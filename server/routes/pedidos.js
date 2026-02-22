const express = require('express');
const { db } = require('../models/database');
const { authMiddleware } = require('./auth');

const router = express.Router();

router.use(authMiddleware);

// Helpers
const FASES = ['comercial', 'logistica', 'laboratorio', 'consultor_externo', 'financeiro', 'controle_qualidade', 'concluido'];

const TIPOS_PEDIDO = ['venda', 'venda_seminovos', 'manutencao_radios', 'eventos', 'cliente_fixo', 'aditivo', 'cancelamento', 'chamado_tecnico'];

const CHECKLISTS_POR_TIPO = {
    'venda': {
        'comercial': [
            'Analisar dados da empresa e sócios (CNPJ, Mídias, JusBrasil, CCC, Protesto)',
            'Verificar e atualizar endereço no parceiros e conferir no Google Imagens',
            'Verificar se o material é para uso e consumo ou revenda',
            'Em caso de cobrança de frete, anexar como "Complemento de Locação" na proposta',
            'Consultar disponibilidade de estoque no grupo',
            'Analisar se a programação será cobrada à parte',
            'Informar número da proposta aprovada no card',
            'Incluir na agenda externa a data de entrega',
            'Venda de RPD 8: Solicitar licença de ativação à técnica',
            'Pré-venda: Enviar vídeo de agradecimento'
        ],
        'logistica': [
            'Verificar necessidade de compra de material e incluir na lista/planilha PP',
            'Fazer separação física do material (Scanner de Seriais)',
            'Entregar ao Laboratório Técnico para programação/configuração',
            'Conferir material devolvido do Laboratório',
            'Confirmar orçamento de venda no caminhão (Qtde, Valor, Modelo)',
            'Se fora do RJ: Despachar via transportadora/correios e preencher OS de coleta',
            'Separar material na prateleira do Consultor com etiquetas, sacolas e brindes'
        ],
        'laboratorio': [
            'Retirar senhas de rádios que serão vendidos',
            'Realizar programação (se frequência do cliente) e testes',
            'Inserir selo de controle de garantia (casca de ovo)'
        ],
        'consultor_externo': [
            'Conferir material recebido da Logística com a DANFE',
            'Testar e conferir quantidades com o cliente no ato da entrega',
            'Dar instruções básicas de uso e apresentar projeto social'
        ],
        'financeiro': [
            'Verificação inicial: Confirmar empresa e conferir valores/produtos com o card',
            'Emissão de NF de Venda (Validar NCM, Posição Fiscal, IE)',
            'Gerar e enviar boleto junto com a NF',
            'Se houver Nota de Empenho, conferir no site do portal',
            'Lançar despesas de frete ou compra de material no Contas a Pagar'
        ],
        'controle_qualidade': [
            'Conferência final: Solicitação x Entrega, Proposta x Card, Orçamento com componentes',
            'Verificar emissão da Nota de Venda',
            'Verificar se OS foi assinada'
        ]
    },
    'venda_seminovos': {
        'comercial': [
            'Analisar dados da empresa e sócios (CNPJ, CCC, Protesto)',
            'Verificar necessidade de programação para o equipamento',
            'Em caso de cobrança de frete, anexar como "Complemento de Locação" na proposta',
            'Informar número da proposta aprovada no card e agendar entrega'
        ],
        'logistica': [
            'Fazer separação física do material e entregar ao Laboratório (Scanner de Seriais)',
            'Anexar FOTOS do produto para certificar o estado (Seminovo)',
            'Confirmar orçamento de venda (Qtde, Valor, Modelo) e despachar/liberar para Consultor'
        ],
        'laboratorio': [
            'Retirar senhas antigas do equipamento',
            'Realizar limpeza detalhada do material',
            'Realizar programação e testes rigorosos',
            'Inserir selo de controle de garantia (casca de ovo)'
        ],
        'consultor_externo': [
            'Conferir material recebido da Logística com a DANFE',
            'Testar e conferir quantidades com o cliente no ato da entrega',
            'Dar instruções básicas de uso e apresentar projeto social'
        ],
        'financeiro': [
            'Verificação inicial: Confirmar empresa e conferir valores/produtos com o card',
            'Emissão de NF de Venda — Usar Posição Fiscal "VENDA DE ATIVO"',
            'Gerar e enviar boleto junto com a NF',
            'Lançar despesas de frete ou compra de material no Contas a Pagar'
        ],
        'controle_qualidade': [
            'Conferência final: Solicitação x Entrega, Proposta x Card, Orçamento com componentes',
            'Verificar emissão da Nota de Venda',
            'Verificar se OS foi assinada'
        ]
    },
    'manutencao_radios': {
        'comercial': [
            'Analisar dados da empresa e sócios (CNPJ, CCC, Protesto)',
            'Se receber Nota de Remessa do cliente, anexar no card do pedido',
            'Agendar retirada e/ou devolução do material com o cliente',
            'Conferir proposta aprovada: Venda de Peças x Serviço de Mão de Obra'
        ],
        'logistica': [
            'Verificar necessidade de cotar transportadora para coleta/devolução',
            'Recebimento: Apenas com NF (Intelbras) ou OS preenchida e assinada (Clientes)',
            'Tirar FOTO do material no ato da chegada',
            'Entregar ao Laboratório Técnico para laudo',
            'Retorno: Confirmar orçamento aprovado, separar na prateleira ou despachar'
        ],
        'laboratorio': [
            'Assistência Intelbras: Abrir OS de garantia e guardar componentes para logística reversa',
            'Efetuar Análise Técnica e preencher Laudo (usar Tabela Indenizatória de Preços)',
            'Se não houver peça em estoque: Informar compra necessária no grupo',
            'Verificar itens faltantes (bateria, antena, clip) e incluir na proposta'
        ],
        'consultor_externo': [
            'Retirada: Foto do material, OS relatando defeitos e números de série',
            'Devolução: Testar equipamento com selo de garantia na presença do cliente'
        ],
        'financeiro': [
            'Conferência da proposta aprovada (valores e itens)',
            'Emissão de NF de Produtos (Peças/Componentes) separada',
            'Emissão de NF de Serviços (Mão de Obra) separada',
            'Exceção: Clientes como "Nacional Gás" aceitam apenas Nota de Serviço unificada',
            'Verificar se cliente emitiu Nota de Retorno (caso tenha enviado remessa)',
            'Alimentar Contas a Receber com nº da OS vinculada'
        ],
        'controle_qualidade': [
            'Conferência final: Laudo x Proposta x Orçamento com componentes',
            'Verificar emissão das Notas Fiscais (Produtos + Serviços)',
            'Verificar se OS de entrega/devolução foi assinada pelo cliente'
        ]
    },
    'eventos': {
        'comercial': [
            'Validação cadastral completa da empresa (CNPJ, CCC, Protesto)',
            'Verificar necessidade de acessórios (Lapela) e programação anexada',
            'Alimentar valores de Tabela Indenizatória no produto',
            'Definir frequência a ser utilizada (Nossa ou do Cliente)',
            'Contrato: Oferecer Upgrade após assinatura'
        ],
        'logistica': [
            'Separação em massa: Enviar lapelas e baterias a mais (reserva)',
            'Verificar necessidade de régua de tomadas para o evento',
            'Alimentar contrato de locação e registrar Saída de Estoque',
            'Tirar FOTO das baterias carregadas na base antes do envio',
            'Retorno: Cotar coleta com transportadora',
            'Retorno: Conferir material devolvido e separar para Análise de Indenização'
        ],
        'laboratorio': [
            'Programação e testes — Validar 100% das baterias',
            'Rádios POC: Verificar consumo de dados e bloquear chip após o evento',
            'Análise de Indenização no retorno: Laudo técnico com fotos dos danos'
        ],
        'consultor_externo': [
            'Contagem rigorosa na frente do cliente (Entrega e Retirada)',
            'OS detalhada com números de série e assinatura do cliente',
            'Treinamento rápido de uso dos equipamentos no local do evento'
        ],
        'financeiro': [
            'Emitir Nota de Remessa para saída do material',
            'Contrato: Certificar que está como "Determinado" (não recorrente)',
            'Faturamento: Verificar se é antecipado ou pós-evento',
            'Indenizações: Enviar e-mail com Laudo, Foto, Boleto e NF de Ressarcimento (se houver danos)'
        ],
        'controle_qualidade': [
            'Conferência final: Material enviado x devolvido x contrato',
            'Verificar emissão da Nota de Remessa e Fatura',
            'Verificar se OS e Laudo de Indenização foram finalizados'
        ]
    },
    'cliente_fixo': {
        'comercial': [
            'Validação cadastral completa e consulta de disponibilidade de estoque',
            'Definir frequência a ser utilizada e informar proposta aprovada no card',
            'Confecção de Contrato (Indeterminado)',
            'Boas-vindas: Enviar vídeo de agradecimento e informar canal de suporte'
        ],
        'logistica': [
            'Separação e alimentação de estoque (Próprio ou Relocação)',
            'Cotação de frete (peso/medidas) e enviar valores ao Financeiro',
            'Dar retorno ao cliente sobre preferência de Clip ou Estojo',
            '[RELOCAÇÃO] Identificar e separar material do Parceiro (Scanner/Bipagem)',
            '[RELOCAÇÃO] Fotografar números de série e salvar NF de Remessa do fornecedor no card',
            '[RELOCAÇÃO] Diferenciar estoque "Nosso" vs "Parceiro"'
        ],
        'laboratorio': [
            'Ativação de Chips POC (se houver)',
            'Programação completa (incluindo senha e bloqueio de canal ocupado)',
            'Inclusão de frequência no Multidados',
            '[RELOCAÇÃO] Gestão de chips POC de parceiros (Arquia/André)'
        ],
        'consultor_externo': [
            'Entrega técnica: Ensinar carregamento correto e cuidados com o equipamento',
            'Informar na OS qual acessório ficou com o cliente (Clip ou Estojo)',
            'Checklist de atendimento especial (Enauta/Brasil Forte)'
        ],
        'financeiro': [
            'Emitir Nota de Remessa para saída do material',
            'Criar Contrato no Orçamento (Garantir Pro-Rata manual se card batido após entrega)',
            'Ajustes Contrato: Código 2911, Indeterminado, Faturamento dia 01, Índice IGPM/IPCA',
            'Lançar fretes e backups de chips no Contas a Pagar',
            '[RELOCAÇÃO] Salvar NF de Remessa do fornecedor e lançar mensalidade do parceiro',
            '[RELOCAÇÃO] Atualizar backup com custos de relocação para cálculo de margem'
        ],
        'controle_qualidade': [
            'Conferência final: Proposta x Contrato x Entrega',
            'Verificar emissão de Nota de Remessa e Contrato ativo',
            'Verificar se OS de entrega foi assinada'
        ]
    },
    'aditivo': {
        'comercial': [
            'Verificar pendência financeira do cliente antes de prosseguir',
            'Aditivo de rádios deve ir com Tabela Indenizatória anexa',
            'Definir logística: Transportadora ou Cliente retira?'
        ],
        'logistica': [
            'Separação e envio do material adicional (similar a Cliente Fixo)',
            'Atenção ao retorno de itens trocados (se for troca de modelo)',
            '[RELOCAÇÃO] Identificar e separar material do Parceiro (Scanner/Bipagem)',
            '[RELOCAÇÃO] Fotografar números de série e salvar NF de Remessa do fornecedor no card',
            '[RELOCAÇÃO] Diferenciar estoque "Nosso" vs "Parceiro"'
        ],
        'laboratorio': [
            'Programação dos equipamentos adicionais seguindo padrão do contrato existente',
            'Testes completos antes do envio',
            '[RELOCAÇÃO] Gestão de chips POC de parceiros (Arquia/André)'
        ],
        'consultor_externo': [
            'Entrega técnica seguindo padrão de Cliente Fixo',
            'Atualizar OS com os novos itens entregues (modelos e seriais)'
        ],
        'financeiro': [
            'Criar contrato do aditivo para cobrança Pro-Rata',
            'Ajuste de itens a mais: Retirar clip/estojo excedente ou emitir nota de retorno',
            'Atualizar locais/postos de cobrança no sistema',
            '[RELOCAÇÃO] Salvar NF de Remessa do fornecedor e lançar mensalidade do parceiro',
            '[RELOCAÇÃO] Atualizar backup com custos de relocação para cálculo de margem'
        ],
        'controle_qualidade': [
            'Conferência final: Aditivo x Contrato original x Entrega',
            'Verificar atualização do contrato com novos itens',
            'Verificar se OS foi assinada com itens adicionais'
        ]
    },
    'cancelamento': {
        'comercial': [
            'Pedir formalização do cancelamento por e-mail e Nota de Devolução',
            'Alinhar retirada: Transportadora ou Cliente posta?',
            'Retirar cliente do "Mãe de Todos" e avisar Aviso Prévio ao Financeiro'
        ],
        'logistica': [
            'Cotar retirada com transportadora e lançar código de rastreio',
            'Receber devolução e transferir para Estoque de Manutenção (Análise)',
            'Processo de Separação de Indenização (se houver danos no material)',
            '[RELOCAÇÃO] Identificar material do Parceiro devolvido (Scanner/Bipagem)',
            '[RELOCAÇÃO] Fotografar números de série e preparar devolução ao fornecedor'
        ],
        'laboratorio': [
            'Suspender Chips POC e remover acesso PTT Manager',
            'Análise de Indenização: Taxa de limpeza e laudo de danos com fotos',
            'Guardar material indenizado na sucata por 30 dias',
            '[RELOCAÇÃO] Gestão de chips POC de parceiros — devolver ao fornecedor'
        ],
        'consultor_externo': [
            'OS de Retirada: Relatar que material vai para análise em bancada',
            'Checklist de encerramento com conferência de itens devolvidos'
        ],
        'financeiro': [
            'Responder e-mail detalhando cobranças (Pro-Rata, Aviso Prévio, Indenização)',
            'Baixar contrato no sistema após confirmação de retorno do material',
            'Emitir boletos finais e Notas de Débito/Ressarcimento conforme laudo',
            '[RELOCAÇÃO] Devolver NF de Remessa ao fornecedor e encerrar mensalidade do parceiro'
        ],
        'controle_qualidade': [
            'Conferência final: Material devolvido x Contrato x Laudo de Indenização',
            'Verificar baixa do contrato no sistema',
            'Verificar emissão de boletos finais e notas de encerramento'
        ]
    },
    'chamado_tecnico': {
        'comercial': [
            'Verificar pendência financeira do cliente',
            'POC: Tentar resolução remota (conexão/chip) antes de agendar visita',
            'Criar proposta de troca ou preventiva'
        ],
        'logistica': [
            'Separação de material de backup/troca',
            'Retorno de material defeituoso: Receber, conferir e enviar para Análise de Indenização',
            '[RELOCAÇÃO] Identificar se material defeituoso é do Parceiro (Scanner/Bipagem)',
            '[RELOCAÇÃO] Fotografar números de série e notificar fornecedor'
        ],
        'laboratorio': [
            'Avaliar material retornado e emitir Laudo para Indenização',
            'Programação e testes de equipamentos de troca/backup',
            '[RELOCAÇÃO] Gestão de chips POC de parceiros — notificar troca'
        ],
        'consultor_externo': [
            'Levantamento de itens defeituosos no local do cliente',
            'Substituir equipamento e mostrar avarias ao cliente (mau uso?)',
            'Preventiva: Limpeza e testes de botões/baterias no local'
        ],
        'financeiro': [
            'Emitir Nota de Remessa da troca',
            'Nota de Retorno do material defeituoso',
            'Cobrança de Indenização se laudo apontar mau uso (sem isenção Safe)',
            '[RELOCAÇÃO] Notificar fornecedor sobre troca e atualizar Contas a Pagar'
        ],
        'controle_qualidade': [
            'Conferência final: Material trocado x Laudo x OS de campo',
            'Verificar emissão de Notas (Remessa + Retorno)',
            'Verificar se laudo de indenização foi concluído (se aplicável)'
        ]
    }
};

