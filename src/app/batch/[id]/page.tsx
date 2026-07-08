"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Moon,
  Sun,
  XCircle,
  LayoutGrid,
  Download,
  Banknote,
  LogOut,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  FileText,
  Pencil,
  Keyboard,
  History,
  RefreshCw,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useToast } from "../../components/Toast";
import { useConfirm } from "../../components/ConfirmDialog";
import { logout } from "../../login/actions";
import { ProfileDropdown } from "../../../components/layout/profile-dropdown";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CheckStatus = "PENDING" | "MANUAL_REVIEW" | "APPROVED" | "REJECTED";

interface Check {
  id: number;
  check_number: string | null;
  check_date: string | null;
  store_name: string | null;
  payee: string | null;
  amount: number | null;
  memo: string | null;
  bank_name?: string | null;
  routing_number?: string | null;
  account_number?: string | null;
  status: CheckStatus;
  confidence_score: number | null;
  validation_notes: string | null;
  s3_image_url?: string;
}

interface AuditLog {
  id: number;
  user: string;
  action: string;
  changes: Record<string, { old: unknown, new: unknown }>;
  created_at: string;
}

interface BatchDetails {
  batch_id: number;
  batch_number?: number;
  status: CheckStatus;
  created_by: string;
  checks: Check[];
}

