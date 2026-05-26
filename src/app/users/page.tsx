"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ChevronLeft,
  Moon,
  Sun,
  LogOut,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Edit2,
  ShieldAlert,
  Save,
  X
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useToast } from "../components/Toast";
import { logout } from "../login/actions";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals / Forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const [formData, setFormData] = useState({ username: "", password: "", role: "REVIEWER" });

  const getAuthRole = useCallback(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp("(^| )auth_role=([^;]+)"));
      if (match) return decodeURIComponent(match[2]);
    }
    return "";
  }, []);

  const getAuthToken = useCallback(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp("(^| )auth_token=([^;]+)"));
      if (match) return decodeURIComponent(match[2]);
    }
    return "";
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const role = getAuthRole();
      if (role !== "ADMIN") {
        router.push("/");
        return;
      }

      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          await logout();
          return;
        }
        throw new Error("Failed to load users");
      }

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load users";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [getAuthRole, getAuthToken, router, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username && !editingUserId) {
        toast.error("Username is required");
        return;
    }

    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PUT" : "POST";
      const body: { username: string; password?: string; role: string } = { ...formData };
      
      // Don't send empty password if editing (means don't change it)
      if (editingUserId && !body.password) {
          delete body.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save user");
      }

      toast.success(editingUserId ? "User updated!" : "User created!");
      setShowAddForm(false);
      setEditingUserId(null);
      setFormData({ username: "", password: "", role: "REVIEWER" });
      fetchUsers();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save user";
      toast.error(errorMsg);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to delete user");
      }

      toast.success("User deleted");
      fetchUsers();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete user";
      toast.error(errorMsg);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30 pb-20">
      <div className="fixed top-8 right-8 z-50 flex items-center gap-2">
        <button
          onClick={() => fetchUsers()}
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

        <form action={logout}>
          <button
            type="submit"
            title="Logout"
            className="p-3 rounded-full bg-white dark:bg-zinc-900 shadow-xl border border-border-custom hover:bg-red-50 hover:border-red-500/20 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors text-slate-500"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-24 space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm font-semibold text-slate-600 dark:text-slate-400 w-fit"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-sm font-medium mb-4"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Admin Control Panel</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-slate-400 dark:to-slate-500"
            >
              User Management
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 dark:text-slate-400 font-medium"
            >
              Control access roles, update passwords, and manage accounts.
            </motion.p>
          </div>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => {
                setEditingUserId(null);
                setFormData({ username: "", password: "", role: "REVIEWER" });
                setShowAddForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 group"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Add User</span>
          </motion.button>
        </header>

        {/* Add/Edit Form Overlay */}
        <AnimatePresence>
            {(showAddForm || editingUserId) && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                    className="bg-card rounded-2xl md:rounded-3xl border border-indigo-500/30 shadow-xl overflow-hidden p-6 relative"
                >
                    <button onClick={() => { setShowAddForm(false); setEditingUserId(null); }} className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground">
                        {editingUserId ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
                        {editingUserId ? "Edit User" : "Add New User"}
                    </h3>

                    <form onSubmit={handleSaveUser} className="space-y-4 max-w-md">
                        {!editingUserId && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Username</label>
                                <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}
                                    className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                                {editingUserId ? "New Password (leave blank to keep current)" : "Password"}
                            </label>
                            <input required={!editingUserId} type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Role</label>
                            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-border-custom bg-black/5 dark:bg-white/5 text-foreground focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all appearance-none">
                                <option value="REVIEWER">Reviewer (Upload & Review)</option>
                                <option value="ADMIN">Admin (Full Access)</option>
                            </select>
                        </div>
                        <div className="pt-4 flex items-center gap-3">
                            <button type="submit" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/20">
                                <Save className="w-4 h-4" /> Save User
                            </button>
                            <button type="button" onClick={() => { setShowAddForm(false); setEditingUserId(null); }} className="px-6 py-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-bold transition-all">
                                Cancel
                            </button>
                        </div>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
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
              <p>Loading users...</p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-custom bg-black/5 dark:bg-white/5">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">User</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Role</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Created At</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom">
                  <AnimatePresence>
                    {filteredUsers.map((user) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold uppercase">
                              {user.username.slice(0, 1)}
                            </span>
                            <span className="font-bold text-foreground text-base">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg",
                              user.role === "ADMIN"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            )}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className="text-sm text-slate-500">
                                {new Date(user.created_at).toLocaleDateString()}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setEditingUserId(user.id);
                                        setFormData({ username: user.username, password: "", role: user.role });
                                        setShowAddForm(false);
                                    }}
                                    className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-500 transition-colors"
                                    title="Edit User"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
                                    title="Delete User"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
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
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-foreground mb-1">No users found</p>
              <p className="text-slate-500">Try adjusting your search query.</p>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
