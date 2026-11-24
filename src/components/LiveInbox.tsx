'use client';

import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  Columns2,
  Command,
  Copy,
  Download,
  ExternalLink,
  GripVertical,
  Link2,
  Mail,
  Maximize2,
  Paperclip,
  PenLine,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Rows2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
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
import { extractVerificationLink } from '@/lib/linkExtractor';
import {
  DEFAULT_WORKSPACE_PREFS,
  loadStoredTabs,
  loadWorkspacePrefs,
  saveStoredTabs,
  saveWorkspacePrefs,
  type EmailPaperMode,
  type StoredInboxTab,
  type WorkspaceDensity,
  type WorkspaceFontSize,
  type WorkspaceLayout,
  type WorkspacePrefs,
} from '@/lib/workspacePrefs';
import { EmailAnnotatorModal } from '@/components/EmailAnnotatorModal';
import { CommandPalette, type PaletteAction } from '@/components/CommandPalette';

const MAX_TABS = 5;

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
      gain.gain.exponentialRampToValueAtTime(0.11, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(587.33, now, 0.15);
    playTone(880.0, now + 0.11, 0.22);
    setTimeout(() => void ctx.close(), 480);
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

function makeTabId(): string {
  return `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export function LiveInbox() {
  const [domains, setDomains] = useState<string[]>(['temporamail.app']);
  const [selectedDomain, setSelectedDomain] = useState<string>('temporamail.app');

  // Multi-inbox tabs
  const [tabs, setTabs] = useState<StoredInboxTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  // Active inbox messages
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [fullMessage, setFullMessage] = useState<FullMessage | null>(null);
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Workspace preferences (persisted)
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_WORKSPACE_PREFS);
  const [prefsOpen, setPrefsOpen] = useState<boolean>(false);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [annotatorOpen, setAnnotatorOpen] = useState<boolean>(false);

  // Inline alias editing
  const [editingAlias, setEditingAlias] = useState<boolean>(false);
  const [aliasDraft, setAliasDraft] = useState<string>('');
  const [aliasBusy, setAliasBusy] = useState<boolean>(false);
  const [aliasHint, setAliasHint] = useState<string | null>(null);

  // Status & feedback
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [msLeft, setMsLeft] = useState<number>(0);
  const [loadingInbox, setLoadingInbox] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<boolean>(false);
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);
  const [copiedOtp, setCopiedOtp] = useState<boolean>(false);
  const [autoCopiedToast, setAutoCopiedToast] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const prefsRef = useRef<WorkspacePrefs>(DEFAULT_WORKSPACE_PREFS);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const prefsPopoverRef = useRef<HTMLDivElement | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId],
  );
  const inbox = activeTab?.inbox ?? null;

  const updatePrefs = useCallback((patch: Partial<WorkspacePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      prefsRef.current = next;
      saveWorkspacePrefs(next);
      return next;
    });
  }, []);

  // Load persisted prefs on mount
  useEffect(() => {
    const loaded = loadWorkspacePrefs();
    prefsRef.current = loaded;
    setPrefs(loaded);
  }, []);

  // Close preferences popover on outside click
  useEffect(() => {
    if (!prefsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (prefsPopoverRef.current && !prefsPopoverRef.current.contains(e.target as Node)) {
        setPrefsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [prefsOpen]);

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
      color: { dark: '#09090b', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [qrOpen, inbox]);

  const refreshMessages = useCallback(async (address: string) => {
    try {
      const res = await api.listMessages(address);
      setMessages(res.messages);
    } catch {
      // Handled by status/SSE
    }
  }, []);

  const createNewTab = useCallback(
    async (domain?: string, replaceCurrent = false) => {
      setLoadingInbox(true);
      setError(null);
      setAliasHint(null);
      setEditingAlias(false);

      try {
        const created = await api.createInbox(domain ? { domain } : {});
        const newTab: StoredInboxTab = { id: makeTabId(), inbox: created };

        setTabs((prev) => {
          let next: StoredInboxTab[];
          if (replaceCurrent && activeTabId) {
            next = prev.map((t) => (t.id === activeTabId ? newTab : t));
          } else {
            next = [...prev, newTab].slice(-MAX_TABS);
          }
          saveStoredTabs(next);
          return next;
        });

        setActiveTabId(newTab.id);
        setSelectedMsgId(null);
        setFullMessage(null);
        setMessages([]);
        setSearchQuery('');
        setMsLeft(Math.max(0, Date.parse(created.expiresAt) - Date.now()));
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
    },
    [activeTabId],
  );

  // Initial boot: fetch domains + hydrate persisted tabs or create first inbox
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

      const stored = loadStoredTabs();
      const validTabs: StoredInboxTab[] = [];
      for (const tab of stored) {
        try {
          const status = await api.getInboxStatus(tab.inbox.address);
          validTabs.push({
            ...tab,
            inbox: { ...tab.inbox, expiresAt: status.expiresAt },
          });
        } catch {
          // Drop expired tab
        }
      }

      if (cancelled) return;

      if (validTabs.length > 0) {
        saveStoredTabs(validTabs);
        setTabs(validTabs);
        const first = validTabs[0]!;
        setActiveTabId(first.id);
        const domainPart = first.inbox.address.split('@')[1];
        if (domainPart) setSelectedDomain(domainPart);
        setMsLeft(Math.max(0, Date.parse(first.inbox.expiresAt) - Date.now()));
        await refreshMessages(first.inbox.address);
        setLoadingInbox(false);
        return;
      }

      await createNewTab();
    }

    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When active tab changes, load its messages
  useEffect(() => {
    if (!inbox) return;
    setSelectedMsgId(null);
    setFullMessage(null);
    setSearchQuery('');
    setEditingAlias(false);
    setAliasHint(null);
    const domainPart = inbox.address.split('@')[1];
    if (domainPart) setSelectedDomain(domainPart);
    void refreshMessages(inbox.address);
  }, [inbox?.address, refreshMessages]);

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

    es.onopen = () => setStreamStatus('live');

    es.addEventListener('message', (event: MessageEvent) => {
      try {
        const summary = JSON.parse(String(event.data)) as MessageSummary;
        setMessages((prev) => {
          if (prev.some((m) => m.id === summary.id)) return prev;
          return [summary, ...prev];
        });

        const curPrefs = prefsRef.current;
        if (curPrefs.soundEnabled) {
          playNotificationChime();
        }

        if (summary.hasOtp) {
          void api
            .getMessage(inbox.address, summary.id)
            .then((full) => {
              const titleText = full.otp
                ? `(${full.otp}) New OTP — TemporaMail`
                : '(1) New Mail — TemporaMail';
              document.title = titleText;

              if (full.otp && curPrefs.autoCopyOtp && navigator.clipboard) {
                void navigator.clipboard
                  .writeText(full.otp)
                  .then(() => {
                    setAutoCopiedToast(`Auto-copied OTP: ${full.otp}`);
                    setTimeout(() => setAutoCopiedToast(null), 3200);
                  })
                  .catch(() => {});
              }

              if (
                curPrefs.notificationsEnabled &&
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
            curPrefs.notificationsEnabled &&
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
      setMsLeft(0);
    });

    es.onerror = () => {
      setStreamStatus('connecting');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [inbox, refreshMessages]);

  const handleOpenMessage = useCallback(
    async (msgId: string) => {
      if (!inbox) return;
      setSelectedMsgId(msgId);
      setLoadingMessage(true);
      try {
        const full = await api.getMessage(inbox.address, msgId);
        setFullMessage(full);
        setViewMode(full.html ? 'html' : 'text');
      } catch {
        setError('Could not load message contents.');
      } finally {
        setLoadingMessage(false);
      }
    },
    [inbox],
  );

  const handleCopyAddress = useCallback(async () => {
    if (!inbox) return;
    try {
      await navigator.clipboard.writeText(inbox.address);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 1800);
    } catch {
      // Fallback ignored
    }
  }, [inbox]);

  const handleCopyOtp = useCallback(async (otp: string) => {
    try {
      await navigator.clipboard.writeText(otp);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 1800);
    } catch {
      // Fallback ignored
    }
  }, []);

  const handleExtend = useCallback(async () => {
    if (!inbox || !activeTab) return;
    try {
      const res = await api.extendInbox(inbox.address, inbox.ownerToken, 10);
      const updatedInbox: CreatedInbox = { ...inbox, expiresAt: res.expiresAt };
      setTabs((prev) => {
        const next = prev.map((t) => (t.id === activeTab.id ? { ...t, inbox: updatedInbox } : t));
        saveStoredTabs(next);
        return next;
      });
      setMsLeft(Math.max(0, Date.parse(res.expiresAt) - Date.now()));
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
    }
  }, [inbox, activeTab]);

  const handleDeleteInbox = useCallback(async () => {
    if (!inbox) return;
    try {
      await api.deleteInbox(inbox.address, inbox.ownerToken);
    } catch {
      // Proceed to replace inbox even if already expired
    }
    await createNewTab(selectedDomain, true);
  }, [inbox, selectedDomain, createNewTab]);

  const handleDeleteMessage = useCallback(
    async (msgId: string) => {
      if (!inbox) return;
      try {
        await api.deleteMessage(inbox.address, msgId, inbox.ownerToken);
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        if (selectedMsgId === msgId) {
          setSelectedMsgId(null);
          setFullMessage(null);
        }
      } catch (err) {
        if (err instanceof ApiClientError) setError(err.message);
      }
    },
    [inbox, selectedMsgId],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      const next = tabs.filter((t) => t.id !== tabId);
      saveStoredTabs(next);
      setTabs(next);
      if (activeTabId === tabId) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        setActiveTabId(fallback?.id ?? null);
      }
    },
    [tabs, activeTabId],
  );

  const handleTabDrop = useCallback(
    (targetTabId: string) => {
      if (!draggedTabId || draggedTabId === targetTabId) return;
      setTabs((prev) => {
        const fromIdx = prev.findIndex((t) => t.id === draggedTabId);
        const toIdx = prev.findIndex((t) => t.id === targetTabId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const copy = [...prev];
        const [moved] = copy.splice(fromIdx, 1);
        if (!moved) return prev;
        copy.splice(toIdx, 0, moved);
        saveStoredTabs(copy);
        return copy;
      });
      setDraggedTabId(null);
    },
    [draggedTabId],
  );

  const handleToggleNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (prefs.notificationsEnabled) {
      updatePrefs({ notificationsEnabled: false });
      return;
    }
    if (Notification.permission === 'granted') {
      updatePrefs({ notificationsEnabled: true });
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      updatePrefs({ notificationsEnabled: true });
    }
  }, [prefs.notificationsEnabled, updatePrefs]);

  // Inline custom alias claim (for signed-in accounts)
  const handleStartEditAlias = useCallback(() => {
    if (!inbox) return;
    const localPart = inbox.address.split('@')[0] ?? '';
    setAliasDraft(localPart);
    setAliasHint(null);
    setEditingAlias(true);
  }, [inbox]);

  const handleSubmitAlias = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = aliasDraft.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (cleaned.length < 3) {
        setAliasHint('Use at least 3 characters (letters, numbers, ., _, -).');
        return;
      }
      setAliasBusy(true);
      setAliasHint(null);
      try {
        const created = await api.createAccountInbox({
          domain: selectedDomain,
          customName: cleaned,
        });
        const nextInbox: CreatedInbox = {
          address: created.address,
          expiresAt: created.expiresAt,
          ownerToken: inbox?.ownerToken ?? '',
        };
        const newTab: StoredInboxTab = { id: makeTabId(), inbox: nextInbox };
        setTabs((prev) => {
          const next = activeTabId
            ? prev.map((t) => (t.id === activeTabId ? newTab : t))
            : [...prev, newTab];
          saveStoredTabs(next);
          return next;
        });
        setActiveTabId(newTab.id);
        setEditingAlias(false);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          setAliasHint('Custom aliases require a free account — sign in to claim yours.');
        } else if (err instanceof ApiClientError) {
          setAliasHint(err.message);
        } else {
          setAliasHint('Could not claim custom alias right now.');
        }
      } finally {
        setAliasBusy(false);
      }
    },
    [aliasDraft, selectedDomain, inbox?.ownerToken, activeTabId],
  );

  // Draggable split-pane resize
  const handleSplitPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingSplit(true);
    const container = splitContainerRef.current;
    if (!container) return;

    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.round(Math.min(58, Math.max(24, pct)));
      updatePrefs({ splitRatio: clamped });
    };

    const onUp = () => {
      setIsDraggingSplit(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [updatePrefs]);

  // Filtered messages
  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        (m.subject || '').toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q),
    );
  }, [messages, searchQuery]);

  // Extracted verification link for open email
  const verificationLink = useMemo(() => {
    if (!fullMessage) return null;
    return extractVerificationLink(fullMessage.html, fullMessage.text);
  }, [fullMessage]);

  // Global keyboard shortcuts + Ctrl+K palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      if (paletteOpen || annotatorOpen || qrOpen || editingAlias) return;
      if (isEditableElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        void handleCopyAddress();
      } else if (key === 'r') {
        e.preventDefault();
        void createNewTab(selectedDomain, true);
      } else if (key === 'n' && tabs.length < MAX_TABS) {
        e.preventDefault();
        void createNewTab(selectedDomain, false);
      } else if (key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === 'q' && inbox) {
        e.preventDefault();
        setQrOpen(true);
      } else if (key === 'a' && fullMessage) {
        e.preventDefault();
        setAnnotatorOpen(true);
      } else if (key === '1') {
        updatePrefs({ layout: 'split' });
      } else if (key === '2') {
        updatePrefs({ layout: 'stacked' });
      } else if (key === '3') {
        updatePrefs({ layout: 'focus' });
      } else if (key === 'j' || key === 'k') {
        if (filteredMessages.length === 0) return;
        e.preventDefault();
        const idx = filteredMessages.findIndex((m) => m.id === selectedMsgId);
        const nextIdx =
          key === 'j'
            ? idx < filteredMessages.length - 1
              ? idx + 1
              : 0
            : idx > 0
              ? idx - 1
              : filteredMessages.length - 1;
        const nextMsg = filteredMessages[nextIdx];
        if (nextMsg) void handleOpenMessage(nextMsg.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    paletteOpen,
    annotatorOpen,
    qrOpen,
    editingAlias,
    handleCopyAddress,
    createNewTab,
    selectedDomain,
    tabs.length,
    inbox,
    fullMessage,
    updatePrefs,
    filteredMessages,
    selectedMsgId,
    handleOpenMessage,
  ]);

  const paletteActions: PaletteAction[] = useMemo(
    () => [
      {
        id: 'copy',
        label: 'Copy current email address',
        hint: inbox?.address,
        shortcut: 'C',
        disabled: !inbox,
        onRun: () => void handleCopyAddress(),
      },
      {
        id: 'new-tab',
        label: 'Open new inbox tab',
        hint: `Keep up to ${MAX_TABS} live addresses side by side`,
        shortcut: 'N',
        disabled: tabs.length >= MAX_TABS,
        onRun: () => void createNewTab(selectedDomain, false),
      },
      {
        id: 'regen',
        label: 'Generate new address in current tab',
        shortcut: 'R',
        onRun: () => void createNewTab(selectedDomain, true),
      },
      {
        id: 'extend',
        label: 'Extend inbox timer (+10 min)',
        disabled: !inbox,
        onRun: () => void handleExtend(),
      },
      {
        id: 'qr',
        label: 'Show QR code for phone transfer',
        shortcut: 'Q',
        disabled: !inbox,
        onRun: () => setQrOpen(true),
      },
      {
        id: 'annotate',
        label: 'Annotate / redact open email as PNG',
        shortcut: 'A',
        disabled: !fullMessage,
        onRun: () => setAnnotatorOpen(true),
      },
      {
        id: 'layout-split',
        label: 'Switch to Split layout',
        shortcut: '1',
        onRun: () => updatePrefs({ layout: 'split' }),
      },
      {
        id: 'layout-stacked',
        label: 'Switch to Stacked layout',
        shortcut: '2',
        onRun: () => updatePrefs({ layout: 'stacked' }),
      },
      {
        id: 'layout-focus',
        label: 'Switch to Focus reader layout',
        shortcut: '3',
        onRun: () => updatePrefs({ layout: 'focus' }),
      },
      {
        id: 'auto-otp',
        label: prefs.autoCopyOtp ? 'Disable Auto-Copy OTP' : 'Enable Auto-Copy OTP on arrival',
        onRun: () => updatePrefs({ autoCopyOtp: !prefs.autoCopyOtp }),
      },
    ],
    [
      inbox,
      tabs.length,
      selectedDomain,
      fullMessage,
      prefs.autoCopyOtp,
      handleCopyAddress,
      createNewTab,
      handleExtend,
      updatePrefs,
    ],
  );

  // Typography & density classes
  const rowPadding = prefs.density === 'compact' ? 'px-3.5 py-2.5' : 'px-4 py-3.5';
  const bodyFontClass =
    prefs.fontSize === 'sm'
      ? 'text-xs leading-relaxed'
      : prefs.fontSize === 'lg'
        ? 'text-base leading-relaxed'
        : 'text-sm leading-relaxed';

  // HTML email paper filter for dark mode
  const iframePaperClass =
    prefs.emailPaper === 'dark'
      ? 'invert-[0.9] hue-rotate-180'
      : prefs.emailPaper === 'auto'
        ? 'dark:invert-[0.88] dark:hue-rotate-180'
        : '';

  const localPart = inbox?.address.split('@')[0] ?? '';
  const domainPart = inbox?.address.split('@')[1] ?? selectedDomain;

  return (
    <div className="space-y-4">
      {/* Multi-Inbox Draggable Tab Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab?.id;
            const shortName = tab.inbox.address.split('@')[0] ?? tab.inbox.address;
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={() => setDraggedTabId(tab.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleTabDrop(tab.id)}
                onDragEnd={() => setDraggedTabId(null)}
                onClick={() => setActiveTabId(tab.id)}
                role="tab"
                aria-selected={isActive}
                title={`${tab.inbox.address} — drag to reorder`}
                className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all select-none ${
                  isActive
                    ? 'border-zinc-300 bg-white text-zinc-950 shadow-xs dark:border-zinc-700 dark:bg-[#18181b] dark:text-zinc-50'
                    : 'border-transparent bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70 dark:bg-[#111113] dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <GripVertical className="h-3 w-3 cursor-grab text-zinc-400 opacity-60 group-hover:opacity-100" />
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive && streamStatus === 'live'
                      ? 'bg-emerald-500'
                      : 'bg-zinc-400 dark:bg-zinc-600'
                  }`}
                />
                <span className="max-w-[140px] truncate font-mono">{shortName}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="ml-0.5 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                    aria-label="Close inbox tab"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {tabs.length < MAX_TABS && (
            <button
              type="button"
              onClick={() => void createNewTab(selectedDomain, false)}
              disabled={loadingInbox}
              className="inline-flex items-center gap-1 rounded-xl border border-dashed border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-[#18181b] dark:hover:text-zinc-100"
              title="Open another live disposable inbox (N)"
            >
              <Plus className="h-3.5 w-3.5" />
              New Tab
            </button>
          )}
        </div>

        {/* Layout Switcher + Command Palette + Workspace Preferences */}
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center rounded-xl border border-zinc-200 bg-zinc-100/70 p-0.5 sm:flex dark:border-zinc-800 dark:bg-[#111113]">
            {(
              [
                { id: 'split', icon: Columns2, label: 'Split (1)' },
                { id: 'stacked', icon: Rows2, label: 'Stacked (2)' },
                { id: 'focus', icon: Maximize2, label: 'Focus (3)' },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => updatePrefs({ layout: id })}
                title={label}
                className={`rounded-lg p-1.5 transition-colors ${
                  prefs.layout === id
                    ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
            title="Command palette & shortcuts (Ctrl+K)"
          >
            <Command className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="hidden rounded border border-zinc-200 bg-zinc-50 px-1 py-0.2 font-mono text-[10px] text-zinc-400 sm:inline dark:border-zinc-700 dark:bg-zinc-900">
              ⌘K
            </kbd>
          </button>

          {/* Preferences Popover */}
          <div className="relative" ref={prefsPopoverRef}>
            <button
              type="button"
              onClick={() => setPrefsOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                prefsOpen
                  ? 'border-zinc-400 bg-zinc-100 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-[#111113] dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100'
              }`}
              title="Customize workspace"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Customize</span>
            </button>

            {prefsOpen && (
              <div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-[#111113]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Workspace Preferences
                  </span>
                  <button
                    type="button"
                    onClick={() => updatePrefs(DEFAULT_WORKSPACE_PREFS)}
                    className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* Layout */}
                  <div>
                    <div className="mb-1.5 font-medium text-zinc-600 dark:text-zinc-400">
                      Layout
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-[#18181b]">
                      {(['split', 'stacked', 'focus'] as const satisfies readonly WorkspaceLayout[]).map(
                        (mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updatePrefs({ layout: mode })}
                            className={`rounded-lg py-1 font-medium capitalize transition-colors ${
                              prefs.layout === mode
                                ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                            }`}
                          >
                            {mode}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Density */}
                  <div>
                    <div className="mb-1.5 font-medium text-zinc-600 dark:text-zinc-400">
                      List Density
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-[#18181b]">
                      {(
                        ['compact', 'comfortable'] as const satisfies readonly WorkspaceDensity[]
                      ).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updatePrefs({ density: d })}
                          className={`rounded-lg py-1 font-medium capitalize transition-colors ${
                            prefs.density === d
                              ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text size */}
                  <div>
                    <div className="mb-1.5 font-medium text-zinc-600 dark:text-zinc-400">
                      Reader Text Size
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-[#18181b]">
                      {(
                        [
                          { id: 'sm', label: 'Small' },
                          { id: 'base', label: 'Default' },
                          { id: 'lg', label: 'Large' },
                        ] as const satisfies ReadonlyArray<{
                          id: WorkspaceFontSize;
                          label: string;
                        }>
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => updatePrefs({ fontSize: s.id })}
                          className={`rounded-lg py-1 font-medium transition-colors ${
                            prefs.fontSize === s.id
                              ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* HTML Email Paper */}
                  <div>
                    <div className="mb-1.5 font-medium text-zinc-600 dark:text-zinc-400">
                      HTML Email Paper
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-[#18181b]">
                      {(['auto', 'light', 'dark'] as const satisfies readonly EmailPaperMode[]).map(
                        (p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => updatePrefs({ emailPaper: p })}
                            className={`rounded-lg py-1 font-medium capitalize transition-colors ${
                              prefs.emailPaper === p
                                ? 'bg-white text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-50'
                                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Auto-copy OTP toggle */}
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <div>
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">
                        Auto-copy OTP
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Copy code on arrival
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.autoCopyOtp}
                      onChange={(e) => updatePrefs({ autoCopyOtp: e.target.checked })}
                      className="h-4 w-4 rounded accent-blue-600"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Bar Card */}
      <div className="tm-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Active Disposable Address
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  streamStatus === 'live'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-900/80'
                    : streamStatus === 'connecting'
                      ? 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700'
                      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    streamStatus === 'live'
                      ? 'animate-pulse bg-emerald-500'
                      : streamStatus === 'connecting'
                        ? 'bg-blue-500'
                        : 'bg-amber-500'
                  }`}
                />
                {streamStatus === 'live'
                  ? 'Live'
                  : streamStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Offline'}
              </span>
              {inbox && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[11px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  <Clock className="h-3 w-3 text-zinc-500" />
                  {formatCountdown(msLeft)}
                </span>
              )}
              {autoCopiedToast && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <Check className="h-3 w-3" />
                  {autoCopiedToast}
                </span>
              )}
            </div>

            {editingAlias ? (
              <form onSubmit={(e) => void handleSubmitAlias(e)} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-xl border border-blue-500 bg-zinc-50 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 dark:bg-[#18181b]">
                    <input
                      type="text"
                      value={aliasDraft}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      autoFocus
                      placeholder="custom-alias"
                      className="min-w-0 flex-1 bg-transparent font-mono text-sm font-semibold text-zinc-950 focus:outline-none dark:text-zinc-50"
                    />
                    <span className="shrink-0 font-mono text-sm text-zinc-500 dark:text-zinc-400">
                      @{domainPart}
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={aliasBusy}
                    className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {aliasBusy ? 'Saving...' : 'Claim'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAlias(false);
                      setAliasHint(null);
                    }}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
                {aliasHint && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {aliasHint}{' '}
                    {aliasHint.includes('sign in') && (
                      <Link href="/login" className="font-semibold underline">
                        Sign in →
                      </Link>
                    )}
                  </p>
                )}
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/90 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-[#18181b]">
                  <span className="truncate font-mono text-sm font-semibold text-zinc-950 sm:text-base dark:text-zinc-50">
                    {loadingInbox ? 'Generating address...' : inbox ? (
                      <>
                        <button
                          type="button"
                          onClick={handleStartEditAlias}
                          className="rounded px-0.5 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                          title="Click to customize alias"
                        >
                          {localPart}
                        </button>
                        <span className="text-zinc-500 dark:text-zinc-400">@{domainPart}</span>
                      </>
                    ) : (
                      'Unavailable'
                    )}
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    {inbox && (
                      <button
                        type="button"
                        onClick={handleStartEditAlias}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        title="Edit alias"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {domains.length > 1 && (
                      <select
                        value={selectedDomain}
                        onChange={(e) => {
                          setSelectedDomain(e.target.value);
                          void createNewTab(e.target.value, true);
                        }}
                        aria-label="Select domain"
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-[#111113] dark:text-zinc-200"
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

                <button
                  type="button"
                  onClick={() => void handleCopyAddress()}
                  disabled={!inbox}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {copiedAddr ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              disabled={!inbox}
              title="Transfer address to phone via QR code (Q)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <QrCode className="h-3.5 w-3.5" />
              QR
            </button>

            <button
              type="button"
              onClick={() => updatePrefs({ soundEnabled: !prefs.soundEnabled })}
              title={prefs.soundEnabled ? 'Mute arrival chime' : 'Enable arrival chime'}
              className={`inline-flex items-center rounded-xl border p-2 transition-colors ${
                prefs.soundEnabled
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'border-zinc-200 bg-white text-zinc-400 hover:text-zinc-700 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-500'
              }`}
            >
              {prefs.soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleToggleNotifications()}
              title={
                prefs.notificationsEnabled
                  ? 'Disable desktop notifications'
                  : 'Enable desktop notifications'
              }
              className={`inline-flex items-center rounded-xl border p-2 transition-colors ${
                prefs.notificationsEnabled
                  ? 'border-blue-500/40 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
                  : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => void handleExtend()}
              disabled={!inbox}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <Plus className="h-3.5 w-3.5" />
              10m
            </button>

            <button
              type="button"
              onClick={() => void createNewTab(selectedDomain, true)}
              disabled={loadingInbox}
              title="Generate a fresh address (R)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-50 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingInbox ? 'animate-spin' : ''}`} />
              New
            </button>

            <button
              type="button"
              onClick={() => void handleDeleteInbox()}
              disabled={!inbox || loadingInbox}
              className="inline-flex items-center rounded-xl border border-zinc-200 bg-white p-2 text-zinc-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-400 dark:hover:border-red-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              title="Destroy inbox"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Resizable / Customizable Workspace Container */}
      <div
        ref={splitContainerRef}
        className={`tm-card overflow-hidden rounded-2xl ${
          prefs.layout === 'split'
            ? 'flex flex-col lg:flex-row'
            : prefs.layout === 'stacked'
              ? 'flex flex-col'
              : 'flex flex-col'
        }`}
      >
        {/* Message List Pane (hidden in Focus mode when a message is open) */}
        {(prefs.layout !== 'focus' || !fullMessage) && (
          <div
            style={
              prefs.layout === 'split'
                ? { flexBasis: `${prefs.splitRatio}%` }
                : undefined
            }
            className={`flex flex-col border-zinc-200 dark:border-zinc-800 ${
              prefs.layout === 'split'
                ? 'min-h-[340px] border-b lg:min-h-[480px] lg:shrink-0 lg:border-b-0'
                : 'max-h-[280px] border-b'
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-[#141416]">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Inbox
                </span>
                <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {messages.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => inbox && void refreshMessages(inbox.address)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                title="Refresh messages"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Search bar inside message list */}
            {messages.length > 0 && (
              <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-[#18181b]">
                  <Search className="h-3.5 w-3.5 text-zinc-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter sender or subject... (/)"
                    className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <Image
                  src="/images/empty-inbox.svg"
                  alt="Waiting for incoming emails"
                  width={120}
                  height={96}
                  className="mb-3 opacity-85"
                />
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Waiting for incoming mail
                </p>
                <p className="mt-1 max-w-[230px] text-xs text-zinc-500 dark:text-zinc-400">
                  Copy your address above. Messages arrive instantly with zero page refresh.
                </p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-8 text-xs text-zinc-500 dark:text-zinc-400">
                No messages match &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800/80">
                {filteredMessages.map((m) => {
                  const active = m.id === selectedMsgId;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => void handleOpenMessage(m.id)}
                        className={`w-full text-left transition-colors ${rowPadding} ${
                          active
                            ? 'bg-zinc-100/90 dark:bg-[#1c1c20]'
                            : 'hover:bg-zinc-50 dark:hover:bg-[#161619]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-xs font-semibold ${
                              active
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {m.from}
                          </span>
                          <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                            {formatTime(m.date)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {m.subject || '(No subject)'}
                        </p>
                        {(m.hasOtp || m.attachmentCount > 0) && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {m.hasOtp && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                OTP
                              </span>
                            )}
                            {m.attachmentCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                <Paperclip className="h-2.5 w-2.5" />
                                {m.attachmentCount}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Draggable Split-Pane Divider (Desktop Split View) */}
        {prefs.layout === 'split' && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to resize message list and reader"
            title="Drag to resize • Double-click to reset"
            onPointerDown={handleSplitPointerDown}
            onDoubleClick={() => updatePrefs({ splitRatio: DEFAULT_WORKSPACE_PREFS.splitRatio })}
            className={`tm-resize-handle hidden w-2 shrink-0 items-center justify-center border-x border-zinc-200/80 transition-colors lg:flex dark:border-zinc-800 ${
              isDraggingSplit
                ? 'bg-blue-500/20'
                : 'bg-zinc-50/70 hover:bg-zinc-200/70 dark:bg-[#141416] dark:hover:bg-zinc-800'
            }`}
          >
            <div className="h-8 w-0.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          </div>
        )}

        {/* Message Reader Pane */}
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col bg-white dark:bg-[#111113]">
          {loadingMessage ? (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-zinc-500 dark:text-zinc-400">
              Loading message...
            </div>
          ) : !fullMessage ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-[#18181b] dark:text-zinc-400">
                <Mail className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Select a message to read
              </p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
                Drag the center divider to resize, press{' '}
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-900">
                  J
                </kbd>
                /
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-900">
                  K
                </kbd>{' '}
                to navigate, or{' '}
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-900">
                  Ctrl+K
                </kbd>{' '}
                for commands.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              {/* Reader Header */}
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                {prefs.layout === 'focus' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMsgId(null);
                      setFullMessage(null);
                    }}
                    className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    ← Back to inbox list
                  </button>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-zinc-950 dark:text-zinc-50">
                      {fullMessage.subject || '(No subject)'}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      From:{' '}
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {fullMessage.from}
                      </span>{' '}
                      · {new Date(fullMessage.date).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {fullMessage.html && (
                      <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 text-xs dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setViewMode('html')}
                          className={`rounded-md px-2 py-1 font-medium ${
                            viewMode === 'html'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                          }`}
                        >
                          HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('text')}
                          className={`rounded-md px-2 py-1 font-medium ${
                            viewMode === 'text'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                          }`}
                        >
                          Text
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setAnnotatorOpen(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-300 dark:hover:bg-zinc-800"
                      title="Draw, highlight, or redact & export PNG (A)"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Annotate
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadMessageAsEml(fullMessage)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-300 dark:hover:bg-zinc-800"
                      title="Download .eml"
                    >
                      <Download className="h-3.5 w-3.5" />
                      .eml
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteMessage(fullMessage.id)}
                      className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-400 dark:hover:border-red-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      title="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Privacy Shield Badges */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    Sanitized HTML
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-[#18181b] dark:text-zinc-400">
                    Trackers &amp; scripts blocked
                  </span>
                </div>

                {/* Smart Action Strip: OTP + One-Click Verification Link */}
                {(fullMessage.otp || verificationLink) && (
                  <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
                    {fullMessage.otp && (
                      <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/70 px-3.5 py-2.5 dark:border-blue-900/60 dark:bg-blue-950/30">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            OTP
                          </span>
                          <span className="font-mono text-base font-bold tracking-widest text-blue-700 dark:text-blue-300">
                            {fullMessage.otp}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopyOtp(fullMessage.otp!)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          {copiedOtp ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {verificationLink && (
                      <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-[#18181b]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="truncate">{verificationLink.label}</span>
                          </div>
                          <div className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            {verificationLink.domain}
                          </div>
                        </div>
                        <a
                          href={verificationLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments */}
                {fullMessage.attachments.length > 0 && inbox && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fullMessage.attachments.map((att) => (
                      <a
                        key={att.index}
                        href={api.getAttachmentUrl(inbox.address, fullMessage.id, att.index)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-300 dark:hover:text-blue-400"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="max-w-[160px] truncate">{att.filename}</span>
                        <span className="text-zinc-400">({formatBytes(att.size)})</span>
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Body */}
              <div className="flex-1 p-5">
                {viewMode === 'html' && fullMessage.html ? (
                  <iframe
                    title="Email content"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;color:#09090b;background:#ffffff;margin:0;padding:12px;line-height:1.6;font-size:${prefs.fontSize === 'sm' ? '13px' : prefs.fontSize === 'lg' ? '16px' : '14px'};word-break:break-word;}a{color:#2563eb;}img{max-width:100%;height:auto;}</style></head><body>${fullMessage.html}</body></html>`}
                    className={`min-h-[320px] w-full rounded-xl border border-zinc-200 bg-white transition-all dark:border-zinc-800 ${iframePaperClass}`}
                  />
                ) : (
                  <pre
                    className={`whitespace-pre-wrap break-words font-sans text-zinc-800 dark:text-zinc-200 ${bodyFontClass}`}
                  >
                    {fullMessage.text || '(Empty message body)'}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Phone Transfer Modal */}
      {qrOpen && inbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-[#111113]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Transfer to Phone
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close QR modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Scan with your phone camera to copy this disposable address instantly.
            </p>
            <div className="mx-auto my-5 flex h-56 w-56 items-center justify-center rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Disposable email QR code" className="h-full w-full" />
              ) : (
                <span className="text-xs text-zinc-400">Generating QR...</span>
              )}
            </div>
            <div className="truncate rounded-xl bg-zinc-100 px-3 py-2 font-mono text-xs font-semibold text-zinc-800 dark:bg-[#18181b] dark:text-zinc-200">
              {inbox.address}
            </div>
          </div>
        </div>
      )}

      {/* Drawable Email Annotator & Redactor Modal */}
      {annotatorOpen && fullMessage && (
        <EmailAnnotatorModal message={fullMessage} onClose={() => setAnnotatorOpen(false)} />
      )}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        open={paletteOpen}
        actions={paletteActions}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
