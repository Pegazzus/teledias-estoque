/**
 * Price Scraper Service
 * Obtém preços REAIS de lojas brasileiras via API e web scraping.
 * Nenhum dado é gerado por IA — tudo vem de fontes verificáveis.
 */

const cheerio = require('cheerio');
const { db } = require('../models/database');

// Hardcoded UA that is confirmed to work in test-ml.js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function getProxyUrl() {
    try {
        const result = await db.execute({
            sql: 'SELECT value FROM system_settings WHERE key = ?',
            args: ['proxy_url']
        });
        return result.rows[0]?.value || process.env.PROXY_URL;
    } catch (e) {
        return process.env.PROXY_URL;
    }
}

async function getFetchOptions(customHeaders = {}) {
    const headers = { ...customHeaders };
    if (!headers['User-Agent']) headers['User-Agent'] = UA;

    // ML requires specific headers to avoid 403
    if (!headers['Accept']) headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';

    const options = {
        headers,
        signal: AbortSignal.timeout(15000), // 15s timeout
        redirect: 'follow'
    };

    const proxyUrl = await getProxyUrl();
    if (proxyUrl) {
        try {
            // Lazy load undici to avoid startup crash if not installed
            const { ProxyAgent } = require('undici');
            const proxyAgent = new ProxyAgent(proxyUrl);
            options.dispatcher = proxyAgent;
            // console.log(`🔒 Usando Proxy: ${proxyUrl.replace(/:[^:]*@/, ':***@')}`); // Too verbose
        } catch (e) {
            // console.warn('⚠️ Proxy configurado mas falha ao carregar undici agent');
        }
    }

    return options;
}

// ╔════════════════════════════════════════╗
// ║  MERCADO LIVRE — Web Scraping          ║
// ╚════════════════════════════════════════╝

async function searchMercadoLivre(query) {
    try {
        const q = query.replace(/\s+/g, '-');
        const url = `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`;

        console.log(`[ML] Fetching: ${url}`);
        const options = await getFetchOptions({
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        const res = await fetch(url, options);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        console.log(`[ML] HTML Length: ${html.length}`);

        const $ = cheerio.load(html);
        const results = [];

        // Selectors for ML product listings (Standard, Grid, Shops)
        const itemSelectors = [
            'li.ui-search-layout__item',
            'div.ui-search-result__wrapper', // Grid view
            'div.ui-search-result', // List view
            '.shops__cardStyles' // Shops view
        ];

        // Combine selectors
        const combinedSelector = itemSelectors.join(', ');

        $(combinedSelector).each((i, el) => {
            if (results.length >= 6) return false;

            // Title
            const title = $(el).find('a.ui-search-link__title-card, h2.ui-search-item__title, a.ui-search-item__group__element, h2.poly-component__title, h2.ui-search-result__title').first().text().trim();

            // Price parsing
            // Check for new price format
            let priceFraction = $(el).find('span.andes-money-amount__fraction').first().text().trim();
            let priceCents = $(el).find('span.andes-money-amount__cents').first().text().trim();

            // Link
            let link = $(el).find('a.ui-search-link, a.ui-search-result__content, a.ui-search-item__group__element').first().attr('href');

            // Image handling (often lazy loaded)
            let img = $(el).find('img').first().attr('src');
            const dataSrc = $(el).find('img').first().attr('data-src');
            if (dataSrc) img = dataSrc;

            if (title && priceFraction) {
                let priceText = priceFraction.replace(/\./g, '');
                if (priceCents) priceText += `.${priceCents}`;
                const preco = parseFloat(priceText);

                if (preco > 0) {
                    results.push({
                        loja: 'Mercado Livre',
                        produto: title,
                        preco,
                        link: link || '',
                        imagem: img || '',
                        frete: 'Consultar',
                        disponibilidade: 'Em estoque',
                        condicao: 'Novo',
                        vendedor: 'Mercado Livre',
                        fonte: 'verificado'
                    });
                }
            }
        });

        console.log(`✅ Mercado Livre: ${results.length} resultados`);
        return results;
    } catch (err) {
        console.warn('⚠️ Mercado Livre scraping falhou:', err.message);
        return [];
    }
}

// ╔════════════════════════════════════════╗
// ║  AMAZON BRASIL — Web Scraping          ║
// ╚════════════════════════════════════════╝

async function searchAmazon(query) {
    try {
        const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(query)}`;
        console.log(`[Amazon] Fetching: ${url}`);

        const options = await getFetchOptions({
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'Accept-Encoding': 'identity',
        });

        const res = await fetch(url, options);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        console.log(`[Amazon] HTML Length: ${html.length}`);

        const $ = cheerio.load(html);
        const results = [];

        $('[data-component-type="s-search-result"]').each((i, el) => {
            if (results.length >= 4) return false;

            const title = $(el).find('h2 .a-text-normal').text().trim();
            const priceWhole = $(el).find('.a-price-whole').first().text().replace(/\./g, '').trim();
            const priceFraction = $(el).find('.a-price-fraction').first().text().trim();
            const linkHref = $(el).find('h2 a.a-link-normal').attr('href');
            const img = $(el).find('img.s-image').attr('src');

            if (title && priceWhole) {
                const preco = parseFloat(`${priceWhole}.${priceFraction || '00'}`);
                if (preco > 0 && !isNaN(preco)) {
                    results.push({
                        loja: 'Amazon Brasil',
                        produto: title,
                        preco,
                        link: linkHref ? `https://www.amazon.com.br${linkHref}` : '',
                        imagem: img || '',
                        frete: 'Consultar',
                        disponibilidade: 'Em estoque',
                        condicao: 'Novo',
                        vendedor: 'Amazon',
                        fonte: 'scraping'
                    });
                }
            }
        });

        console.log(`✅ Amazon: ${results.length} resultados`);
        return results;
    } catch (err) {
        console.warn('⚠️ Amazon scraping falhou:', err.message);
        return [];
    }
}

