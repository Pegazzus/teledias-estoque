const fetch = require('undici').fetch;

async function testExcel() {
    const baseUrl = 'http://localhost:3000/api';

    // 1. Login
    console.log('🔑 Login...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@teledias.com', senha: 'admin123' })
    });

    if (!loginRes.ok) {
        console.error('❌ Login falhou:', await loginRes.text());
        return;
    }

    const { token } = await loginRes.json();
    console.log('✅ Login OK');

    const headers = { 'Authorization': `Bearer ${token}` };

    // 2. Test Clients Export (The one with subquery)
    console.log('\n=== TESTE Excel Clientes ===');
    const res = await fetch(`${baseUrl}/relatorios/clientes`, { headers });

    if (res.ok) {
        console.log('✅ Exportação de Clientes OK (Status 200)');
        const contentType = res.headers.get('content-type');
        console.log('Content-Type:', contentType);
    } else {
        console.error('❌ FALHOU:', res.status, await res.text());
    }

    // 3. Test Radios Export
    console.log('\n=== TESTE Excel Rádios ===');
    const res2 = await fetch(`${baseUrl}/relatorios/radios`, { headers });
    if (res2.ok) console.log('✅ Exportação de Rádios OK');
    else console.error('❌ FALHOU:', res2.status, await res2.text());
}

testExcel().catch(console.error);
