import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Administración de Propiedades - Ross House Rentals - Próximamente Q4 2026-2027'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #4c1d95 100%)',
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
            opacity: 0.15,
            background:
              'radial-gradient(circle at 20% 20%, white 1.5px, transparent 2px), radial-gradient(circle at 80% 60%, white 1.5px, transparent 2px), radial-gradient(circle at 50% 90%, white 1.5px, transparent 2px)',
            backgroundSize: '48px 48px, 64px 64px, 80px 80px',
          }}
        />

        {/* Amber blob */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)',
          }}
        />

        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 60px 0', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              🏢
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Ross House Rentals</span>
              <span style={{ fontSize: 14, opacity: 0.7 }}>Dumas, TX 79029</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 15, padding: '10px 18px', borderRadius: 999, background: 'rgba(251,191,36,0.25)', border: '1.5px solid rgba(251,191,36,0.6)', fontWeight: 800, color: '#fbbf24', letterSpacing: 0.5 }}>
            🚧 PRÓXIMAMENTE Q4 2026 · 2027
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 60px', position: 'relative' }}>
          <div style={{ fontSize: 84, lineHeight: 1, marginBottom: 8 }}>🏠💼✨</div>
          <h1 style={{ fontSize: 82, fontWeight: 900, lineHeight: 1.02, margin: 0, letterSpacing: -3 }}>
            <span style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b)', backgroundClip: 'text', color: 'transparent', WebkitBackgroundClip: 'text' }}>Administración</span>
            <br />
            <span>de Propiedades</span>
          </h1>
          <p style={{ fontSize: 26, opacity: 0.92, marginTop: 20, maxWidth: 900, lineHeight: 1.35 }}>
            ¿Eres propietario de casas de inversión en Dumas TX? Unéte a la lista de espera de nuestro futuro servicio de PM con licencia oficial de Texas.
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px 40px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 20, fontSize: 17, fontWeight: 700 }}>
            <span>✅ Bilingual</span>
            <span>✅ 15+ años operando</span>
            <span>✅ Portal digital</span>
          </div>
          <div style={{ padding: '16px 26px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontSize: 20, fontWeight: 900, borderRadius: 14, letterSpacing: -0.5, boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
            Únete a la lista →
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
