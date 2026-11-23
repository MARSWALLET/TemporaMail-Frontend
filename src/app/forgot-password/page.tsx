'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tm-hero-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="tm-card w-full max-w-md rounded-3xl p-8">
        {submitted ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Check your email</h1>
            <p className="mt-2 text-sm text-slate-600">
              If an account exists for <span className="font-semibold">{email}</span>, we sent a
              single-use password reset link valid for 1 hour.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Mail className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter your account email and we&apos;ll send a reset link.
              </p>
            </div>
            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:brightness-110 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
