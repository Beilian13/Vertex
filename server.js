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

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://beilianalvarenga_db_user:Beilian1010@cluster0.hhyotua.mongodb.net/Vertex?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || "beilian_secret_key_123";
const PORT = process.env.PORT || 10000;

mongoose.connect(MONGO_URI, { dbName: 'Vertex' })
    .then(() => console.log("✅ [DATABASE] Vertex Blue Edition Conectada"))
    .catch(err => console.error("❌ [DATABASE] Erro:", err.message));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true },
    senha: String,
    role: { type: String, enum: ['Aluno', 'Professor', 'Direcao', 'Admin'], default: 'Aluno' },
    avatar: String
}));

const Noticia = mongoose.model('Noticia', new mongoose.Schema({
    titulo: String,
    autor: String,
    createdAt: { type: Date, default: Date.now }
}));

const Atividade = mongoose.model('Atividade', new mongoose.Schema({
    titulo: String,
    materia: String,
    dataEntrega: Date,
    autor: String
}));

const Ocorrencia = mongoose.model('Ocorrencia', new mongoose.Schema({
    alunoNome: String,
    descricao: String,
    tipo: { type: String, enum: ['Advertencia', 'Ocorrencia'], default: 'Ocorrencia' },
    status: { type: String, default: 'Em Processo' },
    autor: String,
    createdAt: { type: Date, default: Date.now }
}));

const Enquete = mongoose.model('Enquete', new mongoose.Schema({
    pergunta: String,
    opcoes: [{ texto: String, votos: { type: Number, default: 0 } }],
    votosUsuarios: [String], // IDs de quem já votou
    autor: String,
    createdAt: { type: Date, default: Date.now }
}));

// --- MIDDLEWARES ---
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ msg: "Acesso negado" });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) { res.status(401).json({ msg: "Sessão expirada" }); }
};

const authorize = (minRole) => (req, res, next) => {
    const roles = ['Aluno', 'Professor', 'Direcao', 'Admin'];
    if (roles.indexOf(req.user.role) >= roles.indexOf(minRole)) return next();
    res.status(403).json({ msg: "Acesso insuficiente." });
};

// --- ROTAS ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, role } = req.body;
        const hashed = await bcrypt.hash(senha, 10);
        await User.create({ 
            nome, email, senha: hashed, 
            role: role || 'Aluno',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nome}`
        });
        res.status(201).json({ msg: "Criado!" });
    } catch (e) { res.status(500).json({ msg: "Erro no registro." }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome }, JWT_SECRET);
        res.json({ token, nome: user.nome, role: user.role, avatar: user.avatar });
    } else { res.status(401).json({ msg: "Credenciais inválidas." }); }
});

// Enquetes (Comunicação 2 Lados)
app.get('/api/enquetes', authenticate, async (req, res) => res.json(await Enquete.find().sort({createdAt:-1})));

app.post('/api/enquetes', authenticate, authorize('Professor'), async (req, res) => {
    const { pergunta, opcoes } = req.body;
    const formattedOpcoes = opcoes.map(o => ({ texto: o, votos: 0 }));
    res.json(await Enquete.create({ pergunta, opcoes: formattedOpcoes, autor: req.user.nome }));
});

app.post('/api/enquetes/votar', authenticate, async (req, res) => {
    const { enqueteId, opcaoIndex } = req.body;
    const enquete = await Enquete.findById(enqueteId);
    if (enquete.votosUsuarios.includes(req.user.id)) return res.status(400).json({ msg: "Já votou!" });
    
    enquete.opcoes[opcaoIndex].votos += 1;
    enquete.votosUsuarios.push(req.user.id);
    await enquete.save();
    res.json(enquete);
});

// Outras rotas...
app.get('/api/noticias', authenticate, async (req, res) => res.json(await Noticia.find().sort({createdAt:-1})));
app.post('/api/noticias', authenticate, authorize('Professor'), async (req, res) => {
    res.json(await Noticia.create({ titulo: req.body.titulo, autor: req.user.nome }));
});

app.get('/api/atividades', authenticate, async (req, res) => res.json(await Atividade.find().sort({dataEntrega:1})));
app.post('/api/atividades', authenticate, authorize('Professor'), async (req, res) => {
    res.json(await Atividade.create({ ...req.body, autor: req.user.nome }));
});

app.get('/api/ocorrencias', authenticate, async (req, res) => {
    const query = ['Direcao', 'Admin'].includes(req.user.role) ? {} : { alunoNome: req.user.nome };
    res.json(await Ocorrencia.find(query).sort({createdAt:-1}));
});

app.post('/api/ocorrencias', authenticate, authorize('Direcao'), async (req, res) => {
    res.json(await Ocorrencia.create({ ...req.body, autor: req.user.nome }));
});

// Admin Control
app.get('/api/admin/users', authenticate, authorize('Admin'), async (req, res) => res.json(await User.find({}, 'nome email role')));
app.post('/api/admin/reset-password', authenticate, authorize('Admin'), async (req, res) => {
    const hashed = await bcrypt.hash(req.body.novaSenha, 10);
    await User.findByIdAndUpdate(req.body.userId, { senha: hashed });
    res.json({ msg: "Senha resetada!" });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`VERTEX ONLINE NA PORTA ${PORT}`));
