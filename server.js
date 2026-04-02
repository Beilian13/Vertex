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

mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Vertex Engine: High Performance Active"))
    .catch(err => console.error("❌ DB Error:", err));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    role: { type: String, enum: ['aluno', 'professor', 'direcao', 'admin'], default: 'aluno' },
    turma: String,
    avatar: { type: String, default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vertex' }
}));

const Atividade = mongoose.model('Atividade', new mongoose.Schema({
    titulo: String, materia: String, descricao: String, dataEntrega: Date,
    autor: String, turma: String, createdAt: { type: Date, default: Date.now }
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
    titulo: String, conteudo: String, autor: String, turma: String,
    replies: [{ id: String, autor: String, texto: String, parentId: String, createdAt: { type: Date, default: Date.now } }],
    reported: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}));

const Noticia = mongoose.model('Noticia', new mongoose.Schema({
    titulo: String, autor: String, turma: String, createdAt: { type: Date, default: Date.now }
}));

const Ocorrencia = mongoose.model('Ocorrencia', new mongoose.Schema({
    alunoNome: String,
    descricao: String,
    tipo: { type: String, enum: ['Leve', 'Media', 'Grave', 'Advertencia'], default: 'Leve' },
    autor: String,
    turma: String,
    status: { type: String, enum: ['Pendente', 'Revisado', 'Arquivado'], default: 'Pendente' },
    createdAt: { type: Date, default: Date.now }
}));

const Avaliacao = mongoose.model('Avaliacao', new mongoose.Schema({
    alunoId: mongoose.Schema.Types.ObjectId,
    materia: String,
    nota: Number,
    tipo: String, // ex: AV1, AV2, Simulado
    autor: String,
    createdAt: { type: Date, default: Date.now }
}));

// --- AUTH MIDDLEWARE ---
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

// --- ROUTES ---

// --- ROTA DE REGISTRO (Para novos alunos/professores) ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, role, turma } = req.body;

        // Verifica se o usuário já existe
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ msg: "Email já cadastrado." });

        // Criptografa a senha (Segurança nível Profissional)
        const salt = await bcrypt.genSalt(10);
        const hashedSenha = await bcrypt.hash(senha, salt);

        // Cria o usuário
        const newUser = await User.create({
            nome,
            email,
            senha: hashedSenha,
            role: role || 'aluno',
            turma: turma || '8A', // Padrão 8º ano como você queria
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nome}`
        });

        res.status(201).json({ msg: "Usuário criado com sucesso!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ msg: "Erro ao registrar usuário." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(senha, user.senha)) {
            const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome, turma: user.turma }, process.env.JWT_SECRET);
            res.json({ token, role: user.role, nome: user.nome, turma: user.turma, avatar: user.avatar });
        } else res.status(401).json({ msg: "Credenciais Inválidas" });
    } catch (e) { res.status(500).json({ msg: "Erro" }); }
});

// NOTICIAS (Ex-Mural)
app.get('/api/noticias', authorize(), async (req, res) => res.json(await Noticia.find({ turma: req.user.turma }).sort({ createdAt: -1 })));
app.post('/api/noticias', authorize(['professor', 'direcao', 'admin']), async (req, res) => {
    res.json(await Noticia.create({ titulo: req.body.titulo, autor: req.user.nome, turma: req.user.turma }));
});

// ATIVIDADES (Ex-Tarefas)
app.get('/api/atividades', authorize(), async (req, res) => res.json(await Atividade.find({ turma: req.user.turma }).sort({ dataEntrega: 1 })));
app.post('/api/atividades', authorize(['professor', 'direcao', 'admin']), async (req, res) => {
    res.json(await Atividade.create({ ...req.body, autor: req.user.nome, turma: req.user.turma }));
});

// OCORRENCIAS (The Court System)
app.get('/api/ocorrencias', authorize(['professor', 'direcao', 'admin']), async (req, res) => res.json(await Ocorrencia.find().sort({ createdAt: -1 })));
app.post('/api/ocorrencias', authorize(['professor', 'direcao', 'admin']), async (req, res) => {
    res.json(await Ocorrencia.create({ ...req.body, autor: req.user.nome }));
});
app.patch('/api/ocorrencias/:id', authorize(['direcao', 'admin']), async (req, res) => {
    res.json(await Ocorrencia.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

// AVALIACOES
app.get('/api/avaliacoes/me', authorize(), async (req, res) => res.json(await Avaliacao.find({ alunoId: req.user.id })));
app.post('/api/avaliacoes', authorize(['professor', 'direcao', 'admin']), async (req, res) => {
    res.json(await Avaliacao.create({ ...req.body, autor: req.user.nome }));
});

// FORUM & BULLYING REPORTING
app.post('/api/forum/report/:id', authorize(), async (req, res) => {
    const thread = await Thread.findByIdAndUpdate(req.params.id, { reported: true });
    // Auto-generate occurrence for the author if reported
    await Ocorrencia.create({
        alunoNome: thread.autor,
        descricao: `Reportado por bullying/conduta no Fórum: "${thread.titulo}"`,
        tipo: 'Media',
        autor: 'Sistema Vertex (Report)'
    });
    res.json({ msg: "Reportado para análise" });
});

app.get('/api/forum', authorize(), async (req, res) => res.json(await Thread.find({ turma: req.user.turma }).sort({ createdAt: -1 })));
app.post('/api/forum', authorize(), async (req, res) => res.json(await Thread.create({ ...req.body, autor: req.user.nome, turma: req.user.turma })));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Vertex Live`));
