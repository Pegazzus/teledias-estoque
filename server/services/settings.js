const { db } = require('../models/database');

const SettingsService = {
    // Obter todas as configurações
    getAll: async () => {
        try {
            const result = await db.execute('SELECT * FROM system_settings');
            return result.rows;
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            return [];
        }
    },

    // Obter configuração por chave
    get: async (key) => {
        try {
            const result = await db.execute({
                sql: 'SELECT value FROM system_settings WHERE key = ?',
                args: [key]
            });
            return result.rows[0]?.value || null;
        } catch (error) {
            console.error(`Erro ao buscar configuração ${key}:`, error);
            return null;
        }
    },

    // Atualizar configuração
    set: async (key, value) => {
        try {
            await db.execute({
                sql: `INSERT INTO system_settings (key, value, updated_at) 
                      VALUES (?, ?, CURRENT_TIMESTAMP) 
                      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
                args: [key, value]
            });
            return true;
        } catch (error) {
            console.error(`Erro ao atualizar configuração ${key}:`, error);
            return false;
        }
    }
};

module.exports = SettingsService;
