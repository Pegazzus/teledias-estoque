const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'login.html' && f !== 'pedidos.html');

const injection = `
                    <a href="dashboard.html" class="nav-link">
                        <span class="nav-link-icon">📊</span>
                        Dashboard
                    </a>
                    <a href="pedidos.html" class="nav-link">
                        <span class="nav-link-icon">📋</span>
                        Pedidos/Propostas
                    </a>`;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if it already has pedidos
    if (content.includes('pedidos.html')) {
        console.log(`Pular ${file} - já possui link de pedidos`);
        return;
    }

    const regex = /<a href="dashboard\.html" class="nav-link">[\s\S]*?Dashboard\s*<\/a>/;

    if (content.match(regex)) {
        content = content.replace(regex, injection.trim());
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Atualizado ${file}`);
    } else {
        console.log(`Não encontrou bloco dashboard em ${file}`);
    }
});
