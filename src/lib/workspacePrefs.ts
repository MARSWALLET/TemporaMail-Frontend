import type { CreatedInbox } from '@/lib/api';

export type WorkspaceLayout = 'split' | 'stacked' | 'focus';
export type WorkspaceDensity = 'compact' | 'comfortable';
export type WorkspaceFontSize = 'sm' | 'base' | 'lg';
export type EmailPaperMode = 'auto' | 'light' | 'dark';

export interface WorkspacePrefs {
  readonly layout: WorkspaceLayout;
  readonly splitRatio: number; // percentage for message list pane (24..58)
  readonly density: WorkspaceDensity;
  readonly fontSize: WorkspaceFontSize;
  readonly autoCopyOtp: boolean;
  readonly emailPaper: EmailPaperMode;
  readonly soundEnabled: boolean;
  readonly notificationsEnabled: boolean;
}

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  layout: 'split',
  splitRatio: 36,
  density: 'comfortable',
  fontSize: 'base',
  autoCopyOtp: false,
  emailPaper: 'auto',
  soundEnabled: true,
  notificationsEnabled: false,
};

const PREFS_KEY = 'temporamail_workspace_prefs_v1';
const TABS_KEY = 'temporamail_inbox_tabs_v1';

export interface StoredInboxTab {
  readonly id: string;
  readonly inbox: CreatedInbox;
  readonly label?: string;
}

export function loadWorkspacePrefs(): WorkspacePrefs {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_WORKSPACE_PREFS;
    const parsed = JSON.parse(raw) as Partial<WorkspacePrefs>;
    const splitRatio =
      typeof parsed.splitRatio === 'number' && Number.isFinite(parsed.splitRatio)
        ? Math.min(58, Math.max(24, parsed.splitRatio))
        : DEFAULT_WORKSPACE_PREFS.splitRatio;
    return {
      layout:
        parsed.layout === 'split' || parsed.layout === 'stacked' || parsed.layout === 'focus'
          ? parsed.layout
          : DEFAULT_WORKSPACE_PREFS.layout,
      splitRatio,
      density:
        parsed.density === 'compact' || parsed.density === 'comfortable'
          ? parsed.density
          : DEFAULT_WORKSPACE_PREFS.density,
      fontSize:
        parsed.fontSize === 'sm' || parsed.fontSize === 'base' || parsed.fontSize === 'lg'
          ? parsed.fontSize
          : DEFAULT_WORKSPACE_PREFS.fontSize,
      autoCopyOtp:
        typeof parsed.autoCopyOtp === 'boolean'
          ? parsed.autoCopyOtp
          : DEFAULT_WORKSPACE_PREFS.autoCopyOtp,
      emailPaper:
        parsed.emailPaper === 'auto' ||
        parsed.emailPaper === 'light' ||
        parsed.emailPaper === 'dark'
          ? parsed.emailPaper
          : DEFAULT_WORKSPACE_PREFS.emailPaper,
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean'
          ? parsed.soundEnabled
          : DEFAULT_WORKSPACE_PREFS.soundEnabled,
      notificationsEnabled:
        typeof parsed.notificationsEnabled === 'boolean'
          ? parsed.notificationsEnabled
          : DEFAULT_WORKSPACE_PREFS.notificationsEnabled,
    };
  } catch {
    return DEFAULT_WORKSPACE_PREFS;
  }
}

export function saveWorkspacePrefs(prefs: WorkspacePrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadStoredTabs(): StoredInboxTab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredInboxTab[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter(
        (t) =>
          t &&
          typeof t.id === 'string' &&
          t.inbox &&
          typeof t.inbox.address === 'string' &&
          Date.parse(t.inbox.expiresAt) > now + 5000,
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function saveStoredTabs(tabs: readonly StoredInboxTab[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TABS_KEY, JSON.stringify(tabs.slice(0, 5)));
  } catch {
    // Ignore storage quota errors
  }
}
