const fetch = require('undici').fetch;

async function testAll() {
    const baseUrl = 'http://localhost:3000/api';

    // 1. Login
    console.log('🔑 Login...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@teledias.com', senha: 'admin123' })
    });
    const { token } = await loginRes.json();
    console.log('✅ Login OK');

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // 2. Create radio
    console.log('\n=== TESTE 1: Criar Rádio ===');
    const createRes = await fetch(`${baseUrl}/radios`, {
        method: 'POST', headers,
        body: JSON.stringify({ codigo: 'TEST_' + Date.now(), modelo: 'TestModel', marca: 'TestBrand', numero_serie: '999', observacoes: 'Test' })
    });
    const radio = await createRes.json();
    console.log(createRes.ok ? `✅ Criado! ID: ${radio.id}` : `❌ FALHOU: ${JSON.stringify(radio)}`);
    if (!createRes.ok) return;

    // 3. Create client (needed for saida)
    console.log('\n=== TESTE 2: Criar Cliente ===');
    const clientRes = await fetch(`${baseUrl}/clientes`, {
        method: 'POST', headers,
        body: JSON.stringify({ nome: 'ClienteTest', telefone: '11999999999' })
    });
    const client = await clientRes.json();
    console.log(clientRes.ok ? `✅ Cliente criado! ID: ${client.id}` : `❌ FALHOU: ${JSON.stringify(client)}`);

    // 4. Move to client (SINGLE radio - uses /api/movimentacoes/saida)
    console.log('\n=== TESTE 3: Saída para Cliente (rota /movimentacoes/saida) ===');
    const saidaRes = await fetch(`${baseUrl}/movimentacoes/saida`, {
        method: 'POST', headers,
        body: JSON.stringify({ radio_id: radio.id, cliente_id: client.id || 1, observacoes: 'Saída teste' })
    });
    const saidaBody = await saidaRes.json();
    console.log(saidaRes.ok ? `✅ Saída OK! ${JSON.stringify(saidaBody)}` : `❌ FALHOU: ${JSON.stringify(saidaBody)}`);

    // 5. Return (SINGLE radio - uses /api/movimentacoes/retorno)
    console.log('\n=== TESTE 4: Retorno ao Estoque (rota /movimentacoes/retorno) ===');
    const retornoRes = await fetch(`${baseUrl}/movimentacoes/retorno`, {
        method: 'POST', headers,
        body: JSON.stringify({ radio_id: radio.id })
    });
    const retornoBody = await retornoRes.json();
    console.log(retornoRes.ok ? `✅ Retorno OK! ${JSON.stringify(retornoBody)}` : `❌ FALHOU: ${JSON.stringify(retornoBody)}`);

    // 6. Move to maintenance (SINGLE radio - uses /api/movimentacoes/manutencao)
    console.log('\n=== TESTE 5: Manutenção (rota /movimentacoes/manutencao) ===');
    const manutRes = await fetch(`${baseUrl}/movimentacoes/manutencao`, {
        method: 'POST', headers,
        body: JSON.stringify({ radio_id: radio.id, descricao: 'Problema teste', observacoes: 'Obs teste' })
    });
    const manutBody = await manutRes.json();
    console.log(manutRes.ok ? `✅ Manutenção OK! ${JSON.stringify(manutBody)}` : `❌ FALHOU: ${JSON.stringify(manutBody)}`);

    // 7. Dashboard stats
    console.log('\n=== TESTE 6: Dashboard Stats ===');
    const statsRes = await fetch(`${baseUrl}/radios/stats/resumo`, { headers: { 'Authorization': `Bearer ${token}` } });
    const statsBody = await statsRes.json();
    console.log(statsRes.ok ? `✅ Stats OK! ${JSON.stringify(statsBody)}` : `❌ FALHOU: ${JSON.stringify(statsBody)}`);

    console.log('\n🏁 Todos os testes concluídos!');
}

testAll().catch(console.error);
