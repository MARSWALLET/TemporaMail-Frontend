import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Code2,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';
import { FaqAccordion } from '@/components/FaqAccordion';
import { LiveInbox } from '@/components/LiveInbox';

export default function HomePage() {
  return (
    <div className="tm-hero-bg pb-20">
      {/* Clean Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6 lg:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800/80 dark:bg-blue-950/70 dark:text-sky-300">
              <Sparkles className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
              Receive-only · Zero spam · Instant OTP extraction
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12] dark:text-white">
              Private temporary email,{' '}
              <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent dark:from-sky-400 dark:via-blue-400 dark:to-indigo-400">
                delivered live.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Keep your real inbox spotless. Generate an unguessable address in one click, stream
              incoming verification codes over SSE in milliseconds, and let everything expire
              automatically.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:ring-slate-700">
                <Zap className="h-3.5 w-3.5 text-sky-500" />
                Real-time SSE
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:ring-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                Sanitized HTML &amp; tracker blocking
              </span>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/70 dark:text-indigo-300 dark:hover:bg-indigo-900/70"
              >
                Need custom names or 24h retention? Create a free account →
              </Link>
            </div>
          </div>

          <div className="hidden justify-center lg:col-span-5 lg:flex">
            <Image
              src="/images/hero-mail.svg"
              alt="TemporaMail glassmorphic inbox illustration"
              width={420}
              height={315}
              className="animate-tm-float select-none"
              priority
            />
          </div>
        </div>
      </section>

      {/* Live Inbox Workspace */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <LiveInbox />
      </section>

      {/* Sister Service Spotlight: GlobeVerify (Paid SMS Verification Backlink) */}
      <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 p-6 text-white shadow-lg shadow-blue-600/15 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
                <Smartphone className="h-3.5 w-3.5" />
                Partner Service · SMS Verification
              </div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Need a real phone number for SMS OTP too?
              </h2>
              <p className="max-w-2xl text-sm text-blue-50/90">
                When a website requires phone number verification alongside email, use{' '}
                <strong className="font-semibold text-white">GlobeVerify</strong> for fast, private
                virtual phone numbers and instant SMS OTP delivery worldwide.
              </p>
            </div>
            <a
              href="https://globeverify.com"
              target="_blank"
              rel="noopener"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              Visit GlobeVerify.com
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Why People Love TemporaMail */}
      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Built for speed, privacy, and developers
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Everything you need for frictionless signups and automated OTP testing.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Zap,
              title: 'Sub-second SSE delivery',
              desc: 'Zero greylisting. Messages push to your screen and flash OTPs in your browser tab instantly.',
              tint: 'bg-sky-50 text-sky-600 dark:bg-sky-950/70 dark:text-sky-400',
            },
            {
              icon: Sparkles,
              title: '1-click OTP & links',
              desc: 'Verification codes and confirmation buttons are automatically extracted and ready to copy.',
              tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400',
            },
            {
              icon: Lock,
              title: 'Tracker & script shield',
              desc: 'Every HTML email is sanitized, remote spy pixels are stripped, and dangerous attachments are blocked.',
              tint: 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400',
            },
            {
              icon: Code2,
              title: 'Developer API & SSE',
              desc: 'Generate scoped API keys for Playwright, Cypress, Python, or cURL with 500 free daily requests.',
              tint: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400',
            },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="tm-card rounded-3xl p-6">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${feat.tint}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{feat.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto mt-16 max-w-3xl px-4 sm:px-6">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Frequently asked questions
          </h2>
        </div>
        <FaqAccordion />
      </section>
    </div>
  );
}
