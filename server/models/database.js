const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// Configuração do banco de dados
// Se TURSO_DATABASE_URL estiver definido, usa Turso (produção)
// Caso contrário, usa SQLite local (desenvolvimento)
let db;

if (process.env.TURSO_DATABASE_URL) {
    console.log('🌐 Conectando ao Turso (produção)...');
    db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });
} else {
    console.log('💾 Usando SQLite local (desenvolvimento)...');
    db = createClient({
        url: 'file:./server/database/database.sqlite'
    });
}

// Wrapper para compatibilidade com código existente
const dbWrapper = {
    prepare: (sql) => ({
        run: async (...params) => {
            const result = await db.execute({ sql, args: params });
            return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
        },
        get: async (...params) => {
            const result = await db.execute({ sql, args: params });
            return result.rows[0] || null;
        },
        all: async (...params) => {
            const result = await db.execute({ sql, args: params });
            return result.rows;
        }
    }),
    exec: async (sql) => {
        const statements = sql.split(';').filter(s => s.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                await db.execute(statement);
            }
        }
    }
};

// Inicializar banco de dados
async function initializeDatabase() {
    console.log('📦 Inicializando banco de dados...');

    // Tabela de usuários
    await db.execute(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            cargo TEXT DEFAULT 'operador' CHECK(cargo IN ('admin', 'operador')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de clientes
    await db.execute(`
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cnpj_cpf TEXT,
            telefone TEXT,
            email TEXT,
            endereco TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de rádios
    await db.execute(`
        CREATE TABLE IF NOT EXISTS radios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT UNIQUE NOT NULL,
            modelo TEXT NOT NULL,
            marca TEXT,
            numero_serie TEXT,
            status TEXT DEFAULT 'estoque' CHECK(status IN ('estoque', 'cliente', 'manutencao')),
            cliente_id INTEGER,
            observacoes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        )
    `);

    // Tabela de movimentações
    await db.execute(`
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            radio_id INTEGER NOT NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('saida', 'retorno', 'manutencao', 'retorno_manutencao')),
            cliente_id INTEGER,
            data_movimento DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_retorno_prevista DATETIME,
            observacoes TEXT,
            usuario_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (radio_id) REFERENCES radios(id),
            FOREIGN KEY (cliente_id) REFERENCES clientes(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    // Tabela de manutenções
    await db.execute(`
        CREATE TABLE IF NOT EXISTS manutencoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            radio_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente', 'em_andamento', 'concluida')),
            data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_conclusao DATETIME,
            custo REAL,
            observacoes TEXT,
            FOREIGN KEY (radio_id) REFERENCES radios(id)
        )
    `);

    // Tabela de fornecedores
    await db.execute(`
        CREATE TABLE IF NOT EXISTS fornecedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cnpj TEXT,
            telefone TEXT,
            email TEXT,
            endereco TEXT,
            contato TEXT,
            site TEXT,
            observacoes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de cotações
    await db.execute(`
        CREATE TABLE IF NOT EXISTS cotacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            descricao TEXT,
            status TEXT DEFAULT 'aberta' CHECK(status IN ('aberta', 'finalizada', 'cancelada')),
            data_validade DATETIME,
            observacoes TEXT,
            usuario_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    // Tabela de itens da cotação (preços encontrados pela IA)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS cotacao_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cotacao_id INTEGER NOT NULL,
            loja TEXT NOT NULL,
            produto TEXT NOT NULL,
            preco REAL,
            link TEXT,
            frete TEXT,
            disponibilidade TEXT,
            observacoes TEXT,
            melhor_preco INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE
        )
    `);

    // Tabela de configurações do sistema
    await db.execute(`
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Seed default settings if not exists
    try {
        const proxySetting = await db.execute({ sql: "SELECT * FROM system_settings WHERE key = ?", args: ['proxy_url'] });
        if (proxySetting.rows.length === 0) {
            await db.execute({
                sql: "INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)",
                args: ['proxy_url', '', 'URL do Proxy rotativo (ex: http://user:pass@host:port)']
            });
        }
    } catch (e) {
        // Ignorar erro se tabela ainda não existir na primeira execução ou erro de sintaxe
    }

    // Criar usuário admin padrão se não existir
    const adminResult = await db.execute({
        sql: 'SELECT id FROM usuarios WHERE email = ?',
        args: ['admin@teledias.com']
    });

    if (adminResult.rows.length === 0) {
        const senhaHash = bcrypt.hashSync('admin123', 10);
        await db.execute({
            sql: 'INSERT INTO usuarios (nome, email, senha, cargo) VALUES (?, ?, ?, ?)',
            args: ['Administrador', 'admin@teledias.com', senhaHash, 'admin']
        });
        console.log('✅ Usuário admin criado: admin@teledias.com / admin123');
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
}

// Exportar cliente e função de inicialização
module.exports = { db, initializeDatabase };
