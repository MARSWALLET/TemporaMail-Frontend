'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'How fast do verification emails and OTP codes arrive?',
    a: 'TemporaMail never uses greylisting. Incoming emails are parsed and pushed over a live Server-Sent Events (SSE) stream in under a second, and OTP codes are automatically highlighted for 1-click copy.',
  },
  {
    q: 'Is my temporary inbox private?',
    a: 'Yes. Every random address uses cryptographic randomness, HTML is automatically sanitized to strip scripts and remote tracking pixels, and all messages and attachments are permanently deleted when your timer expires.',
  },
  {
    q: 'Can I keep an address longer or choose a custom name?',
    a: 'Yes! Anonymous inboxes can be extended up to 60 minutes. Create a free account to keep up to 3 saved addresses for 24 hours, reserve a custom name, and generate API keys.',
  },
  {
    q: 'Need a real phone number for SMS OTP verification too?',
    a: 'TemporaMail handles temporary email addresses. When a website also asks for phone number SMS verification, check out our sister service GlobeVerify (globeverify.com) for instant virtual phone numbers worldwide.',
  },
  {
    q: 'Can developers automate signups and OTP testing?',
    a: 'Absolutely. Generate a scoped tm_live_ API key in your dashboard and use our REST API + SSE stream from Playwright, Cypress, Python, or Node.js—with zero CAPTCHA friction.',
  },
] as const;

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-zinc-200/80 overflow-hidden rounded-2xl tm-card dark:divide-zinc-800">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4.5 text-left transition hover:bg-zinc-50 dark:hover:bg-[#18181b]"
            >
              <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{item.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${
                  isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-6 pb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
