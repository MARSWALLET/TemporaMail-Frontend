'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Download, LogOut, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api, ApiClientError, type UserSessionItem } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, refresh, logout } = useAuth();
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [totpQrDataUrl, setTotpQrDataUrl] = useState<string>('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!totpSetup?.otpauthUrl) {
      setTotpQrDataUrl('');
      return;
    }
    void QRCode.toDataURL(totpSetup.otpauthUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#09090b', light: '#ffffff' },
    })
      .then(setTotpQrDataUrl)
      .catch(() => setTotpQrDataUrl(''));
  }, [totpSetup]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.listSessions();
      setSessions(res.sessions);
    } catch {
      // Handled by auth guard
    }
  }, []);

  useEffect(() => {
    if (user) void loadSessions();
  }, [user, loadSessions]);

  async function handleStart2fa() {
    setError(null);
    try {
      const res = await api.setup2fa();
      setTotpSetup(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to start 2FA setup');
    }
  }

  async function handleEnable2fa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.enable2fa(totpCode);
      setRecoveryCodes(res.recoveryCodes);
      setTotpSetup(null);
      setTotpCode('');
      setNotice('Two-factor authentication is now enabled.');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Invalid TOTP code');
    }
  }

  async function handleExport() {
    try {
      const data = await api.exportAccountData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'temporamail-account-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Export failed');
    }
  }

  async function handleLogoutAll() {
    await api.logoutAll();
    await logout();
    router.push('/login');
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.deleteAccount(deleteEmail, deletePassword || undefined);
      await logout();
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Account deletion failed');
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="tm-hero-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="tm-card max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Sign in to access settings</h1>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tm-hero-bg min-h-[calc(100vh-8rem)] py-10">
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Security &amp; Settings</h1>
          <p className="text-sm text-slate-500">Manage two-factor authentication, sessions, and privacy.</p>
        </div>

        {notice && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Two-Factor Auth */}
        <section className="tm-card rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Two-Factor Authentication (TOTP)</h2>
                <p className="text-xs text-slate-500">
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      user.totpEnabled ? 'text-emerald-600' : 'text-slate-600'
                    }`}
                  >
                    {user.totpEnabled ? 'Enabled' : 'Not enabled'}
                  </span>
                </p>
              </div>
            </div>

            {!user.totpEnabled && !totpSetup && (
              <button
                type="button"
                onClick={() => void handleStart2fa()}
                className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Enable 2FA
              </button>
            )}
          </div>

          {totpSetup && (
            <form
              onSubmit={(e) => void handleEnable2fa(e)}
              className="mt-5 space-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-800"
            >
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Scan this QR code with Google Authenticator, 1Password, Apple Passwords, or Authy,
                or enter the setup key manually, then enter the 6-digit code to confirm:
              </p>

              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-xs dark:border-zinc-700">
                  {totpQrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={totpQrDataUrl}
                      alt="Authenticator app QR code"
                      className="h-full w-full"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400">Generating QR...</span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Manual Setup Key
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(totpSetup.secret);
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 1800);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {copiedSecret ? (
                          <>
                            <Check className="h-3 w-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy key
                          </>
                        )}
                      </button>
                    </div>
                    <code className="block break-all rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 font-mono text-xs font-bold tracking-wider text-zinc-900 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-100">
                      {totpSetup.secret}
                    </code>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-44 rounded-xl border border-zinc-200 px-3.5 py-2 font-mono text-sm tracking-widest outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Confirm &amp; Enable
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {recoveryCodes && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <p className="text-xs font-bold text-amber-900">
                Save these single-use recovery codes now — they will not be shown again:
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-5">
                {recoveryCodes.map((c) => (
                  <span key={c} className="rounded-lg bg-white px-2.5 py-1.5 text-center font-semibold text-slate-800">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Active Sessions */}
        <section className="tm-card rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Active Sessions</h2>
                <p className="text-xs text-slate-500">Devices currently signed in to your account.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLogoutAll()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out everywhere
            </button>
          </div>

          <ul className="mt-4 divide-y divide-slate-100">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {s.userAgent || 'Unknown device'}{' '}
                    {s.current && (
                      <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-slate-400">
                    IP {s.ip} · Last active {new Date(s.lastSeenAt).toLocaleString()}
                  </p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    onClick={() =>
                      void api.revokeSession(s.id).then(() => {
                        setSessions((prev) => prev.filter((item) => item.id !== s.id));
                      })
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:border-rose-200 hover:text-rose-600"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Data Export & Delete Account */}
        <section className="tm-card rounded-3xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Your Data (GDPR)</h2>
              <p className="text-xs text-slate-500">Download a JSON export of your account data.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>

          <form
            onSubmit={(e) => void handleDeleteAccount(e)}
            className="border-t border-slate-100 pt-5"
          >
            <h3 className="text-sm font-bold text-rose-700">Delete Account</h3>
            <p className="mt-1 text-xs text-slate-500">
              Permanently deletes your account, saved addresses, and API keys. Type your email to confirm.
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <input
                type="email"
                required
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder={user.email}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-rose-400"
              />
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Current password"
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-rose-400"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Account
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
