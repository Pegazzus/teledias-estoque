const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar banco de dados
const { initializeDatabase } = require('./models/database');

// Inicializar banco de dados antes de iniciar o servidor
async function startServer() {
    try {
        await initializeDatabase();

        // Importar rotas após inicialização do banco
        const authRoutes = require('./routes/auth');
        const radiosRoutes = require('./routes/radios');
        const clientesRoutes = require('./routes/clientes');
        const movimentacoesRoutes = require('./routes/movimentacoes');
        const relatoriosRoutes = require('./routes/relatorios');

        const app = express();
        const PORT = process.env.PORT || 3000;

        // Middlewares
        app.use(cors());
        app.use(express.json());
        app.use(express.static(path.join(__dirname, '..', 'public')));

        // Rotas da API
        app.use('/api/auth', authRoutes);
        app.use('/api/radios', radiosRoutes);
        app.use('/api/clientes', clientesRoutes);
        app.use('/api/movimentacoes', movimentacoesRoutes);
        app.use('/api/relatorios', relatoriosRoutes);

        // Rota raiz - redirecionar para login
        app.get('/', (req, res) => {
            res.redirect('/login.html');
        });

        // Tratamento de erros
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({ error: 'Erro interno do servidor' });
        });

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔌 Sistema de Estoque - Teledias Telecom                ║
║                                                            ║
║   Servidor rodando em: http://localhost:${PORT}              ║
║                                                            ║
║   Credenciais padrão:                                      ║
║   Email: admin@teledias.com                                ║
║   Senha: admin123                                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

startServer();
