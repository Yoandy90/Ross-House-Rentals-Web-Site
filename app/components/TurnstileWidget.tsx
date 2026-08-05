'use client';

/**
 * Cloudflare Turnstile widget — CAPTCHA invisible/managed.
 *
 * Usage:
 *   <TurnstileWidget onToken={(t) => setCaptcha(t)} theme="dark" />
 *
 * Reads NEXT_PUBLIC_TURNSTILE_SITE_KEY from env. Falls back to the official
 * Cloudflare "always-pass" test key while we work in dev.
 *
 * IMPORTANT: tokens are SINGLE-USE and expire after ~5 min. Always use the
 * returned `ref` to call `reset()` if a submit fails and the user retries.
 */
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import avoids Next.js SSR hydration errors (Turnstile injects <script>)
const Turnstile = dynamic(
  () => import('@marsidev/react-turnstile').then((m) => m.Turnstile),
  { ssr: false }
);

// Cloudflare always-pass test site key (dev only).
const TEST_SITE_KEY = '1x00000000000000000000AA';

export interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  /** Action label for analytics in Cloudflare dashboard */
  action?: string;
  className?: string;
}

export default function TurnstileWidget({
  onToken,
  theme = 'dark',
  size = 'flexible',
  action,
  className = '',
}: TurnstileWidgetProps) {
  const ref = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY;

  if (!mounted) {
    // Skeleton while we hydrate (matches widget height ≈ 65px)
    return (
      <div
        className={`h-[65px] w-full max-w-[320px] rounded-lg bg-white/[0.04] border border-white/[0.08] animate-pulse ${className}`}
      />
    );
  }

  return (
    <div className={className}>
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{
          theme,
          size,
          action: action || 'submit',
          appearance: 'always',
        }}
        onSuccess={(token: string) => onToken(token)}
        onError={() => onToken(null)}
        onExpire={() => onToken(null)}
      />
    </div>
  );
}

/**
 * Helper that exposes an imperative `reset()` for parents that need to retry.
 * Use this if your form may submit twice in a row.
 */
export function useTurnstileReset() {
  const ref = useRef<any>(null);
  const reset = () => {
    try {
      ref.current?.reset?.();
    } catch {
      /* ignore */
    }
  };
  return { ref, reset };
}
