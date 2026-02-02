const express = require('express');
const db = require('../models/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Listar todos os clientes
router.get('/', (req, res) => {
    try {
        const { busca } = req.query;

        let query = 'SELECT * FROM clientes WHERE 1=1';
        const params = [];

        if (busca) {
            query += ' AND (nome LIKE ? OR cnpj_cpf LIKE ? OR telefone LIKE ? OR email LIKE ?)';
            const buscaParam = `%${busca}%`;
            params.push(buscaParam, buscaParam, buscaParam, buscaParam);
        }

        query += ' ORDER BY nome ASC';

        const clientes = db.prepare(query).all(...params);
        res.json(clientes);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar cliente por ID
router.get('/:id', (req, res) => {
    try {
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Buscar rádios alocados ao cliente
        const radios = db.prepare("SELECT * FROM radios WHERE cliente_id = ? AND status = 'cliente'").all(req.params.id);

        res.json({ ...cliente, radios });
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Criar novo cliente
router.post('/', (req, res) => {
    try {
        const { nome, cnpj_cpf, telefone, email, endereco } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = db.prepare(`
            INSERT INTO clientes (nome, cnpj_cpf, telefone, email, endereco)
            VALUES (?, ?, ?, ?, ?)
        `).run(nome, cnpj_cpf || null, telefone || null, email || null, endereco || null);

        res.status(201).json({
            id: result.lastInsertRowid,
            nome,
            cnpj_cpf,
            telefone,
            email,
            endereco
        });
    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar cliente
router.put('/:id', (req, res) => {
    try {
        const { nome, cnpj_cpf, telefone, email, endereco } = req.body;
        const { id } = req.params;

        const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        db.prepare(`
            UPDATE clientes 
            SET nome = COALESCE(?, nome),
                cnpj_cpf = COALESCE(?, cnpj_cpf),
                telefone = COALESCE(?, telefone),
                email = COALESCE(?, email),
                endereco = COALESCE(?, endereco)
            WHERE id = ?
        `).run(nome, cnpj_cpf, telefone, email, endereco, id);

        const clienteAtualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
        res.json(clienteAtualizado);
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Deletar cliente
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Verificar se há rádios alocados
        const radios = db.prepare("SELECT id FROM radios WHERE cliente_id = ? AND status = 'cliente'").get(id);
        if (radios) {
            return res.status(400).json({ error: 'Não é possível excluir cliente com rádios alocados' });
        }

        db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar cliente:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
