const express = require('express');
const db = require('../models/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Listar todos os rádios
router.get('/', (req, res) => {
    try {
        const { status, busca } = req.query;

        let query = `
            SELECT r.*, c.nome as cliente_nome 
            FROM radios r 
            LEFT JOIN clientes c ON r.cliente_id = c.id 
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'todos') {
            query += ' AND r.status = ?';
            params.push(status);
        }

        if (busca) {
            query += ' AND (r.codigo LIKE ? OR r.modelo LIKE ? OR r.marca LIKE ? OR r.numero_serie LIKE ?)';
            const buscaParam = `%${busca}%`;
            params.push(buscaParam, buscaParam, buscaParam, buscaParam);
        }

        query += ' ORDER BY r.created_at DESC';

        const radios = db.prepare(query).all(...params);
        res.json(radios);
    } catch (error) {
        console.error('Erro ao listar rádios:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar rádio por ID
router.get('/:id', (req, res) => {
    try {
        const radio = db.prepare(`
            SELECT r.*, c.nome as cliente_nome 
            FROM radios r 
            LEFT JOIN clientes c ON r.cliente_id = c.id 
            WHERE r.id = ?
        `).get(req.params.id);

        if (!radio) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        res.json(radio);
    } catch (error) {
        console.error('Erro ao buscar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Criar novo rádio
router.post('/', (req, res) => {
    try {
        const { codigo, modelo, marca, numero_serie, observacoes } = req.body;

        if (!codigo || !modelo) {
            return res.status(400).json({ error: 'Código e modelo são obrigatórios' });
        }

        const codigoExiste = db.prepare('SELECT id FROM radios WHERE codigo = ?').get(codigo);
        if (codigoExiste) {
            return res.status(400).json({ error: 'Código já cadastrado' });
        }

        const result = db.prepare(`
            INSERT INTO radios (codigo, modelo, marca, numero_serie, observacoes, status)
            VALUES (?, ?, ?, ?, ?, 'estoque')
        `).run(codigo, modelo, marca || null, numero_serie || null, observacoes || null);

        res.status(201).json({
            id: result.lastInsertRowid,
            codigo,
            modelo,
            marca,
            numero_serie,
            status: 'estoque',
            observacoes
        });
    } catch (error) {
        console.error('Erro ao criar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar rádio
router.put('/:id', (req, res) => {
    try {
        const { codigo, modelo, marca, numero_serie, observacoes } = req.body;
        const { id } = req.params;

        const radio = db.prepare('SELECT id FROM radios WHERE id = ?').get(id);
        if (!radio) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        if (codigo) {
            const codigoExiste = db.prepare('SELECT id FROM radios WHERE codigo = ? AND id != ?').get(codigo, id);
            if (codigoExiste) {
                return res.status(400).json({ error: 'Código já cadastrado' });
            }
        }

        db.prepare(`
            UPDATE radios 
            SET codigo = COALESCE(?, codigo),
                modelo = COALESCE(?, modelo),
                marca = COALESCE(?, marca),
                numero_serie = COALESCE(?, numero_serie),
                observacoes = COALESCE(?, observacoes)
            WHERE id = ?
        `).run(codigo, modelo, marca, numero_serie, observacoes, id);

        const radioAtualizado = db.prepare('SELECT * FROM radios WHERE id = ?').get(id);
        res.json(radioAtualizado);
    } catch (error) {
        console.error('Erro ao atualizar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Deletar rádio
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const radio = db.prepare('SELECT id FROM radios WHERE id = ?').get(id);
        if (!radio) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        // Verificar se há movimentações
        const movimentacoes = db.prepare('SELECT id FROM movimentacoes WHERE radio_id = ?').get(id);
        if (movimentacoes) {
            return res.status(400).json({ error: 'Não é possível excluir rádio com histórico de movimentações' });
        }

        db.prepare('DELETE FROM radios WHERE id = ?').run(id);
        res.json({ message: 'Rádio excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Estatísticas dos rádios
router.get('/stats/resumo', (req, res) => {
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM radios').get().count;
        const estoque = db.prepare("SELECT COUNT(*) as count FROM radios WHERE status = 'estoque'").get().count;
        const cliente = db.prepare("SELECT COUNT(*) as count FROM radios WHERE status = 'cliente'").get().count;
        const manutencao = db.prepare("SELECT COUNT(*) as count FROM radios WHERE status = 'manutencao'").get().count;

        res.json({
            total,
            estoque,
            cliente,
            manutencao
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
