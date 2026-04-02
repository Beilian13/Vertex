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

// --- CONFIGURAÇÕES DE FUNDADOR ---
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://beilianalvarenga_db_user:Beilian1010@cluster0.hhyotua.mongodb.net/Vertex?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || "beilian_secret_key_123";
const PORT = process.env.PORT || 10000;

// --- CONEXÃO MONGODB ---
mongoose.connect(MONGO_URI, { dbName: 'Vertex' })
    .then(() => console.log("✅ [DATABASE] Vertex Blue Edition Conectada"))
    .catch(err => console.error("❌ [DATABASE] Erro:", err.message));

// --- SCHEMAS (Baseados no seu HTML) ---

const User = mongoose.model('User', new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true },
    senha: String,
    role: { type: String, default: 'aluno' },
    avatar: { type: String, default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vertex' }
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
    createdAt: { type: Date, default: Date.now }
}));

const Forum = mongoose.model('Forum', new mongoose.Schema({
    titulo: String,
    autor: String,
    reportado: { type: Boolean, default: false }
}));

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ msg: "Acesso negado" });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) { res.status(401).json({ msg: "Sessão expirada" }); }
};

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, role } = req.body;
        const hashed = await bcrypt.hash(senha, 10);
        const user = await User.create({ 
            nome, 
            email, 
            senha: hashed, 
            role: role || 'aluno',
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
    } else {
        res.status(401).json({ msg: "E-mail ou senha incorretos." });
    }
});

// --- ROTAS DO APP (Sincronizadas com seu JS) ---

app.get('/api/noticias', authenticate, async (req, res) => {
    res.json(await Noticia.find().sort({ createdAt: -1 }));
});

app.get('/api/atividades', authenticate, async (req, res) => {
    res.json(await Atividade.find().sort({ dataEntrega: 1 }));
});

app.get('/api/ocorrencias', authenticate, async (req, res) => {
    // Se for admin, vê tudo. Se for aluno, só as dele.
    const query = req.user.role === 'admin' ? {} : { alunoNome: req.user.nome };
    res.json(await Ocorrencia.find(query).sort({ createdAt: -1 }));
});

app.get('/api/forum', authenticate, async (req, res) => {
    res.json(await Forum.find({ reportado: false }));
});

app.post('/api/forum/report/:id', authenticate, async (req, res) => {
    try {
        const post = await Forum.findByIdAndUpdate(req.params.id, { reportado: true });
        // Lógica de "Justiça Automática"
        await Ocorrencia.create({
            alunoNome: post.autor,
            descricao: `Conteúdo impróprio reportado no fórum: "${post.titulo}"`,
            tipo: 'Advertencia',
            status: 'Análise de Bullying'
        });
        res.json({ msg: "Reportado com sucesso" });
    } catch (e) { res.status(500).json({ msg: "Erro ao reportar" }); }
});

// --- SERVIR O FRONTEND ---
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n-----------------------------------------`);
    console.log(`   VERTEX BLUE EDITION - ONLINE          `);
    console.log(`   PORTA: ${PORT}                        `);
    console.log(`-----------------------------------------\n`);
});
