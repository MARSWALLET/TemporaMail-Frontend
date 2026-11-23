'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Clock,
  Copy,
  KeyRound,
  Mail,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import {
  api,
  ApiClientError,
  type AccountInboxItem,
  type FullMessage,
  type MessageSummary,
} from '@/lib/api';

export default function DashboardPage() {
  const { user, entitlements, loading } = useAuth();
  const [inboxes, setInboxes] = useState<AccountInboxItem[]>([]);
  const [domains, setDomains] = useState<string[]>(['temporamail.app']);
  const [customName, setCustomName] = useState('');
  const [domain, setDomain] = useState('temporamail.app');
  const [ttlMinutes, setTtlMinutes] = useState(1440);

  const [selectedInbox, setSelectedInbox] = useState<AccountInboxItem | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [activeMessage, setActiveMessage] = useState<FullMessage | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInboxes = useCallback(async () => {
    try {
      const [inboxRes, domRes] = await Promise.all([api.listAccountInboxes(), api.getDomains()]);
      setInboxes(inboxRes.inboxes);
      if (domRes.domains.length > 0) {
        setDomains(domRes.domains);
        setDomain(domRes.domains[0] ?? 'temporamail.app');
      }
    } catch {
      // Handled by auth guard
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadInboxes();
    }
  }, [user, loadInboxes]);

  useEffect(() => {
    if (!selectedInbox) {
      setMessages([]);
      setActiveMessage(null);
      return;
    }
    void api
      .listAccountInboxMessages(selectedInbox.id)
      .then((res) => setMessages(res.messages))
      .catch(() => setMessages([]));
  }, [selectedInbox]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await api.createAccountInbox({
        domain,
        ...(customName.trim() ? { customName: customName.trim() } : {}),
        ttlMinutes,
      });
      setCustomName('');
      setInboxes((prev) => [created, ...prev]);
      setSelectedInbox(created);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create address');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteAccountInbox(id);
      setInboxes((prev) => prev.filter((i) => i.id !== id));
      if (selectedInbox?.id === id) setSelectedInbox(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not delete address');
    }
  }

  async function handleCopy(item: AccountInboxItem) {
    await navigator.clipboard.writeText(item.address);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="tm-hero-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="tm-card max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Sign in to view your dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">
            Save addresses for up to 24 hours, reserve custom names, and manage API keys.
          </p>
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

  const customUsed = inboxes.filter((i) => i.customName).length;

  return (
    <div className="tm-hero-bg min-h-[calc(100vh-8rem)] py-10">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        {/* Header + Plan Usage Meters */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{user.email}</span> ·{' '}
              <span className="font-semibold text-blue-600 capitalize">{user.planId} plan</span>
            </p>
          </div>
          <Link
            href="/dashboard/api-keys"
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <KeyRound className="h-4 w-4" />
            Manage API Keys
          </Link>
        </div>

        {/* Plan Meter Cards */}
        {entitlements && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="tm-card rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase">Active Addresses</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {inboxes.length}{' '}
                <span className="text-sm font-normal text-slate-400">
                  / {entitlements.maxActiveAddresses}
                </span>
              </p>
            </div>
            <div className="tm-card rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase">Custom Names</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {customUsed}{' '}
                <span className="text-sm font-normal text-slate-400">
                  / {entitlements.maxReservedCustomNames}
                </span>
              </p>
            </div>
            <div className="tm-card rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase">Max Retention</p>
              <p className="mt-2 text-2xl font-bold text-blue-600">
                {Math.round(entitlements.maxInboxLifetimeMinutes / 60)}h
              </p>
            </div>
          </div>
        )}

        {/* Create New Saved Address */}
        <form onSubmit={(e) => void handleCreate(e)} className="tm-card rounded-3xl p-6">
          <h2 className="text-base font-bold text-slate-900">Create a saved address</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Leave custom name blank for a random address, or reserve a custom local part (3–30 chars).
          </p>

          {error && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-12">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Custom name (optional, e.g. dev-alerts)"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:col-span-5"
            />
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 sm:col-span-3"
            >
              {domains.map((d) => (
                <option key={d} value={d}>
                  @{d}
                </option>
              ))}
            </select>
            <select
              value={ttlMinutes}
              onChange={(e) => setTtlMinutes(Number(e.target.value))}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 sm:col-span-2"
            >
              <option value={60}>1 hour</option>
              <option value={360}>6 hours</option>
              <option value={1440}>24 hours</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:brightness-110 disabled:opacity-60 sm:col-span-2"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
        </form>

        {/* Saved Inboxes & Messages Split View */}
        <div className="tm-card grid min-h-[380px] overflow-hidden rounded-3xl lg:grid-cols-12">
          <div className="border-b border-slate-100 lg:col-span-5 lg:border-r lg:border-b-0">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs font-semibold text-slate-600 uppercase">
              Your Saved Addresses ({inboxes.length})
            </div>
            {inboxes.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <Image src="/images/empty-inbox.svg" alt="No saved inboxes" width={160} height={124} />
                <p className="mt-2 text-sm font-medium text-slate-600">No saved addresses yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {inboxes.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between gap-2 px-5 py-3.5 transition ${
                      selectedInbox?.id === item.id ? 'bg-blue-50/70' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedInbox(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-mono text-sm font-semibold text-slate-900">
                        {item.address}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-blue-500" />
                          Expires {new Date(item.expiresAt).toLocaleString()}
                        </span>
                        {item.customName && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                            Custom
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleCopy(item)}
                        className="rounded-xl p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Copy address"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete address"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-6 lg:col-span-7">
            {!selectedInbox ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <Mail className="mb-2 h-8 w-8 text-blue-300" />
                <p className="text-sm font-medium text-slate-600">Select an address to view messages</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="font-mono text-sm font-semibold text-blue-700">
                  {selectedInbox.address}
                </p>
                <p className="mt-1 text-xs text-slate-500">No messages received yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-mono text-xs font-semibold text-blue-700">
                  {selectedInbox.address}
                </p>
                {messages.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      void api
                        .getAccountInboxMessage(selectedInbox.id, m.id)
                        .then(setActiveMessage)
                    }
                    className="block w-full rounded-2xl border border-slate-200/80 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-blue-700">{m.from}</span>
                      {m.hasOtp && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Sparkles className="h-3 w-3" /> OTP
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {m.subject || '(No subject)'}
                    </p>
                  </button>
                ))}

                {activeMessage && (
                  <div className="mt-4 rounded-2xl border border-blue-100 bg-slate-50/70 p-4">
                    <p className="text-sm font-bold text-slate-900">{activeMessage.subject}</p>
                    {activeMessage.otp && (
                      <p className="mt-2 font-mono text-lg font-bold text-emerald-700">
                        OTP: {activeMessage.otp}
                      </p>
                    )}
                    <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-slate-700">
                      {activeMessage.text}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
