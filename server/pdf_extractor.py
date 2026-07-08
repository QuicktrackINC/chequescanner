"""
PDF Check Extractor Module
Extracts signed check images from bank statement PDFs.
"""
import io
import fitz  # PyMuPDF
from PIL import Image, ImageFilter, ImageOps
from typing import List, Tuple, Optional
import re
import logging

logger = logging.getLogger("quicktrack")
def _normalize_image(img: Image.Image) -> Image.Image:
    """Convert any image mode to grayscale with white background."""
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        alpha = img.convert('RGBA').split()[-1]
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        bg.paste(img, mask=alpha)
        return bg.convert('L')
    return img.convert('L')


def _is_signed_check(img_gray: Image.Image) -> Tuple[bool, str]:
    """
    Determine if an image is a signed check with MICR values.
    Returns (True, "found") or (False, "reason for skip").
    """
    W, H = img_gray.size
    aspect_ratio = W / H
    
    # Check dimensions
    if W < 700:
        return False, f"too small (W={W})"
    if H < 180:
        return False, f"too short (H={H})"
    if aspect_ratio < 1.7:
        return False, f"too square (AR={aspect_ratio:.2f})"
    if aspect_ratio > 3.8:
        return False, f"too wide (AR={aspect_ratio:.2f})"

    # Get raw bytes for fast processing
    pixels = img_gray.tobytes()
    total_pixels = W * H
    
    # Count ink pixels (threshold < 185)
    ink_count = sum(1 for p in pixels if p < 185)
    total_ink_ratio = ink_count / float(total_pixels)
    
    if total_ink_ratio > 0.35:
        return False, f"too dense ({total_ink_ratio:.1%})"
    if total_ink_ratio < 0.001:
        return False, f"too sparse ({total_ink_ratio:.1%})"

    # --- Vertical Distribution Check ---
    mid_start = int(0.33 * H) * W
    mid_end = int(0.66 * H) * W
    mid_pixels = pixels[mid_start:mid_end]
    mid_density = sum(1 for p in mid_pixels if p < 185) / float(len(mid_pixels))
    
    if mid_density > 0.15:
        return False, f"middle too dense ({mid_density:.3f})"

    # --- Specific ROI checks ---
    # Signature region: bottom-right quadrant
    sig_y_start = int(0.65 * H)
    sig_y_end = int(0.95 * H)
    sig_x_start = int(0.65 * W)
    sig_x_end = int(0.98 * W)
    
    sig_ink = 0
    sig_total = (sig_y_end - sig_y_start) * (sig_x_end - sig_x_start)
    for y in range(sig_y_start, sig_y_end):
        row_start = y * W + sig_x_start
        row_end = y * W + sig_x_end
        sig_ink += sum(1 for p in pixels[row_start:row_end] if p < 185)
        
    sig_ratio = sig_ink / float(sig_total)
    if sig_ratio < 0.008:
        return False, f"signature check failed ({sig_ratio:.3f})"

    # Bottom strip: MICR
    micr_y_start = int(0.85 * H)
    micr_y_end = int(0.99 * H)
    micr_x_start = int(0.10 * W)
    micr_x_end = int(0.90 * W)
    
    micr_ink = 0
    micr_total = (micr_y_end - micr_y_start) * (micr_x_end - micr_x_start)
    for y in range(micr_y_start, micr_y_end):
        row_start = y * W + micr_x_start
        row_end = y * W + micr_x_end
        micr_ink += sum(1 for p in pixels[row_start:row_end] if p < 185)
        
    micr_density = micr_ink / float(micr_total)
    if micr_density < 0.003:
        return False, f"MICR strip check failed ({micr_density:.3f})"

    return True, "valid check"


def parse_range_string(range_str: str, max_pages: int) -> List[int]:
    """
    Parses a string like "1, 3, 5-10" into a list of 0-based page indices.
    """
    if not range_str or not range_str.strip():
        return []

    indices = set()
    parts = range_str.split(',')
    
    for part in parts:
        part = part.strip()
        if '-' in part:
            try:
                start, end = map(int, part.split('-'))
                # User enters 1-based, we convert to 0-based
                for p in range(start, end + 1):
                    if 1 <= p <= max_pages:
                        indices.add(p - 1)
            except ValueError:
                continue
        elif part.isdigit():
            p = int(part)
            if 1 <= p <= max_pages:
                indices.add(p - 1)
                
    return sorted(list(indices))


