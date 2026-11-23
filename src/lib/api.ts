export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3000';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export interface CreatedInbox {
  readonly address: string;
  readonly ownerToken: string;
  readonly expiresAt: string;
}

export interface InboxStatus {
  readonly address: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ttlSeconds: number;
  readonly messageCount: number;
}

export interface MessageSummary {
  readonly id: string;
  readonly from: string;
  readonly subject: string;
  readonly date: string;
  readonly hasOtp: boolean;
  readonly spamFlagged: boolean;
  readonly attachmentCount: number;
}

export interface StoredAttachmentMetadata {
  readonly index: number;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
}

export interface FullMessage {
  readonly id: string;
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly date: string;
  readonly text: string;
  readonly html: string;
  readonly hasRemoteContent: boolean;
  readonly otp: string | null;
  readonly links: readonly string[];
  readonly attachments: readonly StoredAttachmentMetadata[];
  readonly spamScore: number;
  readonly spamFlagged: boolean;
}

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly planId: string;
  readonly totpEnabled: boolean;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
}

export interface PlanEntitlements {
  readonly planId: string;
  readonly maxInboxLifetimeMinutes: number;
  readonly maxActiveAddresses: number;
  readonly maxReservedCustomNames: number;
  readonly maxApiKeys: number;
  readonly apiRequestsPerDay: number;
  readonly maxAttachmentBytes: number;
  readonly privateDomain: boolean;
}

