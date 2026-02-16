const express = require('express');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

// Estatísticas gerais
router.get('/stats/resumo', async (req, res) => {
    try {
        const totalResult = await db.execute('SELECT COUNT(*) as count FROM radios');
        const estoqueResult = await db.execute("SELECT COUNT(*) as count FROM radios WHERE status = 'estoque'");
        const clienteResult = await db.execute("SELECT COUNT(*) as count FROM radios WHERE status = 'cliente'");
        const manutencaoResult = await db.execute("SELECT COUNT(*) as count FROM radios WHERE status = 'manutencao'");

        res.json({
            total: Number(totalResult.rows[0].count),
            estoque: Number(estoqueResult.rows[0].count),
            cliente: Number(clienteResult.rows[0].count),
            manutencao: Number(manutencaoResult.rows[0].count)
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Listar todos os rádios
router.get('/', async (req, res) => {
    try {
        const { status, busca } = req.query;

        let sql = `
            SELECT r.*, c.nome as cliente_nome 
            FROM radios r 
            LEFT JOIN clientes c ON r.cliente_id = c.id 
            WHERE 1=1
        `;
        const args = [];

        if (status && status !== 'todos') {
            sql += ' AND r.status = ?';
            args.push(status);
        }

        if (busca) {
            sql += ' AND (r.codigo LIKE ? OR r.modelo LIKE ? OR r.marca LIKE ? OR r.numero_serie LIKE ?)';
            const buscaParam = `%${busca}%`;
            args.push(buscaParam, buscaParam, buscaParam, buscaParam);
        }

        sql += ' ORDER BY r.created_at DESC';

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar rádios:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar rádio por ID
router.get('/:id', async (req, res) => {
    try {
        const result = await db.execute({
            sql: `SELECT r.*, c.nome as cliente_nome 
                  FROM radios r 
                  LEFT JOIN clientes c ON r.cliente_id = c.id 
                  WHERE r.id = ?`,
            args: [req.params.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar rádio por código (para código de barras)
router.get('/codigo/:codigo', async (req, res) => {
    try {
        const result = await db.execute({
            sql: `SELECT r.*, c.nome as cliente_nome 
                  FROM radios r 
                  LEFT JOIN clientes c ON r.cliente_id = c.id 
                  WHERE r.codigo = ?`,
            args: [req.params.codigo]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar rádio por código:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Criar novo rádio
router.post('/', async (req, res) => {
    try {
        const { codigo, modelo, marca, numero_serie, observacoes } = req.body;

        if (!codigo || !modelo) {
            return res.status(400).json({ error: 'Código e modelo são obrigatórios' });
        }

        // Verificar se código já existe
        const existsResult = await db.execute({
            sql: 'SELECT id FROM radios WHERE codigo = ?',
            args: [codigo]
        });

        if (existsResult.rows.length > 0) {
            return res.status(400).json({ error: 'Código já cadastrado' });
        }

        const result = await db.execute({
            sql: 'INSERT INTO radios (codigo, modelo, marca, numero_serie, observacoes) VALUES (?, ?, ?, ?, ?)',
            args: [codigo, modelo, marca || null, numero_serie || null, observacoes || null]
        });

        res.status(201).json({
            id: Number(result.lastInsertRowid),
            codigo,
            modelo,
            marca,
            numero_serie,
            observacoes,
            status: 'estoque'
        });
    } catch (error) {
        console.error('Erro ao criar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar rádio
router.put('/:id', async (req, res) => {
    try {
        const { codigo, modelo, marca, numero_serie, observacoes } = req.body;
        const { id } = req.params;

        const existsResult = await db.execute({
            sql: 'SELECT id FROM radios WHERE id = ?',
            args: [id]
        });

        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        // Verificar se novo código já existe em outro rádio
        if (codigo) {
            const codeExistsResult = await db.execute({
                sql: 'SELECT id FROM radios WHERE codigo = ? AND id != ?',
                args: [codigo, id]
            });

            if (codeExistsResult.rows.length > 0) {
                return res.status(400).json({ error: 'Código já cadastrado em outro rádio' });
            }
        }

        await db.execute({
            sql: `UPDATE radios 
                  SET codigo = COALESCE(?, codigo),
                      modelo = COALESCE(?, modelo),
                      marca = COALESCE(?, marca),
                      numero_serie = COALESCE(?, numero_serie),
                      observacoes = COALESCE(?, observacoes)
                  WHERE id = ?`,
            args: [codigo, modelo, marca, numero_serie, observacoes, id]
        });

        const updatedResult = await db.execute({
            sql: 'SELECT * FROM radios WHERE id = ?',
            args: [id]
        });

        res.json(updatedResult.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Deletar rádio
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const existsResult = await db.execute({
            sql: 'SELECT id, status FROM radios WHERE id = ?',
            args: [id]
        });

        if (existsResult.rows.length === 0) {
            return res.status(404).json({ error: 'Rádio não encontrado' });
        }

        if (existsResult.rows[0].status !== 'estoque') {
            return res.status(400).json({ error: 'Apenas rádios em estoque podem ser excluídos o registro.' });
        }

        // Remover dependências (Cascading Delete manual para evitar erro de FK)
        // 1. Remover movimentações
        await db.execute({
            sql: 'DELETE FROM movimentacoes WHERE radio_id = ?',
            args: [id]
        });

        // 2. Remover manutenções
        await db.execute({
            sql: 'DELETE FROM manutencoes WHERE radio_id = ?',
            args: [id]
        });

        // 3. Remover o rádio
        await db.execute({
            sql: 'DELETE FROM radios WHERE id = ?',
            args: [id]
        });

        res.json({ message: 'Rádio e seu histórico excluídos com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar rádio:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao excluir rádio' });
    }
});

// === AÇÕES EM LOTE ===

// Saída em lote
router.post('/lote/saida', async (req, res) => {
    try {
        const { radio_ids, cliente_id, observacoes } = req.body;

        if (!radio_ids || !Array.isArray(radio_ids) || radio_ids.length === 0) {
            return res.status(400).json({ error: 'Selecione ao menos um rádio' });
        }

        if (!cliente_id) {
            return res.status(400).json({ error: 'Cliente é obrigatório' });
        }

        let successCount = 0;
        let errorCount = 0;

        for (const radioId of radio_ids) {
            try {
                // Verificar se rádio está em estoque
                const radioResult = await db.execute({
                    sql: "SELECT id FROM radios WHERE id = ? AND status = 'estoque'",
                    args: [radioId]
                });

                if (radioResult.rows.length === 0) {
                    errorCount++;
                    continue;
                }

                // Atualizar status do rádio
                await db.execute({
                    sql: "UPDATE radios SET status = 'cliente', cliente_id = ? WHERE id = ?",
                    args: [cliente_id, radioId]
                });

                // Registrar movimentação
                await db.execute({
                    sql: 'INSERT INTO movimentacoes (radio_id, tipo, cliente_id, observacoes, usuario_id) VALUES (?, ?, ?, ?, ?)',
                    args: [radioId, 'saida', cliente_id, observacoes || null, req.userId]
                });

                successCount++;
            } catch (e) {
                errorCount++;
            }
        }

        res.json({
            message: `${successCount} rádio(s) enviado(s) para o cliente`,
            successCount,
            errorCount
        });
    } catch (error) {
        console.error('Erro ao registrar saída em lote:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Retorno em lote
router.post('/lote/retorno', async (req, res) => {
    try {
        const { radio_ids, observacoes } = req.body;

        if (!radio_ids || !Array.isArray(radio_ids) || radio_ids.length === 0) {
            return res.status(400).json({ error: 'Selecione ao menos um rádio' });
        }

        let successCount = 0;
        let errorCount = 0;

        for (const radioId of radio_ids) {
            try {
                // Verificar se rádio está com cliente
                const radioResult = await db.execute({
                    sql: "SELECT id FROM radios WHERE id = ? AND status = 'cliente'",
                    args: [radioId]
                });

                if (radioResult.rows.length === 0) {
                    errorCount++;
                    continue;
                }

                // Atualizar status do rádio
                await db.execute({
                    sql: "UPDATE radios SET status = 'estoque', cliente_id = NULL WHERE id = ?",
                    args: [radioId]
                });

                // Registrar movimentação
                await db.execute({
                    sql: 'INSERT INTO movimentacoes (radio_id, tipo, observacoes, usuario_id) VALUES (?, ?, ?, ?)',
                    args: [radioId, 'retorno', observacoes || null, req.userId]
                });

                successCount++;
            } catch (e) {
                errorCount++;
            }
        }

        res.json({
            message: `${successCount} rádio(s) retornado(s) ao estoque`,
            successCount,
            errorCount
        });
    } catch (error) {
        console.error('Erro ao registrar retorno em lote:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Manutenção em lote
router.post('/lote/manutencao', async (req, res) => {
    try {
        const { radio_ids, descricao, observacoes } = req.body;

        if (!radio_ids || !Array.isArray(radio_ids) || radio_ids.length === 0) {
            return res.status(400).json({ error: 'Selecione ao menos um rádio' });
        }

        if (!descricao) {
            return res.status(400).json({ error: 'Descrição do problema é obrigatória' });
        }

        let successCount = 0;
        let errorCount = 0;

        for (const radioId of radio_ids) {
            try {
                // Verificar se rádio está em estoque
                const radioResult = await db.execute({
                    sql: "SELECT id FROM radios WHERE id = ? AND status = 'estoque'",
                    args: [radioId]
                });

                if (radioResult.rows.length === 0) {
                    errorCount++;
                    continue;
                }

                // Atualizar status do rádio
                await db.execute({
                    sql: "UPDATE radios SET status = 'manutencao', cliente_id = NULL WHERE id = ?",
                    args: [radioId]
                });

                // Criar registro de manutenção
                await db.execute({
                    sql: 'INSERT INTO manutencoes (radio_id, descricao) VALUES (?, ?)',
                    args: [radioId, descricao]
                });

                // Registrar movimentação
                await db.execute({
                    sql: 'INSERT INTO movimentacoes (radio_id, tipo, observacoes, usuario_id) VALUES (?, ?, ?, ?)',
                    args: [radioId, 'manutencao', observacoes || descricao, req.userId]
                });

                successCount++;
            } catch (e) {
                errorCount++;
            }
        }

        res.json({
            message: `${successCount} rádio(s) enviado(s) para manutenção`,
            successCount,
            errorCount
        });
    } catch (error) {
        console.error('Erro ao registrar manutenção em lote:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
