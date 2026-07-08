"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut } from "lucide-react";

export function ProfileDropdown({ logoutAction }: { logoutAction: string | ((formData: FormData) => void) }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [user, setUser] = useState<{ username?: string; role?: string; email?: string } | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    
    // Parse JWT
    try {
      const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
      const roleMatch = document.cookie.match(new RegExp('(^| )auth_role=([^;]+)'));
      if (match) {
        const payload = JSON.parse(atob(match[2].split('.')[1]));
        setUser({
          username: payload.sub || payload.username || "User",
          email: payload.email || "",
          role: roleMatch ? decodeURIComponent(roleMatch[2]) : "User"
        });
      } else {
        setUser({ username: "User", role: roleMatch ? decodeURIComponent(roleMatch[2]) : "User" });
      }
    } catch (e) {
      setUser({ username: "User", role: "User" });
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initial = (user.username || "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 font-bold flex items-center justify-center hover:bg-indigo-500/20 transition-colors focus:outline-none"
        title="Profile"
      >
        {initial}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border-custom bg-card shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-3 py-2 border-b border-border-custom mb-1">
            <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
            {user.email && <p className="text-xs text-slate-500 truncate">{user.email}</p>}
            <p className="text-[10px] uppercase font-bold text-indigo-400 mt-1 tracking-wider">
              {user.role}
            </p>
          </div>
          <form action={logoutAction as any}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
