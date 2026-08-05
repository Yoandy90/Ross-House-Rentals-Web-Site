'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const SESSION_KEY = 'rh_va_sid';
const HEARTBEAT_MS = 30_000;          // ping every 30s
const SCROLL_SAMPLE_MS = 500;         // throttle scroll measurements
const HIDE_ON_PREFIXES = ['/admin', '/tenant', '/inversor', '/landlord', '/invest'];

function pickSessionId(): string | null {
  try { return window.localStorage.getItem(SESSION_KEY); } catch { return null; }
}
function saveSessionId(sid: string) {
  try { window.localStorage.setItem(SESSION_KEY, sid); } catch { /* ignore */ }
}

async function post(url: string, body: any): Promise<any | null> {
  try {
    // Prefer sendBeacon for unload events; otherwise fetch keepalive
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    if ('sendBeacon' in navigator && body._beacon) {
      navigator.sendBeacon(url, blob);
      return null;
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

export default function VisitorTracker() {
  const pathname = usePathname() || '/';
  const search = useSearchParams();
  const sidRef = useRef<string | null>(null);
  const initRef = useRef<boolean>(false);
  const pageStartRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>('');
  const maxScrollRef = useRef<number>(0);

  const fullPath = `${pathname}${search?.toString() ? `?${search.toString()}` : ''}`;
  const hide = HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p));

  // Initialize session on first mount (skip admin)
  useEffect(() => {
    if (hide || initRef.current) return;
    initRef.current = true;
    (async () => {
      const existing = pickSessionId();
      const res = await post('/api/public/track/session', {
        session_id: existing,
        screen_w: typeof window !== 'undefined' ? window.screen?.width  : undefined,
        screen_h: typeof window !== 'undefined' ? window.screen?.height : undefined,
        lang: typeof navigator !== 'undefined' ? navigator.language : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
        landing_path: fullPath,
      });
      const sid = res?.session_id || existing;
      if (sid) { saveSessionId(sid); sidRef.current = sid; }
      // Log the first pageview now that the session exists
      if (sid) {
        post('/api/public/track/page', {
          session_id: sid,
          path: fullPath,
          title: document.title?.slice(0, 280),
          referrer: document.referrer || undefined,
        });
        lastPathRef.current = fullPath;
        pageStartRef.current = Date.now();
        maxScrollRef.current = 0;
      }
    })();
  }, [hide, fullPath]);

  // Track navigation changes
  useEffect(() => {
    if (hide || !initRef.current) return;
    const sid = sidRef.current || pickSessionId();
    if (!sid) return;
    if (lastPathRef.current === fullPath) return;
    const prevDuration = Date.now() - pageStartRef.current;
    const prevScroll = maxScrollRef.current;
    // Send the next pageview AND attach duration/scroll of the previous one
    post('/api/public/track/page', {
      session_id: sid,
      path: fullPath,
      title: document.title?.slice(0, 280),
      referrer: lastPathRef.current ? `${location.origin}${lastPathRef.current}` : (document.referrer || undefined),
      duration_ms: prevDuration,
      scroll_pct: prevScroll,
    });
    lastPathRef.current = fullPath;
    pageStartRef.current = Date.now();
    maxScrollRef.current = 0;
  }, [fullPath, hide]);

  // Heartbeat
  useEffect(() => {
    if (hide) return;
    const id = setInterval(() => {
      const sid = sidRef.current || pickSessionId();
      if (!sid) return;
      post('/api/public/track/heartbeat', { session_id: sid, path: fullPath });
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [fullPath, hide]);

  // Scroll depth measurement (throttled)
  useEffect(() => {
    if (hide) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const doc = document.documentElement;
        const total = Math.max(doc.scrollHeight - window.innerHeight, 1);
        const pct = Math.min(100, Math.round((window.scrollY / total) * 100));
        if (pct > maxScrollRef.current) maxScrollRef.current = pct;
      }, SCROLL_SAMPLE_MS);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [hide]);

  // Flush on tab close
  useEffect(() => {
    if (hide) return;
    const onUnload = () => {
      const sid = sidRef.current || pickSessionId();
      if (!sid) return;
      const data = {
        session_id: sid,
        path: lastPathRef.current || fullPath,
        title: document.title?.slice(0, 280),
        duration_ms: Date.now() - pageStartRef.current,
        scroll_pct: maxScrollRef.current,
        _beacon: true,
      };
      post('/api/public/track/page', data);
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [fullPath, hide]);

  return null;
}

// ── Optional helper exposed for any client component that wants to log a custom event ──
export async function trackEvent(name: string, data?: Record<string, any>, path?: string) {
  try {
    const sid = window.localStorage.getItem(SESSION_KEY);
    if (!sid) return;
    await fetch('/api/public/track/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, name, data: data || {}, path }),
      keepalive: true,
    });
  } catch { /* ignore */ }
}
