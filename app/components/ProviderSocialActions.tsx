'use client';

/**
 * Social action bar for the provider signup landing page.
 *
 * - Floating "Chat con Rossy (IA)" button — contractor-focused: answers FAQ,
 *   requirements, payment, how to sign up, etc. via the Rossy chatbot.
 * - Sticky bottom CTA on mobile that scrolls to the form.
 * - Auto-shows after user scrolls past hero.
 *
 * Note: The general PublicChatbot is intentionally hidden on /proveedores
 * (see PublicChatbotMount) so this is the ONLY chat entry point here, and
 * it always opens with the contractor context pre-set.
 */
import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, MessageCircleQuestion } from 'lucide-react';

export default function ProviderSocialActions({ lang = 'es' }: { lang?: 'es' | 'en' }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 380);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const labels = lang === 'es' ? {
    cta: 'Registrarme gratis',
    ai: 'Preguntas frecuentes',
    aiTooltip: 'Chatea con Rossy',
  } : {
    cta: 'Sign up free',
    ai: 'Frequently asked',
    aiTooltip: 'Chat with Rossy',
  };

  const scrollToForm = () => {
    const el = document.getElementById('provider-form');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openAIChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('rh:open-chatbot', { detail: { context: 'contractor' } })
      );
    }
  };

  return (
    <>
      {/* Floating single AI chat button (contractor-focused, all breakpoints) */}
      <button
        onClick={openAIChat}
        aria-label={labels.aiTooltip}
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 text-white shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 active:scale-95 transition-all border border-white/20"
      >
        <div className="relative">
          <MessageCircleQuestion className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-orange-500 animate-pulse" />
        </div>
        <span className="text-xs font-bold whitespace-nowrap max-w-0 group-hover:max-w-[200px] overflow-hidden transition-all sm:max-w-[200px]">
          {labels.ai}
        </span>
        <Sparkles className="w-3.5 h-3.5 opacity-80" />
      </button>

      {/* Sticky bottom CTA — only on mobile, appears after scrolling */}
      {show && (
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-3 pt-2"
          style={{
            background: 'linear-gradient(to top, rgba(15,23,42,0.96) 60%, rgba(15,23,42,0))',
            paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
          }}
        >
          <button
            onClick={scrollToForm}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black py-3.5 rounded-xl shadow-2xl shadow-amber-500/40 flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <span className="text-base">{labels.cta}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}
