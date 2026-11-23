import type { Metadata } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { ThemeProvider } from '@/components/ThemeProvider';
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

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('temporamail_theme');if(s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased dark:bg-[#060b18] dark:text-slate-100">
        <ThemeProvider>
          <AuthProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer className="border-t border-slate-100 bg-white py-6 dark:border-slate-800/80 dark:bg-[#060b18]">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 dark:text-slate-400">
                  <p>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      TemporaMail
                    </span>{' '}
                    · Receive-only disposable email with automatic expiry.
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
        </ThemeProvider>
      </body>
    </html>
  );
}
