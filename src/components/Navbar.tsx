'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Code2, KeyRound, LayoutDashboard, LogOut, Mail, Moon, Settings, Sun } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useTheme } from './ThemeProvider';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navLinkClass = (href: string) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
      pathname === href
        ? 'bg-zinc-100 text-zinc-950 ring-1 ring-zinc-200 dark:bg-zinc-800/90 dark:text-zinc-50 dark:ring-zinc-700'
        : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
    }`;

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090b]/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/images/logo-mark.svg"
              alt="TemporaMail"
              width={36}
              height={36}
              className="rounded-xl transition-transform duration-200 group-hover:scale-105"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Tempora
              <span className="text-blue-600 dark:text-blue-400">
                Mail
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/" className={navLinkClass('/')}>
              <Mail className="h-4 w-4" />
              Live Inbox
            </Link>
            <Link href="/developers" className={navLinkClass('/developers')}>
              <Code2 className="h-4 w-4" />
              Developers
            </Link>
            {user && (
              <>
                <Link href="/dashboard" className={navLinkClass('/dashboard')}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link href="/dashboard/api-keys" className={navLinkClass('/dashboard/api-keys')}>
                  <KeyRound className="h-4 w-4" />
                  API Keys
                </Link>
                <Link href="/settings" className={navLinkClass('/settings')}>
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 sm:inline-flex dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-200 dark:hover:border-zinc-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase">
                  {user.email.charAt(0)}
                </span>
                <span className="max-w-[140px] truncate">{user.email}</span>
                <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 capitalize dark:bg-zinc-800 dark:text-zinc-300">
                  {user.planId}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-300 dark:hover:border-red-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700"
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
