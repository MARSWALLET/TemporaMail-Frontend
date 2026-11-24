'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  EyeOff,
  Highlighter,
  PenLine,
  RotateCcw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { FullMessage } from '@/lib/api';

type Tool = 'pen' | 'highlighter' | 'arrow' | 'box' | 'redact';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Stroke {
  readonly tool: Tool;
  readonly color: string;
  readonly points: readonly Point[];
}

interface EmailAnnotatorModalProps {
  readonly message: FullMessage;
  readonly onClose: () => void;
}

const COLORS = [
  { id: 'red', label: 'Red', value: '#ef4444' },
  { id: 'blue', label: 'Blue', value: '#3b82f6' },
  { id: 'amber', label: 'Amber', value: '#f59e0b' },
  { id: 'emerald', label: 'Green', value: '#10b981' },
] as const;

const CANVAS_W = 820;
const CANVAS_H = 540;

function stripHtmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (lines.length >= maxLines) break;
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
        if (lines.length >= maxLines) break;
      } else {
        current = candidate;
      }
    }
    if (current && lines.length < maxLines) {
      lines.push(current);
    }
  }
  return lines;
}

export function EmailAnnotatorModal({ message, onClose }: EmailAnnotatorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>('redact');
  const [color, setColor] = useState<string>('#ef4444');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [darkCanvas, setDarkCanvas] = useState<boolean>(false);
  const [copiedImg, setCopiedImg] = useState<boolean>(false);

  const drawScene = useCallback(
    (allStrokes: readonly Stroke[], current: Stroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== CANVAS_W * dpr || canvas.height !== CANVAS_H * dpr) {
        canvas.width = CANVAS_W * dpr;
        canvas.height = CANVAS_H * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background card
      const bg = darkCanvas ? '#111113' : '#ffffff';
      const headerBg = darkCanvas ? '#18181b' : '#f8fafc';
      const border = darkCanvas ? '#27272a' : '#e4e4e7';
      const titleColor = darkCanvas ? '#fafafa' : '#09090b';
      const mutedColor = darkCanvas ? '#a1a1aa' : '#52525b';
      const bodyColor = darkCanvas ? '#e4e4e7' : '#27272a';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Header band
      ctx.fillStyle = headerBg;
      ctx.fillRect(0, 0, CANVAS_W, 118);
      ctx.fillStyle = border;
      ctx.fillRect(0, 118, CANVAS_W, 1);

      // Subject
      ctx.fillStyle = titleColor;
      ctx.font = '600 18px system-ui, -apple-system, sans-serif';
      const subj = (message.subject || '(No subject)').slice(0, 76);
      ctx.fillText(subj, 28, 40);

      // Metadata
      ctx.fillStyle = mutedColor;
      ctx.font = '400 12.5px system-ui, -apple-system, sans-serif';
      ctx.fillText(`From: ${message.from.slice(0, 88)}`, 28, 66);
      ctx.fillText(`To: ${message.to.join(', ').slice(0, 88)}`, 28, 86);
      ctx.fillText(
        `Date: ${new Date(message.date).toLocaleString()}   •   Captured with TemporaMail`,
        28,
        106,
      );

      // OTP pill if present
      let bodyStartY = 148;
      if (message.otp) {
        ctx.fillStyle = darkCanvas ? 'rgba(59, 130, 246, 0.16)' : '#eff6ff';
        ctx.strokeStyle = darkCanvas ? 'rgba(59, 130, 246, 0.4)' : '#bfdbfe';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(28, 134, 240, 34, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = darkCanvas ? '#93c5fd' : '#1d4ed8';
        ctx.font = '700 14px ui-monospace, Menlo, monospace';
        ctx.fillText(`OTP CODE: ${message.otp}`, 42, 156);
        bodyStartY = 194;
      }

      // Body text
      const plain = (message.text || stripHtmlToPlainText(message.html) || '(Empty message)').slice(
        0,
        2400,
      );
      ctx.fillStyle = bodyColor;
      ctx.font = '400 13.5px system-ui, -apple-system, sans-serif';
      const lines = wrapText(ctx, plain, CANVAS_W - 56, 17);
      lines.forEach((line, idx) => {
        ctx.fillText(line, 28, bodyStartY + idx * 20);
      });

      // Draw strokes
      const renderStroke = (s: Stroke) => {
        if (s.points.length === 0) return;
        const first = s.points[0]!;
        const last = s.points[s.points.length - 1]!;

        ctx.save();
        if (s.tool === 'pen') {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < s.points.length; i++) {
            const p = s.points[i]!;
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        } else if (s.tool === 'highlighter') {
          ctx.strokeStyle = s.color;
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 18;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < s.points.length; i++) {
            const p = s.points[i]!;
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        } else if (s.tool === 'box') {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y);
        } else if (s.tool === 'redact') {
          ctx.fillStyle = darkCanvas ? '#000000' : '#09090b';
          const rx = Math.min(first.x, last.x);
          const ry = Math.min(first.y, last.y);
          const rw = Math.abs(last.x - first.x);
          const rh = Math.abs(last.y - first.y);
          ctx.fillRect(rx, ry, rw, rh);
        } else if (s.tool === 'arrow') {
          ctx.strokeStyle = s.color;
          ctx.fillStyle = s.color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          ctx.lineTo(last.x, last.y);
          ctx.stroke();

          const angle = Math.atan2(last.y - first.y, last.x - first.x);
          const headLen = 13;
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(
            last.x - headLen * Math.cos(angle - Math.PI / 6),
            last.y - headLen * Math.sin(angle - Math.PI / 6),
          );
          ctx.lineTo(
            last.x - headLen * Math.cos(angle + Math.PI / 6),
            last.y - headLen * Math.sin(angle + Math.PI / 6),
          );
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      };

      for (const s of allStrokes) renderStroke(s);
      if (current) renderStroke(current);

      ctx.restore();
    },
    [darkCanvas, message],
  );

  useEffect(() => {
    setDarkCanvas(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    drawScene(strokes, activeStroke);
  }, [drawScene, strokes, activeStroke]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setStrokes((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getPoint(e);
    setActiveStroke({ tool, color, points: [p] });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStroke) return;
    const p = getPoint(e);
    setActiveStroke((prev) =>
      prev ? { ...prev, points: [...prev.points, p] } : null,
    );
  }

  function handlePointerUp() {
    if (!activeStroke) return;
    setStrokes((prev) => [...prev, activeStroke]);
    setActiveStroke(null);
  }

  function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${(message.subject || 'email-snapshot').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 36)}.png`;
    a.click();
  }

  async function handleCopyPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (blob && navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImg(true);
        setTimeout(() => setCopiedImg(false), 1800);
      } else {
        handleDownloadPng();
      }
    } catch {
      handleDownloadPng();
    }
  }

  const tools: ReadonlyArray<{ id: Tool; label: string; icon: typeof PenLine }> = [
    { id: 'redact', label: 'Redact', icon: EyeOff },
    { id: 'pen', label: 'Draw', icon: PenLine },
    { id: 'highlighter', label: 'Highlight', icon: Highlighter },
    { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
    { id: 'box', label: 'Box', icon: Square },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#111113]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Annotate &amp; Redact Email
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Draw, highlight, or blackout sensitive text, then copy or export as PNG.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDarkCanvas((v) => !v)}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {darkCanvas ? 'Light Paper' : 'Dark Paper'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Close annotator"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-[#0c0c0e]">
          <div className="flex flex-wrap items-center gap-1">
            {tools.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  tool === id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}

            <span className="mx-1.5 h-4 w-px bg-zinc-300 dark:bg-zinc-800" />

            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={c.label}
                  className={`h-5 w-5 rounded-full transition-transform ${
                    color === c.value
                      ? 'scale-110 ring-2 ring-zinc-900 ring-offset-2 dark:ring-zinc-100 dark:ring-offset-[#0c0c0e]'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStrokes((prev) => prev.slice(0, -1))}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Canvas surface */}
        <div className="flex items-center justify-center bg-zinc-100/80 p-4 dark:bg-[#09090b]">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full max-w-[820px] cursor-crosshair touch-none rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          />
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Tip: Use <strong className="text-zinc-700 dark:text-zinc-200">Redact</strong> to hide
            private tokens before sharing screenshots.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyPng()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {copiedImg ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied PNG
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy PNG
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-3.5 w-3.5" />
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
