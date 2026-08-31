"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Upload,
  X,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
  Table as TableIcon,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

type UploadPhase = "idle" | "uploading" | "extracting" | "processing" | "done" | "error" | "previewing";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [totalChecks, setTotalChecks] = useState(0);
  const [tablePages, setTablePages] = useState("");
  const [checkPages, setCheckPages] = useState("");
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<number>>(new Set());
  const [selectedChecks, setSelectedChecks] = useState<Set<number>>(new Set());
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

  const getAuthToken = useCallback(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp("(^| )auth_token=([^;]+)"));
      if (match) return decodeURIComponent(match[2]);
    }
    return "";
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setPhase("idle");
      setErrorMsg(null);
      setThumbnails([]);
      setSelectedTables(new Set());
      setSelectedChecks(new Set());
      
      // Fetch Thumbnails
      setLoadingThumbnails(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await fetch(`${apiBase}/api/pdf/thumbnails`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getAuthToken()}` },
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setThumbnails(data.thumbnails);
        } else {
          const errorData = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
          console.error("Thumbnail fetch failed:", res.status, errorData);
          setErrorMsg(`PDF Preview Error: ${errorData.detail || 'Could not reach server'}`);
        }
      } catch (err) {
        console.error("Failed to load thumbnails", err);
        setErrorMsg("Network Error: Could not connect to the backend server.");
      } finally {
        setLoadingThumbnails(false);
      }
    }
  }, [apiBase, getAuthToken]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
  });

  const removeFile = () => {
    setFile(null);
    setPhase("idle");
    setErrorMsg(null);
  };

  const processUpload = async () => {
    if (!file) return;
    setPhase("uploading");
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Convert sets to range strings for backend
      const tableRange = Array.from(selectedTables).sort((a,b) => a-b).join(",");
      const checkRange = Array.from(selectedChecks).sort((a,b) => a-b).join(",");
      
      if (tableRange) formData.append("table_pages", tableRange);
      if (checkRange) formData.append("check_pages", checkRange);
      // Support manual overrides if fields were used
      if (tablePages && !tableRange) formData.append("table_pages", tablePages);
      if (checkPages && !checkRange) formData.append("check_pages", checkPages);

      // --- FORCE SCAN LOGIC ---
      // If the user selected pages via thumbnails, we assume they want EVERY check on those pages.
      if (selectedChecks.size > 0 || checkPages.length > 0) {
        formData.append("force_scan", "true");
      }

      // --- FORCE SCAN LOGIC ---
      // If the user selected pages via thumbnails, we assume they want EVERY check on those pages.
      if (selectedChecks.size > 0 || checkPages.length > 0) {
        formData.append("force_scan", "true");
      }

      setPhase("extracting");

      // Bypass Next.js dev proxy for this long-running request to avoid ECONNRESET.
      const uploadUrl = apiBase ? `${apiBase}/api/checks/upload` : "/api/checks/upload";
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setTotalChecks(data.total_checks);
      setPhase("done");

      // Auto-redirect after a brief pause
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  const phaseLabel = {
    idle: "",
    uploading: "Uploading PDF...",
    extracting: "Extracting & processing checks... This may take a moment.",
    processing: "Running AI extraction on checks...",
    done: `Success! ${totalChecks} checks extracted.`,
    error: errorMsg || "An error occurred.",
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 pb-24">
      <div className="w-full max-w-2xl bg-card border border-border-custom rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
        {/* Decorative flair */}
        <div className="absolute top-[-50%] left-[-10%] w-[80%] h-[80%] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-full flex justify-start mb-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-500 hover:text-foreground transition-colors text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-500 dark:text-indigo-400">
            <Upload className="w-8 h-8" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-2 text-center text-foreground">
            Upload Bank Statement
          </h1>
          <p className="text-slate-500 text-center mb-10 pb-6 border-b border-border-custom w-full max-w-sm font-medium">
            Upload a PDF bank statement. All signed checks with MICR values will
            be automatically extracted and processed.
          </p>

          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={cn(
              "w-full cursor-pointer rounded-2xl p-10 border-2 border-dashed transition-all duration-300 bg-black/[0.02] dark:bg-white/[0.02] text-center mb-8",
              isDragActive
                ? "border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/20"
                : "border-slate-300 dark:border-slate-800 hover:border-indigo-500",
              phase !== "idle" && phase !== "error" ? "pointer-events-none opacity-50" : ""
            )}
          >
            <input {...getInputProps()} />
            <p className="text-lg font-bold text-foreground mb-1">
              Select PDF File
            </p>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">
              or drag & drop
            </p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="w-full p-4 mb-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* File Preview */}
          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full space-y-4"
              >
                <div
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-colors",
                    phase === "error"
                      ? "bg-red-500/5 border-red-500/20"
                      : phase === "done"
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : phase === "extracting" || phase === "uploading" || phase === "processing"
                      ? "bg-indigo-500/5 border-indigo-500/20"
                      : "bg-black/5 dark:bg-white/5 border-border-custom"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div
                      className={cn(
                        "p-2.5 rounded-lg shrink-0",
                        phase === "done"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : phase === "error"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-indigo-500/10 text-indigo-500"
                      )}
                    >
                      {phase === "done" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate text-foreground">
                        {file.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>

                  {phase === "idle" || phase === "error" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 ml-2"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : phase !== "done" ? (
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0 ml-2" />
                  ) : null}
                </div>

                {/* Status Message */}
                {phase !== "idle" && (
                  <div
                    className={cn(
                      "text-center text-sm font-medium py-3 px-4 rounded-xl",
                      phase === "done"
                        ? "text-emerald-600 bg-emerald-500/10"
                        : phase === "error"
                        ? "text-red-500"
                        : "text-indigo-500 bg-indigo-500/5"
                    )}
                  >
                    {phase === "extracting" || phase === "uploading" || phase === "processing" ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {phaseLabel[phase]}
                      </span>
                    ) : phase === "done" ? (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {phaseLabel[phase]} Redirecting to dashboard...
                      </span>
                    ) : null}
                  </div>
                )}

                {loadingThumbnails && (
                   <div className="w-full py-12 flex flex-col items-center justify-center gap-4 bg-slate-500/5 rounded-2xl border border-dashed border-border-custom mt-6">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-sm font-medium text-slate-500 italic">Generating page previews...</p>
                   </div>
                )}

                {/* Thumbnail Grid */}
                {thumbnails.length > 0 && !loadingThumbnails && phase === "idle" && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Visual Page Selector</h3>
                       <p className="text-xs text-indigo-500 font-bold">Select Table & Check pages below</p>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto p-2 border border-border-custom rounded-2xl bg-black/5 dark:bg-white/5 custom-scrollbar">
                      {thumbnails.map((b64, idx) => {
                        const pageNum = idx + 1;
                        const isTable = selectedTables.has(pageNum);
                        const isCheck = selectedChecks.has(pageNum);
                        
                        return (
                          <div 
                            key={idx} 
                            onClick={() => {
                              const next = new Set(selectedChecks);
                              if (next.has(pageNum)) next.delete(pageNum);
                              else next.add(pageNum);
                              setSelectedChecks(next);
                            }}
                            className={cn(
                              "relative group rounded-xl border-2 transition-all p-2 cursor-pointer",
                              isCheck ? "bg-indigo-500/5 border-indigo-500 ring-2 ring-indigo-500/20" : 
                              isTable ? "bg-emerald-500/5 border-emerald-500/50" : 
                              "bg-card border-border-custom hover:border-indigo-300"
                            )}
                          >
                            <img 
                              src={`data:image/jpeg;base64,${b64}`} 
                              alt={`Page ${pageNum}`} 
                              className={cn(
                                "w-full aspect-[3/4] object-cover rounded-lg shadow-sm transition-all",
                                isCheck ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                              )}
                            />
                            
                            {/* Overlay check icon when selected */}
                            {isCheck && (
                              <div className="absolute top-4 right-4 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-md">
                                <Check className="w-4 h-4" />
                              </div>
                            )}

                            <div className="mt-2 flex items-center justify-between p-1">
                               <span className={cn(
                                 "text-xs font-bold transition-colors",
                                 isCheck ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 group-hover:text-indigo-500"
                               )}>
                                 Page {pageNum}
                               </span>
                               
                               <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => {
                                      const next = new Set(selectedTables);
                                      if (next.has(pageNum)) next.delete(pageNum);
                                      else next.add(pageNum);
                                      setSelectedTables(next);
                                    }}
                                    className={cn(
                                      "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                                      isTable ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-emerald-500"
                                    )}
                                    title="Set as Summary Table"
                                  >
                                    <TableIcon className="w-3 h-3" />
                                  </button>
                               </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 italic">
                       <span>Legend:</span>
                       <span className="flex items-center gap-1 text-emerald-500"><div className="w-2 h-2 bg-emerald-500 rounded-sm"/> Summary Table</span>
                       <span className="flex items-center gap-1 text-indigo-500"><div className="w-2 h-2 bg-indigo-500 rounded-sm"/> Check Image</span>
                    </div>
                  </div>
                )}

                {/* Manual Page Range Selection (Fallback/Advanced) */}
                {phase === "idle" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-6 bg-slate-500/5 rounded-2xl border border-border-custom">
                    <div className="space-y-2">
                      <label htmlFor="table-pages" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Summary Table Pages
                      </label>
                      <input
                        id="table-pages"
                        type="text"
                        placeholder="e.g. 1-7"
                        value={tablePages}
                        onChange={(e) => setTablePages(e.target.value)}
                        className="w-full bg-background border border-border-custom px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      />
                      <p className="text-[10px] text-slate-400 font-medium">Source of Truth (Date/Amount)</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="check-pages" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Check Image Pages
                      </label>
                      <input
                        id="check-pages"
                        type="text"
                        placeholder="e.g. 8-19"
                        value={checkPages}
                        onChange={(e) => setCheckPages(e.target.value)}
                        className="w-full bg-background border border-border-custom px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      />
                      <p className="text-[10px] text-slate-400 font-medium">Pages to scan for images</p>
                    </div>
                    <div className="md:col-span-2">
                       <p className="text-[11px] text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg font-medium">
                        <b>Blank Slate:</b> Only the specified ranges will be processed.
                       </p>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-2">
                  <button
                    onClick={processUpload}
                    disabled={
                      !file ||
                      phase === "uploading" ||
                      phase === "extracting" ||
                      phase === "processing" ||
                      phase === "done"
                    }
                    className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                  >
                    {phase === "uploading" ||
                    phase === "extracting" ||
                    phase === "processing" ? (
                      <span className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </span>
                    ) : phase === "done" ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        {totalChecks} Checks Extracted
                      </span>
                    ) : (
                      <span>Extract Checks from PDF</span>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
