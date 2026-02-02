const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/database');
const { JWT_SECRET, authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

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
router.get('/usuarios', authMiddleware, requireAdmin, (req, res) => {
    try {
        const usuarios = db.prepare('SELECT id, nome, email, cargo, created_at FROM usuarios ORDER BY created_at DESC').all();
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registrar novo usuário (admin only)
router.post('/registrar', authMiddleware, requireAdmin, (req, res) => {
    try {
        const { nome, email, senha, cargo } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const usuarioExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);

        if (usuarioExiste) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const senhaHash = bcrypt.hashSync(senha, 10);
        const cargoUsuario = cargo || 'operador';

        const result = db.prepare('INSERT INTO usuarios (nome, email, senha, cargo) VALUES (?, ?, ?, ?)').run(nome, email, senhaHash, cargoUsuario);

        res.status(201).json({
            id: result.lastInsertRowid,
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
router.delete('/usuarios/:id', authMiddleware, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;

        // Não permitir excluir o próprio usuário
        if (parseInt(id) === req.userId) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
        }

        const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);

        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);

        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
