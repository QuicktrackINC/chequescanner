'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleResponse = (value: boolean) => {
    setState(null);
    resolveRef.current?.(value);
  };

  const isDanger = state?.variant !== 'warning';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state?.open && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => handleResponse(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${isDanger ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                  <AlertTriangle className={`w-5 h-5 ${isDanger ? 'text-red-500' : 'text-amber-500'}`} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  {state?.title ?? 'Are you sure?'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {state?.message}
                </p>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => handleResponse(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {state?.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  onClick={() => handleResponse(true)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-500 hover:bg-amber-400'}`}
                >
                  {state?.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
