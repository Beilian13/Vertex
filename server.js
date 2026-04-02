const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 10000;

// --- CONEXÃO COM MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🚀 Vertex Engine: Banco de Dados Ativo"))
    .catch(err => console.error("❌ Erro no MongoDB:", err));

// --- SCHEMAS (Modelagem de Dados) ---

const UserSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    role: { type: String, enum: ['aluno', 'professor', 'direcao', 'admin'], default: 'aluno' },
    turma: { type: String, default: '8A' },
    avatar: { type: String, default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vertex' }
});
const User = mongoose.model('User', UserSchema);

const Atividade = mongoose.model('Atividade', new mongoose.Schema({
    titulo: String, materia: String, dataEntrega: Date,
    autor: String, turma: String
}));

const Ocorrencia = mongoose.model('Ocorrencia', new mongoose.Schema({
    alunoNome: String, descricao: String,
    tipo: { type: String, enum: ['Leve', 'Media', 'Grave', 'Advertencia'] },
    autor: String, status: { type: String, default: 'Em Julgamento' },
    createdAt: { type: Date, default: Date.now }
}));

const Noticia = mongoose.model('Noticia', new mongoose.Schema({
    titulo: String, autor: String, createdAt: { type: Date, default: Date.now }
}));

const Forum = mongoose.model('Forum', new mongoose.Schema({
    titulo: String, autor: String, reportado: { type: Boolean, default: false }
}));

const AiRequest = mongoose.model('AiRequest', new mongoose.Schema({
    alunoNome: String, pergunta: String, resposta: String,
    status: { type: String, default: 'pendente' }
}));

// --- MIDDLEWARE DE PROTEÇÃO ---
const authorize = (roles = []) => (req, res, next) => {
    try {
        const token = req.headers.authorization;
        if (!token) return res.status(401).json({ msg: "Acesso negado" });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (roles.length && !roles.includes(decoded.role)) return res.status(403).json({ msg: "Sem permissão" });
        req.user = decoded;
        next();
    } catch (e) { res.status(401).json({ msg: "Sessão inválida" }); }
};

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, role } = req.body;
        const hashed = await bcrypt.hash(senha, 10);
        const user = await User.create({ nome, email, senha: hashed, role: role || 'aluno' });
        res.status(201).json({ msg: "Usuário criado!" });
    } catch (e) { res.status(500).json({ msg: "Erro no registro. Email já existe?" }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(senha, user.senha)) {
            const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome }, process.env.JWT_SECRET);
            res.json({ token, role: user.role, nome: user.nome, avatar: user.avatar });
        } else res.status(401).json({ msg: "Credenciais inválidas" });
    } catch (e) { res.status(500).json({ msg: "Erro no servidor" }); }
});

// --- ROTAS DO SISTEMA ---

// Notícias
app.get('/api/noticias', authorize(), async (req, res) => res.json(await Noticia.find().sort({ createdAt: -1 })));
app.post('/api/noticias', authorize(['professor', 'direcao', 'admin']), async (req, res) => {
    res.json(await Noticia.create({ titulo: req.body.titulo, autor: req.user.nome }));
});

// Atividades
app.get('/api/atividades', authorize(), async (req, res) => res.json(await Atividade.find()));
app.post('/api/atividades', authorize(['professor', 'direcao', 'admin']), async (req, res) => {
    res.json(await Atividade.create({ ...req.body, autor: req.user.nome }));
});

// Ocorrências (Justiça)
app.get('/api/ocorrencias', authorize(), async (req, res) => {
    if (req.user.role === 'aluno') return res.json(await Ocorrencia.find({ alunoNome: req.user.nome }));
    res.json(await Ocorrencia.find());
});
app.post('/api/ocorrencias', authorize(['professor', 'direcao', 'admin']), async (req, res) => {
    res.json(await Ocorrencia.create({ ...req.body, autor: req.user.nome }));
});

// Fórum & Report de Bullying
app.get('/api/forum', authorize(), async (req, res) => res.json(await Forum.find({ reportado: false })));
app.post('/api/forum', authorize(), async (req, res) => {
    res.json(await Forum.create({ titulo: req.body.titulo, autor: req.user.nome }));
});
app.post('/api/forum/report/:id', authorize(), async (req, res) => {
    await Forum.findByIdAndUpdate(req.params.id, { reportado: true });
    // Gera ocorrência automática
    await Ocorrencia.create({ 
        alunoNome: "Sistema", 
        descricao: `Post ID ${req.params.id} reportado por Bullying.`, 
        tipo: 'Grave', autor: 'Vertex Guard' 
    });
    res.json({ msg: "Reportado" });
});

// --- VERTEX AI (Buffer de Treinamento) ---

app.post('/api/ai/ask', authorize(), async (req, res) => {
    const q = await AiRequest.create({ alunoNome: req.user.nome, pergunta: req.body.prompt });
    res.json(q);
});

app.get('/api/ai/my-answers', authorize(), async (req, res) => {
    res.json(await AiRequest.find({ alunoNome: req.user.nome, status: 'respondido' }));
});

app.get('/api/ai/pending', authorize(['admin']), async (req, res) => {
    res.json(await AiRequest.find({ status: 'pendente' }));
});

app.post('/api/ai/answer', authorize(['admin']), async (req, res) => {
    const { id, resposta } = req.body;
    await AiRequest.findByIdAndUpdate(id, { resposta, status: 'respondido' });
    res.json({ msg: "Respondido" });
});

// --- INICIALIZAÇÃO ---
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------`);
    console.log(`   VERTEX SYSTEM v2.0 - Founder Edition  `);
    console.log(`   Status: ONLINE na porta ${PORT}       `);
    console.log(`-----------------------------------------`);
});