// ╔════════════════════════════════════════╗
// ║  KABUM — Web Scraping                  ║
// ╚════════════════════════════════════════╝

async function searchKabum(query) {
    try {
        const url = `https://www.kabum.com.br/busca/${encodeURIComponent(query)}`;
        const options = await getFetchOptions({
            'Accept-Language': 'pt-BR,pt;q=0.9',
        });

        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const $ = cheerio.load(html);

        const results = [];

        // Kabum Strategy 1: JSON via Next.js
        const nextData = $('script#__NEXT_DATA__').html();
        if (nextData) {
            try {
                const parsed = JSON.parse(nextData);
                // Try different paths in the JSON structure
                const props = parsed?.props?.pageProps;
                let products = [];

                if (props?.data?.catalogServer?.data) products = props.data.catalogServer.data;
                else if (props?.data?.search?.data) products = props.data.search.data;
                else if (props?.initialState?.catalog?.data) products = props.initialState.catalog.data;

                if (Array.isArray(products)) {
                    for (const item of products.slice(0, 4)) {
                        if (item.name && (item.price || item.priceWithDiscount)) {
                            results.push({
                                loja: 'Kabum',
                                produto: item.name,
                                preco: item.priceWithDiscount || item.price,
                                link: `https://www.kabum.com.br/produto/${item.code}/${item.friendlyName}`,
                                imagem: item.image,
                                frete: 'Consultar',
                                disponibilidade: item.available ? 'Em estoque' : 'Indisponível',
                                condicao: 'Novo',
                                vendedor: 'Kabum',
                                fonte: 'scraping'
                            });
                        }
                    }
                }
            } catch (e) { /* ignore json parse error */ }
        }

        // Kabum Strategy 2: HTML Parsing (fallback)
        if (results.length === 0) {
            $('article.productCard, div[data-testid="product-card"]').each((i, el) => {
                if (results.length >= 4) return false;
                const title = $(el).find('span.nameCard, h2').text().trim();
                const priceText = $(el).find('span.priceCard').text().trim();
                const link = $(el).find('a').attr('href');
                const img = $(el).find('img').attr('src');

                if (title && priceText) {
                    const preco = parsePrice(priceText);
                    if (preco > 0) {
                        results.push({
                            loja: 'Kabum',
                            produto: title,
                            preco,
                            link: link ? `https://www.kabum.com.br${link}` : '',
                            imagem: img || '',
                            frete: 'Consultar',
                            disponibilidade: 'Em estoque',
                            condicao: 'Novo',
                            vendedor: 'Kabum',
                            fonte: 'scraping'
                        });
                    }
                }
            });
        }

        console.log(`✅ Kabum: ${results.length} resultados`);
        return results;
    } catch (err) {
        console.warn('⚠️ Kabum scraping falhou:', err.message);
        return [];
    }
}

