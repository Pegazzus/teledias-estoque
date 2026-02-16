const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../models/database');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'teledias-secret-key-2024';

// Middleware de autenticação
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        req.userName = decoded.nome;
        req.userCargo = decoded.cargo;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// Middleware de admin
const requireAdmin = (req, res, next) => {
    if (req.userCargo !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }
    next();
};

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const result = await db.execute({
            sql: 'SELECT * FROM usuarios WHERE email = ?',
            args: [email]
        });

        const usuario = result.rows[0];

        if (!usuario) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const senhaValida = bcrypt.compareSync(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo || 'operador' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                cargo: usuario.cargo || 'operador'
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Verificar token
router.get('/verificar', authMiddleware, (req, res) => {
    res.json({
        valid: true,
        userId: req.userId,
        userName: req.userName,
        userCargo: req.userCargo
    });
});

// Listar todos os usuários (admin only)
router.get('/usuarios', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const result = await db.execute('SELECT id, nome, email, cargo, created_at FROM usuarios ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registrar novo usuário (admin only)
router.post('/registrar', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { nome, email, senha, cargo } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const existsResult = await db.execute({
            sql: 'SELECT id FROM usuarios WHERE email = ?',
            args: [email]
        });

        if (existsResult.rows.length > 0) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const senhaHash = bcrypt.hashSync(senha, 10);
        const cargoUsuario = cargo || 'operador';

        const result = await db.execute({
            sql: 'INSERT INTO usuarios (nome, email, senha, cargo) VALUES (?, ?, ?, ?)',
            args: [nome, email, senhaHash, cargoUsuario]
        });

        res.status(201).json({
            id: Number(result.lastInsertRowid),
            nome,
            email,
            cargo: cargoUsuario
        });
    } catch (error) {
        console.error('Erro ao registrar:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Excluir usuário (admin only)
router.delete('/usuarios/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.userId) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
        }

        const result = await db.execute({
            sql: 'SELECT id FROM usuarios WHERE id = ?',
            args: [id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        await db.execute({
            sql: 'DELETE FROM usuarios WHERE id = ?',
            args: [id]
        });

        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.JWT_SECRET = JWT_SECRET;
