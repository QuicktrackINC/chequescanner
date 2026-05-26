"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {

  FileText,
  CheckCircle2,
  Table as TableIcon,
  Download,
  AlertCircle,
  Moon,
  Sun,
  Eye,
  Clock,
  Search,
  Plus,
  Trash2,
  Activity,
  CheckSquare,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
  Filter,
  Users
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useToast } from "./components/Toast";
import { useConfirm } from "./components/ConfirmDialog";
import { logout } from "./login/actions";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ─── Relative time ─────────────────────────────────────────────────── */
function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

type CheckStatus = "PENDING" | "MANUAL_REVIEW" | "APPROVED" | "REJECTED";
type StatusFilter = "ALL" | CheckStatus;
type DateFilter = "ALL" | "WEEK" | "MONTH";

interface Batch {
  batch_id: number;
  batch_number: number;
  status: CheckStatus;
  created_by: string;
  created_at?: string;
  total_checks?: number;
  approved_checks?: number;
}

interface Stats {
  total_batches: number;
  pending_checks: number;
  review_checks: number;
  approved_today: number;
}

/* ─── Skeleton Components ────────────────────────────────────────────── */
function SkeletonStatCard() {
  return (
    <div className="bg-card border border-border-custom rounded-3xl p-6 flex flex-col shadow-lg backdrop-blur-md animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10" />
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
      </div>
      <div className="h-10 w-20 rounded bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10" />
          <div className="space-y-2">
            <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-3 w-16 rounded bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
      </td>
      <td className="px-6 py-5"><div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-white/10" /></td>
      <td className="px-6 py-5"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-white/10" /></td>
      <td className="px-6 py-5"><div className="h-2 w-40 rounded-full bg-slate-200 dark:bg-white/10" /></td>
      <td className="px-6 py-5">
        <div className="flex gap-2 justify-end">
          <div className="h-9 w-20 rounded-xl bg-slate-200 dark:bg-white/10" />
          <div className="h-9 w-20 rounded-xl bg-slate-200 dark:bg-white/10" />
          <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-white/10" />
        </div>
      </td>
    </tr>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function Dashboard() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  // Filtering & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const role = getAuthRole();
      const headers = { Authorization: `Bearer ${getAuthToken()}`, "X-User-Role": role };

      // Build query string for filtering
      const params = new URLSearchParams();
      params.append("skip", "0");
      params.append("limit", "1000"); // Standard high limit for dashboard
      
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchQuery.length > 2) params.append("created_by", searchQuery);
      
      if (dateFilter !== "ALL") {
        const d = new Date();
        if (dateFilter === "WEEK") d.setDate(d.getDate() - 7);
        if (dateFilter === "MONTH") d.setMonth(d.getMonth() - 1);
        params.append("start_date", d.toISOString().split('T')[0]);
      }

      const [statsRes, batchRes] = await Promise.all([
        fetch("/api/checks/stats", { headers }),
        fetch(`/api/checks/batches?${params.toString()}`, { headers }),
      ]);

      if (statsRes.status === 401 || batchRes.status === 401) {
        // Clear tokens and redirect
        document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        document.cookie = "auth_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        document.cookie = "last_active=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        router.push("/login?error=Session+expired.+Please+sign+in+again.");
        return;
      }

      if (statsRes.ok) setStats(await statsRes.json());
      if (!batchRes.ok) throw new Error("Failed to load batches");
      const data = await batchRes.json();
      setBatches(data.batches || []);
    } catch (err: unknown) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Failed to load batches");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [getAuthRole, getAuthToken, statusFilter, dateFilter, searchQuery, toast, router]);

  useEffect(() => {
    setMounted(true);
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [statusFilter, dateFilter, searchQuery, fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const deleteBatch = async (batchId: number, batchNumber: number) => {
    const ok = await confirm({
      title: 'Delete Batch',
      message: `This will permanently delete Batch #${batchNumber} and all its check data. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    // Optimistic delete
    const prev = batches;
    setBatches(b => b.filter(x => x.batch_id !== batchId));
    try {
      const role = getAuthRole();
      const res = await fetch(`/api/checks/batch/${batchId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "X-User-Role": role },
      });
      if (!res.ok) throw new Error("Failed to delete batch");
      toast.success(`Batch #${batchNumber} deleted.`);
      fetchData(true); // silently refresh stats
    } catch (err: unknown) {
      setBatches(prev); // revert
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleExport = async (batchId: number, format: "excel" | "csv", batchNumber?: number) => {
    try {
      const endpoint =
        format === "csv"
          ? `/api/checks/export/csv?batch_id=${batchId}`
          : `/api/checks/export?batch_id=${batchId}`;

      const role = getAuthRole();
      const res = await fetch(endpoint, { headers: { Authorization: "Bearer local-dev-token", "X-User-Role": role } });
      if (!res.ok) throw new Error("Failed to export batch");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QuickTrack_Batch_${batchNumber ?? batchId}_Export.${format === "csv" ? "csv" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success(`Batch #${batchNumber ?? batchId} exported as ${format.toUpperCase()}.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? "Export failed: " + err.message : "Export failed");
    }
  };

  const getStatusColor = (status: CheckStatus) => {
    switch (status) {
      case "APPROVED": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "MANUAL_REVIEW": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "REJECTED": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  /* ─── Filtering ─────────────────────────────────────────────────────── */
  const filteredBatches = useMemo(() => {
    const now = Date.now();
    return batches.filter(batch => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          batch.batch_number?.toString().includes(q) ||
          batch.created_by?.toLowerCase().includes(q) ||
          batch.status?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && batch.status !== statusFilter) return false;
      // Date filter
      if (dateFilter !== "ALL" && batch.created_at) {
        const age = now - new Date(batch.created_at).getTime();
        if (dateFilter === "WEEK" && age > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === "MONTH" && age > 30 * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [batches, searchQuery, statusFilter, dateFilter]);

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const currentBatches = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBatches.slice(start, start + itemsPerPage);
  }, [filteredBatches, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, dateFilter]);

  if (!mounted) return <div className="min-h-screen bg-background" />;

  const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "Pending", value: "PENDING" },
    { label: "Review", value: "MANUAL_REVIEW" },
    { label: "Approved", value: "APPROVED" },
  ];

  const DATE_FILTERS: { label: string; value: DateFilter }[] = [
    { label: "All Time", value: "ALL" },
    { label: "This Month", value: "MONTH" },
    { label: "This Week", value: "WEEK" },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30">
      {/* Top-right controls */}
      <div className="fixed top-8 right-8 z-50 flex items-center gap-2">
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-3 rounded-2xl bg-card border border-border-custom shadow-xl hover:scale-110 transition-transform duration-300 group"
          title="Refresh Data"
        >
          <RefreshCw className={cn("w-5 h-5 text-indigo-500", refreshing && "animate-spin")} />
        </button>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-3 rounded-2xl bg-card border border-border-custom shadow-xl hover:scale-110 transition-transform duration-300 group"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform duration-500" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-600" />
          )}
        </button>
        <form action={logout}>
          <button
            type="submit"
            title="Logout"
            className="p-3 rounded-2xl bg-card border border-border-custom shadow-xl hover:scale-110 transition-transform duration-300 group"
          >
            <LogOut className="w-5 h-5 text-red-500 group-hover:translate-x-0.5 transition-transform duration-300" />
          </button>
        </form>
      </div>

      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full dark:opacity-100 opacity-40" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full dark:opacity-100 opacity-40" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12 md:py-24 space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-sm font-medium mb-4"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>AI Extraction System</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-slate-400 dark:to-slate-500"
            >
              Batch Dashboard
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 dark:text-slate-400 font-medium"
            >
              Manage, review, and export check data batches.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center gap-3"
          >
            {getAuthRole() === "ADMIN" && (
              <>
                <Link
                  href="/users"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-500/20 transition-colors border border-indigo-500/20"
                >
                  <Users className="w-5 h-5" />
                  <span className="hidden sm:inline">Users</span>
                </Link>
                <Link
                  href="/audit"
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-500/20 transition-colors border border-indigo-500/20"
                >
                  <Activity className="w-5 h-5" />
                  <span className="hidden sm:inline">Audit Logs</span>
                </Link>
              </>
            )}
            <Link
              href="/upload"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 group"
            >
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>New Batch</span>
            </Link>
          </motion.div>
        </header>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {loading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            <>
              <div className="bg-card border border-border-custom rounded-3xl p-6 flex flex-col shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-500">Total Batches</h3>
                </div>
                <p className="text-4xl font-bold tracking-tight">{stats?.total_batches ?? "-"}</p>
              </div>

              <div className="bg-card border border-border-custom rounded-3xl p-6 flex flex-col shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-500">Checks Pending Review</h3>
                </div>
                <p className="text-4xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {(stats?.review_checks ?? 0) + (stats?.pending_checks ?? 0) || "-"}
                </p>
              </div>

              <div className="bg-card border border-border-custom rounded-3xl p-6 flex flex-col shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-500">Approved Today</h3>
                </div>
                <p className="text-4xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {stats?.approved_today ?? "-"}
                </p>
              </div>
            </>
          )}
        </motion.div>

        {/* Table Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border-custom rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl min-h-[400px] flex flex-col"
        >
          {/* Table Header / Filters */}
          <div className="p-6 border-b border-border-custom bg-card/40 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <TableIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground tracking-tight">Recent Batches</h3>
              </div>
              <div className="relative w-full md:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by ID, status, or creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-black/5 dark:bg-white/5 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all w-full md:w-72 text-foreground"
                />
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Status:</span>
              </div>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                    statusFilter === f.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-black/5 dark:bg-white/5 text-slate-500 border-border-custom hover:border-indigo-500/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
              <div className="w-px h-5 bg-border-custom self-center mx-1" />
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Date:</span>
              </div>
              {DATE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setDateFilter(f.value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                    dateFilter === f.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-black/5 dark:bg-white/5 text-slate-500 border-border-custom hover:border-indigo-500/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-border-custom">
                  {Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)}
                </tbody>
              </table>
            ) : currentBatches.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-custom bg-black/[0.02] dark:bg-white/[0.02]">
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Batch ID</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Created</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom">
                  <AnimatePresence>
                    {currentBatches.map((batch) => (
                      <motion.tr
                        key={batch.batch_id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                              #{batch.batch_number ?? batch.batch_id}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-foreground truncate">Upload Batch {batch.batch_number ?? batch.batch_id}</span>
                              <span className="text-xs text-slate-500 truncate">by {batch.created_by}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border",
                            getStatusColor(batch.status)
                          )}>
                            {batch.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400" title={batch.created_at ? new Date(batch.created_at).toLocaleString() : ""}>
                            <Clock className="w-4 h-4" />
                            <span>{relativeTime(batch.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {batch.total_checks ? (
                            <div className="flex items-center gap-3 w-48">
                              <div className="flex-1 h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000",
                                    batch.approved_checks === batch.total_checks ? "bg-emerald-500" : "bg-indigo-500"
                                  )}
                                  style={{ width: `${(batch.approved_checks! / batch.total_checks) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-500 w-12 text-right">
                                {batch.approved_checks} / {batch.total_checks}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Processing...</span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              title="Export to Excel"
                              onClick={() => handleExport(batch.batch_id, "excel", batch.batch_number ?? batch.batch_id)}
                              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                            >
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">Export</span>
                            </button>

                            <Link
                              href={`/batch/${batch.batch_number ?? batch.batch_id}?bid=${batch.batch_id}`}
                              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                              title="Review Batch"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">Review</span>
                            </Link>

                            {getAuthRole() === "ADMIN" && (
                              <button
                                title="Delete Batch"
                                onClick={() => deleteBatch(batch.batch_id, batch.batch_number ?? batch.batch_id)}
                                className="flex items-center gap-2 p-2.5 text-sm font-medium rounded-xl transition-all bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            ) : (
              /* ─── Enhanced Empty State ─── */
              <div className="flex flex-col items-center justify-center h-64 text-center p-12">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <FileText className="w-10 h-10 text-indigo-400 opacity-60" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground mb-1">
                  {searchQuery || statusFilter !== "ALL" || dateFilter !== "ALL"
                    ? "No matching batches"
                    : "No batches yet"}
                </p>
                <p className="text-sm text-slate-500 max-w-xs mb-5">
                  {searchQuery || statusFilter !== "ALL" || dateFilter !== "ALL"
                    ? "Try clearing your filters or adjusting your search query."
                    : "Upload check PDFs to extract and manage routing and account numbers."}
                </p>
                {(searchQuery || statusFilter !== "ALL" || dateFilter !== "ALL") ? (
                  <button
                    onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); setDateFilter("ALL"); }}
                    className="px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-500 text-sm font-bold hover:bg-indigo-500/20 transition-colors border border-indigo-500/20"
                  >
                    Clear Filters
                  </button>
                ) : (
                  <Link
                    href="/upload"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    Upload First Batch
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border-custom bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium ml-4">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredBatches.length)} of {filteredBatches.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
