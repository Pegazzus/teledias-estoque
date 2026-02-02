const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Criar diretório do banco de dados se não existir
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Diretório database criado');
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new Database(dbPath);

// Criar tabelas
function initializeDatabase() {
    // Tabela de usuários
    db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            cargo TEXT DEFAULT 'operador' CHECK(cargo IN ('admin', 'operador')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Adicionar coluna cargo se não existir (migração para bancos existentes)
    try {
        db.exec(`ALTER TABLE usuarios ADD COLUMN cargo TEXT DEFAULT 'operador' CHECK(cargo IN ('admin', 'operador'))`);
        console.log('Coluna cargo adicionada à tabela usuarios');
    } catch (e) {
        // Coluna já existe, ignorar
    }

    // Tabela de clientes
    db.exec(`
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
    db.exec(`
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
    db.exec(`
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
    db.exec(`
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

    // Criar usuário admin padrão se não existir
    const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@teledias.com');
    if (!adminExists) {
        const senhaHash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO usuarios (nome, email, senha, cargo) VALUES (?, ?, ?, ?)').run('Administrador', 'admin@teledias.com', senhaHash, 'admin');
        console.log('Usuário admin criado: admin@teledias.com / admin123');
    } else {
        // Garantir que o admin tenha cargo 'admin'
        db.prepare('UPDATE usuarios SET cargo = ? WHERE email = ?').run('admin', 'admin@teledias.com');
    }
}

// Inicializar banco de dados
initializeDatabase();

module.exports = db;
