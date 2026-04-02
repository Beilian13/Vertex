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

// --- CONFIGURAÇÕES ---
// Se as variáveis de ambiente do Render falharem, ele usa as suas fixas como fallback
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://beilianalvarenga_db_user:Beilian1010@cluster0.hhyotua.mongodb.net/Vertex?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || "beilian_secret_key_123";
const PORT = process.env.PORT || 10000;

// --- CONEXÃO MONGODB ---
// O parâmetro dbName: 'Vertex' garante que ele crie o banco se não existir
mongoose.connect(MONGO_URI, { dbName: 'Vertex' })
    .then(() => console.log("✅ [DATABASE] Conectado ao cluster do Beilian - Banco: Vertex"))
    .catch(err => console.error("❌ [DATABASE] Erro de conexão:", err.message));

// --- SCHEMAS (Coleções que serão criadas automaticamente) ---

const User = mongoose.model('User', new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    role: { type: String, default: 'admin' }, // Primeiro usuário como admin para teste
    avatar: { type: String, default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vertex' }
}));

const Noticia = mongoose.model('Noticia', new mongoose.Schema({
    titulo: String,
    autor: String,
    createdAt: { type: Date, default: Date.now }
}));

const AiRequest = mongoose.model('AiRequest', new mongoose.Schema({
    alunoNome: String,
    pergunta: String,
    resposta: { type: String, default: "" },
    status: { type: String, default: 'pendente' }
}));

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ msg: "Acesso negado. Faça login." });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) { res.status(401).json({ msg: "Token inválido ou expirado." }); }
};

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ msg: "Este email já está registrado." });

        const salt = await bcrypt.genSalt(10);
        const hashedSenha = await bcrypt.hash(senha, salt);

        const newUser = await User.create({
            nome,
            email,
            senha: hashedSenha,
            role: 'admin' // Definindo como admin para você ter controle total
        });

        console.log(`🚀 [REGISTER] Usuário criado: ${email}`);
        res.status(201).json({ msg: "Conta criada com sucesso!" });
    } catch (e) {
        console.error("❌ [REGISTER ERROR]:", e.message);
        res.status(500).json({ msg: "Erro interno no servidor.", erro: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(401).json({ msg: "Usuário não encontrado." });

        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) return res.status(401).json({ msg: "Senha incorreta." });

        const token = jwt.sign({ id: user._id, role: user.role, nome: user.nome }, JWT_SECRET, { expiresIn: '7d' });
        
        console.log(`🔑 [LOGIN] ${user.nome} entrou no sistema.`);
        res.json({ token, nome: user.nome, role: user.role, avatar: user.avatar });
    } catch (e) {
        res.status(500).json({ msg: "Erro ao processar login." });
    }
});

// --- ROTAS DE FUNCIONALIDADES ---

app.get('/api/noticias', authenticate, async (req, res) => {
    const news = await Noticia.find().sort({ createdAt: -1 });
    res.json(news);
});

app.post('/api/ai/ask', authenticate, async (req, res) => {
    const request = await AiRequest.create({ alunoNome: req.user.nome, pergunta: req.body.prompt });
    res.json(request);
});

// --- SERVIR FRONTEND ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=========================================`);
    console.log(`   VERTEX SYSTEM v2.0 - FOUNDER EDITION  `);
    console.log(`   STATUS: ONLINE                        `);
    console.log(`   PORTA: ${PORT}                        `);
    console.log(`=========================================\n`);
});
