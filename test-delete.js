const fetch = require('undici').fetch;

async function testDelete() {
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

    // 2. Buscar rádio "sadsa"
    console.log('🔍 Buscando rádio "sadsa"...');
    const radiosRes = await fetch(`${baseUrl}/radios?busca=sadsa`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const radios = await radiosRes.json();
    const radio = radios.find(r => r.codigo === 'sadsa');

    if (!radio) {
        console.log('⚠️ Rádio "sadsa" não encontrado. Talvez já excluído?');
        // Tentar criar para testar exclusão?
        console.log('➕ Criando rádio teste "sadsa"...');
        const createRes = await fetch(`${baseUrl}/radios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                codigo: 'sadsa',
                modelo: 'asdsads',
                marca: 'asdsada',
                numero_serie: 'asdsada',
                observacoes: 'Teste de exclusão'
            })
        });

        if (!createRes.ok) {
            console.error('❌ Falha ao criar rádio teste:', await createRes.text());
            return;
        }

        const newRadio = await createRes.json();
        console.log('✅ Rádio criado. ID:', newRadio.id);

        // Adicionar histórico (simular o problema original)
        console.log('📝 Adicionando histórico de manutenção (simulando FK)...');
        await fetch(`${baseUrl}/radios/lote/manutencao`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                radio_ids: [newRadio.id],
                descricao: 'Teste FK',
                observacoes: 'Teste'
            })
        });

        // Precisamos retornar ao estoque para permitir exclusão (regra de negócio)
        // Mas a rota de manutenção muda status para 'manutencao'.
        // Rota de exclusão exige status 'estoque'.
        // Vamos retornar da manutenção.
        // Ops, não tem rota de retorno de manutenção individual na API listada?
        // Tem `/lote/retorno` mas é de cliente.
        // Tem `/movimentacoes`?

        // Vamos checar o código de `radios.js` novamente... 
        // Ah, `status !== 'estoque'` impede exclusão.
        // Se eu coloquei em manutenção, não posso excluir.
        // O usuário disse que deu Erro Interno. Isso acontece se tentar excluir algo em estoque mas com histórico.

        // Então, se eu criei e deixei em estoque, mas adicionei histórico (movimentação de entrada? não, criação não cria mov).
        // Se eu fizer Saída e Retorno, fica em estoque E tem histórico.

        console.log('🚚 Simulando Saída e Retorno...');
        await fetch(`${baseUrl}/radios/lote/saida`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ radio_ids: [newRadio.id], cliente_id: 1, observacoes: 'Saída teste' }) // Assumindo cliente ID 1 existe
        });

        await fetch(`${baseUrl}/radios/lote/retorno`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ radio_ids: [newRadio.id], observacoes: 'Retorno teste' })
        });

        console.log('🗑️ Tentando excluir AGORA...');
        const deleteRes = await fetch(`${baseUrl}/radios/${newRadio.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (deleteRes.ok) {
            console.log('✅ SUCESSO! Rádio excluído com histórico.');
        } else {
            console.error('❌ FALHA na exclusão:', await deleteRes.text());
        }
    } else {
        console.log('🆔 Rádio encontrado. ID:', radio.id);

        // Excluir
        console.log('🗑️ Excluindo rádio...');
        const deleteRes = await fetch(`${baseUrl}/radios/${radio.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (deleteRes.ok) {
            console.log('✅ SUCESSO! Rádio excluído.');
        } else {
            console.error('❌ FALHA na exclusão:', deleteRes.status, await deleteRes.text());
        }
    }
}

testDelete();
