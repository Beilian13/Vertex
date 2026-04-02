const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json()); // CRITICAL: Allows backend to read your JSON
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/['"]+/g, '').trim() : null;

// --- DATABASE CONNECTION WITH TIMEOUT PREVENTER ---
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log("🚀 Vertex Engine: Core Active"))
    .catch(err => console.error("❌ DB CONNECTION ERROR:", err.message));

// --- USER MODEL ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    role: { type: String, default: 'aluno' },
    turma: String,
    avatar: { type: String, default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vertex' },
    grades: { type: Array, default: [] }
}));

// --- AUTH ROUTES (FIXED) ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, turma } = req.body;
        if (!nome || !email || !senha) return res.status(400).json({ msg: "Campos obrigatórios faltando" });

        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ msg: "Email já existe" });

        const hashed = await bcrypt.hash(senha, 10);
        await User.create({ nome, email, senha: hashed, turma });
        res.status(201).json({ msg: "Sucesso" });
    } catch (e) {
        console.error("Reg Error:", e);
        res.status(500).json({ msg: "Erro interno no registro" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!process.env.JWT_SECRET) return res.status(500).json({ msg: "JWT_SECRET não configurado no Render" });

        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(senha, user.senha)) {
            const token = jwt.sign(
                { id: user._id, role: user.role, nome: user.nome, turma: user.turma }, 
                process.env.JWT_SECRET, 
                { expiresIn: '7d' }
            );
            res.json({ token, role: user.role, nome: user.nome, turma: user.turma, avatar: user.avatar });
        } else {
            res.status(401).json({ msg: "Email ou senha incorretos" });
        }
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ msg: "Erro interno no login" });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Vertex running on ${PORT}`));
