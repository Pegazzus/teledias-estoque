const { db } = require('./models/database');

async function clearProxy() {
    console.log('🔄 Removendo Proxy...');

    try {
        await db.execute({
            sql: `UPDATE system_settings SET value = '', updated_at = CURRENT_TIMESTAMP WHERE key = 'proxy_url'`,
            args: []
        });
        console.log('✅ Proxy removido com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao remover proxy:', error);
    }
}

clearProxy();