/* ─── Copy button ─────────────────────────────────────────────────────── */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ReviewPage() {
  const { id } = useParams();  // batch_number (display only)
  const searchParams = useSearchParams();
  const apiId = searchParams.get("bid") || id; // real batch_id for API calls
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedStatus, setSavedStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [showReviewAnyway, setShowReviewAnyway] = useState(false);

  // Image zoom
  const [zoom, setZoom] = useState(1);
  const changeZoom = (delta: number) => setZoom(z => Math.min(3, Math.max(0.5, parseFloat((z + delta).toFixed(1)))));

  // Batch notes (localStorage)
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const noteInputRef = useRef<HTMLInputElement>(null);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const getAuthRole = useCallback(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )auth_role=([^;]+)'));
      if (match) return decodeURIComponent(match[2]);
    }
    return "ADMIN";
  }, []);

  const getAuthToken = useCallback(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
      if (match) return decodeURIComponent(match[2]);
    }
    return "";
  }, []);

  const fetchHistory = useCallback(async (checkId: number) => {
    setLoadingHistory(true);
    try {
      const role = getAuthRole();
      const res = await fetch(`/api/checks/${checkId}/audit`, {
        headers: { Authorization: `Bearer ${getAuthToken()}`, "X-User-Role": role }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.history);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }, [getAuthRole, getAuthToken]);

  useEffect(() => {
    if (historyOpen && batch?.checks[currentIndex]) {
      fetchHistory(batch.checks[currentIndex].id);
    }
  }, [historyOpen, currentIndex, batch, fetchHistory]);

  const noteKey = `batch_note_${id}`;
  useEffect(() => {
    const saved = localStorage.getItem(noteKey);
    if (saved) setNote(saved);
  }, [noteKey]);

  const saveNote = () => {
    localStorage.setItem(noteKey, noteInput);
    setNote(noteInput);
    setEditingNote(false);
  };

  // Form State
  const [editForm, setEditForm] = useState<{
    store_name: string; check_number: string; check_date: string;
    payee: string; amount: string; memo: string;
    bank_name: string; routing_number: string; account_number: string;
    status: string;
  }>({
    store_name: "", check_number: "", check_date: "",
    payee: "", amount: "", memo: "",
    bank_name: "", routing_number: "", account_number: "",
    status: "APPROVED"
  });

  const fetchBatch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const role = getAuthRole();
      const res = await fetch(`/api/checks/batch/${apiId}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}`, "X-User-Role": role }
      });
      if (res.status === 401) { await logout(); return; }
      if (!res.ok) throw new Error("Failed to fetch batch data");
      const data = await res.json();
      setBatch(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
      // Explicit connection error check
      if (msg.includes("fetch")) {
        toast.error("Backend server unreachable. Please check if the service is running.");
      } else {
        toast.error(msg);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [apiId, getAuthRole, getAuthToken, toast]);

  useEffect(() => {
    fetchBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  const pendingChecks = batch?.checks.filter(c => showReviewAnyway || c.status === "PENDING" || c.status === "MANUAL_REVIEW") || [];
  const currentCheck = pendingChecks[currentIndex];

  useEffect(() => {
    if (currentCheck) {
      setEditForm({
        store_name: currentCheck.store_name || "", check_number: currentCheck.check_number || "",
        check_date: currentCheck.check_date || "", payee: currentCheck.payee || "",
        amount: currentCheck.amount ? currentCheck.amount.toString() : "", memo: currentCheck.memo || "",
        bank_name: currentCheck.bank_name || "", routing_number: currentCheck.routing_number || "",
        account_number: currentCheck.account_number || "", status: currentCheck.status
      });
      setSaveSuccess(false);
    }
  }, [currentIndex, currentCheck]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (pendingChecks.length === 0) return;
      if (e.key === "ArrowLeft") setCurrentIndex(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setCurrentIndex(i => Math.min(pendingChecks.length - 1, i + 1));
      if (e.key === "a" || e.key === "A") handleSave("APPROVED");
      if (e.key === "r" || e.key === "R") handleSave("REJECTED");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChecks, currentIndex, editForm]);




  const handleSave = useCallback(async (status: CheckStatus, form = editForm) => {
    if (!currentCheck) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const role = getAuthRole();
      const res = await fetch(`/api/checks/${currentCheck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}`, "X-User-Role": role },
        body: JSON.stringify({
          status,
          store_name: form.store_name, check_number: form.check_number,
          check_date: form.check_date, payee: form.payee,
          amount: parseFloat(form.amount) || null, memo: form.memo,
          bank_name: form.bank_name, routing_number: form.routing_number,
          account_number: form.account_number
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update check");
      }
      setBatch(prev => {
        if (!prev) return prev;
        const newChecks = [...prev.checks];
        newChecks[currentIndex] = {
          ...newChecks[currentIndex], status,
          store_name: form.store_name, check_number: form.check_number,
          check_date: form.check_date, payee: form.payee,
          amount: parseFloat(form.amount) || null, memo: form.memo,
          bank_name: form.bank_name, routing_number: form.routing_number,
          account_number: form.account_number
        };
        return { ...prev, checks: newChecks };
      });
      setSaveSuccess(true);
      setSavedStatus(status as "APPROVED" | "REJECTED");
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // If we are approving the very last pending check, route back to the Dashboard
      if (pendingChecks.length === 1 && status === "APPROVED") {
        toast.success("Batch completed! Returning to Dashboard...");
        setTimeout(() => router.push("/"), 1500);
      } else if (currentIndex > 0 && currentIndex === pendingChecks.length - 1) {
        setCurrentIndex(currentIndex - 1);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCheck, currentIndex, editForm, batch]);

  const handleApproveAll = async () => {
    if (!batch) return;
    const pending = batch.checks.filter(c => c.status !== "APPROVED" && c.status !== "REJECTED");
    if (pending.length === 0) { toast.info("All checks are already processed."); return; }

    const ok = await confirm({
      title: 'Bulk Approve Batch',
      message: `Are you sure you want to approve all ${pending.length} remaining unprocessed check(s)? This will set their status to Approved instantly.`,
      confirmLabel: 'Approve All',
      cancelLabel: 'Cancel',
      variant: 'warning',
    });
    if (!ok) return;

    setApprovingAll(true);
    try {
      const role = getAuthRole();
      const res = await fetch(`/api/checks/batch/${apiId}/approve_all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "X-User-Role": role },
      });
      if (!res.ok) throw new Error("Bulk approve failed");
      
      toast.success(`Successfully approved all checks!`);
      // Refresh data
      await fetchBatch(true);
      setShowReviewAnyway(false); // Go to summary
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bulk approve failed");
    } finally {
      setApprovingAll(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch(`/api/checks/export?batch_id=${batch?.batch_id}`, {
        headers: { Authorization: "Bearer local-dev-token" },
      });
      if (!res.ok) throw new Error("Failed to export batch");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const displayNum = batch?.batch_number ?? batch?.batch_id;
      a.download = `QuickTrack_Batch_${displayNum}_Export.xlsx`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
      toast.success("Excel report exported successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? "Export failed: " + err.message : "Export failed");
    }
  };

  const handlePrint = () => window.print();

  /* ─── Loading skeleton ───────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-16 border-b border-border-custom bg-card flex items-center px-6 gap-4 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-white/10" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-black/5 dark:bg-[#0a0a0a] animate-pulse" />
          <div className="w-full md:w-[450px] bg-card border-l border-border-custom p-8 space-y-5 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Error / Empty ──────────────────────────────────────────────────── */
  if (error || !batch || batch.checks.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 rounded-full bg-red-500/10 mb-6">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">No Records Found</h2>
        <p className="text-slate-500 mb-8 max-w-md">
          {error || "This batch appears to be empty."}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/upload" className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">
            Start New Batch
          </Link>
          <Link href="/" className="px-8 py-3 bg-card border border-border-custom text-foreground font-bold rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const allProcessed = batch.checks.every(c => c.status === "APPROVED" || c.status === "REJECTED");

  /* ─── Completed Summary View ─────────────────────────────────────────── */
  if (allProcessed && !showReviewAnyway) {
    return (
      <main className="min-h-screen bg-[#04060A] text-slate-300 p-8 flex flex-col items-center selection:bg-indigo-500/30">

        {/* Print styles (hidden in normal view) */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white; color: black; }
            .print-table { color: black; }
          }
        `}</style>

        <div className="w-full max-w-5xl mb-6 flex items-center justify-between no-print">
          <Link href="/" className="mb-4 text-xs font-bold text-[#565C68] hover:text-indigo-400 transition-colors flex items-center gap-2 uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            {note && (
              <span className="text-xs text-slate-500 italic border border-white/10 px-3 py-1 rounded-full">
                📝 {note}
              </span>
            )}
            <div className={cn(
              "px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2",
              batch.checks.every(c => c.status === "APPROVED")
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-amber-500/10 border-amber-500/20 text-amber-500"
            )}>
              {batch.checks.every(c => c.status === "APPROVED") ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Batch Fully Approved</>
              ) : (
                <><AlertCircle className="w-3.5 h-3.5" /> Processed with Rejections</>
              )}
            </div>
          </div>
        </div>

        <div className="w-full max-w-5xl bg-[#0B101A] border border-white/5 rounded-2xl overflow-hidden shadow-2xl print-table">
          {/* Success Banner */}
          <div className={cn("w-full border-b p-4 flex items-center justify-center gap-3",
            batch.checks.every(c => c.status === "APPROVED") ? "bg-emerald-500/5 border-emerald-500/10" : "bg-amber-500/5 border-amber-500/10"
          )}>
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center",
              batch.checks.every(c => c.status === "APPROVED") ? "bg-emerald-500" : "bg-amber-500"
            )}>
              {batch.checks.every(c => c.status === "APPROVED") ? <CheckCircle2 className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-tight">Batch Processed Successfully</span>
              <span className="text-xs text-slate-500">
                {batch.checks.every(c => c.status === "APPROVED")
                  ? "All records have been validated and are ready for export."
                  : "Validation complete. Some records were rejected."}
              </span>
            </div>
          </div>

          <div className="p-6 md:p-8 flex flex-row items-center justify-between border-b border-white/5 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl">
                <LayoutGrid className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  Batch #{batch.batch_number ?? batch.batch_id}
                  {note && <span className="ml-2 text-sm font-normal text-slate-500 italic">— {note}</span>}
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">
                  {batch.checks.filter(c => c.status === "APPROVED").length} Approved / {batch.checks.length} Total
                  {' · '}
                  Total: ${batch.checks.filter(c => c.status === "APPROVED").reduce((sum, c) => sum + (c.amount || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 no-print">
              <button
                onClick={() => setShowReviewAnyway(true)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Edit Data
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                <FileText className="w-4 h-4" /> Print Report
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" /> Download Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 px-8 py-4 bg-white/[0.02] border-b border-white/5 text-[11px] font-bold uppercase tracking-widest text-[#565C68]">
            <div>Cheque Details</div>
            <div>Recipient & Value</div>
            <div>MICR Footer</div>
          </div>

          <div className="divide-y divide-white/5">
            {batch.checks.map(check => (
              <div key={check.id} className={cn(
                "grid grid-cols-3 gap-4 px-8 py-6 hover:bg-white/[0.02] transition-colors",
                check.status === "REJECTED" && "opacity-50 grayscale"
              )}>
                <div className="flex flex-col gap-1.5 justify-center">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">#{check.check_number || "N/A"}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                      check.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                    )}>
                      {check.status}
                    </span>
                  </div>
                  <span className="text-sm text-[#565C68] font-medium">{check.check_date || "N/A"} | {check.bank_name || "N/A"}</span>
                  <span className="text-sm italic text-indigo-400 font-medium">M: {check.memo || "N/A"}</span>
                </div>

                <div className="flex flex-col gap-1.5 justify-center">
                  <span className="text-sm text-indigo-300 font-bold">{check.payee || "N/A"}</span>
                  <span className="text-xl font-bold text-emerald-500 flex items-center gap-1.5">
                    <Banknote className="w-5 h-5 opacity-80" />
                    ${check.amount ? check.amount.toFixed(2) : "0.00"}
                  </span>
                </div>

                <div className="flex flex-col gap-3 justify-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#565C68] mb-0.5">Routing</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-slate-300 tracking-wider">{check.routing_number || "N/A"}</span>
                      {check.routing_number && <CopyButton value={check.routing_number} />}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#565C68] mb-0.5">Account</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-slate-300 tracking-wider">{check.account_number || "N/A"}</span>
                      {check.account_number && <CopyButton value={check.account_number} />}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  /* ─── Review / Edit View ─────────────────────────────────────────────── */
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col h-screen overflow-hidden selection:bg-indigo-500/30">

      {/* Top Navigation Bar */}
      <header className="flex-shrink-0 h-16 border-b border-border-custom bg-card flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground leading-tight">
                Batch #{batch.batch_number ?? batch.batch_id} Review
              </span>
              {/* Batch note */}
              {editingNote ? (
                <form onSubmit={e => { e.preventDefault(); saveNote(); }} className="flex items-center gap-1">
                  <input
                    ref={noteInputRef}
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="Add a note..."
                    className="text-xs px-2 py-1 rounded-lg border border-border-custom bg-black/5 dark:bg-white/5 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
                  />
                  <button type="submit" className="p-1 rounded text-emerald-500 hover:text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => setEditingNote(false)} className="p-1 rounded text-slate-400 hover:text-slate-300"><XCircle className="w-3.5 h-3.5" /></button>
                </form>
              ) : (
                <button
                  onClick={() => { setNoteInput(note); setEditingNote(true); setTimeout(() => noteInputRef.current?.focus(), 50); }}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  <span>{note || "Add note"}</span>
                </button>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{currentIndex + 1} of {pendingChecks.length} Checks</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Keyboard shortcut hint */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[10px] font-mono text-slate-500">
            <Keyboard className="w-3 h-3 mr-1" />
            <kbd>←</kbd><kbd>→</kbd> navigate · <kbd>A</kbd> approve · <kbd>R</kbd> reject
          </div>

          {/* History */}
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={cn(
              "hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
              historyOpen ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" : "bg-black/5 dark:bg-white/5 text-slate-500 border-transparent hover:bg-black/10 dark:hover:bg-white/10"
            )}
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>

          {!allProcessed && (
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all border border-emerald-500/20 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {approvingAll ? "Approving..." : "Bulk Approve"}
            </button>
          )}

          <div className="w-px h-6 bg-border-custom mx-1" />

          <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentIndex(Math.min(pendingChecks.length - 1, currentIndex + 1))} disabled={currentIndex >= pendingChecks.length - 1}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border-custom mx-2" />

          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-500">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <ProfileDropdown logoutAction={logout} />
        </div>
      </header>

      {/* Main Split Screen */}
      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">

        {/* Left: Check Image Viewer */}
        <div className="h-52 md:h-auto md:flex-1 bg-black/5 dark:bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-border-custom relative flex flex-col overflow-hidden">
          {/* Zoom controls — bottom-right to avoid overlapping the confidence banner */}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-xl px-2 py-1.5">
            <button onClick={() => changeZoom(-0.2)} className="p-1 text-slate-300 hover:text-white transition-colors" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-[11px] font-bold text-slate-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => changeZoom(0.2)} className="p-1 text-slate-300 hover:text-white transition-colors" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
          </div>

          {currentCheck?.s3_image_url ? (
            <div
              className="flex-1 w-full h-full flex items-center justify-center overflow-auto p-4 md:p-8"
              onWheel={e => { e.preventDefault(); changeZoom(e.deltaY < 0 ? 0.1 : -0.1); }}
            >
              {currentCheck.s3_image_url.toLowerCase().includes(".pdf") ? (
                <iframe src={currentCheck.s3_image_url}
                  className="w-full h-full rounded-xl shadow-2xl border border-border-custom bg-white"
                  title="Check Scan PDF"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s ease" }}
                />
              ) : (
                <img src={currentCheck.s3_image_url} alt="Check Scan"
                  className="max-w-full h-auto rounded-xl shadow-2xl border border-border-custom object-contain bg-white"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.15s ease" }}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 w-full h-full flex flex-col items-center justify-center text-slate-400 p-8">
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p className="font-medium">Image Not Available</p>
            </div>
          )}

          {/* Confidence Banner */}
          {currentCheck?.status === "MANUAL_REVIEW" && (
            <div className="absolute top-4 left-4 right-16 bg-amber-500/90 backdrop-blur-md text-amber-950 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Manual Review Required</span>
                  <span className="text-xs opacity-80">{currentCheck.validation_notes}</span>
                </div>
              </div>
              <span className="text-xs font-bold uppercase py-1 px-2 rounded-lg bg-black/10">
                AI Confidence: {Math.round((currentCheck.confidence_score || 0) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Data Edit Form */}
        <div className="w-full md:w-[450px] lg:w-[500px] flex flex-col bg-card overflow-y-auto">
          <div className="p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Extraction Data</h2>
              <p className="text-sm text-slate-500">Edit any misread fields from the scan before approving.</p>
            </div>

            <form className="space-y-5" onSubmit={e => { e.preventDefault(); handleSave("APPROVED"); }}>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Store Name</label>
                <input type="text" value={editForm.store_name} onChange={e => setEditForm({ ...editForm, store_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
              </div>

              <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Check #</label>
                  <input type="text" value={editForm.check_number} onChange={e => setEditForm({ ...editForm, check_number: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date (YYYY-MM-DD)</label>
                  <input type="text" value={editForm.check_date} onChange={e => setEditForm({ ...editForm, check_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Payee</label>
                <input type="text" value={editForm.payee} onChange={e => setEditForm({ ...editForm, payee: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
              </div>

              <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount ($)</label>
                  <input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Name</label>
                <input type="text" value={editForm.bank_name} onChange={e => setEditForm({ ...editForm, bank_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Memo</label>
                <input type="text" value={editForm.memo} onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
              </div>

              <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Routing #</label>
                    {currentCheck?.validation_notes?.includes("Math repair") || currentCheck?.validation_notes?.includes("tesseract") ? (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/20">🔧 Auto-Corrected</span>
                    ) : currentCheck?.validation_notes?.includes("Routing Number") ? (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/20">⚠ Check Routing</span>
                    ) : editForm.routing_number && editForm.routing_number.length === 9 ? (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">✓ Valid</span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <input type="text" value={editForm.routing_number} onChange={e => setEditForm({ ...editForm, routing_number: e.target.value })}
                      className="w-full px-4 py-3 pr-10 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
                    {editForm.routing_number && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CopyButton value={editForm.routing_number} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Account #</label>
                  <div className="relative">
                    <input type="text" value={editForm.account_number} onChange={e => setEditForm({ ...editForm, account_number: e.target.value })}
                      className="w-full px-4 py-3 pr-10 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all" />
                    {editForm.account_number && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CopyButton value={editForm.account_number} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-border-custom my-8" />

              <AnimatePresence>
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "mb-4 p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2",
                      savedStatus === "APPROVED"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                    )}
                  >
                    {savedStatus === "APPROVED" ? (
                      <><CheckCircle2 className="w-4 h-4" /> Check Approved &amp; Saved!</>
                    ) : (
                      <><XCircle className="w-4 h-4" /> Check Rejected &amp; Saved.</>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => handleSave("REJECTED")} disabled={saving}
                  className="flex flex-col items-center justify-center w-24 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors disabled:opacity-50">
                  <XCircle className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase">Reject (R)</span>
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none">
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Approve (A)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* History Sidebar */}
        {historyOpen && (
          <div className="w-full md:w-[320px] lg:w-[400px] border-l border-border-custom bg-white dark:bg-zinc-900 flex flex-col p-6 overflow-y-auto">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6 flex items-center gap-2">
              <History className="w-4 h-4" /> Audit History
            </h3>
            {loadingHistory ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center p-8 text-sm text-slate-500">No history found for this check.</div>
            ) : (
              <div className="space-y-6">
                {auditLogs.map(log => (
                  <div key={log.id} className="text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold flex items-center gap-1.5 text-foreground">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] uppercase">
                          {log.user.slice(0, 1)}
                        </span>
                        {log.user}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 space-y-2">
                      <div className="text-xs font-bold text-slate-500 uppercase">{log.action}</div>
                      {Object.entries(log.changes || {}).map(([field, vals]) => (
                        <div key={field} className="grid grid-cols-3 gap-2 text-xs">
                          <span className="font-medium text-slate-500 truncate" title={field}>{field.replace(/_/g, ' ')}:</span>
                          <span className="text-red-500 line-through truncate" title={String(vals.old || 'none')}>{String(vals.old || 'none')}</span>
                          <span className="text-emerald-500 truncate" title={String(vals.new || 'none')}>→ {String(vals.new || 'none')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