// ╔════════════════════════════════════════════════╗
// ║  GOOGLE SHOPPING — Web Scraping (best-effort)  ║
// ╚════════════════════════════════════════════════╝

async function searchGoogleShopping(query) {
    try {
        const url = `https://www.google.com.br/search?q=${encodeURIComponent(query)}&tbm=shop&hl=pt-BR&gl=BR`;
        const options = await getFetchOptions({
            'Accept-Language': 'pt-BR,pt;q=0.9',
        });

        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const $ = cheerio.load(html);

        const results = [];

        // Google Shopping product cards - selectors change frequently
        // Try multiple selector patterns
        const cardSelectors = [
            '.sh-dgr__content',
            '.i0X6df',
            '.sh-dgr__grid-result'
        ];

        $(cardSelectors.join(', ')).each((i, el) => {
            if (results.length >= 5) return false;

            const title = $(el).find('h3, .tAxDx').text().trim();

            // Price often in span like "R$ 1.999,00"
            let priceText = $(el).find('span[aria-hidden="true"]').first().text().trim();
            if (!priceText || !priceText.includes('R$')) {
                // Try finding any text matching price pattern
                const text = $(el).text();
                const match = text.match(/R\$\s*[\d.,]+/);
                if (match) priceText = match[0];
            }

            const loja = $(el).find('.IuHnof, .aULzUe').text().trim();
            const link = $(el).find('a[href^="/url"]').attr('href') || $(el).find('a').attr('href');
            const img = $(el).find('img').attr('src');

            if (title && priceText) {
                const preco = parsePrice(priceText);
                const cleanLink = extractGoogleRedirectUrl(link);

                if (preco > 0) {
                    results.push({
                        loja: loja || 'Google Shopping',
                        produto: title,
                        preco,
                        link: cleanLink ? (cleanLink.startsWith('http') ? cleanLink : `https://www.google.com.br${cleanLink}`) : '',
                        imagem: img || '',
                        frete: 'Consultar',
                        disponibilidade: 'Verificar',
                        condicao: '',
                        vendedor: loja,
                        fonte: 'google_shopping'
                    });
                }
            }
        });

        console.log(`✅ Google Shopping: ${results.length} resultados`);
        return results;
    } catch (err) {
        console.warn('⚠️ Google Shopping scraping falhou:', err.message);
        return [];
    }
}

// ╔════════════════════════════════════════╗
// ║  ORQUESTRADOR — Busca em todas lojas   ║
// ╚════════════════════════════════════════╝

