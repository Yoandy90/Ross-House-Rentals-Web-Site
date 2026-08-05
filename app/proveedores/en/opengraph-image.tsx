import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Join the Ross House Rentals contractors network - Dumas TX';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #f59e0b 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.12,
            background:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1.5px), radial-gradient(circle at 80% 60%, white 1px, transparent 1.5px), radial-gradient(circle at 50% 90%, white 1px, transparent 1.5px)',
            backgroundSize: '40px 40px, 60px 60px, 80px 80px',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 60px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🏠</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Ross House Rentals</span>
              <span style={{ fontSize: 14, opacity: 0.7 }}>Dumas, TX 79029</span>
            </div>
          </div>
          <div style={{ fontSize: 16, padding: '8px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
            🔥 Now recruiting
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 60px' }}>
          <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 8 }}>👷‍♂️🔧⚡</div>
          <h1 style={{ fontSize: 78, fontWeight: 900, lineHeight: 1.05, margin: 0, letterSpacing: -2.5 }}>
            Join our<br /><span style={{ color: '#fbbf24' }}>contractors</span> network
          </h1>
          <p style={{ fontSize: 28, opacity: 0.92, marginTop: 22, maxWidth: 880, lineHeight: 1.35 }}>
            Plumbers, electricians, gardeners &amp; handymen in Dumas TX. Direct jobs · No contracts · Fast payments.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px 40px' }}>
          <div style={{ display: 'flex', gap: 18, fontSize: 18, fontWeight: 700 }}>
            <span>✅ Free signup</span>
            <span>✅ No commissions</span>
            <span>✅ +100 properties</span>
          </div>
          <div style={{ padding: '16px 28px', background: '#fbbf24', color: '#0f172a', fontSize: 22, fontWeight: 900, borderRadius: 14, letterSpacing: -0.5 }}>
            rosshouserentals.com/proveedores →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
