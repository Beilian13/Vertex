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
    nome: String, email: { type: String, unique: true }, senha: String,
    role: { type: String, enum: ['Aluno', 'Professor', 'Direcao', 'Admin'], default: 'Aluno' },
    avatar: String
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
    titulo: String,
    conteudo: String,
    autor: String,
    temEnquete: { type: Boolean, default: false },
    enquete: {
        pergunta: String,
        opcoes: [{ texto: String, votos: { type: Number, default: 0 } }],
        votosUsuarios: [String]
    },
    comentarios: [{ autor: String, texto: String, createdAt: { type: Date, default: Date.now } }],
    createdAt: { type: Date, default: Date.now }
}));

const Noticia = mongoose.model('Noticia', new mongoose.Schema({ titulo: String, autor: String, createdAt: { type: Date, default: Date.now } }));
const Atividade = mongoose.model('Atividade', new mongoose.Schema({ titulo: String, materia: String, dataEntrega: Date, autor: String }));
const Ocorrencia = mongoose.model('Ocorrencia', new mongoose.Schema({ alunoNome: String, descricao: String, tipo: String, status: { type: String, default: 'Em Processo' }, autor: String, createdAt: { type: Date, default: Date.now } }));

// --- MIDDLEWARES ---
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ msg: "Acesso negado" });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch (e) { res.status(401).json({ msg: "Sessão expirada" }); }
};

const authorize = (minRole) => (req, res, next) => {
    const roles = ['Aluno', 'Professor', 'Direcao', 'Admin'];
    if (roles.indexOf(req.user.role) >= roles.indexOf(minRole)) return next();
    res.status(403).json({ msg: "Acesso insuficiente." });
};

// --- ROTAS FÓRUM (THREADS + ENQUETES) ---
app.get('/api/forum', authenticate, async (req, res) => res.json(await Thread.find().sort({createdAt:-1})));

app.post('/api/forum', authenticate, async (req, res) => {
    const { titulo, conteudo, enquete } = req.body;
    const novaThread = { titulo, conteudo, autor: req.user.nome };
    if(enquete) {
        novaThread.temEnquete = true;
        novaThread.enquete = { pergunta: enquete.pergunta, opcoes: enquete.opcoes.map(o => ({ texto: o, votos: 0 })) };
    }
    res.json(await Thread.create(novaThread));
});

app.post('/api/forum/comentar/:id', authenticate, async (req, res) => {
    const thread = await Thread.findById(req.params.id);
    thread.comentarios.push({ autor: req.user.nome, texto: req.body.texto });
    await thread.save();
    res.json(thread);
});

app.post('/api/forum/votar/:id', authenticate, async (req, res) => {
    const thread = await Thread.findById(req.params.id);
    if (thread.enquete.votosUsuarios.includes(req.user.id)) return res.status(400).json({ msg: "Já votou!" });
    thread.enquete.opcoes[req.body.opcaoIndex].votos += 1;
    thread.enquete.votosUsuarios.push(req.user.id);
    await thread.save();
    res.json(thread);
});

// --- OUTRAS ROTAS ---
app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome }, JWT_SECRET);
        res.json({ token, nome: user.nome, role: user.role, avatar: user.avatar });
    } else res.status(401).json({ msg: "Erro!" });
});

app.post('/api/auth/register', async (req, res) => {
    const hashed = await bcrypt.hash(req.body.senha, 10);
    await User.create({ ...req.body, senha: hashed, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.body.nome}` });
    res.status(201).json({ msg: "OK" });
});

app.get('/api/noticias', authenticate, async (req, res) => res.json(await Noticia.find().sort({createdAt:-1})));
app.get('/api/atividades', authenticate, async (req, res) => res.json(await Atividade.find().sort({dataEntrega:1})));
app.get('/api/ocorrencias', authenticate, async (req, res) => {
    const q = ['Direcao', 'Admin'].includes(req.user.role) ? {} : { alunoNome: req.user.nome };
    res.json(await Ocorrencia.find(q).sort({createdAt:-1}));
});

// Admin Reset
app.get('/api/admin/users', authenticate, authorize('Admin'), async (req, res) => res.json(await User.find({}, 'nome email role')));
app.post('/api/admin/reset-password', authenticate, authorize('Admin'), async (req, res) => {
    const hashed = await bcrypt.hash(req.body.novaSenha, 10);
    await User.findByIdAndUpdate(req.body.userId, { senha: hashed });
    res.json({ msg: "OK" });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`VERTEX ONLINE NA PORTA ${PORT}`));
