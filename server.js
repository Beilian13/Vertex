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

// MongoDB Connection
const mongoURI = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/['"]+/g, '').trim() : null;
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Vertex: Database Connected"))
    .catch(err => console.error("❌ Vertex: Connection Error:", err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true },
    senha: String,
    role: { type: String, default: 'aluno' }, // aluno, representante, professor, direcao, admin
    turma: String
});
const User = mongoose.model('User', UserSchema);

const TaskSchema = new mongoose.Schema({
    titulo: String,
    materia: String,
    dataEntrega: String,
    autor: String,
    createdAt: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', TaskSchema);

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    const { nome, email, senha, turma } = req.body;
    try {
        const hashed = await bcrypt.hash(senha, 10);
        await User.create({ nome, email, senha: hashed, turma });
        res.status(201).send("Registrado com sucesso!");
    } catch(e) { res.status(400).send("Erro: Email já cadastrado."); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome }, process.env.JWT_SECRET);
        res.json({ token, role: user.role, nome: user.nome, turma: user.turma });
    } else {
        res.status(401).send("Credenciais inválidas.");
    }
});

// --- TASK ROUTES ---
app.get('/api/tasks', async (req, res) => {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
});

app.post('/api/tasks', async (req, res) => {
    const { titulo, materia, dataEntrega, token } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (['admin', 'direcao', 'professor'].includes(decoded.role)) {
            await Task.create({ titulo, materia, dataEntrega, autor: decoded.nome });
            res.status(201).send("Atividade publicada!");
        } else {
            res.status(403).send("Acesso negado.");
        }
    } catch(e) { res.status(401).send("Sessão inválida."); }
});

// --- ADMIN ROUTES ---
app.put('/api/admin/update-role', async (req, res) => {
    const { targetEmail, newRole, token } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin' && decoded.role !== 'direcao') return res.status(403).send("Acesso Negado.");
        await User.findOneAndUpdate({ email: targetEmail }, { role: newRole });
        res.send(`Cargo de ${targetEmail} alterado para ${newRole}`);
    } catch(e) { res.status(401).send("Token inválido."); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Vertex engine running on port ${PORT}`));
