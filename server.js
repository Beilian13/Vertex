const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/['"]+/g, '').trim() : null;

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Vertex Engine: Core Active"))
    .catch(err => console.error("❌ Critical Connection Failure:", err));

// --- DATA MODELS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    role: { type: String, enum: ['aluno', 'professor', 'direcao'], default: 'aluno' },
    turma: String,
    avatar: { type: String, default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vertex' },
    grades: [{ materia: String, av1: Number, av2: Number }]
}));

const Homework = mongoose.model('Homework', new mongoose.Schema({
    titulo: String, materia: String, descricao: String, dataEntrega: Date,
    autor: String, turma: String, createdAt: { type: Date, default: Date.now }
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
    titulo: String, conteudo: String, autor: String, turma: String,
    replies: [{ id: String, autor: String, texto: String, parentId: String, createdAt: { type: Date, default: Date.now } }],
    createdAt: { type: Date, default: Date.now }
}));

const Mural = mongoose.model('Mural', new mongoose.Schema({
    titulo: String, autor: String, turma: String, createdAt: { type: Date, default: Date.now }
}));

// --- SECURITY MIDDLEWARE ---
const authorize = (roles = []) => (req, res, next) => {
    try {
        const token = req.headers.authorization;
        if (!token) return res.status(401).json({ msg: "Acesso Negado" });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (roles.length && !roles.includes(decoded.role)) return res.status(403).json({ msg: "Permissão Insuficiente" });
        req.user = decoded;
        next();
    } catch (e) { res.status(401).json({ msg: "Sessão Expirada" }); }
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, turma } = req.body;
        const hashed = await bcrypt.hash(senha, 10);
        await User.create({ nome, email, senha: hashed, turma, role: 'aluno' });
        res.status(201).json({ msg: "Sucesso" });
    } catch (e) { res.status(400).json({ msg: "Erro no registro" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(senha, user.senha)) {
            const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome, turma: user.turma }, process.env.JWT_SECRET);
            res.json({ token, role: user.role, nome: user.nome, turma: user.turma, avatar: user.avatar });
        } else res.status(401).json({ msg: "Credenciais Inválidas" });
    } catch (e) { res.status(500).json({ msg: "Erro no Servidor" }); }
});

// --- CORE ROUTES ---
app.get('/api/mural', authorize(), async (req, res) => res.json(await Mural.find({ turma: req.user.turma }).sort({ createdAt: -1 })));
app.post('/api/mural', authorize(['professor', 'direcao']), async (req, res) => {
    const post = await Mural.create({ titulo: req.body.titulo, autor: req.user.nome, turma: req.user.turma });
    res.json(post);
});

app.get('/api/homeworks', authorize(), async (req, res) => res.json(await Homework.find({ turma: req.user.turma }).sort({ dataEntrega: 1 })));
app.post('/api/homeworks', authorize(['professor', 'direcao']), async (req, res) => {
    const hw = await Homework.create({ ...req.body, autor: req.user.nome, turma: req.user.turma });
    res.json(hw);
});

app.get('/api/forum', authorize(), async (req, res) => res.json(await Thread.find({ turma: req.user.turma }).sort({ createdAt: -1 })));
app.get('/api/forum/:id', authorize(), async (req, res) => res.json(await Thread.findById(req.params.id)));
app.post('/api/forum', authorize(), async (req, res) => {
    const thread = await Thread.create({ ...req.body, autor: req.user.nome, turma: req.user.turma });
    res.json(thread);
});

app.post('/api/forum/reply', authorize(), async (req, res) => {
    const reply = { id: new mongoose.Types.ObjectId().toString(), autor: req.user.nome, texto: req.body.texto, parentId: req.body.parentId };
    await Thread.findByIdAndUpdate(req.body.threadId, { $push: { replies: reply } });
    res.json(reply);
});

app.get('/api/me/grades', authorize(), async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json(user.grades || []);
});

// Wildcard Catch-all (Must be last)
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Vertex Live on Port ${PORT}`));