export interface AccountInboxItem {
  readonly id: string;
  readonly address: string;
  readonly customName: boolean;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface ApiKeyItem {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly last4: string;
  readonly scopes: readonly string[];
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly lastIp: string | null;
  readonly revokedAt: string | null;
}

export interface UserSessionItem {
  readonly id: string;
  readonly current: boolean;
  readonly ip: string;
  readonly userAgent: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    ownerToken?: string;
    csrf?: boolean;
  } = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.ownerToken) {
    headers['x-owner-token'] = options.ownerToken;
  }
  if (options.csrf || method !== 'GET') {
    headers['x-requested-with'] = 'XMLHttpRequest';
  }

  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    let code = 'REQUEST_FAILED';
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } };
      if (data.error?.code) code = data.error.code;
      if (data.error?.message) message = data.error.message;
    } catch {
      // Ignore non-JSON error body
    }
    throw new ApiClientError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export const api = {
  // Anonymous / core inbox endpoints
  getDomains: () => apiRequest<{ domains: string[] }>('/domains'),
  createInbox: (payload: { domain?: string; ttlMinutes?: number } = {}) =>
    apiRequest<CreatedInbox>('/inbox', { method: 'POST', body: payload }),
  getInboxStatus: (address: string) =>
    apiRequest<InboxStatus>(`/inbox/${encodeURIComponent(address)}`),
  listMessages: (address: string) =>
    apiRequest<{ address: string; messages: MessageSummary[] }>(
      `/inbox/${encodeURIComponent(address)}/messages`,
    ),
  getMessage: (address: string, id: string) =>
    apiRequest<FullMessage>(
      `/inbox/${encodeURIComponent(address)}/messages/${encodeURIComponent(id)}`,
    ),
  extendInbox: (address: string, ownerToken: string, ttlMinutes?: number) =>
    apiRequest<{ address: string; expiresAt: string; ttlSeconds: number }>(
      `/inbox/${encodeURIComponent(address)}/extend`,
      { method: 'POST', ownerToken, body: ttlMinutes ? { ttlMinutes } : {} },
    ),
  deleteInbox: (address: string, ownerToken: string) =>
    apiRequest<{ deleted: boolean }>(`/inbox/${encodeURIComponent(address)}`, {
      method: 'DELETE',
      ownerToken,
    }),
  deleteMessage: (address: string, id: string, ownerToken: string) =>
    apiRequest<{ deleted: boolean }>(
      `/inbox/${encodeURIComponent(address)}/messages/${encodeURIComponent(id)}`,
      { method: 'DELETE', ownerToken },
    ),
  getStreamUrl: (address: string) =>
    `${API_BASE_URL}/api/v1/inbox/${encodeURIComponent(address)}/stream`,
  getAttachmentUrl: (address: string, msgId: string, index: number) =>
    `${API_BASE_URL}/api/v1/inbox/${encodeURIComponent(address)}/messages/${encodeURIComponent(msgId)}/attachments/${index}`,

  // Auth endpoints
  signup: (email: string, password: string) =>
    apiRequest<{ message: string }>('/auth/signup', {
      method: 'POST',
      body: { email, password },
    }),
  verifyEmail: (token: string) =>
    apiRequest<{ verified: boolean; user: UserProfile }>(
      `/auth/verify?token=${encodeURIComponent(token)}`,
    ),
  login: (email: string, password: string, rememberMe: boolean = false) =>
    apiRequest<{ mfaRequired: boolean; mfaToken?: string; user?: UserProfile }>('/auth/login', {
      method: 'POST',
      body: { email, password, rememberMe },
    }),
  loginMfa: (mfaToken: string, code: string) =>
    apiRequest<{ authenticated: boolean; user: UserProfile }>('/auth/login/mfa', {
      method: 'POST',
      body: { mfaToken, code },
    }),
  logout: () => apiRequest<{ loggedOut: boolean }>('/auth/logout', { method: 'POST', csrf: true }),
  logoutAll: () =>
    apiRequest<{ loggedOutAll: boolean }>('/auth/logout-all', { method: 'POST', csrf: true }),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token: string, newPassword: string) =>
    apiRequest<{ reset: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
    }),
  getGoogleAuthUrl: () => `${API_BASE_URL}/api/v1/auth/google`,

  // Account & profile
  getMe: () => apiRequest<{ user: UserProfile; entitlements: PlanEntitlements }>('/account/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ updated: boolean }>('/account/password', {
      method: 'POST',
      csrf: true,
      body: { currentPassword, newPassword },
    }),
  listSessions: () => apiRequest<{ sessions: UserSessionItem[] }>('/account/sessions'),
  revokeSession: (id: string) =>
    apiRequest<{ deleted: boolean }>(`/account/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      csrf: true,
    }),
  exportAccountData: () => apiRequest<Record<string, unknown>>('/account/export'),
  deleteAccount: (email: string, password?: string) =>
    apiRequest<{ deleted: boolean }>('/account/delete', {
      method: 'POST',
      csrf: true,
      body: { email, ...(password ? { password } : {}) },
    }),

  // 2FA
  setup2fa: () =>
    apiRequest<{ secret: string; otpauthUrl: string }>('/account/2fa/setup', {
      method: 'POST',
      csrf: true,
    }),
  enable2fa: (code: string) =>
    apiRequest<{ enabled: boolean; recoveryCodes: string[] }>('/account/2fa/enable', {
      method: 'POST',
      csrf: true,
      body: { code },
    }),
  disable2fa: (password: string, code: string) =>
    apiRequest<{ enabled: boolean }>('/account/2fa/disable', {
      method: 'POST',
      csrf: true,
      body: { password, code },
    }),

  // Account Inboxes
  listAccountInboxes: () => apiRequest<{ inboxes: AccountInboxItem[] }>('/account/inboxes'),
  createAccountInbox: (payload: { domain?: string; customName?: string; ttlMinutes?: number }) =>
    apiRequest<AccountInboxItem>('/account/inboxes', {
      method: 'POST',
      csrf: true,
      body: payload,
    }),
  deleteAccountInbox: (id: string) =>
    apiRequest<{ deleted: boolean; address: string }>(
      `/account/inboxes/${encodeURIComponent(id)}`,
      { method: 'DELETE', csrf: true },
    ),
  listAccountInboxMessages: (id: string) =>
    apiRequest<{ address: string; messages: MessageSummary[] }>(
      `/account/inboxes/${encodeURIComponent(id)}/messages`,
    ),
  getAccountInboxMessage: (id: string, msgId: string) =>
    apiRequest<FullMessage>(
      `/account/inboxes/${encodeURIComponent(id)}/messages/${encodeURIComponent(msgId)}`,
    ),

  // API Keys
  listApiKeys: () => apiRequest<{ apiKeys: ApiKeyItem[] }>('/account/api-keys'),
  createApiKey: (name: string, scopes?: string[]) =>
    apiRequest<{ apiKey: ApiKeyItem; key: string }>('/account/api-keys', {
      method: 'POST',
      csrf: true,
      body: { name, ...(scopes ? { scopes } : {}) },
    }),
  revokeApiKey: (id: string) =>
    apiRequest<{ revoked: boolean }>(`/account/api-keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      csrf: true,
    }),
};