// Obter configurações de SLA
async function getSLAConfig() {
    const res = await db.execute("SELECT key, value FROM system_settings WHERE key LIKE 'sla_%'");
    const slas = {};
    res.rows.forEach(row => {
        slas[row.key] = parseInt(row.value) || 24;
    });
    return slas;
}

// 1. Criar novo Pedido/Proposta
router.post('/', async (req, res) => {
    try {
        const { cliente_id, observacoes, tipo } = req.body;
        const usuario_id = req.userId; // user logado
        const tipoPedido = TIPOS_PEDIDO.includes(tipo) ? tipo : 'venda';

        if (!cliente_id) {
            return res.status(400).json({ error: 'ID do cliente é obrigatório' });
        }

        const result = await db.execute({
            sql: `INSERT INTO pedidos (cliente_id, usuario_id, observacoes, tipo, status_atual) VALUES (?, ?, ?, ?, 'comercial')`,
            args: [cliente_id, usuario_id, observacoes || null, tipoPedido]
        });

        const pedido_id = Number(result.lastInsertRowid);

        // Gerar checklists iniciais para todas as fases baseado no TIPO
        const checklistsDoTipo = CHECKLISTS_POR_TIPO[tipoPedido] || CHECKLISTS_POR_TIPO['venda'];
        for (const [fase, itens] of Object.entries(checklistsDoTipo)) {
            for (const item of itens) {
                await db.execute({
                    sql: `INSERT INTO pedido_checklists (pedido_id, fase_setor, descricao) VALUES (?, ?, ?)`,
                    args: [pedido_id, fase, item]
                });
            }
        }

        // Criar log inicial
        await db.execute({
            sql: `INSERT INTO audit_logs (pedido_id, acao, status_novo, usuario_id) VALUES (?, ?, ?, ?)`,
            args: [pedido_id, 'CRIACAO', 'comercial', usuario_id]
        });

        res.status(201).json({ id: pedido_id, message: 'Pedido criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 2. Listar Pedidos com cálculo de SLA
router.get('/', async (req, res) => {
    try {
        const slas = await getSLAConfig();

        const result = await db.execute(`
            SELECT p.*, c.nome as cliente_nome, u.nome as criador_nome 
            FROM pedidos p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.updated_at DESC
        `);

        // Calcular SLA em atraso dinamicamente
        const agora = new Date();

        const pedidosComSla = result.rows.map(pedido => {
            let configKey = '';
            if (pedido.status_atual === 'logistica') configKey = 'sla_logistica_horas';
            else if (pedido.status_atual === 'laboratorio') configKey = 'sla_laboratorio_horas';
            else if (pedido.status_atual === 'financeiro') configKey = 'sla_financeiro_horas';
            else if (pedido.status_atual === 'consultor_externo') configKey = 'sla_consultor_horas';

            let em_atraso = false;
            let horas_restantes = 0;

            if (configKey && pedido.data_entrada_status && pedido.status_atual !== 'concluido') {
                const slaHoras = slas[configKey] || 24;
                const dataEntrada = new Date(pedido.data_entrada_status);

                // Diff in hours
                const diffTime = Math.abs(agora - dataEntrada);
                const diffHoras = Math.ceil(diffTime / (1000 * 60 * 60));

                horas_restantes = slaHoras - diffHoras;
                em_atraso = diffHoras > slaHoras;
            }

            return {
                ...pedido,
                em_atraso,
                horas_restantes,
                sla_horas: configKey ? (slas[configKey] || 24) : null
            };
        });

        res.json(pedidosComSla);
    } catch (error) {
        console.error('Erro ao listar pedidos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 3. Detalhes do Pedido
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Pedido
        const pedResult = await db.execute({
            sql: `SELECT p.*, c.nome as cliente_nome, c.plano_safe_ativo, u.nome as criador_nome 
                  FROM pedidos p
                  LEFT JOIN clientes c ON p.cliente_id = c.id
                  LEFT JOIN usuarios u ON p.usuario_id = u.id
                  WHERE p.id = ?`,
            args: [id]
        });

        if (pedResult.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });

        const pedido = pedResult.rows[0];

        // Equipamentos
        const equipResult = await db.execute({
            sql: `SELECT * FROM pedido_equipamentos WHERE pedido_id = ?`,
            args: [id]
        });

        // Checklists
        const chkResult = await db.execute({
            sql: `SELECT * FROM pedido_checklists WHERE pedido_id = ?`,
            args: [id]
        });

        // Agrupar checklists por fase
        const checklists = {};
        FASES.forEach(f => checklists[f] = []);
        chkResult.rows.forEach(chk => {
            if (checklists[chk.fase_setor]) {
                checklists[chk.fase_setor].push({
                    id: chk.id,
                    descricao: chk.descricao,
                    concluido: chk.concluido === 1
                });
            }
        });

        // Audit Logs
        const logsResult = await db.execute({
            sql: `SELECT a.*, u.nome as usuario_nome 
                  FROM audit_logs a
                  LEFT JOIN usuarios u ON a.usuario_id = u.id
                  WHERE a.pedido_id = ?
                  ORDER BY a.created_at DESC`,
            args: [id]
        });

        // Pecas Usadas
        const pecasResult = await db.execute({
            sql: `SELECT pp.*, pi.modelo_equipamento, pi.componente, pi.valor_base, pi.valor_mao_de_obra
                  FROM pedido_pecas pp
                  LEFT JOIN precos_indenizatorios pi ON pp.preco_indenizatorio_id = pi.id
                  WHERE pp.pedido_id = ?`,
            args: [id]
        });

        // Solicitacoes do Comercial
        const solResult = await db.execute({
            sql: `SELECT * FROM pedido_solicitacoes WHERE pedido_id = ?`,
            args: [id]
        });

        res.json({
            pedido,
            equipamentos: equipResult.rows,
            checklists,
            audit_logs: logsResult.rows,
            pecas: pecasResult.rows,
            solicitacoes: solResult.rows
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 3.1. Salvar Solicitações do Comercial (Idempotente)
router.post('/:id/solicitacoes', async (req, res) => {
    try {
        const { id } = req.params;
        const { solicitacoes } = req.body; // Array de { modelo, quantidade }

        if (!Array.isArray(solicitacoes)) {
            return res.status(400).json({ error: 'Solicitações devem ser um array' });
        }

        // Deletar existentes para recriar
        await db.execute({
            sql: `DELETE FROM pedido_solicitacoes WHERE pedido_id = ?`,
            args: [id]
        });

        // Inserir novos
        for (const sol of solicitacoes) {
            if (sol.modelo && sol.quantidade > 0) {
                await db.execute({
                    sql: `INSERT INTO pedido_solicitacoes (pedido_id, modelo, quantidade) VALUES (?, ?, ?)`,
                    args: [id, sol.modelo, sol.quantidade]
                });
            }
        }

        res.json({ message: 'Solicitações salvas com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar solicitações:', error);
        res.status(500).json({ error: 'Erro ao salvar solicitações' });
    }
});

// 3.2. Atualizar Dados de Frete (Logística/Financeiro)
router.put('/:id/frete', async (req, res) => {
    try {
        const { id } = req.params;
        const { frete_valor, transportadora, dados_frete, frete_status } = req.body; // frete_status: 'pendente', 'aprovado', 'reprovado'

        const args = [];
        const sets = [];

        if (frete_valor !== undefined) { sets.push('frete_valor = ?'); args.push(frete_valor); }
        if (transportadora !== undefined) { sets.push('transportadora = ?'); args.push(transportadora); }
        if (dados_frete !== undefined) { sets.push('dados_frete = ?'); args.push(dados_frete); }
        if (frete_status !== undefined) { sets.push('frete_status = ?'); args.push(frete_status); }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        args.push(id);

        await db.execute({
            sql: `UPDATE pedidos SET ${sets.join(', ')} WHERE id = ?`,
            args: args
        });

        res.json({ message: 'Dados de frete atualizados' });
    } catch (error) {
        console.error('Erro ao atualizar frete:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar frete' });
    }
});

// 4. Salvar Equipamentos Vinculados (Idempotente)
router.post('/:id/equipamentos', async (req, res) => {
    try {
        const { id } = req.params;
        const { equipamentos } = req.body; // Array de { serial_number, modelo, acessorios }

        if (!Array.isArray(equipamentos)) {
            return res.status(400).json({ error: 'Equipamentos devem ser um array' });
        }

        // Deletar existentes
        await db.execute({
            sql: `DELETE FROM pedido_equipamentos WHERE pedido_id = ?`,
            args: [id]
        });

        // Inserir novos
        for (const eq of equipamentos) {
            await db.execute({
                sql: `INSERT INTO pedido_equipamentos (pedido_id, serial_number, modelo, acessorios) VALUES (?, ?, ?, ?)`,
                args: [id, eq.serial_number || '', eq.modelo || '', eq.acessorios || '']
            });
        }

        res.json({ message: 'Equipamentos salvos com sucesso' });

    } catch (error) {
        console.error('Erro ao salvar equipamentos:', error);
        res.status(500).json({ error: 'Erro ao salvar equipamentos' });
    }
});

// 5. Toggle status do Checklist
router.post('/checklists/:chkId/toggle', async (req, res) => {
    try {
        const { chkId } = req.params;
        const { concluido } = req.body; // boolean

        const val = concluido ? 1 : 0;

        await db.execute({
            sql: `UPDATE pedido_checklists SET concluido = ? WHERE id = ?`,
            args: [val, chkId]
        });

        res.json({ message: 'Checklist atualizado' });

    } catch (error) {
        console.error('Erro ao atualizar checklist:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 6. Avançar de Fase (Gating / Trava)
router.post('/:id/avancar', async (req, res) => {
    try {
        const { id } = req.params;
        const usuario_id = req.userId;

        // Buscar pedido atual
        const pRes = await db.execute({ sql: `SELECT * FROM pedidos WHERE id = ?`, args: [id] });
        if (pRes.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });

        const pedido = pRes.rows[0];
        const statusAtual = pedido.status_atual;

        if (statusAtual === 'concluido') {
            return res.status(400).json({ error: 'Pedido já está concluído' });
        }

        // TRAVA (GATING): Validar se 100% dos checklists da fase atual estão marcados
        const chkRes = await db.execute({
            sql: `SELECT COUNT(*) as total, SUM(concluido) as concluidos 
                  FROM pedido_checklists 
                  WHERE pedido_id = ? AND fase_setor = ?`,
            args: [id, statusAtual]
        });

        const total = Number(chkRes.rows[0].total) || 0;
        const concluidos = Number(chkRes.rows[0].concluidos) || 0;

        if (total > 0 && concluidos < total) {
            // Nem todos concluídos! Bloquear avanço.
            return res.status(403).json({
                error: 'Trava de Processo: Você deve preencher 100% do checklist da fase atual antes de avançar.',
                gatingBlocked: true
            });
        }

        // Calcular próxima fase
        const idxAtual = FASES.indexOf(statusAtual);
        const proximaFase = FASES[idxAtual + 1];

        // Se por algum motivo o index der ruim ou for o ultimo
        if (!proximaFase) return res.status(400).json({ error: 'Não há próxima fase' });

        // Atualizar status e zerar timer SLA (data_entrada_status)
        await db.execute({
            sql: `UPDATE pedidos SET status_atual = ?, data_entrada_status = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            args: [proximaFase, id]
        });

        // Registrar Audit Log
        await db.execute({
            sql: `INSERT INTO audit_logs (pedido_id, acao, status_anterior, status_novo, usuario_id) VALUES (?, ?, ?, ?, ?)`,
            args: [id, 'AVANCO_FASE', statusAtual, proximaFase, usuario_id]
        });

        res.json({ message: 'Avançou para próxima fase', novo_status: proximaFase });

    } catch (error) {
        console.error('Erro ao avançar de fase:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// 7. Adicionar Peça (Laboratório)
router.post('/:id/pecas', async (req, res) => {
    try {
        const { id } = req.params;
        const { equipamento_id, preco_indenizatorio_id, quantidade, isenta_plano_safe } = req.body;

        if (!preco_indenizatorio_id) {
            return res.status(400).json({ error: 'Preço Indenizatório (Peça) é obrigatório' });
        }

        const result = await db.execute({
            sql: `INSERT INTO pedido_pecas (pedido_id, equipamento_id, preco_indenizatorio_id, quantidade, isenta_plano_safe) 
                  VALUES (?, ?, ?, ?, ?)`,
            args: [id, equipamento_id || null, preco_indenizatorio_id, quantidade || 1, isenta_plano_safe ? 1 : 0]
        });

        res.status(201).json({ id: parseInt(result.lastInsertRowid), message: 'Peça adicionada com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar peça:', error);
        res.status(500).json({ error: 'Erro ao adicionar peça' });
    }
});

// 8. Remover Peça
router.delete('/:id/pecas/:pecaId', async (req, res) => {
    try {
        const { id, pecaId } = req.params;
        await db.execute({
            sql: `DELETE FROM pedido_pecas WHERE id = ? AND pedido_id = ?`,
            args: [pecaId, id]
        });
        res.json({ message: 'Peça removida com sucesso' });
    } catch (error) {
        console.error('Erro ao remover peça:', error);
        res.status(500).json({ error: 'Erro ao remover peça' });
    }
});

module.exports = router;
