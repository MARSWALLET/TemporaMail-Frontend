import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { LiveInbox } from '@/components/LiveInbox';

export default function HomePage() {
  return (
    <div className="tm-hero-bg pb-16">
      {/* Clean Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6 lg:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-700">
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              Receive-only · Zero spam · Instant OTP extraction
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12]">
              Private temporary email,{' '}
              <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
                delivered live.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              Keep your real inbox spotless. Generate an unguessable address in one click, stream
              incoming verification codes over SSE in milliseconds, and let everything expire
              automatically.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200/80">
                <Zap className="h-3.5 w-3.5 text-sky-500" />
                Real-time SSE
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200/80">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                Sanitized HTML &amp; tracker blocking
              </span>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-700 transition hover:bg-indigo-100"
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
    </div>
  );
}
