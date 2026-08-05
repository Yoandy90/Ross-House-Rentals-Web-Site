import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// ─── Design system ─────────────────────────────────────────────────────────
type ConceptKey = 'bold' | 'professional' | 'trust';
type FormatKey = 'square' | 'vertical' | 'horizontal';

const CONCEPT_STYLE: Record<ConceptKey, {
  name: string;
  bgGradient: string;
  accent: string;
  accentSecondary: string;
  chipBg: string;
  ctaBg: string;
  ctaText: string;
  pattern: string;
}> = {
  bold: {
    name: 'Bold & Energetic',
    bgGradient: 'linear-gradient(135deg, #0f172a 0%, #7c2d12 45%, #f97316 100%)',
    accent: '#fbbf24',
    accentSecondary: '#fb923c',
    chipBg: 'rgba(251,191,36,0.25)',
    ctaBg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    ctaText: '#0f172a',
    pattern: 'radial-gradient(circle at 20% 20%, white 1.5px, transparent 2px), radial-gradient(circle at 80% 60%, white 1.5px, transparent 2px)',
  },
  professional: {
    name: 'Professional & Modern',
    bgGradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #4c1d95 100%)',
    accent: '#a78bfa',
    accentSecondary: '#818cf8',
    chipBg: 'rgba(167,139,250,0.25)',
    ctaBg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    ctaText: '#ffffff',
    pattern: 'radial-gradient(circle at 30% 30%, white 1px, transparent 1.5px), radial-gradient(circle at 70% 70%, white 1px, transparent 1.5px)',
  },
  trust: {
    name: 'Trust & Local',
    bgGradient: 'linear-gradient(135deg, #052e16 0%, #14532d 40%, #16a34a 100%)',
    accent: '#facc15',
    accentSecondary: '#a3e635',
    chipBg: 'rgba(250,204,21,0.25)',
    ctaBg: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
    ctaText: '#052e16',
    pattern: 'radial-gradient(circle at 15% 25%, white 1.5px, transparent 2px), radial-gradient(circle at 85% 75%, white 1.5px, transparent 2px)',
  },
};

const FORMAT_SIZE: Record<FormatKey, { width: number; height: number }> = {
  square:     { width: 1080, height: 1080 },
  vertical:   { width: 1080, height: 1920 },
  horizontal: { width: 1200, height: 630  },
};

