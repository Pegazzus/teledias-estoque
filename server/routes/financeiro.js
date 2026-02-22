const express = require('express');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');

const router = express.Router();
router.use(authMiddleware);

// --- 1. CONTAS A PAGAR (FINANCEIRO) ---

// Listar contas a pagar de um pedido
router.get('/pedidos/:pedidoId/contas', async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const result = await db.execute({
            sql: `SELECT * FROM contas_a_pagar WHERE pedido_id = ? ORDER BY created_at DESC`,
            args: [pedidoId]
        });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar contas a pagar:', error);
        res.status(500).json({ error: 'Erro interno ao buscar contas' });
    }
});

// Adicionar conta a pagar a um pedido
router.post('/pedidos/:pedidoId/contas', async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { descricao, tipo, valor, vencimento } = req.body;

        if (!descricao || !valor) return res.status(400).json({ error: 'Descrição e Valor são obrigatórios' });

        await db.execute({
            sql: `INSERT INTO contas_a_pagar (pedido_id, descricao, tipo, valor, vencimento, status) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [pedidoId, descricao, tipo || 'Outros', valor, vencimento || null, 'Pendente']
        });

        res.status(201).json({ message: 'Conta cadastrada com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao cadastrar conta' });
    }
});

// Atualizar status de pagamento da conta
router.put('/contas/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'Pendente' ou 'Pago'

        if (!['Pendente', 'Pago'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        await db.execute({
            sql: `UPDATE contas_a_pagar SET status = ? WHERE id = ?`,
            args: [status, id]
        });

        res.json({ message: 'Status da conta atualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar conta' });
    }
});

// Excluir conta a pagar
router.delete('/contas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute({
            sql: `DELETE FROM contas_a_pagar WHERE id = ?`,
            args: [id]
        });
        res.json({ message: 'Conta removida' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover conta' });
    }
});

// --- 2. CONSULTOR EXTERNO (ASSINATURA E CONCLUSÃO DA O.S.) ---

// Assinar e Concluir Pedido (Atribui data de entrega)
router.post('/pedidos/:pedidoId/assinar-concluir', async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { valor_acordado } = req.body; // Se houver atualização / faturamento

        // 1. Atualizar o pedido para 'financeiro' com a Data Atual de Entrega
        const args = ['financeiro', pedidoId];
        let sql = `UPDATE pedidos SET status_atual = ?, data_entrega = CURRENT_TIMESTAMP WHERE id = ?`;

        if (valor_acordado !== undefined) {
            sql = `UPDATE pedidos SET status_atual = ?, data_entrega = CURRENT_TIMESTAMP, valor_acordado = ? WHERE id = ?`;
            args.splice(1, 0, valor_acordado);
        }

        await db.execute({ sql, args });

        // 2. Opcional: Registrar Log de Auditoria dessa transição especial
        await db.execute({
            sql: `INSERT INTO audit_logs (pedido_id, acao, status_anterior, status_novo, usuario_id) VALUES (?, ?, ?, ?, ?)`,
            args: [pedidoId, 'AVANCO_FASE', 'consultor_externo', 'financeiro', req.userId]
        });

        res.json({ message: 'O.S. assinada e Pedido Movido para o Financeiro' });
    } catch (error) {
        console.error('Erro ao assinar e concluir:', error);
        res.status(500).json({ error: 'Erro ao assinar e finalizar O.S.' });
    }
});

module.exports = router;
