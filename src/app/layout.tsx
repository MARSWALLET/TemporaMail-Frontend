import type { Metadata } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TemporaMail — Instant, Private Temporary Email',
  description:
    'Disposable receive-only temporary email addresses with real-time SSE inbox streaming, instant OTP extraction, and zero spam.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased">
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-slate-100 bg-white py-6">
              <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
                <p>
                  <span className="font-semibold text-slate-700">TemporaMail</span> · Receive-only
                  disposable email with automatic expiry.
                </p>
                <div className="flex items-center gap-4">
                  <span>Zero tracking</span>
                  <span>·</span>
                  <span>Real-time SSE</span>
                  <span>·</span>
                  <span>Auto-sanitized HTML</span>
                </div>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
