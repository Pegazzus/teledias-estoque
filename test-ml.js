// Test web scraping approaches for Brazilian stores
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function testMercadoLivreScraping(query) {
    console.log('\n--- Mercado Livre (Web Scraping) ---');
    try {
        const q = query.replace(/\s+/g, '-');
        const url = `https://lista.mercadolivre.com.br/${q}`;
        console.log('URL:', url);

        const res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
            },
            signal: AbortSignal.timeout(15000),
            redirect: 'follow'
        });
        console.log('Status:', res.status);
        if (!res.ok) return;

        const html = await res.text();
        console.log('HTML length:', html.length);
        const $ = cheerio.load(html);

        // Try different selectors for ML product listings
        const selectors = [
            'li.ui-search-layout__item',
            'div.ui-search-result',
            'ol.ui-search-layout > li',
            '.shops__cardStyles',
            'section.ui-search-results'
        ];

        for (const sel of selectors) {
            const count = $(sel).length;
            if (count > 0) {
                console.log(`Found ${count} elements with: ${sel}`);
            }
        }

        // Try to extract products
        const results = [];
        $('li.ui-search-layout__item, div.ui-search-result__wrapper').each((i, el) => {
            if (results.length >= 3) return false;

            const title = $(el).find('a.ui-search-link__title-card, h2.ui-search-item__title, a.ui-search-item__group__element').text().trim() ||
                $(el).find('h2').first().text().trim();
            const priceText = $(el).find('span.andes-money-amount__fraction').first().text().trim();
            const link = $(el).find('a.ui-search-link, a.ui-search-result__content').attr('href') ||
                $(el).find('a').first().attr('href');
            const img = $(el).find('img').first().attr('data-src') || $(el).find('img').first().attr('src');

            if (title) {
                results.push({ title, price: priceText, link: link?.substring(0, 80), img: img?.substring(0, 60) });
            }
        });

        console.log(`Extracted ${results.length} products:`);
        results.forEach(r => console.log(`  ${r.title} | R$ ${r.price} | ${r.link}`));

        // If no results found, dump some HTML clues
        if (results.length === 0) {
            // Check for any price elements
            const priceEls = $('span.andes-money-amount__fraction');
            console.log(`Price elements found: ${priceEls.length}`);

            // Check for product links
            const productLinks = $('a[href*="/MLB-"]');
            console.log(`Product links (MLB): ${productLinks.length}`);

            // Try to find any text that looks like product data
            const h2s = $('h2');
            console.log(`H2 elements: ${h2s.length}`);
            h2s.slice(0, 3).each((i, el) => {
                console.log(`  H2: ${$(el).text().trim().substring(0, 60)}`);
            });

            // Dump a section of the body
            const bodyText = $('body').text().replace(/\s+/g, ' ').substring(0, 500);
            console.log(`Body preview: ${bodyText.substring(0, 300)}`);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function testAmazonScraping(query) {
    console.log('\n--- Amazon BR (Web Scraping) ---');
    try {
        const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(query)}`;
        console.log('URL:', url);

        const res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Accept-Encoding': 'identity',
            },
            signal: AbortSignal.timeout(15000)
        });
        console.log('Status:', res.status);
        if (!res.ok) return;

        const html = await res.text();
        console.log('HTML length:', html.length);
        const $ = cheerio.load(html);

        const products = $('[data-component-type="s-search-result"]');
        console.log(`Search result elements: ${products.length}`);

        products.slice(0, 3).each((i, el) => {
            const title = $(el).find('h2 .a-text-normal').text().trim();
            const price = $(el).find('.a-price .a-price-whole').first().text().trim();
            const link = $(el).find('h2 a').attr('href');
            console.log(`  ${title.substring(0, 60)} | R$ ${price} | ${link?.substring(0, 50)}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function main() {
    const query = 'iPhone 15 128GB';
    console.log(`=== Testing scrapers for: "${query}" ===`);
    await testMercadoLivreScraping(query);
    await testAmazonScraping(query);
    console.log('\n=== Done ===');
}

main();
