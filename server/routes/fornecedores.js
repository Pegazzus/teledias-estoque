const express = require('express');
const { db } = require('../models/database');
const { authMiddleware, requireAdmin } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

// Listar todos os fornecedores
router.get('/', async (req, res) => {
    try {
        const { busca } = req.query;

        let sql = 'SELECT * FROM fornecedores WHERE 1=1';
        const args = [];

        if (busca) {
            sql += ' AND (nome LIKE ? OR cnpj LIKE ? OR telefone LIKE ? OR email LIKE ? OR contato LIKE ?)';
            const buscaParam = `%${busca}%`;
            args.push(buscaParam, buscaParam, buscaParam, buscaParam, buscaParam);
        }

        sql += ' ORDER BY nome ASC';

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar fornecedores:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar fornecedor por ID
router.get('/:id', async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM fornecedores WHERE id = ?',
            args: [req.params.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar fornecedor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Criar novo fornecedor
router.post('/', async (req, res) => {
    try {
        const { nome, cnpj, telefone, email, endereco, contato, site, observacoes } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const result = await db.execute({
            sql: 'INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco, contato, site, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            args: [nome, cnpj || null, telefone || null, email || null, endereco || null, contato || null, site || null, observacoes || null]
        });

        res.status(201).json({
            id: Number(result.lastInsertRowid),
            nome, cnpj, telefone, email, endereco, contato, site, observacoes
        });
    } catch (error) {
        console.error('Erro ao criar fornecedor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar fornecedor
router.put('/:id', async (req, res) => {
    try {
        const { nome, cnpj, telefone, email, endereco, contato, site, observacoes } = req.body;
        const { id } = req.params;

        const existsResult = await db.execute({
            sql: 'SELECT id FROM fornecedores WHERE id = ?',
            args: [id]
        });

        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }

        await db.execute({
            sql: `UPDATE fornecedores 
                  SET nome = COALESCE(?, nome),
                      cnpj = COALESCE(?, cnpj),
                      telefone = COALESCE(?, telefone),
                      email = COALESCE(?, email),
                      endereco = COALESCE(?, endereco),
                      contato = COALESCE(?, contato),
                      site = COALESCE(?, site),
                      observacoes = COALESCE(?, observacoes)
                  WHERE id = ?`,
            args: [nome, cnpj, telefone, email, endereco, contato, site, observacoes, id]
        });

        const updatedResult = await db.execute({
            sql: 'SELECT * FROM fornecedores WHERE id = ?',
            args: [id]
        });

        res.json(updatedResult.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar fornecedor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Deletar fornecedor
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const existsResult = await db.execute({
            sql: 'SELECT id FROM fornecedores WHERE id = ?',
            args: [id]
        });

        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }

        // Verificar se há itens de cotação vinculados
        const itensResult = await db.execute({
            sql: 'SELECT id FROM cotacao_itens WHERE fornecedor_id = ?',
            args: [id]
        });

        if (itensResult.rows.length > 0) {
            return res.status(400).json({ error: 'Não é possível excluir fornecedor vinculado a cotações' });
        }

        await db.execute({
            sql: 'DELETE FROM fornecedores WHERE id = ?',
            args: [id]
        });

        res.json({ message: 'Fornecedor excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar fornecedor:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
