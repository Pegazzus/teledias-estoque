const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settings');

// GET /api/settings - Obter todas as configurações
router.get('/', async (req, res) => {
    try {
        const settings = await SettingsService.getAll();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

// POST /api/settings - Atualizar configuração
router.post('/', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Chave é obrigatória' });

        const success = await SettingsService.set(key, value);
        if (success) {
            res.json({ message: 'Configuração atualizada com sucesso' });
        } else {
            res.status(500).json({ error: 'Erro ao atualizar configuração' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao salvar configurações' });
    }
});

module.exports = router;
