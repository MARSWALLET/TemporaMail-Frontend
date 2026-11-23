'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api, ApiClientError } from '@/lib/api';

function VerifyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();
  const token = params.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    void api
      .verifyEmail(token)
      .then(async () => {
        await refresh();
        setStatus('success');
        setMessage('Your email is verified! Redirecting to your dashboard…');
        setTimeout(() => router.push('/dashboard'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err instanceof ApiClientError ? err.message : 'Verification link is invalid or expired.',
        );
      });
  }, [token, refresh, router]);

  return (
    <div className="tm-card w-full max-w-md rounded-3xl p-8 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Verifying email</h1>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Email verified</h1>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="mx-auto h-11 w-11 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Verification failed</h1>
        </>
      )}
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      {status === 'error' && (
        <Link
          href="/login"
          className="mt-6 inline-block rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Back to Login
        </Link>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="tm-hero-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="h-48 w-full max-w-md animate-pulse rounded-3xl bg-slate-100" />}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
