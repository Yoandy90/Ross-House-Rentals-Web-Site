'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const NewsletterModal = dynamic(() => import('./NewsletterModal'), { ssr: false });

const HIDE_ON_PREFIXES = ['/admin', '/tenant', '/inversor', '/landlord', '/invest', '/save-card', '/proveedores'];

export default function NewsletterModalMount() {
  const pathname = usePathname() || '/';
  if (HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return (
    <Suspense fallback={null}>
      <NewsletterModal />
    </Suspense>
  );
}
