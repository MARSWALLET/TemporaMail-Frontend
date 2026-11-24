export interface ExtractedActionLink {
  readonly url: string;
  readonly domain: string;
  readonly label: string;
}

const POSITIVE_KEYWORDS = [
  'verify',
  'confirm',
  'activate',
  'validate',
  'magic',
  'signin',
  'sign-in',
  'login',
  'log-in',
  'reset',
  'token=',
  'code=',
  'auth',
  'accept',
  'invite',
  'approve',
  'complete',
];

const NEGATIVE_KEYWORDS = [
  'unsubscribe',
  'optout',
  'opt-out',
  'privacy',
  'terms',
  'policy',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'mailto:',
  'tel:',
  'preferences',
  'manage-subscriptions',
  'help.',
  'support.',
];

function scoreCandidate(url: string, anchorText: string): number {
  const lowerUrl = url.toLowerCase();
  const lowerText = anchorText.toLowerCase();
  const combined = `${lowerUrl} ${lowerText}`;

  for (const neg of NEGATIVE_KEYWORDS) {
    if (combined.includes(neg)) return -100;
  }

  let score = 0;
  for (const pos of POSITIVE_KEYWORDS) {
    if (lowerText.includes(pos)) score += 30;
    if (lowerUrl.includes(pos)) score += 20;
  }

  if (lowerUrl.includes('?')) score += 5;
  if (lowerText.length >= 4 && lowerText.length <= 42) score += 8;
  return score;
}

function cleanLabel(anchorText: string): string {
  const trimmed = anchorText.replace(/\s+/g, ' ').trim();
  if (trimmed.length >= 4 && trimmed.length <= 34 && !trimmed.startsWith('http')) {
    return trimmed;
  }
  return 'Open verification link';
}

export function extractVerificationLink(html: string, text: string): ExtractedActionLink | null {
  const candidates: Array<{ url: string; label: string; score: number }> = [];

  // 1. Scan HTML <a> tags first (better signal from button/anchor text)
  if (html) {
    const anchorRegex = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null = anchorRegex.exec(html);
    while (match !== null) {
      const rawUrl = match[1]?.replace(/&amp;/g, '&').trim() ?? '';
      const rawText = (match[2] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (rawUrl) {
        const score = scoreCandidate(rawUrl, rawText);
        if (score > 15) {
          candidates.push({ url: rawUrl, label: cleanLabel(rawText), score });
        }
      }
      match = anchorRegex.exec(html);
    }
  }

  // 2. Fallback to plain-text URLs
  if (candidates.length === 0 && text) {
    const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
    let match: RegExpExecArray | null = urlRegex.exec(text);
    while (match !== null) {
      const rawUrl = (match[0] ?? '').replace(/[.,;:!?]+$/, '');
      if (rawUrl) {
        const score = scoreCandidate(rawUrl, '');
        if (score > 15) {
          candidates.push({ url: rawUrl, label: 'Open verification link', score });
        }
      }
      match = urlRegex.exec(text);
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return null;

  try {
    const parsed = new URL(best.url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return {
      url: parsed.toString(),
      domain: parsed.hostname.replace(/^www\./, ''),
      label: best.label,
    };
  } catch {
    return null;
  }
}
