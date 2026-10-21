async function check() {
  console.log('--- DIAGNOSTIC CHECK ---');
  
  // 1. Check live frontend
  try {
    const res = await fetch('https://billflow-murex-phi.vercel.app', { method: 'GET' });
    console.log('Live Vercel Frontend HTTP Status:', res.status);
  } catch (err) {
    console.log('Live Vercel Frontend Error:', err.message);
  }

  // 2. Check live backend
  try {
    console.log('Pinging Render backend (https://billflow-backend-ntt5.onrender.com)...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch('https://billflow-backend-ntt5.onrender.com', { signal: controller.signal });
    clearTimeout(timeout);
    console.log('Render Backend HTTP Status:', res.status);
  } catch (err) {
    console.log('Render Backend Fetch Error:', err.message);
  }

  // 3. Check live backend /api/clients with demo cookie
  try {
    console.log('Testing /api/clients on live backend with demo admin cookie...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch('https://billflow-backend-ntt5.onrender.com/api/clients', {
      headers: { 'Cookie': 'billflow_demo=admin' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const body = await res.text();
    console.log('/api/clients Status:', res.status, 'Body:', body.slice(0, 300));
  } catch (err) {
    console.log('/api/clients Error:', err.message);
  }

  // 4. Check live Vercel /api/clients with demo cookie
  try {
    console.log('Testing /api/clients on Vercel frontend with demo admin cookie...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch('https://billflow-murex-phi.vercel.app/api/clients', {
      headers: { 'Cookie': 'billflow_demo=admin' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const body = await res.text();
    console.log('Vercel /api/clients Status:', res.status, 'Body:', body.slice(0, 300));
  } catch (err) {
    console.log('Vercel /api/clients Error:', err.message);
  }
}

check();
