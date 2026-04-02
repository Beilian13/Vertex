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

mongoose.connect(process.env.MONGO_URI.replace(/['"]+/g, '').trim()).then(() => console.log("🚀 Vertex Engine: Full Restoration Complete"));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: String, email: { type: String, unique: true }, senha: String,
    role: { type: String, default: 'aluno' }, // aluno, professor, direcao
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
    titulo: String, conteudo: String, autor: String, 
    upvotes: { type: [String], default: [] },
    replies: [{ id: String, autor: String, texto: String, parentId: { type: String, default: null } }],
    createdAt: { type: Date, default: Date.now }
}));

// --- AUTH & ROLES ---
app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome }, process.env.JWT_SECRET);
        res.json({ token, role: user.role, nome: user.nome, turma: user.turma });
    } else { res.status(401).send("Falha no Login"); }
});

// Admin/Direção Middleware
const checkRole = (roles) => (req, res, next) => {
    try {
        const token = req.headers.authorization || req.body.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (roles.includes(decoded.role)) return next();
        res.status(403).send("Acesso negado pela Direção");
    } catch(e) { res.status(401).send("Sessão expirada"); }
};

// --- DATA ROUTES ---
app.get('/api/homeworks', async (req, res) => res.json(await Homework.find().sort({ createdAt: -1 })));
app.post('/api/homeworks', checkRole(['professor', 'direcao']), async (req, res) => {
    const { titulo, materia, descricao, dataEntrega, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await Homework.create({ titulo, materia, descricao, dataEntrega, autor: decoded.nome });
    res.status(201).send("OK");
});

app.get('/api/forum', async (req, res) => res.json(await Thread.find().sort({ createdAt: -1 })));
app.post('/api/forum/reply', async (req, res) => {
    const { threadId, texto, parentId, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const reply = { id: new mongoose.Types.ObjectId().toString(), autor: decoded.nome, texto, parentId };
    await Thread.findByIdAndUpdate(threadId, { $push: { replies: reply } });
    res.json(reply);
});

app.get('/api/users', checkRole(['direcao']), async (req, res) => res.json(await User.find({}, '-senha')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 3000);
