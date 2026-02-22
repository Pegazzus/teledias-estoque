const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 50 });
    const context = await browser.newContext();
    const page = await context.newPage();

    let step = '';
    try {
        step = 'Login';
        console.log(`[${step}] Iniciando login...`);
        await page.goto('http://localhost:3000');
        await page.fill('#email', 'admin@teledias.com');
        await page.fill('#senha', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL('http://localhost:3000/dashboard.html');

        step = 'Acessando Aba Pedidos';
        console.log(`[${step}] Navegando...`);
        await page.goto('http://localhost:3000/pedidos.html');
        await page.waitForSelector('text=+ Novo Pedido');

        step = 'Criando Novo Pedido VENDA';
        console.log(`[${step}] Preenchendo dados...`);
        await page.click('text=+ Novo Pedido');
        await page.click('text=Novo Cliente');
        await page.waitForSelector('#pedCnpj');
        await page.fill('#pedCnpj', '30.134.450/0001-44'); // Empresa fictícia ou real para testar API
        await page.click('button:has-text("Buscar CNPJ")');
        await page.waitForTimeout(2000); // Wait for API response

        // Add item to proposal
        await page.selectOption('#pedNovoModelo', { label: 'DEP450' });
        await page.fill('#pedNovoQtd', '2');
        await page.click('button:has-text("Adicionar ao Pedido")');
        await page.waitForTimeout(500);

        await page.fill('#pedObservacoes', 'Teste Flow VENDA - E2E Playwright');
        await page.click('#btnSalvarPedido');
        await page.waitForTimeout(1000);

        // At this point the panel should slide open automatically on the newly created order
        await page.waitForSelector('#pedidoPanel[style*="right: 0"]');
        const pedidoIdText = await page.innerText('#panelPedidoId');
        console.log(`Pedido criado: #${pedidoIdText}`);

        // --- FASE 1: COMERCIAL ---
        step = 'Fase Comercial - Checklists';
        console.log(`[${step}] Executando...`);
        let chksComercial = await page.$$('#checklists-comercial input[type="checkbox"]');
        console.log(`Encontrados ${chksComercial.length} checklists no Comercial`);
        for (let chk of chksComercial) {
            await chk.check();
            await page.waitForTimeout(200);
        }
        await page.click('#btnAvancarFase');
        await page.waitForTimeout(1500);

        // --- FASE 2: LOGÍSTICA ---
        step = 'Fase Logística - Scanner e Checklists';
        console.log(`[${step}] Executando...`);
        // Add 2 equipments manually to simulate scanner
        await page.click('#btnEditEquips');
        let equipRows = await page.$$('#equipLogisticaBody tr');
        let inputsRow1 = await equipRows[0].$$('input');
        await inputsRow1[0].fill('SN001-TESTE');
        await inputsRow1[1].fill('DEP450');

        await page.click('#btnEditEquips'); // Add second row
        equipRows = await page.$$('#equipLogisticaBody tr');
        let inputsRow2 = await equipRows[1].$$('input');
        await inputsRow2[0].fill('SN002-TESTE');
        await inputsRow2[1].fill('DEP450');
        await page.click('#btnSaveEquips');
        await page.waitForTimeout(1000);

        let chksLogistica = await page.$$('#checklists-logistica input[type="checkbox"]');
        for (let chk of chksLogistica) {
            await chk.check();
            await page.waitForTimeout(200);
        }
        await page.click('#btnAvancarFase');
        await page.waitForTimeout(1500);

        // --- FASE 3: LABORATÓRIO ---
        step = 'Fase Laboratório - Checklists';
        console.log(`[${step}] Executando...`);
        let chksLab = await page.$$('#checklists-laboratorio input[type="checkbox"]');
        for (let chk of chksLab) {
            await chk.check();
            await page.waitForTimeout(200);
        }
        await page.click('#btnAvancarFase');
        await page.waitForTimeout(1500);

        // --- FASE 4: CONSULTOR EXTERNO ---
        step = 'Fase Consultor Externo - Checklists e Assinatura';
        console.log(`[${step}] Executando...`);
        let chksConsultor = await page.$$('#checklists-consultor_externo input[type="checkbox"]');
        for (let chk of chksConsultor) {
            await chk.check();
            await page.waitForTimeout(200);
        }

        // Simulating drawing on canvas
        const canvas = await page.$('#signaturePadCanvas');
        const box = await canvas.boundingBox();
        await page.mouse.move(box.x + 50, box.y + 50);
        await page.mouse.down();
        await page.mouse.move(box.x + 100, box.y + 100);
        await page.mouse.move(box.x + 150, box.y + 50);
        await page.mouse.up();

        await page.fill('#recebedorNome', 'Cliente Teste Venda');
        await page.click('#btnAssinarOS');
        await page.waitForTimeout(3000); // Wait for PDF generation and API to save and switch to Financeiro

        // Re-open panel because assinarEGerarOS closes it
        step = 'Reabrindo painel para Financeiro';
        console.log(`[${step}] Executando...`);
        // Find the tr containing our order ID
        await page.click(`tr:has-text("#${pedidoIdText}")`);
        await page.waitForSelector('#pedidoPanel[style*="right: 0"]');
        await page.waitForTimeout(1000);

        // --- FASE 5: FINANCEIRO ---
        step = 'Fase Financeiro - Pro Rata e Checklists';
        console.log(`[${step}] Executando...`);
        await page.fill('#finValorAcordado', '1500');
        await page.keyboard.press('Tab'); // Trigger oninput calculation
        await page.waitForTimeout(500);
        await page.click('button:has-text("Salvar Faturamento")');
        await page.waitForTimeout(1000);

        let chksFin = await page.$$('#checklists-financeiro input[type="checkbox"]');
        for (let chk of chksFin) {
            await chk.check();
            await page.waitForTimeout(200);
        }
        await page.click('#btnAvancarFase');
        await page.waitForTimeout(1500);

        // --- FASE 6: CONTROLE DE QUALIDADE ---
        step = 'Fase Controle de Qualidade - Checklists Finais';
        console.log(`[${step}] Executando...`);
        let chksCQ = await page.$$('#checklists-controle_qualidade input[type="checkbox"]');
        for (let chk of chksCQ) {
            await chk.check();
            await page.waitForTimeout(200);
        }
        await page.click('#btnAvancarFase');
        await page.waitForTimeout(1500);

        // Verify it ended up in Concluído
        const finalBadge = await page.innerText('#panelSlaBadge');
        assert(finalBadge.includes('CONCLUÍDO') || finalBadge.includes('Finalizado'), 'O pedido não atingiu a fase final Concluído');
        console.log('🎉 SUCESSO: TESTE E2E DO FLUXO DE VENDA FINALIZADO COM SUCESSO!');

    } catch (e) {
        console.error(`❌ Erro durante o passo: ${step}`);
        console.error(e);
        await page.screenshot({ path: 'test_error_venda_flow.png' });
    } finally {
        await browser.close();
    }
})();
