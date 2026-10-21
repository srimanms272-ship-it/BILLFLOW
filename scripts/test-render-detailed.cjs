async function testRender() {
  console.log('Sending request to Render /api/clients with 45s timeout...');
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const res = await fetch('https://billflow-backend-ntt5.onrender.com/api/clients', {
      headers: {
        'Cookie': 'billflow_demo=admin',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const text = await res.text();
    console.log(`Render responded in ${Date.now() - start}ms`);
    console.log(`Status: ${res.status}`);
    console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
    console.log(`Body:`, text);
  } catch (err) {
    console.log(`Failed after ${Date.now() - start}ms:`, err);
  }
}

testRender();
