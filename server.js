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

// Database Connection
const mongoURI = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/['"]+/g, '').trim() : null;
mongoose.connect(mongoURI).then(() => console.log("✅ Vertex Core: Active"));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: String, email: { type: String, unique: true }, senha: String,
    role: { type: String, default: 'aluno' }, turma: String,
    grades: [{ materia: String, av1: Number, av2: Number }]
}));

const Task = mongoose.model('Task', new mongoose.Schema({
    titulo: String, materia: String, dataEntrega: String, autor: String, createdAt: { type: Date, default: Date.now }
}));

const Material = mongoose.model('Material', new mongoose.Schema({
    titulo: String, materia: String, url: String, autor: String, turma: String, createdAt: { type: Date, default: Date.now }
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
    titulo: String, conteudo: String, autor: String, turma: String,
    upvotes: { type: [String], default: [] },
    replies: [{ 
        id: String, autor: String, texto: String, parentId: { type: String, default: null }, createdAt: { type: Date, default: Date.now } 
    }],
    createdAt: { type: Date, default: Date.now }
}));

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
    const { nome, email, senha, turma } = req.body;
    try {
        const hashed = await bcrypt.hash(senha, 10);
        await User.create({ nome, email, senha: hashed, turma });
        res.status(201).send("OK");
    } catch(e) { res.status(400).send("Erro"); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome, turma: user.turma }, process.env.JWT_SECRET);
        res.json({ token, role: user.role, nome: user.nome, turma: user.turma });
    } else { res.status(401).send("Erro"); }
});

// --- CORE LOGIC ---
app.get('/api/tasks', async (req, res) => res.json(await Task.find().sort({ createdAt: -1 })));
app.get('/api/my-grades', async (req, res) => {
    const decoded = jwt.verify(req.headers.authorization, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    res.json(user.grades || []);
});

app.get('/api/forum', async (req, res) => res.json(await Thread.find().sort({ createdAt: -1 })));
app.get('/api/forum/:id', async (req, res) => res.json(await Thread.findById(req.params.id)));

app.post('/api/forum', async (req, res) => {
    const { titulo, conteudo, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await Thread.create({ titulo, conteudo, autor: decoded.nome, turma: decoded.turma });
    res.status(201).send("OK");
});

app.post('/api/forum/reply', async (req, res) => {
    const { threadId, texto, parentId, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const reply = { id: new mongoose.Types.ObjectId().toString(), autor: decoded.nome, texto, parentId };
    await Thread.findByIdAndUpdate(threadId, { $push: { replies: reply } });
    res.json(reply);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 3000);
