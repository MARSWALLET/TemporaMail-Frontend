'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api, API_BASE_URL, ApiClientError, type ApiKeyItem } from '@/lib/api';

const AVAILABLE_SCOPES = [
  'inbox:create',
  'inbox:read',
  'inbox:delete',
  'messages:read',
] as const;

export default function ApiKeysPage() {
  const { user, loading } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([...AVAILABLE_SCOPES]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      const res = await api.listApiKeys();
      setKeys(res.apiKeys);
    } catch {
      // Handled by auth state
    }
  }, []);

  useEffect(() => {
    if (user) void loadKeys();
  }, [user, loadKeys]);

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (scopes.length === 0) {
      setError('Select at least one scope.');
      return;
    }
    setCreating(true);
    setError(null);
    setRevealedKey(null);
    try {
      const res = await api.createApiKey(name, scopes);
      setKeys((prev) => [res.apiKey, ...prev]);
      setRevealedKey(res.key);
      setName('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await api.revokeApiKey(id);
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to revoke API key');
    }
  }

  async function copyRevealed() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="tm-hero-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="tm-card max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Sign in to manage API keys</h1>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tm-hero-bg min-h-[calc(100vh-8rem)] py-10">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">API Keys</h1>
          <p className="text-sm text-slate-500">
            Create programmatic keys to generate inboxes and read OTPs from CI/CD or scripts.
          </p>
        </div>

        {/* Newly Created Key Banner (Shown Once) */}
        {revealedKey && (
          <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50/70 to-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  Copy your API key now — you won&apos;t see it again
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs font-semibold text-slate-900">
                    {revealedKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyRevealed()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey ? 'Copied!' : 'Copy key'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Key Card */}
        <form onSubmit={(e) => void handleCreate(e)} className="tm-card rounded-3xl p-6">
          <h2 className="text-base font-bold text-slate-900">Create a new API key</h2>
          {error && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Key name (e.g. Playwright E2E)"
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:brightness-110 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Creating…' : 'Generate Key'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {AVAILABLE_SCOPES.map((scope) => {
              const active = scopes.includes(scope);
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200'
                  }`}
                >
                  {scope}
                </button>
              );
            })}
          </div>
        </form>

        {/* Keys Table */}
        <div className="tm-card overflow-hidden rounded-3xl">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3.5 text-xs font-semibold text-slate-600 uppercase">
            Your Keys ({keys.length})
          </div>
          {keys.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              <KeyRound className="mx-auto mb-2 h-7 w-7 text-blue-300" />
              No API keys created yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{k.name}</span>
                      <code className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                        {k.keyPrefix}…{k.last4}
                      </code>
                      {k.revokedAt ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                          Revoked
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {k.scopes.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {!k.revokedAt && (
                    <button
                      type="button"
                      onClick={() => void handleRevoke(k.id)}
                      className="inline-flex items-center gap-1.5 self-start rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 sm:self-center"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Curl Example */}
        <div className="tm-card rounded-3xl p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase">Quick cURL Example</p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-900 p-4 font-mono text-xs text-sky-200">
            {`curl -X POST ${API_BASE_URL}/api/v1/inbox \\
  -H "Authorization: Bearer tm_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"ttlMinutes": 60}'`}
          </pre>
        </div>
      </div>
    </div>
  );
}
