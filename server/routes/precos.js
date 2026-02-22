const express = require('express');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

// Middleware para verificar se é Admin (Gestor)
const requireAdmin = (req, res, next) => {
    if (req.userCargo !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas gestores podem realizar esta ação.' });
    }
    next();
};

// 1. Listar Preços (Admin) ou (Técnicos na tela de pedido)
// Quando for dropdown no laboratório, vai ser listado por aqui.
router.get('/', async (req, res) => {
    try {
        const { modelo } = req.query;
        let sql = `SELECT * FROM precos_indenizatorios`;
        const args = [];

        if (modelo) {
            sql += ` WHERE modelo_equipamento = ?`;
            args.push(modelo);
        }

        sql += ` ORDER BY modelo_equipamento ASC, componente ASC`;

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar preços indenizatórios:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 2. Obter Detalhes de um Preço
router.get('/:id', async (req, res) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM precos_indenizatorios WHERE id = ?`,
            args: [req.params.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Preço não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar preço:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 3. Cadastrar Preço (apenas admin)
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { modelo_equipamento, componente, valor_base, valor_mao_de_obra } = req.body;

        if (!modelo_equipamento || !componente) {
            return res.status(400).json({ error: 'Modelo e componente são obrigatórios.' });
        }

        const result = await db.execute({
            sql: `INSERT INTO precos_indenizatorios (modelo_equipamento, componente, valor_base, valor_mao_de_obra) 
                  VALUES (?, ?, ?, ?)`,
            args: [modelo_equipamento, componente, valor_base || 0, valor_mao_de_obra || 0]
        });

        res.status(201).json({ id: result.lastInsertRowid, message: 'Cadastrado com sucesso' });
    } catch (error) {
        console.error('Erro ao cadastrar preço:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 4. Atualizar Preço (apenas admin)
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const { modelo_equipamento, componente, valor_base, valor_mao_de_obra } = req.body;

        await db.execute({
            sql: `UPDATE precos_indenizatorios 
                  SET modelo_equipamento = ?, componente = ?, valor_base = ?, valor_mao_de_obra = ? 
                  WHERE id = ?`,
            args: [modelo_equipamento, componente, valor_base || 0, valor_mao_de_obra || 0, req.params.id]
        });

        res.json({ message: 'Atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar preço:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 5. Excluir Preço (apenas admin)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await db.execute({
            sql: `DELETE FROM precos_indenizatorios WHERE id = ?`,
            args: [req.params.id]
        });

        res.json({ message: 'Excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir preço:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
