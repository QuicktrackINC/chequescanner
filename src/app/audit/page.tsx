"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  ChevronLeft,
  Moon,
  Sun,
  LogOut,
  RefreshCw,
  Search,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useToast } from "../components/Toast";
import { logout } from "../login/actions";
import { ProfileDropdown } from "../../components/layout/profile-dropdown";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlobalAuditLog {
  id: number;
  check_id: number;
  batch_id: number;
  user: string;
  action: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [logs, setLogs] = useState<GlobalAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const getAuthRole = useCallback(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp("(^| )auth_role=([^;]+)"));
      if (match) return decodeURIComponent(match[2]);
    }
    return "ADMIN";
  }, []);

  const getAuthToken = useCallback(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp("(^| )auth_token=([^;]+)"));
      if (match) return decodeURIComponent(match[2]);
    }
    return "";
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const role = getAuthRole();
      if (role !== "ADMIN") {
        router.push("/");
        return;
      }

      const res = await fetch("/api/audit?limit=100", {
        headers: { Authorization: `Bearer ${getAuthToken()}`, "X-User-Role": role },
      });

      if (res.status === 401) { await logout(); return; }

      if (!res.ok) {
        if (res.status === 403) {
          router.push("/");
          return;
        }
        throw new Error("Failed to load audit logs");
      }

      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load audit logs";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [getAuthRole, getAuthToken, router, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.user.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.check_id.toString().includes(q) ||
      log.batch_id.toString().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30">
      <div className="fixed top-8 right-8 z-50 flex items-center gap-2">
        <button
          onClick={() => fetchLogs()}
          disabled={loading}
          className="p-3 rounded-full bg-white dark:bg-zinc-900 shadow-xl border border-border-custom hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 text-slate-500"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-3 rounded-full bg-white dark:bg-zinc-900 shadow-xl border border-border-custom hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-slate-500"
          title="Toggle Theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <ProfileDropdown logoutAction={logout} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12 md:py-24 space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm font-semibold text-slate-600 dark:text-slate-400 w-fit"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <header>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-sm font-medium mb-4"
          >
            <History className="w-4 h-4" />
            <span>Admin Control Panel</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-slate-400 dark:to-slate-500"
          >
            Global Audit Logs
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 dark:text-slate-400 font-medium"
          >
            System-wide history of all check modifications and approvals.
          </motion.p>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs by user, action, batch ID, or check ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-border-custom bg-card text-foreground focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-shadow shadow-sm"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl md:rounded-3xl border border-border-custom shadow-xl overflow-hidden"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-4" />
              <p>Loading audit logs...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-custom bg-black/5 dark:bg-white/5">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-48">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">User</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Action</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Target</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom">
                  <AnimatePresence>
                    {filteredLogs.map((log) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-500 font-medium">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] font-bold uppercase">
                              {log.user.slice(0, 1)}
                            </span>
                            <span className="text-sm font-bold text-foreground">{log.user}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg",
                              log.action === "APPROVED"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            )}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-sm">
                            <Link href={`/batch/${log.batch_id}`} className="font-semibold text-indigo-500 hover:underline">
                              Batch #{log.batch_id}
                            </Link>
                            <span className="text-slate-500 text-xs">Check ID: {log.check_id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {Object.keys(log.changes || {}).length > 0 ? (
                            <div className="space-y-2 max-w-sm">
                              {Object.entries(log.changes).map(([field, vals]) => (
                                <div key={field} className="grid grid-cols-[80px_1fr_1fr] gap-2 text-xs bg-black/5 dark:bg-white/5 rounded-lg p-2">
                                  <span className="font-medium text-slate-500 truncate" title={field}>
                                    {field.replace(/_/g, " ")}:
                                  </span>
                                  <span className="text-red-500 line-through truncate" title={String(vals.old || "none")}>
                                    {String(vals.old || "none")}
                                  </span>
                                  <span className="text-emerald-500 truncate" title={String(vals.new || "none")}>
                                    → {String(vals.new || "none")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 italic">No significant field changes</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center p-12">
              <div className="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center mb-4">
                <History className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-foreground mb-1">No audit logs found</p>
              <p className="text-slate-500">
                {searchQuery ? "Try adjusting your search query." : "There are no recorded actions in the system yet."}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
