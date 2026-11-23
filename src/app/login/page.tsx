'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api, ApiClientError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.login(email, password, rememberMe);
      if (res.mfaRequired && res.mfaToken) {
        setMfaToken(res.mfaToken);
        return;
      }
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.loginMfa(mfaToken, mfaCode);
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Invalid verification code');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tm-hero-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="tm-card w-full max-w-md rounded-3xl p-7 sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/images/logo-mark.svg" alt="TemporaMail" width={48} height={48} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {mfaToken ? 'Two-factor verification' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mfaToken
              ? 'Enter the 6-digit code from your authenticator app or a recovery code.'
              : 'Sign in to manage saved addresses, custom names, and API keys.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {mfaToken ? (
          <form onSubmit={(e) => void handleMfaSubmit(e)} className="space-y-4">
            <div>
              <label htmlFor="mfa-code" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Authenticator or Recovery Code
              </label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-blue-500" />
                <input
                  id="mfa-code"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456 or XXXX-XXXX"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-10 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:brightness-110 disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {submitting ? 'Verifying…' : 'Verify & Sign In'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMfaToken(null);
                setMfaCode('');
                setError(null);
              }}
              className="w-full text-center text-xs font-medium text-slate-500 hover:text-blue-600"
            >
              Back to password login
            </button>
          </form>
        ) : (
          <>
            <a
              href={api.getGoogleAuthUrl()}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/40"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.54-5.17 3.54-8.88Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.27V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4.01-3.11Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4.01 3.11c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              Continue with Google
            </a>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">or with email</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Keep me signed in for 30 days
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                Create a free account
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
