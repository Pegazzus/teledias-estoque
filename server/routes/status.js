const express = require('express');
const router = express.Router();
const priceScraper = require('../services/price-scraper');

// GET /api/status - Verifica saúde do sistema
router.get('/', async (req, res) => {
    try {
        const scraperHealth = await priceScraper.checkHealth();

        const systemStatus = {
            online: true,
            timestamp: new Date().toISOString(),
            scrapers: scraperHealth
        };

        res.json(systemStatus);
    } catch (error) {
        console.error('Erro no health check:', error);
        res.status(500).json({ error: 'Erro ao verificar status do sistema' });
    }
});

module.exports = router;