// ─── Endpoint ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const concept = (url.searchParams.get('concept') || 'bold') as ConceptKey;
  const format  = (url.searchParams.get('format')  || 'square') as FormatKey;

  const style = CONCEPT_STYLE[concept] || CONCEPT_STYLE.bold;
  const size  = FORMAT_SIZE[format]    || FORMAT_SIZE.square;

  const isVertical = format === 'vertical';
  const isHorizontal = format === 'horizontal';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: style.bgGradient,
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Dot pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.14,
            background: style.pattern,
            backgroundSize: '48px 48px, 72px 72px',
          }}
        />

        {/* Decorative blobs */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${style.accent}40 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            left: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${style.accentSecondary}30 0%, transparent 70%)`,
          }}
        />

        {/* Top brand bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isHorizontal ? '30px 55px 0' : '48px 60px 0',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: isHorizontal ? 48 : 60,
              height: isHorizontal ? 48 : 60,
              borderRadius: 16,
              background: style.ctaBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isHorizontal ? 26 : 32,
            }}>🏠</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: isHorizontal ? 20 : 24, fontWeight: 900, letterSpacing: -0.5 }}>Ross House Rentals</span>
              <span style={{ fontSize: isHorizontal ? 12 : 14, opacity: 0.72 }}>Dumas, TX 79029</span>
            </div>
          </div>
          <div style={{
            display: 'flex',
            gap: 10,
            fontSize: isHorizontal ? 13 : 15,
            padding: '10px 18px',
            borderRadius: 999,
            background: style.chipBg,
            border: `1.5px solid ${style.accent}80`,
            fontWeight: 800,
            color: style.accent,
            letterSpacing: 0.5,
          }}>
            🔥 {isHorizontal ? 'RECRUITING' : 'NOW HIRING · RECLUTANDO'}
          </div>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isHorizontal ? '10px 55px' : '20px 60px',
          position: 'relative',
        }}>
          {/* Emoji tools row */}
          <div style={{
            fontSize: isHorizontal ? 60 : isVertical ? 110 : 90,
            lineHeight: 1,
            marginBottom: isHorizontal ? 8 : 14,
            letterSpacing: '0.1em',
          }}>
            🔧⚡🪛🔨👷
          </div>

          {/* Bilingual title */}
          <h1 style={{
            fontSize: isHorizontal ? 60 : isVertical ? 108 : 90,
            fontWeight: 900,
            lineHeight: 0.98,
            margin: 0,
            letterSpacing: -3,
          }}>
            <span style={{
              background: `linear-gradient(90deg, ${style.accent}, ${style.accentSecondary})`,
              backgroundClip: 'text',
              color: 'transparent',
              // @ts-ignore - webkit needed for og
              WebkitBackgroundClip: 'text',
            }}>ÚNETE</span>
            <span style={{ opacity: 0.5, fontSize: isHorizontal ? 50 : isVertical ? 92 : 76 }}> · </span>
            <span>JOIN US</span>
          </h1>

          <p style={{
            fontSize: isHorizontal ? 24 : isVertical ? 46 : 38,
            fontWeight: 700,
            opacity: 0.95,
            marginTop: isHorizontal ? 14 : 24,
            maxWidth: isHorizontal ? '80%' : '92%',
            lineHeight: 1.2,
          }}>
            {isVertical
              ? 'Directorio de contratistas locales · Regístrate gratis · Sin compromiso'
              : 'Directorio de Contratistas · Local Contractor Directory'}
          </p>

          {/* Bullets */}
          <div style={{
            display: 'flex',
            flexDirection: isHorizontal ? 'row' : 'column',
            gap: isHorizontal ? 20 : isVertical ? 18 : 14,
            marginTop: isHorizontal ? 20 : 30,
            fontSize: isHorizontal ? 18 : isVertical ? 30 : 24,
            fontWeight: 700,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: style.accent }}>✓</span> Registro gratis · Free signup
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: style.accent }}>✓</span> Sin compromiso · No commitment
            </span>
            {!isHorizontal && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: style.accent }}>✓</span> Te llamamos cuando te necesitemos
              </span>
            )}
            {!isHorizontal && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: style.accent }}>✓</span> Bilingüe 🇺🇸🇲🇽
              </span>
            )}
          </div>
        </div>

        {/* CTA + URL */}
        <div style={{
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          alignItems: isHorizontal ? 'center' : 'flex-start',
          justifyContent: 'space-between',
          gap: isHorizontal ? 20 : 20,
          padding: isHorizontal ? '0 55px 30px' : '0 60px 48px',
          position: 'relative',
        }}>
          <div style={{
            padding: isHorizontal ? '14px 24px' : '20px 32px',
            background: style.ctaBg,
            color: style.ctaText,
            fontSize: isHorizontal ? 20 : isVertical ? 34 : 28,
            fontWeight: 900,
            borderRadius: 16,
            letterSpacing: -0.5,
            boxShadow: `0 10px 30px ${style.accent}40`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            REGÍSTRATE GRATIS · SIGN UP FREE →
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isHorizontal ? 'flex-end' : 'flex-start',
            fontSize: isHorizontal ? 14 : isVertical ? 24 : 20,
            fontWeight: 800,
            opacity: 0.95,
          }}>
            <span>rosshouserentals.com/proveedores</span>
            <span style={{ fontSize: isHorizontal ? 11 : isVertical ? 18 : 15, opacity: 0.7, fontWeight: 600, marginTop: 4 }}>
              📞 (806) 934-2018
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control': 'public, max-age=604800, immutable', // 7 days
      },
    },
  );
}