async function searchAllStores(query) {
    console.log(`\n🔍 Buscando "${query}" em todas as lojas...`);

    const scrapers = [
        { name: 'Kabum', fn: searchKabum }, // Run Kabum first (usually fastest/easiest)
        { name: 'Mercado Livre', fn: searchMercadoLivre },
        { name: 'Amazon', fn: searchAmazon },
        { name: 'Google Shopping', fn: searchGoogleShopping },
    ];

    let allResults = [];

    // Run sequentially to reduce bot detection risk and network congestion
    for (const scraper of scrapers) {
        try {
            console.log(`  👉 Iniciando: ${scraper.name}...`);
            // Add a small random delay between requests
            if (allResults.length > 0) await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

            const res = await scraper.fn(query);
            console.log(`  ✅ ${scraper.name}: ${res.length} resultados`);
            allResults.push(...res);
        } catch (e) {
            console.log(`  ⚠️ ${scraper.name}: Erro - ${e.message}`);
        }
    }

    // Filter out items with invalid prices
    allResults = allResults.filter(r => r.preco > 0 && !isNaN(r.preco));

    // Sort by price ascending
    allResults.sort((a, b) => a.preco - b.preco);

    // Mark best price
    if (allResults.length > 0) {
        const minPrice = allResults[0].preco;
        allResults.forEach(r => {
            r.melhor_preco = (r.preco === minPrice);
        });
    }

    console.log(`📊 Total: ${allResults.length} resultados encontrados\n`);
    return allResults;
}

// ╔════════════════════════════════════════╗
// ║  UTILITÁRIOS                           ║
// ╚════════════════════════════════════════╝

function parsePrice(text) {
    if (!text) return 0;
    // Remove "R$", spaces
    let clean = text.replace(/R\$\s*/gi, '').replace(/\s/g, '').trim();
    // Handle BR format: 1.299,90 -> 1299.90
    // Remove thousands separator (.) and replace decimal separator (,) with (.)
    clean = clean.replace(/\./g, '').replace(',', '.');

    // Some stores might send 1299.90 directly
    if (!clean.includes('.') && clean.length > 5) {
        // heuristic: if number is huge, maybe it has no decimal?
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

function extractGoogleRedirectUrl(url) {
    if (!url) return '';
    try {
        if (url.includes('url?q=')) {
            const match = url.match(/[?&]q=([^&]+)/);
            if (match) return decodeURIComponent(match[1]);
        }
        return url;
    } catch {
        return url;
    }
}

function getQuickSearchLinks(query) {
    const q = encodeURIComponent(query);
    return [
        { loja: 'Google Shopping', url: `https://www.google.com.br/search?q=${q}&tbm=shop`, icone: '🔍' },
        { loja: 'Magazine Luiza', url: `https://www.magazineluiza.com.br/busca/${q}/`, icone: '🟣' },
        { loja: 'Americanas', url: `https://www.americanas.com.br/busca/${q}`, icone: '🔴' },
        { loja: 'Casas Bahia', url: `https://www.casasbahia.com.br/busca/${q}`, icone: '🔵' },
        { loja: 'Shopee', url: `https://shopee.com.br/search?keyword=${q}`, icone: '🟠' },
        { loja: 'AliExpress', url: `https://pt.aliexpress.com/wholesale?SearchText=${q}`, icone: '🟡' },
    ];
}

async function checkHealth() {
    const testQuery = 'pen drive';
    console.log('🩺 Verificando saúde dos scrapers...');

    // Check in parallel for speed in health check
    const results = await Promise.all([
        searchMercadoLivre(testQuery).then(r => ({ name: 'Mercado Livre', status: r.length > 0 ? 'online' : 'blocked', count: r.length })),
        searchKabum(testQuery).then(r => ({ name: 'Kabum', status: r.length > 0 ? 'online' : 'blocked', count: r.length })),
        searchAmazon(testQuery).then(r => ({ name: 'Amazon', status: r.length > 0 ? 'online' : 'blocked', count: r.length }))
        // Google is fallback, skip for health check to avoid rate limit
    ]);

    return results;
}

module.exports = {
    searchAllStores,
    searchMercadoLivre,
    searchAmazon,
    searchKabum,
    searchGoogleShopping,
    getQuickSearchLinks,
    parsePrice,
    checkHealth
};
