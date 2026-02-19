const express = require('express');
const ExcelJS = require('exceljs');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

// Exportar rádios para Excel
router.get('/radios', async (req, res) => {
    try {
        const { status } = req.query;

        let sql = `
            SELECT r.codigo, r.modelo, r.marca, r.numero_serie, r.status, 
                   r.observacoes, c.nome as cliente_nome, r.created_at
            FROM radios r
            LEFT JOIN clientes c ON r.cliente_id = c.id
            WHERE 1=1
        `;
        const args = [];

        if (status && status !== 'todos') {
            sql += ' AND r.status = ?';
            args.push(status);
        }

        sql += ' ORDER BY r.codigo';

        const result = await db.execute({ sql, args });

        // Criar workbook Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Teledias Estoque';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Rádios', {
            headerFooter: {
                firstHeader: 'Sistema de Estoque - Teledias Telecom'
            }
        });

        // Estilo do cabeçalho
        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a365d' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // Definir colunas
        worksheet.columns = [
            { header: 'Código', key: 'codigo', width: 15 },
            { header: 'Modelo', key: 'modelo', width: 25 },
            { header: 'Marca', key: 'marca', width: 15 },
            { header: 'Nº Série', key: 'numero_serie', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Cliente', key: 'cliente_nome', width: 25 },
            { header: 'Observações', key: 'observacoes', width: 30 },
            { header: 'Cadastro', key: 'created_at', width: 18 }
        ];

        // Aplicar estilo ao cabeçalho
        worksheet.getRow(1).eachCell(cell => {
            cell.style = headerStyle;
        });
        worksheet.getRow(1).height = 25;

        // Mapeamento de status
        const statusMap = {
            'estoque': 'Em Estoque',
            'cliente': 'Com Cliente',
            'manutencao': 'Em Manutenção'
        };

        // Adicionar dados
        result.rows.forEach((row, index) => {
            const dataRow = worksheet.addRow({
                codigo: row.codigo,
                modelo: row.modelo,
                marca: row.marca || '-',
                numero_serie: row.numero_serie || '-',
                status: statusMap[row.status] || row.status,
                cliente_nome: row.cliente_nome || '-',
                observacoes: row.observacoes || '-',
                created_at: row.created_at ? new Date(row.created_at).toLocaleDateString('pt-BR') : '-'
            });

            // Cores alternadas
            if (index % 2 === 1) {
                dataRow.eachCell(cell => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF7FAFC' }
                    };
                });
            }

            // Cores por status
            const statusCell = dataRow.getCell('status');
            if (row.status === 'estoque') {
                statusCell.font = { color: { argb: 'FF22543D' }, bold: true };
            } else if (row.status === 'cliente') {
                statusCell.font = { color: { argb: 'FF2B6CB0' }, bold: true };
            } else if (row.status === 'manutencao') {
                statusCell.font = { color: { argb: 'FFC05621' }, bold: true };
            }

            // Bordas
            dataRow.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        });

        // Adicionar linha de resumo
        worksheet.addRow([]);
        const resumoRow = worksheet.addRow([`Total de rádios: ${result.rows.length}`]);
        resumoRow.getCell(1).font = { bold: true, italic: true };

        // Configurar resposta
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=radios_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao exportar rádios:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// Exportar clientes para Excel
router.get('/clientes', async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT c.*, 
                   CAST((SELECT COUNT(*) FROM radios r WHERE r.cliente_id = c.id AND r.status = 'cliente') AS INT) as qtd_radios
            FROM clientes c
            ORDER BY c.nome
        `);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Teledias Estoque';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Clientes');

        // Estilo do cabeçalho
        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        worksheet.columns = [
            { header: 'Nome/Razão Social', key: 'nome', width: 30 },
            { header: 'CNPJ/CPF', key: 'cnpj_cpf', width: 20 },
            { header: 'Telefone', key: 'telefone', width: 18 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Endereço', key: 'endereco', width: 40 },
            { header: 'Rádios Alocados', key: 'qtd_radios', width: 15 }
        ];

        worksheet.getRow(1).eachCell(cell => {
            cell.style = headerStyle;
        });
        worksheet.getRow(1).height = 25;

        result.rows.forEach((row, index) => {
            const dataRow = worksheet.addRow({
                nome: row.nome,
                cnpj_cpf: row.cnpj_cpf || '-',
                telefone: row.telefone || '-',
                email: row.email || '-',
                endereco: row.endereco || '-',
                qtd_radios: row.qtd_radios || 0
            });

            if (index % 2 === 1) {
                dataRow.eachCell(cell => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF7FAFC' }
                    };
                });
            }

            dataRow.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        });

        worksheet.addRow([]);
        const resumoRow = worksheet.addRow([`Total de clientes: ${result.rows.length}`]);
        resumoRow.getCell(1).font = { bold: true, italic: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=clientes_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao exportar clientes:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// Exportar movimentações para Excel
router.get('/movimentacoes', async (req, res) => {
    try {
        const { tipo, dataInicio, dataFim } = req.query;

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

        const result = await db.execute({ sql, args });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Teledias Estoque';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Movimentações');

        const headerStyle = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5568' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        worksheet.columns = [
            { header: 'Data', key: 'data', width: 18 },
            { header: 'Tipo', key: 'tipo', width: 18 },
            { header: 'Rádio', key: 'radio_codigo', width: 15 },
            { header: 'Modelo', key: 'radio_modelo', width: 25 },
            { header: 'Cliente', key: 'cliente_nome', width: 25 },
            { header: 'Usuário', key: 'usuario_nome', width: 20 },
            { header: 'Observações', key: 'observacoes', width: 35 }
        ];

        worksheet.getRow(1).eachCell(cell => {
            cell.style = headerStyle;
        });
        worksheet.getRow(1).height = 25;

        const tipoMap = {
            'saida': 'Saída',
            'retorno': 'Retorno',
            'manutencao': 'Manutenção',
            'retorno_manutencao': 'Retorno Manutenção'
        };

        result.rows.forEach((row, index) => {
            const dataRow = worksheet.addRow({
                data: row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '-',
                tipo: tipoMap[row.tipo] || row.tipo,
                radio_codigo: row.radio_codigo,
                radio_modelo: row.radio_modelo,
                cliente_nome: row.cliente_nome || '-',
                usuario_nome: row.usuario_nome || '-',
                observacoes: row.observacoes || '-'
            });

            if (index % 2 === 1) {
                dataRow.eachCell(cell => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF7FAFC' }
                    };
                });
            }

            dataRow.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        });

        worksheet.addRow([]);
        const resumoRow = worksheet.addRow([`Total de movimentações: ${result.rows.length}`]);
        resumoRow.getCell(1).font = { bold: true, italic: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=movimentacoes_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao exportar movimentações:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

module.exports = router;
