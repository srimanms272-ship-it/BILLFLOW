export default function ApiRootPage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>BillFlow API Service</h1>
      <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Standalone Next.js Web Service running on Render.</p>
      <div style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.5rem 1rem', background: '#1e293b', borderRadius: '8px' }}>
        Status: <span style={{ color: '#22c55e', fontWeight: 600 }}>Active</span>
      </div>
    </main>
  );
}
