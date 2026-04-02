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

mongoose.connect(process.env.MONGO_URI.replace(/['"]+/g, '').trim()).then(() => console.log("✅ Vertex Core: Roles Restored"));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: String, email: { type: String, unique: true }, senha: String,
    role: { type: String, default: 'aluno' }, // 'admin', 'professor', 'aluno'
    turma: String,
    grades: [{ materia: String, av1: Number, av2: Number }]
}));

const Homework = mongoose.model('Homework', new mongoose.Schema({
    titulo: String, materia: String, descricao: String, dataEntrega: String, autor: String, createdAt: { type: Date, default: Date.now }
}));

const Task = mongoose.model('Task', new mongoose.Schema({
    titulo: String, materia: String, dataEntrega: String, autor: String, createdAt: { type: Date, default: Date.now }
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
    titulo: String, conteudo: String, autor: String, upvotes: { type: [String], default: [] },
    replies: [{ id: String, autor: String, texto: String, parentId: { type: String, default: null } }],
    createdAt: { type: Date, default: Date.now }
}));

// --- MIDDLEWARE: ADMIN CHECK ---
const isAdmin = (req, res, next) => {
    try {
        const decoded = jwt.verify(req.body.token || req.headers.authorization, process.env.JWT_SECRET);
        if (['admin', 'professor'].includes(decoded.role)) return next();
        res.status(403).send("Acesso Negado");
    } catch(e) { res.status(401).send("Sessão Inválida"); }
};

// --- ROUTES ---
app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome }, process.env.JWT_SECRET);
        res.json({ token, role: user.role, nome: user.nome });
    } else { res.status(401).send("Erro"); }
});

// Homework Routes
app.get('/api/homeworks', async (req, res) => res.json(await Homework.find().sort({ createdAt: -1 })));
app.post('/api/homeworks', isAdmin, async (req, res) => {
    const { titulo, materia, descricao, dataEntrega, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await Homework.create({ titulo, materia, descricao, dataEntrega, autor: decoded.nome });
    res.status(201).send("OK");
});

// Forum & Grades (same as previous master version)
app.get('/api/forum', async (req, res) => res.json(await Thread.find().sort({ createdAt: -1 })));
app.post('/api/forum/reply', async (req, res) => {
    const { threadId, texto, parentId, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await Thread.findByIdAndUpdate(threadId, { $push: { replies: { id: new mongoose.Types.ObjectId().toString(), autor: decoded.nome, texto, parentId } } });
    res.send("OK");
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 3000);
