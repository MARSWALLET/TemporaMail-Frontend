'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token in URL.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tm-card w-full max-w-md rounded-3xl p-8">
      {done ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Password updated</h1>
          <p className="mt-2 text-sm text-slate-600">
            All previous sessions have been signed out for security. Sign in with your new password.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
            <p className="mt-1 text-sm text-slate-500">Minimum 10 characters.</p>
          </div>
          {error && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <input
              type="password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New strong passphrase"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:brightness-110 disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="tm-hero-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="h-48 w-full max-w-md animate-pulse rounded-3xl bg-slate-100" />}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
