const express = require('express');
const { db } = require('../models/database');
const { authMiddleware, requireAdmin } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

// Listar todos os clientes
router.get('/', async (req, res) => {
    try {
        const { busca } = req.query;

        let sql = 'SELECT * FROM clientes WHERE 1=1';
        const args = [];

        if (busca) {
            sql += ' AND (nome LIKE ? OR cnpj_cpf LIKE ? OR telefone LIKE ? OR email LIKE ?)';
            const buscaParam = `%${busca}%`;
            args.push(buscaParam, buscaParam, buscaParam, buscaParam);
        }

        sql += ' ORDER BY nome ASC';

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar cliente por ID
router.get('/:id', async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM clientes WHERE id = ?',
            args: [req.params.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        const cliente = result.rows[0];

        // Buscar rádios alocados ao cliente
        const radiosResult = await db.execute({
            sql: "SELECT * FROM radios WHERE cliente_id = ? AND status = 'cliente'",
            args: [req.params.id]
        });

        res.json({ ...cliente, radios: radiosResult.rows });
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Criar novo cliente (admin only)
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { nome, cnpj_cpf, telefone, email, endereco } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = await db.execute({
            sql: 'INSERT INTO clientes (nome, cnpj_cpf, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
            args: [nome, cnpj_cpf || null, telefone || null, email || null, endereco || null]
        });

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

// Atualizar cliente (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { nome, cnpj_cpf, telefone, email, endereco } = req.body;
        const { id } = req.params;

        const existsResult = await db.execute({
            sql: 'SELECT id FROM clientes WHERE id = ?',
            args: [id]
        });

        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        await db.execute({
            sql: `UPDATE clientes 
                  SET nome = COALESCE(?, nome),
                      cnpj_cpf = COALESCE(?, cnpj_cpf),
                      telefone = COALESCE(?, telefone),
                      email = COALESCE(?, email),
                      endereco = COALESCE(?, endereco)
                  WHERE id = ?`,
            args: [nome, cnpj_cpf, telefone, email, endereco, id]
        });

        const updatedResult = await db.execute({
            sql: 'SELECT * FROM clientes WHERE id = ?',
            args: [id]
        });

        res.json(updatedResult.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Deletar cliente (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const existsResult = await db.execute({
            sql: 'SELECT id FROM clientes WHERE id = ?',
            args: [id]
        });

        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Verificar se há rádios alocados
        const radiosResult = await db.execute({
            sql: "SELECT id FROM radios WHERE cliente_id = ? AND status = 'cliente'",
            args: [id]
        });

        if (radiosResult.rows.length > 0) {
            return res.status(400).json({ error: 'Não é possível excluir cliente com rádios alocados' });
        }

        await db.execute({
            sql: 'DELETE FROM clientes WHERE id = ?',
            args: [id]
        });

        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar cliente:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
