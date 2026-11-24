'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';

export interface PaletteAction {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly onRun: () => void;
}

interface CommandPaletteProps {
  readonly open: boolean;
  readonly actions: readonly PaletteAction[];
  readonly onClose: () => void;
}

export function CommandPalette({ open, actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter((a) => {
      if (a.disabled) return false;
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) ||
        (a.hint?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) =>
          filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          onClose();
          item.onRun();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIndex, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh] backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#111113]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-3.5 py-3 dark:border-zinc-800">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command or search actions..."
            className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No matching commands
            </p>
          ) : (
            filtered.map((action, idx) => (
              <button
                key={action.id}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onClose();
                  action.onRun();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  idx === activeIndex
                    ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-800/90 dark:text-zinc-50'
                    : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{action.label}</div>
                  {action.hint && (
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {action.hint}
                    </div>
                  )}
                </div>
                {action.shortcut && (
                  <kbd className="ml-3 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    {action.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-[#0c0c0e] dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Command className="h-3 w-3" /> Quick shortcuts work anywhere outside inputs
          </span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
