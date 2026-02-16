const express = require('express');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

// Listar movimentações
router.get('/', async (req, res) => {
    try {
        const { tipo, limite } = req.query;

        let sql = `
            SELECT m.*, r.codigo as radio_codigo, r.modelo as radio_modelo, 
                   c.nome as cliente_nome, u.nome as usuario_nome
            FROM movimentacoes m
            LEFT JOIN radios r ON m.radio_id = r.id
            LEFT JOIN clientes c ON m.cliente_id = c.id
            LEFT JOIN usuarios u ON m.usuario_id = u.id
            WHERE 1=1
        `;
        const args = [];

        if (tipo) {
            sql += ' AND m.tipo = ?';
            args.push(tipo);
        }

        sql += ' ORDER BY m.created_at DESC';

        if (limite) {
            sql += ` LIMIT ${parseInt(limite)}`;
        }

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar movimentações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registrar saída para cliente
router.post('/saida', async (req, res) => {
    try {
        const { radio_id, cliente_id, observacoes } = req.body;

        if (!radio_id || !cliente_id) {
            return res.status(400).json({ error: 'Rádio e cliente são obrigatórios' });
        }

        // Verificar se rádio está em estoque
        const radioResult = await db.execute({
            sql: "SELECT id FROM radios WHERE id = ? AND status = 'estoque'",
            args: [radio_id]
        });

        if (radioResult.rows.length === 0) {
            return res.status(400).json({ error: 'Rádio não está disponível no estoque' });
        }

        // Atualizar status do rádio
        await db.execute({
            sql: "UPDATE radios SET status = 'cliente', cliente_id = ? WHERE id = ?",
            args: [cliente_id, radio_id]
        });

        // Registrar movimentação
        const result = await db.execute({
            sql: 'INSERT INTO movimentacoes (radio_id, tipo, cliente_id, observacoes, usuario_id) VALUES (?, ?, ?, ?, ?)',
            args: [radio_id, 'saida', cliente_id, observacoes || null, req.userId]
        });

        res.status(201).json({
            id: Number(result.lastInsertRowid),
            message: 'Saída registrada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registrar retorno de cliente
router.post('/retorno', async (req, res) => {
    try {
        const { radio_id, observacoes } = req.body;

        if (!radio_id) {
            return res.status(400).json({ error: 'Rádio é obrigatório' });
        }

        // Verificar se rádio está com cliente
        const radioResult = await db.execute({
            sql: "SELECT id FROM radios WHERE id = ? AND status = 'cliente'",
            args: [radio_id]
        });

        if (radioResult.rows.length === 0) {
            return res.status(400).json({ error: 'Rádio não está com cliente' });
        }

        // Atualizar status do rádio
        await db.execute({
            sql: "UPDATE radios SET status = 'estoque', cliente_id = NULL WHERE id = ?",
            args: [radio_id]
        });

        // Registrar movimentação
        const result = await db.execute({
            sql: 'INSERT INTO movimentacoes (radio_id, tipo, observacoes, usuario_id) VALUES (?, ?, ?, ?)',
            args: [radio_id, 'retorno', observacoes || null, req.userId]
        });

        res.status(201).json({
            id: Number(result.lastInsertRowid),
            message: 'Retorno registrado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao registrar retorno:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Enviar para manutenção
router.post('/manutencao', async (req, res) => {
    try {
        const { radio_id, descricao, observacoes } = req.body;

        if (!radio_id || !descricao) {
            return res.status(400).json({ error: 'Rádio e descrição são obrigatórios' });
        }

        // Verificar se rádio está em estoque
        const radioResult = await db.execute({
            sql: "SELECT id FROM radios WHERE id = ? AND status = 'estoque'",
            args: [radio_id]
        });

        if (radioResult.rows.length === 0) {
            return res.status(400).json({ error: 'Rádio não está disponível no estoque' });
        }

        // Atualizar status do rádio
        await db.execute({
            sql: "UPDATE radios SET status = 'manutencao', cliente_id = NULL WHERE id = ?",
            args: [radio_id]
        });

        // Criar registro de manutenção
        await db.execute({
            sql: 'INSERT INTO manutencoes (radio_id, descricao) VALUES (?, ?)',
            args: [radio_id, descricao]
        });

        // Registrar movimentação
        const result = await db.execute({
            sql: 'INSERT INTO movimentacoes (radio_id, tipo, observacoes, usuario_id) VALUES (?, ?, ?, ?)',
            args: [radio_id, 'manutencao', observacoes || descricao, req.userId]
        });

        res.status(201).json({
            id: Number(result.lastInsertRowid),
            message: 'Enviado para manutenção com sucesso'
        });
    } catch (error) {
        console.error('Erro ao enviar para manutenção:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Listar manutenções
router.get('/manutencoes', async (req, res) => {
    try {
        const { status } = req.query;

        let sql = `
            SELECT m.*, r.codigo as radio_codigo, r.modelo as radio_modelo
            FROM manutencoes m
            JOIN radios r ON m.radio_id = r.id
            WHERE 1=1
        `;
        const args = [];

        if (status) {
            sql += ' AND m.status = ?';
            args.push(status);
        }

        sql += ' ORDER BY m.data_entrada DESC';

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar manutenções:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar status da manutenção
router.put('/manutencoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await db.execute({
            sql: 'UPDATE manutencoes SET status = ? WHERE id = ?',
            args: [status, id]
        });

        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar manutenção:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Concluir manutenção
router.post('/concluir-manutencao', async (req, res) => {
    try {
        const { manutencao_id, custo, observacoes } = req.body;

        if (!manutencao_id) {
            return res.status(400).json({ error: 'ID da manutenção é obrigatório' });
        }

        // Buscar manutenção
        const manutResult = await db.execute({
            sql: 'SELECT * FROM manutencoes WHERE id = ?',
            args: [manutencao_id]
        });

        if (manutResult.rows.length === 0) {
            return res.status(404).json({ error: 'Manutenção não encontrada' });
        }

        const manutencao = manutResult.rows[0];

        // Atualizar manutenção
        await db.execute({
            sql: `UPDATE manutencoes 
                  SET status = 'concluida', 
                      data_conclusao = CURRENT_TIMESTAMP,
                      custo = ?,
                      observacoes = COALESCE(?, observacoes)
                  WHERE id = ?`,
            args: [custo || null, observacoes || null, manutencao_id]
        });

        // Retornar rádio ao estoque
        await db.execute({
            sql: "UPDATE radios SET status = 'estoque', cliente_id = NULL WHERE id = ?",
            args: [manutencao.radio_id]
        });

        // Registrar movimentação
        await db.execute({
            sql: 'INSERT INTO movimentacoes (radio_id, tipo, observacoes, usuario_id) VALUES (?, ?, ?, ?)',
            args: [manutencao.radio_id, 'retorno_manutencao', observacoes || 'Manutenção concluída', req.userId]
        });

        res.json({ message: 'Manutenção concluída com sucesso' });
    } catch (error) {
        console.error('Erro ao concluir manutenção:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
