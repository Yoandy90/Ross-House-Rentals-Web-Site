'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const VisitorTracker = dynamic(() => import('./VisitorTracker'), { ssr: false });

const HIDE_ON_PREFIXES = ['/admin', '/tenant', '/inversor', '/landlord', '/invest'];

export default function VisitorTrackerMount() {
  const pathname = usePathname() || '/';
  if (HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return (
    <Suspense fallback={null}>
      <VisitorTracker />
    </Suspense>
  );
}
