'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Lazy-load to avoid SSR + keep landing page light
const PublicChatbot = dynamic(() => import('./PublicChatbot'), { ssr: false });

const HIDE_ON_PREFIXES = [
  '/admin',
  '/tenant',
  '/inversor',
  '/landlord',
  '/invest',
  '/proveedores',  // /proveedores has its own contractor-focused Rossy launcher via ProviderSocialActions
];

export default function PublicChatbotMount() {
  const pathname = usePathname() || '/';
  const hide = HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p));
  if (hide) return null;
  return <PublicChatbot />;
}
