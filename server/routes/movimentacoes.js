const express = require('express');
const db = require('../models/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Listar todas as movimentações
router.get('/', (req, res) => {
    try {
        const { radio_id, cliente_id, tipo, limite } = req.query;

        let query = `
            SELECT m.*, 
                   r.codigo as radio_codigo, 
                   r.modelo as radio_modelo,
                   c.nome as cliente_nome,
                   u.nome as usuario_nome
            FROM movimentacoes m
            LEFT JOIN radios r ON m.radio_id = r.id
            LEFT JOIN clientes c ON m.cliente_id = c.id
            LEFT JOIN usuarios u ON m.usuario_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (radio_id) {
            query += ' AND m.radio_id = ?';
            params.push(radio_id);
        }

        if (cliente_id) {
            query += ' AND m.cliente_id = ?';
            params.push(cliente_id);
        }

        if (tipo) {
            query += ' AND m.tipo = ?';
            params.push(tipo);
        }

        query += ' ORDER BY m.created_at DESC';

        if (limite) {
            query += ' LIMIT ?';
            params.push(parseInt(limite));
        }

        const movimentacoes = db.prepare(query).all(...params);
        res.json(movimentacoes);
    } catch (error) {
        console.error('Erro ao listar movimentações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registrar saída de rádio para cliente
router.post('/saida', (req, res) => {
    try {
        const { radio_id, cliente_id, data_retorno_prevista, observacoes } = req.body;

        if (!radio_id || !cliente_id) {
            return res.status(400).json({ error: 'Rádio e cliente são obrigatórios' });
        }

        const radio = db.prepare('SELECT * FROM radios WHERE id = ?').get(radio_id);
        if (!radio) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        if (radio.status !== 'estoque') {
            return res.status(400).json({ error: 'Rádio não está disponível no estoque' });
        }

        const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Atualizar status do rádio
        db.prepare("UPDATE radios SET status = 'cliente', cliente_id = ? WHERE id = ?").run(cliente_id, radio_id);

        // Registrar movimentação
        const result = db.prepare(`
            INSERT INTO movimentacoes (radio_id, tipo, cliente_id, data_retorno_prevista, observacoes, usuario_id)
            VALUES (?, 'saida', ?, ?, ?, ?)
        `).run(radio_id, cliente_id, data_retorno_prevista || null, observacoes || null, req.userId);

        res.status(201).json({
            id: result.lastInsertRowid,
            message: 'Saída registrada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registrar retorno de rádio
router.post('/retorno', (req, res) => {
    try {
        const { radio_id, observacoes } = req.body;

        if (!radio_id) {
            return res.status(400).json({ error: 'Rádio é obrigatório' });
        }

        const radio = db.prepare('SELECT * FROM radios WHERE id = ?').get(radio_id);
        if (!radio) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        if (radio.status !== 'cliente') {
            return res.status(400).json({ error: 'Rádio não está com cliente' });
        }

        // Atualizar status do rádio
        db.prepare("UPDATE radios SET status = 'estoque', cliente_id = NULL WHERE id = ?").run(radio_id);

        // Registrar movimentação
        const result = db.prepare(`
            INSERT INTO movimentacoes (radio_id, tipo, cliente_id, observacoes, usuario_id)
            VALUES (?, 'retorno', ?, ?, ?)
        `).run(radio_id, radio.cliente_id, observacoes || null, req.userId);

        res.status(201).json({
            id: result.lastInsertRowid,
            message: 'Retorno registrado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao registrar retorno:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Enviar rádio para manutenção
router.post('/manutencao', (req, res) => {
    try {
        const { radio_id, descricao, observacoes } = req.body;

        if (!radio_id || !descricao) {
            return res.status(400).json({ error: 'Rádio e descrição são obrigatórios' });
        }

        const radio = db.prepare('SELECT * FROM radios WHERE id = ?').get(radio_id);
        if (!radio) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        if (radio.status === 'manutencao') {
            return res.status(400).json({ error: 'Rádio já está em manutenção' });
        }

        const clienteAnterior = radio.cliente_id;

        // Atualizar status do rádio
        db.prepare("UPDATE radios SET status = 'manutencao', cliente_id = NULL WHERE id = ?").run(radio_id);

        // Registrar movimentação
        db.prepare(`
            INSERT INTO movimentacoes (radio_id, tipo, cliente_id, observacoes, usuario_id)
            VALUES (?, 'manutencao', ?, ?, ?)
        `).run(radio_id, clienteAnterior, observacoes || null, req.userId);

        // Criar registro de manutenção
        const result = db.prepare(`
            INSERT INTO manutencoes (radio_id, descricao, observacoes)
            VALUES (?, ?, ?)
        `).run(radio_id, descricao, observacoes || null);

        res.status(201).json({
            id: result.lastInsertRowid,
            message: 'Rádio enviado para manutenção'
        });
    } catch (error) {
        console.error('Erro ao enviar para manutenção:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Concluir manutenção
router.post('/concluir-manutencao', (req, res) => {
    try {
        const { manutencao_id, custo, observacoes } = req.body;

        if (!manutencao_id) {
            return res.status(400).json({ error: 'ID da manutenção é obrigatório' });
        }

        const manutencao = db.prepare('SELECT * FROM manutencoes WHERE id = ?').get(manutencao_id);
        if (!manutencao) {
            return res.status(404).json({ error: 'Manutenção não encontrada' });
        }

        if (manutencao.status === 'concluida') {
            return res.status(400).json({ error: 'Manutenção já foi concluída' });
        }

        // Atualizar manutenção
        db.prepare(`
            UPDATE manutencoes 
            SET status = 'concluida', 
                data_conclusao = CURRENT_TIMESTAMP,
                custo = ?,
                observacoes = COALESCE(?, observacoes)
            WHERE id = ?
        `).run(custo || null, observacoes, manutencao_id);

        // Atualizar status do rádio
        db.prepare("UPDATE radios SET status = 'estoque' WHERE id = ?").run(manutencao.radio_id);

        // Registrar movimentação
        db.prepare(`
            INSERT INTO movimentacoes (radio_id, tipo, observacoes, usuario_id)
            VALUES (?, 'retorno_manutencao', ?, ?)
        `).run(manutencao.radio_id, observacoes || 'Manutenção concluída', req.userId);

        res.json({ message: 'Manutenção concluída com sucesso' });
    } catch (error) {
        console.error('Erro ao concluir manutenção:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Listar manutenções
router.get('/manutencoes', (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT m.*, r.codigo as radio_codigo, r.modelo as radio_modelo
            FROM manutencoes m
            LEFT JOIN radios r ON m.radio_id = r.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND m.status = ?';
            params.push(status);
        }

        query += ' ORDER BY m.data_entrada DESC';

        const manutencoes = db.prepare(query).all(...params);
        res.json(manutencoes);
    } catch (error) {
        console.error('Erro ao listar manutenções:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar status da manutenção
router.put('/manutencoes/:id', (req, res) => {
    try {
        const { status, custo, observacoes } = req.body;
        const { id } = req.params;

        const manutencao = db.prepare('SELECT * FROM manutencoes WHERE id = ?').get(id);
        if (!manutencao) {
            return res.status(404).json({ error: 'Manutenção não encontrada' });
        }

        db.prepare(`
            UPDATE manutencoes 
            SET status = COALESCE(?, status),
                custo = COALESCE(?, custo),
                observacoes = COALESCE(?, observacoes)
            WHERE id = ?
        `).run(status, custo, observacoes, id);

        const manutencaoAtualizada = db.prepare('SELECT * FROM manutencoes WHERE id = ?').get(id);
        res.json(manutencaoAtualizada);
    } catch (error) {
        console.error('Erro ao atualizar manutenção:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
