const fs = require('fs');
const glob = require('glob');

const files = fs.readdirSync('public').filter(f => f.endsWith('.html') && f !== 'login.html');

files.forEach(file => {
    let content = fs.readFileSync('public/' + file, 'utf8');

    // Find where the Cotações section starts and ends approximately
    const regex = /(<div class="nav-section-title">Cotações<\/div>[\s\S]*?<a href="fornecedores\.html".*?<\/a>)/;

    const match = content.match(regex);
    if (match) {
        let replacement = match[1] + `\n                    <a href="precos.html" class="nav-link admin-only">\n                        <span class="nav-link-icon">💲</span>\n                        Tabela de Preços\n                    </a>`;

        let updated = content.replace(regex, replacement);

        // Also replace the title Cotações
        updated = updated.replace('<div class="nav-section-title">Cotações</div>', '<div class="nav-section-title">Cotações & Preços</div>');

        fs.writeFileSync('public/' + file, updated, 'utf8');
        console.log('Patched ' + file);
    } else {
        console.log('Regex did not match on ' + file);
    }
});
