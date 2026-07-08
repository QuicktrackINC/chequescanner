import fitz
import re
from typing import Dict, Tuple, List, Optional
import logging
import io

logger = logging.getLogger("quicktrack")

def extract_table_data(pdf_bytes: bytes, page_indices: Optional[List[int]] = None) -> Dict[str, Tuple[str, float]]:
    """
    Extracts the source-of-truth table mapping Check Number -> (Date, Amount).
    
    Args:
        pdf_bytes: Raw bytes of the PDF.
        page_indices: Optional 0-based list of page numbers to scan. 
                     If None, defaults to scanning first 7 pages.
    
    Returns:
        Dict mapping check_number (str) -> (ISO date string, amount float)
    """
    check_data = {}
    
    # Matches dates like 02/15 or 02-15 or 02/15/26
    date_pattern = re.compile(r'^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$')
    statement_year = "2026" # Fallback based on known dataset
    
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as pdf:
            # 1. Try to dynamically extract statement year from page 1
            if len(pdf) > 0:
                first_page_text = pdf[0].get_text() or ""
                year_matches = re.findall(r'20\d{2}', first_page_text)
                if year_matches:
                    statement_year = year_matches[0]
            
            # 2. Determine which pages to scan
            if page_indices is not None:
                scan_pages = [p for p in page_indices if p < len(pdf)]
            else:
                # Default: scan first 7 pages (where header tables usually are)
                # INCREASED limit to 10 just in case summary is slightly later
                scan_pages = range(min(10, len(pdf)))
            
            for i in scan_pages:
                page = pdf[i]
                words = page.get_text("words")
                
                # Group words into lines based on Y coordinate (vertical). 
                # Tolerance of 3 points is standard for slight PDF misalignments.
                lines = {}
                for w in words:
                    # w is (x0, y0, x1, y1, "word", block_no, line_no, word_no)
                    y0 = round(w[1] / 3) * 3
                    if y0 not in lines:
                        lines[y0] = []
                    lines[y0].append({'x0': w[0], 'text': w[4]})
                
                # Process line by line
                for y0 in sorted(lines.keys()):
                    # Sort left-to-right
                    line_words = sorted(lines[y0], key=lambda w: w['x0'])
                    texts = [w['text'] for w in line_words]
                    
                    # Scan across the words in this line looking for triplets
                    # We jump 3 words at a time if we find a match to avoid overlapping false positives
                    j = 0
                    while j < len(texts) - 2:
                        match_found = False
                        
                        # Possible patterns:
                        # 1. DATE, NUMBER, AMOUNT
                        # 2. NUMBER, DATE, AMOUNT
                        
                        m_date = None
                        chk_text = None
                        amt_text = None
                        
                        # Try Pattern 1: DATE, NUMBER, AMOUNT
                        m_date = date_pattern.match(texts[j])
                        if m_date:
                            chk_text = texts[j+1].replace('*', '').strip()
                            amt_text = texts[j+2].replace('$', '').replace(',', '').strip()
                        else:
                            # Try Pattern 2: NUMBER, DATE, AMOUNT
                            m_date = date_pattern.match(texts[j+1])
                            if m_date:
                                chk_text = texts[j].replace('*', '').strip()
                                amt_text = texts[j+2].replace('$', '').replace(',', '').strip()
                        
                        if m_date and chk_text and chk_text.isdigit() and len(chk_text) >= 3:
                            # Clean up amount string carefully
                            is_negative = False
                            if amt_text.endswith('-'):
                                is_negative = True
                                amt_text = amt_text[:-1]
                            elif amt_text.startswith('-'):
                                is_negative = True
                                amt_text = amt_text[1:]
                            
                            # Check if it's a valid float
                            if amt_text.replace('.', '', 1).isdigit():
                                try:
                                    amount = float(amt_text)
                                    if is_negative: amount = -amount
                                    amount = abs(amount)
                                    
                                    m, d, y = m_date.groups()
                                    if not y:
                                        y = statement_year
                                    elif len(y) == 2:
                                        y = "20" + y
                                        
                                    iso_date = f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
                                    check_data[chk_text] = (iso_date, amount)
                                    match_found = True
                                    j += 3 # Move past this triplet
                                except ValueError:
                                    pass
                        
                        if not match_found:
                            j += 1

    except Exception as e:
        logger.error(f"Failed to extract table data: {e}", exc_info=True)
        
    logger.info(f"Table Extractor found {len(check_data)} checks in summary tables.")
    return check_data
