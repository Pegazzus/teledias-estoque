const express = require('express');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');

const router = express.Router();
router.use(authMiddleware);

// --- 1. FREQUÊNCIAS DO CLIENTE ---

// Listar frequencias de um cliente
router.get('/clientes/:clienteId/frequencias', async (req, res) => {
    try {
        const { clienteId } = req.params;
        const result = await db.execute({
            sql: `SELECT * FROM cliente_frequencias WHERE cliente_id = ? ORDER BY canal ASC`,
            args: [clienteId]
        });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar frequencias:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Adicionar frequencia
router.post('/clientes/:clienteId/frequencias', async (req, res) => {
    try {
        const { clienteId } = req.params;
        const { tx, rx, subtom_tx, subtom_rx, canal, observacoes } = req.body;

        await db.execute({
            sql: `INSERT INTO cliente_frequencias (cliente_id, tx, rx, subtom_tx, subtom_rx, canal, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [clienteId, tx || '', rx || '', subtom_tx || '', subtom_rx || '', canal || '', observacoes || '']
        });

        res.status(201).json({ message: 'Frequência adicionada com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar frequencia:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar' });
    }
});

// Excluir frequencia
router.delete('/frequencias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute({
            sql: `DELETE FROM cliente_frequencias WHERE id = ?`,
            args: [id]
        });
        res.json({ message: 'Frequência removida' });
    } catch (error) {
        console.error('Erro ao excluir frequencia:', error);
        res.status(500).json({ error: 'Erro ao remover frequência' });
    }
});

// --- 2. CHIPS POC ---

// Listar chips POC de um pedido
router.get('/pedidos/:pedidoId/chips', async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const result = await db.execute({
            sql: `SELECT * FROM chips_poc WHERE pedido_id = ?`,
            args: [pedidoId]
        });
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao buscar chips' });
    }
});

// Adicionar chip POC a um pedido
router.post('/pedidos/:pedidoId/chips', async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { cliente_id, iccid, linha, operadora, plano, status } = req.body;

        if (!iccid) return res.status(400).json({ error: 'ICCID é obrigatório' });

        await db.execute({
            sql: `INSERT INTO chips_poc (pedido_id, cliente_id, iccid, linha, operadora, plano, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [pedidoId, cliente_id, iccid, linha || '', operadora || '', plano || '', status || 'Ativo']
        });

        res.status(201).json({ message: 'Chip adicionado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao adicionar chip' });
    }
});

// Alternar status do chip
router.put('/chips/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'Ativo' ou 'Suspenso'

        if (!['Ativo', 'Suspenso'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        await db.execute({
            sql: `UPDATE chips_poc SET status = ? WHERE id = ?`,
            args: [status, id]
        });

        res.json({ message: 'Status do chip atualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar chip' });
    }
});

// Excluir chip POC
router.delete('/chips/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute({
            sql: `DELETE FROM chips_poc WHERE id = ?`,
            args: [id]
        });
        res.json({ message: 'Chip removido' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover chip' });
    }
});

module.exports = router;
