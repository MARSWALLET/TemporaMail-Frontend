'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Code2, Copy, KeyRound, Terminal, Zap } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

type LangTab = 'curl' | 'node' | 'python' | 'playwright';

const SNIPPETS: Record<LangTab, { readonly label: string; readonly code: string }> = {
  curl: {
    label: 'cURL',
    code: `# 1. Create a temporary inbox (API key skips CAPTCHA)
curl -s -X POST ${API_BASE_URL}/api/v1/inbox \\
  -H "Authorization: Bearer tm_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"ttlMinutes": 60}'

# 2. Stream incoming messages in real time (SSE)
curl -N ${API_BASE_URL}/api/v1/inbox/YOUR_ADDRESS/stream

# 3. Read full message with extracted OTP
curl -s ${API_BASE_URL}/api/v1/inbox/YOUR_ADDRESS/messages/MESSAGE_ID \\
  -H "Authorization: Bearer tm_live_YOUR_API_KEY"`,
  },
  node: {
    label: 'Node.js / TypeScript',
    code: `const API = '${API_BASE_URL}/api/v1';
const headers = {
  Authorization: 'Bearer tm_live_YOUR_API_KEY',
  'Content-Type': 'application/json',
};

// 1. Allocate an inbox
const { address } = await fetch(\`\${API}/inbox\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ ttlMinutes: 30 }),
}).then((r) => r.json());

// 2. Poll or stream until OTP email arrives
const { messages } = await fetch(\`\${API}/inbox/\${encodeURIComponent(address)}/messages\`, { headers })
  .then((r) => r.json());

const full = await fetch(\`\${API}/inbox/\${encodeURIComponent(address)}/messages/\${messages[0].id}\`, { headers })
  .then((r) => r.json());

console.log('Extracted OTP:', full.otp);`,
  },
  python: {
    label: 'Python',
    code: `import requests

API = "${API_BASE_URL}/api/v1"
HEADERS = {"Authorization": "Bearer tm_live_YOUR_API_KEY"}

# 1. Create a disposable inbox
inbox = requests.post(f"{API}/inbox", json={"ttlMinutes": 30}, headers=HEADERS).json()
address = inbox["address"]

# 2. Fetch messages & read extracted OTP
msgs = requests.get(f"{API}/inbox/{address}/messages", headers=HEADERS).json()["messages"]
full = requests.get(f"{API}/inbox/{address}/messages/{msgs[0]['id']}", headers=HEADERS).json()
print("OTP:", full["otp"], "Links:", full["links"])`,
  },
  playwright: {
    label: 'Playwright E2E',
    code: `import { test, expect } from '@playwright/test';

test('signup email verification flow', async ({ page, request }) => {
  const headers = { Authorization: \`Bearer \${process.env.TEMPORAMAIL_KEY}\` };
  const inbox = await (await request.post('${API_BASE_URL}/api/v1/inbox', { headers, data: {} })).json();

  await page.goto('https://your-app.com/signup');
  await page.fill('input[type="email"]', inbox.address);
  await page.click('button[type="submit"]');

  // Wait for verification email & read extracted OTP automatically
  await expect.poll(async () => {
    const res = await request.get(\`${API_BASE_URL}/api/v1/inbox/\${encodeURIComponent(inbox.address)}/messages\`, { headers });
    return (await res.json()).messages.length;
  }).toBeGreaterThan(0);
});`,
  },
};

export default function DevelopersPage() {
  const [tab, setTab] = useState<LangTab>('curl');
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(SNIPPETS[tab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="tm-hero-bg min-h-[calc(100vh-8rem)] py-12">
      <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/70 dark:text-sky-300">
            <Code2 className="h-3.5 w-3.5" />
            TemporaMail REST &amp; SSE API
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Automate email &amp; OTP testing in{' '}
            <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent dark:from-sky-400 dark:to-indigo-400">
              5 lines of code.
            </span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Generate disposable inboxes via API, receive structured JSON with pre-extracted{' '}
            <code className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-950 dark:text-sky-300">
              otp
            </code>{' '}
            and{' '}
            <code className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-950 dark:text-sky-300">
              links
            </code>
            , and stream arrivals over SSE. Free accounts include 500 API requests/day.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard/api-keys"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:brightness-110"
            >
              <KeyRound className="h-4 w-4" />
              Get your API key
            </Link>
            <a
              href="https://globeverify.com"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500"
            >
              <Zap className="h-4 w-4 text-sky-500" />
              Need SMS numbers too? GlobeVerify →
            </a>
          </div>
        </div>

        {/* Interactive Code Recipes */}
        <div className="tm-card overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SNIPPETS) as LangTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                    tab === key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {SNIPPETS[key].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy snippet'}
            </button>
          </div>
          <pre className="overflow-x-auto bg-slate-950 p-6 font-mono text-xs leading-relaxed text-sky-200">
            {SNIPPETS[tab].code}
          </pre>
        </div>

        {/* Endpoint Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { method: 'POST', path: '/api/v1/inbox', desc: 'Allocate a new temporary address (scope: inbox:create)' },
            { method: 'GET', path: '/api/v1/inbox/:address/messages', desc: 'List messages with hasOtp flags (scope: messages:read)' },
            { method: 'GET', path: '/api/v1/inbox/:address/messages/:id', desc: 'Full sanitized HTML, text, otp, links & attachments' },
            { method: 'GET', path: '/api/v1/inbox/:address/stream', desc: 'Real-time Server-Sent Events (SSE) push stream' },
          ].map((ep) => (
            <div key={ep.path} className="tm-card rounded-2xl p-5">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-blue-600 dark:text-sky-400" />
                <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-sky-300">
                  {ep.method}
                </span>
                <code className="truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {ep.path}
                </code>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{ep.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
