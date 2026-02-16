const express = require('express');
const ExcelJS = require('exceljs');
const { GoogleGenAI } = require('@google/genai');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');
const { searchAllStores, getQuickSearchLinks } = require('../services/price-scraper');

const router = express.Router();

router.use(authMiddleware);

// Inicializar Gemini (usado apenas para análise, NÃO para buscar preços)
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada no .env');
    }
    return new GoogleGenAI({ apiKey });
}

// === BUSCA AUTOMÁTICA DE PREÇOS (usando APIs reais) ===

router.post('/buscar-precos', async (req, res) => {
    try {
        const { produto, especificacoes, quantidade } = req.body;

        if (!produto || produto.trim().length < 3) {
            return res.status(400).json({ error: 'Digite o nome do produto (mínimo 3 caracteres)' });
        }

        // Montar query de busca incluindo especificações
        let searchQuery = produto.trim();
        if (especificacoes && especificacoes.trim()) {
            searchQuery += ' ' + especificacoes.trim();
        }

        console.log(`\n🔍 Iniciando busca real para: "${searchQuery}"`);

        // === 1. BUSCAR PREÇOS REAIS via APIs e scraping ===
        const resultados = await searchAllStores(searchQuery);

        // === 2. GERAR QUICK SEARCH LINKS ===
        const quickLinks = getQuickSearchLinks(searchQuery);

        // === 3. ANÁLISE IA (opcional — usa dados REAIS) ===
        let resumo = '';
        if (resultados.length > 0) {
            try {
                const ai = getGeminiClient();
                const itensParaAnalise = resultados.slice(0, 10).map(r =>
                    `- ${r.produto} | ${r.loja} | R$ ${r.preco.toFixed(2)} | ${r.frete} | ${r.fonte}`
                ).join('\n');

                const prompt = `Analise estes preços REAIS encontrados para "${produto}" e dê uma recomendação breve (máximo 3 frases) em português:

${itensParaAnalise}

Diga qual é a melhor opção e por quê. Seja direto e objetivo.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { temperature: 0.3 },
                });
                resumo = response.text || '';
            } catch (aiErr) {
                console.warn('⚠️ Análise IA falhou (não afeta resultados):', aiErr.message);
                resumo = resultados.length > 0
                    ? `Melhor preço encontrado: R$ ${resultados[0].preco.toFixed(2)} em ${resultados[0].loja}.`
                    : '';
            }
        }

        // === 4. SALVAR NO BANCO ===
        const cotacaoResult = await db.execute({
            sql: 'INSERT INTO cotacoes (titulo, descricao, usuario_id) VALUES (?, ?, ?)',
            args: [`Cotação: ${produto}`, especificacoes || `Busca automática para ${produto}`, req.userId]
        });
        const cotacaoId = Number(cotacaoResult.lastInsertRowid);

        for (const item of resultados) {
            await db.execute({
                sql: 'INSERT INTO cotacao_itens (cotacao_id, loja, produto, preco, link, frete, disponibilidade, melhor_preco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                args: [
                    cotacaoId,
                    item.loja || 'Desconhecido',
                    item.produto || produto,
                    item.preco || 0,
                    item.link || '',
                    item.frete || 'Consultar',
                    item.disponibilidade || 'Verificar',
                    item.melhor_preco ? 1 : 0
                ]
            });
        }

        console.log(`✅ Cotação #${cotacaoId} criada com ${resultados.length} resultados REAIS`);

        // === 5. RESPONDER ===
        res.json({
            cotacao_id: cotacaoId,
            produto,
            resultados,
            resumo,
            quickLinks,
            quantidade: resultados.length
        });

    } catch (error) {
        console.error('Erro ao buscar preços:', error);
        res.status(500).json({ error: 'Erro ao buscar preços. Tente novamente.' });
    }
});

// === ANÁLISE IA (recomendação detalhada) ===

router.get('/:id/analise', async (req, res) => {
    try {
        const cotacaoResult = await db.execute({
            sql: 'SELECT * FROM cotacoes WHERE id = ?',
            args: [req.params.id]
        });

        if (cotacaoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }

        const cotacao = cotacaoResult.rows[0];

        const itensResult = await db.execute({
            sql: 'SELECT * FROM cotacao_itens WHERE cotacao_id = ? ORDER BY preco ASC',
            args: [req.params.id]
        });

        if (itensResult.rows.length === 0) {
            return res.status(400).json({ error: 'A cotação não possui resultados para análise' });
        }

        const ai = getGeminiClient();

        const itensFormatados = itensResult.rows.map(item => {
            return `- ${item.produto} | Loja: ${item.loja} | Preço: R$ ${(item.preco || 0).toFixed(2)} | Frete: ${item.frete || 'N/I'} | Disponível: ${item.disponibilidade || 'N/I'}`;
        }).join('\n');

        const prompt = `Você é um analista de compras especializado. Analise os seguintes preços encontrados e dê uma recomendação clara em português brasileiro.

Produto pesquisado: ${cotacao.titulo}
${cotacao.descricao ? `Especificações: ${cotacao.descricao}` : ''}

Preços encontrados:
${itensFormatados}

Por favor, forneça:
1. **Melhor Opção**: Qual loja oferece o melhor custo-benefício e por quê
2. **Economia**: Quanto se economiza escolhendo a melhor opção vs a mais cara
3. **Alertas**: Algum preço parece suspeito? Produto indisponível?
4. **Recomendação Final**: Sua sugestão com justificativa

Responda de forma direta e profissional em português.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.3,
            },
        });

        res.json({ analise: response.text });
    } catch (error) {
        console.error('Erro na análise IA:', error);
        res.status(500).json({ error: 'Erro ao gerar análise com IA' });
    }
});

// === LISTAGEM E CRUD ===

// Listar cotações
router.get('/', async (req, res) => {
    try {
        const { busca, status } = req.query;

        let sql = `
            SELECT c.*, u.nome as usuario_nome,
                   (SELECT COUNT(*) FROM cotacao_itens ci WHERE ci.cotacao_id = c.id) as total_itens
            FROM cotacoes c
            LEFT JOIN usuarios u ON c.usuario_id = u.id
            WHERE 1=1
        `;
        const args = [];

        if (busca) {
            sql += ' AND (c.titulo LIKE ? OR c.descricao LIKE ?)';
            const buscaParam = `%${busca}%`;
            args.push(buscaParam, buscaParam);
        }

        if (status && status !== 'todas') {
            sql += ' AND c.status = ?';
            args.push(status);
        }

        sql += ' ORDER BY c.created_at DESC';

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar cotações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Estatísticas
router.get('/stats/resumo', async (req, res) => {
    try {
        const totalResult = await db.execute('SELECT COUNT(*) as total FROM cotacoes');
        const abertasResult = await db.execute("SELECT COUNT(*) as total FROM cotacoes WHERE status = 'aberta'");
        const finalizadasResult = await db.execute("SELECT COUNT(*) as total FROM cotacoes WHERE status = 'finalizada'");
        const canceladasResult = await db.execute("SELECT COUNT(*) as total FROM cotacoes WHERE status = 'cancelada'");

        res.json({
            total: Number(totalResult.rows[0].total),
            abertas: Number(abertasResult.rows[0].total),
            finalizadas: Number(finalizadasResult.rows[0].total),
            canceladas: Number(canceladasResult.rows[0].total)
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar cotação por ID com itens
router.get('/:id', async (req, res) => {
    try {
        const cotacaoResult = await db.execute({
            sql: `SELECT c.*, u.nome as usuario_nome 
                  FROM cotacoes c 
                  LEFT JOIN usuarios u ON c.usuario_id = u.id 
                  WHERE c.id = ?`,
            args: [req.params.id]
        });

        if (cotacaoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }

        const itensResult = await db.execute({
            sql: 'SELECT * FROM cotacao_itens WHERE cotacao_id = ? ORDER BY preco ASC',
            args: [req.params.id]
        });

        res.json({
            ...cotacaoResult.rows[0],
            itens: itensResult.rows
        });
    } catch (error) {
        console.error('Erro ao buscar cotação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar status da cotação
router.put('/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        if (status) {
            await db.execute({
                sql: 'UPDATE cotacoes SET status = ? WHERE id = ?',
                args: [status, id]
            });
        }

        const updatedResult = await db.execute({
            sql: 'SELECT * FROM cotacoes WHERE id = ?',
            args: [id]
        });

        if (updatedResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }

        res.json(updatedResult.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar cotação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Deletar cotação
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await db.execute({
            sql: 'DELETE FROM cotacao_itens WHERE cotacao_id = ?',
            args: [id]
        });

        await db.execute({
            sql: 'DELETE FROM cotacoes WHERE id = ?',
            args: [id]
        });

        res.json({ message: 'Cotação excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar cotação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// === EXPORTAR PARA EXCEL ===

router.get('/:id/exportar', async (req, res) => {
    try {
        const cotacaoResult = await db.execute({
            sql: 'SELECT * FROM cotacoes WHERE id = ?',
            args: [req.params.id]
        });

        if (cotacaoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }

        const cotacao = cotacaoResult.rows[0];

        const itensResult = await db.execute({
            sql: 'SELECT * FROM cotacao_itens WHERE cotacao_id = ? ORDER BY preco ASC',
            args: [req.params.id]
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Teledias - Cotação Automática';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Cotação');

        // Título
        worksheet.mergeCells('A1:F1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = cotacao.titulo;
        titleCell.font = { bold: true, size: 16, color: { argb: 'FF1E3A5F' } };
        titleCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:F2');
        const descCell = worksheet.getCell('A2');
        descCell.value = cotacao.descricao || '';
        descCell.font = { size: 11, color: { argb: 'FF718096' } };
        descCell.alignment = { horizontal: 'center' };

        worksheet.addRow([]);

        // Cabeçalho
        worksheet.columns = [
            { key: 'loja', width: 25 },
            { key: 'produto', width: 40 },
            { key: 'preco', width: 15 },
            { key: 'frete', width: 15 },
            { key: 'disponibilidade', width: 18 },
            { key: 'link', width: 35 }
        ];

        const headerRow = worksheet.addRow({
            loja: 'Loja',
            produto: 'Produto',
            preco: 'Preço',
            frete: 'Frete',
            disponibilidade: 'Disponibilidade',
            link: 'Link de Compra'
        });

        const headerStyle = {
            font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };

        headerRow.eachCell(cell => { cell.style = headerStyle; });
        headerRow.height = 25;

        let menorPreco = Infinity;
        itensResult.rows.forEach(item => {
            if (item.preco && item.preco < menorPreco) menorPreco = item.preco;
        });

        itensResult.rows.forEach((item, index) => {
            const dataRow = worksheet.addRow({
                loja: item.loja,
                produto: item.produto,
                preco: item.preco ? `R$ ${item.preco.toFixed(2)}` : '-',
                frete: item.frete || '-',
                disponibilidade: item.disponibilidade || '-',
                link: item.link || '-'
            });

            // Destacar melhor preço
            if (item.preco && item.preco === menorPreco) {
                dataRow.getCell('preco').font = { bold: true, color: { argb: 'FF22543D' } };
                dataRow.getCell('preco').fill = {
                    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6F6D5' }
                };
                dataRow.getCell('loja').font = { bold: true, color: { argb: 'FF22543D' } };
            }

            if (index % 2 === 1) {
                dataRow.eachCell(cell => {
                    if (!cell.fill?.fgColor || cell.fill.fgColor.argb !== 'FFC6F6D5') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
                    }
                });
            }
        });

        worksheet.addRow([]);
        const statusMap = { 'aberta': 'Aberta', 'finalizada': 'Finalizada', 'cancelada': 'Cancelada' };
        worksheet.addRow([`Status: ${statusMap[cotacao.status] || cotacao.status}`]);
        worksheet.addRow([`Data: ${cotacao.created_at ? new Date(cotacao.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}`]);
        worksheet.addRow([`Gerado por: Teledias - Sistema de Cotação Automática`]);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=cotacao_${cotacao.id}_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao exportar cotação:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

module.exports = router;
