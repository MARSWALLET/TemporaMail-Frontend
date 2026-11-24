'use client';

import Image from 'next/image';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Paperclip,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  api,
  ApiClientError,
  type CreatedInbox,
  type FullMessage,
  type MessageSummary,
} from '@/lib/api';

const STORAGE_KEY = 'temporamail_active_inbox';

function formatCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function playNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(587.33, now, 0.16); // D5
    playTone(880.0, now + 0.11, 0.24); // A5
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // Ignore autoplay/WebAudio restrictions
  }
}

function downloadMessageAsEml(msg: FullMessage): void {
  const headers = [
    `From: ${msg.from}`,
    `To: ${msg.to.join(', ')}`,
    `Subject: ${msg.subject}`,
    `Date: ${new Date(msg.date).toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
  ].join('\r\n');
  const eml = `${headers}\r\n\r\n${msg.text || msg.html}`;
  const blob = new Blob([eml], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(msg.subject || 'message').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40)}.eml`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LiveInbox() {
  const [domains, setDomains] = useState<string[]>(['temporamail.app']);
  const [selectedDomain, setSelectedDomain] = useState<string>('temporamail.app');
  const [inbox, setInbox] = useState<CreatedInbox | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [fullMessage, setFullMessage] = useState<FullMessage | null>(null);
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');

  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [msLeft, setMsLeft] = useState<number>(0);
  const [loadingInbox, setLoadingInbox] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<boolean>(false);
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);
  const [copiedOtp, setCopiedOtp] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [qrOpen, setQrOpen] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const soundEnabledRef = useRef<boolean>(true);
  const notificationsEnabledRef = useRef<boolean>(false);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  // Reset dynamic tab title when user focuses the tab
  useEffect(() => {
    const resetTitle = () => {
      document.title = 'TemporaMail — Instant, Private Temporary Email';
    };
    window.addEventListener('focus', resetTitle);
    return () => {
      window.removeEventListener('focus', resetTitle);
      resetTitle();
    };
  }, []);

  // Generate QR data URL when modal opens
  useEffect(() => {
    if (!qrOpen || !inbox) return;
    void QRCode.toDataURL(inbox.address, {
      width: 240,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [qrOpen, inbox]);

  async function handleToggleNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return;
    }
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setNotificationsEnabled(true);
    }
  }

  const allocateInbox = useCallback(async (domain?: string) => {
    setLoadingInbox(true);
    setError(null);
    setSelectedMsgId(null);
    setFullMessage(null);
    setMessages([]);

    try {
      const created = await api.createInbox(domain ? { domain } : {});
      setInbox(created);
      setMsLeft(Math.max(0, Date.parse(created.expiresAt) - Date.now()));
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(created));
      } catch {
        // Ignore storage quota errors
      }
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Could not connect to TemporaMail API. Make sure the backend is running.';
      setError(msg);
      setStreamStatus('offline');
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  const refreshMessages = useCallback(async (address: string) => {
    try {
      const res = await api.listMessages(address);
      setMessages(res.messages);
    } catch {
      // Handled by status/SSE
    }
  }, []);

  // Initial boot: fetch domains + restore or create inbox
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const d = await api.getDomains();
        if (!cancelled && d.domains.length > 0) {
          setDomains(d.domains);
          setSelectedDomain(d.domains[0] ?? 'temporamail.app');
        }
      } catch {
        // Keep default domain list
      }

      if (cancelled) return;

      try {
        const savedRaw = sessionStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const saved = JSON.parse(savedRaw) as CreatedInbox;
          if (saved.address && Date.parse(saved.expiresAt) > Date.now() + 5000) {
            try {
              const status = await api.getInboxStatus(saved.address);
              if (!cancelled) {
                const hydrated: CreatedInbox = { ...saved, expiresAt: status.expiresAt };
                setInbox(hydrated);
                setMsLeft(Math.max(0, Date.parse(status.expiresAt) - Date.now()));
                await refreshMessages(saved.address);
                setLoadingInbox(false);
                return;
              }
            } catch {
              sessionStorage.removeItem(STORAGE_KEY);
            }
          }
        }
      } catch {
        // Ignore sessionStorage read errors
      }

      if (!cancelled) {
        await allocateInbox();
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [allocateInbox, refreshMessages]);

  // Countdown tick
  useEffect(() => {
    if (!inbox) return;
    const expiresMs = Date.parse(inbox.expiresAt);
    const tick = () => setMsLeft(Math.max(0, expiresMs - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [inbox]);

  // Live SSE subscription
  useEffect(() => {
    if (!inbox) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStreamStatus('connecting');
    const es = new EventSource(api.getStreamUrl(inbox.address));
    eventSourceRef.current = es;

    es.onopen = () => {
      setStreamStatus('live');
    };

    es.addEventListener('message', (event: MessageEvent) => {
      try {
        const summary = JSON.parse(String(event.data)) as MessageSummary;
        setMessages((prev) => {
          if (prev.some((m) => m.id === summary.id)) return prev;
          return [summary, ...prev];
        });

        if (soundEnabledRef.current) {
          playNotificationChime();
        }

        // Flash OTP or New Mail right in the browser tab title + optional desktop notification
        if (summary.hasOtp) {
          void api
            .getMessage(inbox.address, summary.id)
            .then((full) => {
              const titleText = full.otp
                ? `(${full.otp}) New OTP — TemporaMail`
                : '(1) New Mail — TemporaMail';
              document.title = titleText;
              if (
                notificationsEnabledRef.current &&
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                new Notification(full.otp ? `OTP Code: ${full.otp}` : 'New TemporaMail Message', {
                  body: `${summary.from}: ${summary.subject || '(No subject)'}`,
                  icon: '/images/logo-mark.svg',
                });
              }
            })
            .catch(() => {
              document.title = '(1) New Mail — TemporaMail';
            });
        } else {
          document.title = `(1) ${summary.subject || 'New Mail'} — TemporaMail`;
          if (
            notificationsEnabledRef.current &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('New TemporaMail Message', {
              body: `${summary.from}: ${summary.subject || '(No subject)'}`,
              icon: '/images/logo-mark.svg',
            });
          }
        }
      } catch {
        void refreshMessages(inbox.address);
      }
    });

    es.addEventListener('expired', () => {
      setStreamStatus('offline');
      es.close();
      sessionStorage.removeItem(STORAGE_KEY);
    });

    es.onerror = () => {
      setStreamStatus('offline');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [inbox, refreshMessages]);

  // Load full message when selected
  useEffect(() => {
    if (!inbox || !selectedMsgId) {
      setFullMessage(null);
      return;
    }

    let cancelled = false;
    setLoadingMessage(true);

    void api
      .getMessage(inbox.address, selectedMsgId)
      .then((msg) => {
        if (!cancelled) {
          setFullMessage(msg);
          setViewMode(msg.html ? 'html' : 'text');
        }
      })
      .catch(() => {
        if (!cancelled) setFullMessage(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inbox, selectedMsgId]);

  async function handleCopyAddress() {
    if (!inbox) return;
    await navigator.clipboard.writeText(inbox.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  }

  async function handleCopyOtp(otp: string) {
    await navigator.clipboard.writeText(otp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 1800);
  }

  async function handleExtend() {
    if (!inbox) return;
    setError(null);
    try {
      const updated = await api.extendInbox(inbox.address, inbox.ownerToken, 10);
      const next: CreatedInbox = { ...inbox, expiresAt: updated.expiresAt };
      setInbox(next);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not extend inbox');
    }
  }

  async function handleDeleteInbox() {
    if (!inbox) return;
    try {
      await api.deleteInbox(inbox.address, inbox.ownerToken);
    } catch {
      // Ignore if already expired
    }
    sessionStorage.removeItem(STORAGE_KEY);
    await allocateInbox(selectedDomain);
  }

  async function handleDeleteMessage(msgId: string) {
    if (!inbox) return;
    try {
      await api.deleteMessage(inbox.address, msgId, inbox.ownerToken);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (selectedMsgId === msgId) {
        setSelectedMsgId(null);
        setFullMessage(null);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete message');
    }
  }

  const isLowTime = msLeft > 0 && msLeft < 120_000;
  const progressPct = Math.min(100, Math.max(0, (msLeft / (10 * 60 * 1000)) * 100));

  return (
    <div className="space-y-6">
      {/* Address Control Card */}
      <section className="tm-card overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Your Temporary Address
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  streamStatus === 'live'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                    : streamStatus === 'connecting'
                      ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/80'
                      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    streamStatus === 'live'
                      ? 'animate-pulse bg-emerald-500'
                      : streamStatus === 'connecting'
                        ? 'animate-pulse bg-sky-500'
                        : 'bg-amber-500'
                  }`}
                />
                {streamStatus === 'live'
                  ? 'Live stream'
                  : streamStatus === 'connecting'
                    ? 'Connecting'
                    : 'Offline'}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-sky-50/40 to-indigo-50/50 px-4 py-3.5 dark:border-blue-900/70 dark:from-blue-950/60 dark:via-slate-900/80 dark:to-indigo-950/50">
                {loadingInbox ? (
                  <div className="h-7 w-64 animate-pulse rounded-lg bg-blue-100/70 dark:bg-slate-800" />
                ) : (
                  <span className="truncate font-mono text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
                    {inbox?.address ?? 'Unavailable'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleCopyAddress()}
                  disabled={!inbox}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50 ${
                    copiedAddr
                      ? 'bg-emerald-500 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/25 hover:brightness-110'
                  }`}
                >
                  {copiedAddr ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedAddr ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {domains.length > 1 && (
                <select
                  aria-label="Select domain"
                  value={selectedDomain}
                  onChange={(e) => {
                    const nextDomain = e.target.value;
                    setSelectedDomain(nextDomain);
                    void allocateInbox(nextDomain);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-900"
                >
                  {domains.map((d) => (
                    <option key={d} value={d}>
                      @{d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Actions + Countdown */}
          <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
            <div className="flex items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-sm font-semibold ${
                  isLowTime
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800'
                    : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700'
                }`}
              >
                <Clock className="h-4 w-4 text-blue-500 dark:text-sky-400" />
                {formatCountdown(msLeft)}
              </div>
              <button
                type="button"
                onClick={() => void handleExtend()}
                disabled={!inbox}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/80 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/60 dark:text-sky-300 dark:hover:bg-blue-900/60"
              >
                <Plus className="h-4 w-4" />
                +10m
              </button>
              <button
                type="button"
                onClick={() => void allocateInbox(selectedDomain)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                New
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                disabled={!inbox}
                title="Show QR code for phone"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
              >
                <QrCode className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled((s) => !s)}
                title={soundEnabled ? 'Mute arrival chime' : 'Enable arrival chime'}
                className={`inline-flex items-center justify-center rounded-xl border p-2 transition ${
                  soundEnabled
                    ? 'border-blue-200 bg-blue-50/70 text-blue-600 dark:border-blue-800 dark:bg-blue-950/60 dark:text-sky-300'
                    : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => void handleToggleNotifications()}
                title={notificationsEnabled ? 'Desktop alerts on' : 'Enable desktop OTP alerts'}
                className={`inline-flex items-center justify-center rounded-xl border p-2 transition ${
                  notificationsEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteInbox()}
                disabled={!inbox}
                title="Delete inbox and generate a new one"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-rose-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Subtle Expiry Progress Bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isLowTime
                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                : 'bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Split-Pane Inbox Viewer */}
      <section className="tm-card grid min-h-[460px] overflow-hidden rounded-3xl lg:grid-cols-12">
        {/* Message List */}
        <div className="flex flex-col border-b border-slate-100 lg:col-span-5 lg:border-r lg:border-b-0 dark:border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600 dark:text-sky-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Inbox</h2>
              <span className="rounded-full bg-blue-100/80 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-sky-300">
                {messages.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => inbox && void refreshMessages(inbox.address)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <Image
                src="/images/empty-inbox.svg"
                alt="Waiting for emails"
                width={190}
                height={146}
                className="mb-3 opacity-95"
              />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Waiting for incoming mail…
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Send a verification code or email to your address above. New messages appear here
                automatically in real time.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {messages.map((msg) => {
                const isSelected = selectedMsgId === msg.id;
                return (
                  <li key={msg.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedMsgId(msg.id)}
                      className={`w-full px-5 py-4 text-left transition ${
                        isSelected
                          ? 'bg-blue-50/75 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:ring-blue-800/70'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-blue-700 dark:text-sky-400">
                          {msg.from || 'Unknown sender'}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {formatTime(msg.date)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {msg.subject || '(No subject)'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {msg.hasOtp && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            <Sparkles className="h-3 w-3" />
                            OTP detected
                          </span>
                        )}
                        {msg.attachmentCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <Paperclip className="h-3 w-3" />
                            {msg.attachmentCount}
                          </span>
                        )}
                        {msg.spamFlagged && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Suspicious
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Message Reader */}
        <div className="flex flex-col bg-white lg:col-span-7 dark:bg-slate-950/40">
          {!selectedMsgId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-slate-400">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-blue-950/70 dark:text-sky-400">
                <Mail className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Select a message to read
              </p>
              <p className="mt-1 text-xs text-slate-400">
                HTML is automatically sanitized and remote trackers are stripped.
              </p>
            </div>
          ) : loadingMessage || !fullMessage ? (
            <div className="space-y-4 p-6">
              <div className="h-6 w-2/3 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-1/3 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-48 w-full animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-900" />
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              {/* Message Header */}
              <div className="border-b border-slate-100 p-5 sm:p-6 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {fullMessage.subject || '(No subject)'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      From{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {fullMessage.from}
                      </span>{' '}
                      · {new Date(fullMessage.date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => downloadMessageAsEml(fullMessage)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-slate-800"
                      title="Download as .eml"
                    >
                      <Download className="h-3.5 w-3.5" />
                      .eml
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMessage(fullMessage.id)}
                      className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:hover:border-rose-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
                      title="Delete message"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* OTP Quick Copy Card */}
                {fullMessage.otp && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-sky-50 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase">
                          Verification Code Detected
                        </p>
                        <p className="font-mono text-xl font-bold tracking-widest text-slate-900">
                          {fullMessage.otp}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyOtp(fullMessage.otp ?? '')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      {copiedOtp ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedOtp ? 'Copied code!' : 'Copy OTP'}
                    </button>
                  </div>
                )}

                {/* Verification Links */}
                {fullMessage.links.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {fullMessage.links.slice(0, 3).map((link, idx) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Verification Link {fullMessage.links.length > 1 ? `#${idx + 1}` : ''}
                      </a>
                    ))}
                  </div>
                )}

                {/* Toolbar: HTML/Text toggle + privacy badge */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-medium dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setViewMode('html')}
                      disabled={!fullMessage.html}
                      className={`rounded-lg px-3 py-1 transition ${
                        viewMode === 'html'
                          ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-sky-300'
                          : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      Rich HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('text')}
                      className={`rounded-lg px-3 py-1 transition ${
                        viewMode === 'text'
                          ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-sky-300'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      Plain Text
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Sanitized HTML
                    </span>
                    {fullMessage.hasRemoteContent && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Remote trackers blocked
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="flex-1 p-5 sm:p-6">
                {viewMode === 'html' && fullMessage.html ? (
                  <iframe
                    title="Email content"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={`<!doctype html><html><head><style>body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;line-height:1.6;margin:0;padding:4px;font-size:14px;word-wrap:break-word;}a{color:#2563eb;}</style></head><body>${fullMessage.html}</body></html>`}
                    className="min-h-[260px] w-full rounded-2xl border border-slate-100 bg-white p-2 dark:border-slate-800"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50/80 p-4 font-mono text-xs leading-relaxed text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                    {fullMessage.text || '(Empty message body)'}
                  </pre>
                )}

                {/* Attachments */}
                {fullMessage.attachments.length > 0 && inbox && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">
                      Attachments
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {fullMessage.attachments.map((att) => (
                        <a
                          key={att.index}
                          href={api.getAttachmentUrl(inbox.address, fullMessage.id, att.index)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-blue-500" />
                          <span className="max-w-[180px] truncate">{att.filename}</span>
                          <span className="text-slate-400">({formatBytes(att.size)})</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
      {/* QR Code Transfer Modal */}
      {qrOpen && inbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="tm-card w-full max-w-sm rounded-3xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Scan to use on phone
              </h3>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="my-5 flex justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${inbox.address}`}
                  width={220}
                  height={220}
                  className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
                />
              ) : (
                <div className="h-[220px] w-[220px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              )}
            </div>
            <p className="break-all font-mono text-xs font-semibold text-blue-700 dark:text-sky-300">
              {inbox.address}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Scan with your phone camera to copy this temporary address instantly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