def extract_checks_from_pdf(pdf_bytes: bytes, page_indices: Optional[List[int]] = None, force_scan: bool = False) -> List[Tuple[bytes, str]]:
    """
    Extract all signed check images from a bank statement PDF.
    
    Args:
        pdf_bytes: Raw bytes of the PDF file.
        page_indices: Optional list of 0-based page indices to process.
        
    Returns:
        List of (image_bytes_png, filename) tuples for each detected check.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    checks: List[Tuple[bytes, str]] = []
    img_counter = 0

    # Determine which pages to scan
    pages_to_scan = page_indices if page_indices is not None else range(doc.page_count)
    msg = f"[EXTRACTOR] Starting scan on {len(pages_to_scan)} pages (Force={force_scan}): {[p+1 for p in pages_to_scan]}"
    print(msg) # Ensure visibility in terminal
    logger.info(msg)

    for page_num in pages_to_scan:
        if page_num >= doc.page_count:
            continue
            
        page = doc[page_num]
        
        # --- Structural Anchoring ---
        # Find the header "Checks and Other Debits" to avoid capturing logos above it
        search_zone_y_min = 0
        text_instances = page.search_for("Checks and Other Debits")
        if text_instances:
            search_zone_y_min = text_instances[0].y0 - 20
        
        images = page.get_images(full=True)

        for img_info in images:
            xref = img_info[0]
            width = img_info[2]
            height = img_info[3]

            # Skip tiny images (logos, icons, or narrow fragments)
            if width < 400 or height < 200:
                continue

            # --- Explicit Range & Page Logging ---
            # CONFIRM: Are we on a page we are supposed to be scanning?
            if page_num not in pages_to_scan: # Should never happen due to for-loop but good to be certain
                logger.warning(f"CRITICAL: Scanning page {page_num+1} which is NOT in range {pages_to_scan}")
                continue

            try:
                # --- Image Extraction & DNA Validation ---
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]

                img = Image.open(io.BytesIO(image_bytes))
                img_gray = _normalize_image(img)
                W, H = img_gray.size

                pixels = img_gray.tobytes()
                
                # Approximate mean_val using first 1000 pixels for speed
                sample_pixels = pixels[:min(1000, len(pixels))]
                mean_val = sum(sample_pixels) / len(sample_pixels) if sample_pixels else 255

                # Handle inverted (black background) images
                if mean_val < 127:
                    img_gray = ImageOps.invert(img_gray)

                # --- SCAN LOGIC ---
                if force_scan:
                    # When force_scan is true (manual selection), we skip all DNA/Dimension filters
                    # We only check for absolute tiny images (logos)
                    if W < 300 or H < 100:
                        logger.info(f"Page {page_num+1} img {xref}: Skipped even in Force mode (too tiny W={W}, H={H})")
                        continue
                    is_check, reason = True, "forced"
                else:
                    is_check, reason = _is_signed_check(img_gray)

                if is_check:
                    # Convert the original image to JPEG for storage
                    # (re-open from original bytes to preserve quality)
                    original_img = Image.open(io.BytesIO(image_bytes))
                    
                    # If inverted, invert back for display
                    if mean_val < 127:
                        if original_img.mode in ('L', 'RGB', 'RGBA'):
                            # Need to handle alpha carefully or just convert to RGB first
                            if original_img.mode == 'RGBA':
                                # Split and invert RGB, keep A
                                r, g, b, a = original_img.split()
                                r, g, b = ImageOps.invert(r), ImageOps.invert(g), ImageOps.invert(b)
                                original_img = Image.merge('RGBA', (r, g, b, a))
                            else:
                                original_img = ImageOps.invert(original_img)
                    
                    # --- Natural Grayscale Processing for AI OCR ---
                    # 1. Grayscale & Contrast
                    proc_img = original_img.convert('L')
                    proc_img = ImageOps.autocontrast(proc_img, cutoff=1)
                    
                    # 2. Subtle Sharpening (better for GPT-4o-mini than binary conversion)
                    proc_img = proc_img.filter(ImageFilter.SHARPEN)
                    
                    # We no longer binarize or dilate, as it distorts characters for modern AI.
                    original_img = proc_img
                    
                    buf = io.BytesIO()
                    original_img.convert('RGB').save(buf, format='JPEG', quality=95) # Higher quality for OCR
                    jpeg_bytes = buf.getvalue()

                    filename = f"check_p{page_num + 1}_{img_counter}.jpg"
                    checks.append((jpeg_bytes, filename))
                    img_counter += 1
                else:
                    if W > 500: # Only log reasoning for larger images to avoid spam
                        logger.info(f"Page {page_num+1} img {xref}: Skipped ({reason})")

            except Exception:
                continue

    doc.close()
    return checks
