const { searchMercadoLivre, searchAmazon, searchKabum, searchGoogleShopping, searchAllStores } = require('./server/services/price-scraper');

async function test() {
    const query = 'iPhone 15 128GB';
    console.log(`\n=== Testando busca: "${query}" ===\n`);

    // Test ML
    console.log('--- Mercado Livre ---');
    try {
        const ml = await searchMercadoLivre(query);
        console.log(`Resultados: ${ml.length}`);
        ml.slice(0, 3).forEach(r => console.log(`  ${r.produto} | R$ ${r.preco} | ${r.link.substring(0, 80)}`));
    } catch (e) {
        console.error('ERRO ML:', e.message);
    }

    // Test Amazon
    console.log('\n--- Amazon ---');
    try {
        const az = await searchAmazon(query);
        console.log(`Resultados: ${az.length}`);
        az.slice(0, 2).forEach(r => console.log(`  ${r.produto} | R$ ${r.preco}`));
    } catch (e) {
        console.error('ERRO Amazon:', e.message);
    }

    // Test Kabum
    console.log('\n--- Kabum ---');
    try {
        const kb = await searchKabum(query);
        console.log(`Resultados: ${kb.length}`);
        kb.slice(0, 2).forEach(r => console.log(`  ${r.produto} | R$ ${r.preco}`));
    } catch (e) {
        console.error('ERRO Kabum:', e.message);
    }

    // Test Google Shopping
    console.log('\n--- Google Shopping ---');
    try {
        const gs = await searchGoogleShopping(query);
        console.log(`Resultados: ${gs.length}`);
        gs.slice(0, 2).forEach(r => console.log(`  ${r.produto} | R$ ${r.preco} | ${r.loja}`));
    } catch (e) {
        console.error('ERRO Google Shopping:', e.message);
    }

    console.log('\n=== Fim do teste ===');
}

test();
