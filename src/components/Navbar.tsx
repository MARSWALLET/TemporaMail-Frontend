'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { KeyRound, LayoutDashboard, LogOut, Mail, Settings } from 'lucide-react';
import { useAuth } from './AuthProvider';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const navLinkClass = (href: string) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
      pathname === href
        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/80'
        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
    }`;

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/85 backdrop-blur-md">
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
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Tempora<span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">Mail</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/" className={navLinkClass('/')}>
              <Mail className="h-4 w-4" />
              Live Inbox
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

        <div className="flex items-center gap-2.5">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-slate-100" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/60 sm:inline-flex"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-[10px] font-bold text-white uppercase">
                  {user.email.charAt(0)}
                </span>
                <span className="max-w-[140px] truncate">{user.email}</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 capitalize">
                  {user.planId}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:brightness-110"
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
