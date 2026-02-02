const jwt = require('jsonwebtoken');

const JWT_SECRET = 'teledias-secret-key-2024';

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
        return res.status(401).json({ error: 'Token mal formatado' });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ error: 'Token mal formatado' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        req.userName = decoded.nome;
        req.userCargo = decoded.cargo;
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// Middleware para verificar se usuário é admin
function requireAdmin(req, res, next) {
    if (req.userCargo !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }
    return next();
}

module.exports = { authMiddleware, requireAdmin, JWT_SECRET };

