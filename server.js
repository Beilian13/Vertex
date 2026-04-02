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

// --- CONFIG & DB ---
const PORT = process.env.PORT || 10000; // Render prefers 10000
const MONGO_URI = process.env.MONGO_URI ? process.env.MONGO_URI.replace(/['"]+/g, '').trim() : null;

if (!MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI is not defined in environment variables!");
}

// Connect with options to prevent hanging (fixes 502)
mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000, 
    socketTimeoutMS: 45000,
})
.then(() => console.log("🚀 Vertex Engine: Core Active"))
.catch(err => console.error("❌ Critical Connection Failure:", err));

// --- DATA ARCHITECTURE ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    role: { type: String, enum: ['aluno', 'professor', 'direcao'], default: 'aluno' },
    turma: String,
    avatar: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    grades: [{ materia: String, av1: Number, av2: Number }],
    lastLogin: { type: Date, default: Date.now }
}));

const Homework = mongoose.model('Homework', new mongoose.Schema({
    titulo: String, materia: String, descricao: String, dataEntrega: Date,
    autor: String, turma: String, status: { type: String, default: 'Ativo' },
    createdAt: { type: Date, default: Date.now }
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
    titulo: String, conteudo: String, autor: String, turma: String,
    replies: [{ 
        id: String, autor: String, texto: String, 
        parentId: { type: String, default: null }, 
        createdAt: { type: Date, default: Date.now } 
    }],
    createdAt: { type: Date, default: Date.now }
}));

const Mural = mongoose.model('Mural', new mongoose.Schema({
    titulo: String, autor: String, turma: String, createdAt: { type: Date, default: Date.now }
}));

// --- SECURITY (Fixed for 403 Errors) ---
const authorize = (roles = []) => (req, res, next) => {
    try {
        let token = req.headers.authorization;
        if (!token) return res.status(401).json({ msg: "No token provided" });

        // Strip "Bearer " prefix if present
        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (roles.length && !roles.includes(decoded.role)) {
            return res.status(403).json({ msg: "Acesso Negado: Permissão insuficiente" });
        }
        
        req.user = decoded;
        next();
    } catch (e) { 
        console.error("Auth Error:", e.message);
        res.status(401).json({ msg: "Token Inválido ou Expirado" }); 
    }
};

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha, turma } = req.body;
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ msg: "Email já cadastrado" });

        const hashed = await bcrypt.hash(senha, 10);
        await User.create({ nome, email, senha: hashed, turma });
        res.status(201).json({ msg: "Sucesso" });
    } catch (e) { 
        res.status(500).json({ msg: "Erro no servidor durante registro" }); 
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        // 1. Safety Check for JWT
        if (!process.env.JWT_SECRET) {
            console.error("❌ LOGIN ERROR: JWT_SECRET is missing from Environment Variables!");
            return res.status(500).json({ msg: "Server configuration error" });
        }

        // 2. Find User
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ msg: "Usuário não encontrado" });
        }

        // 3. Compare Password
        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            return res.status(401).json({ msg: "Senha incorreta" });
        }

        // 4. Generate Token
        const token = jwt.sign(
            { id: user._id, role: user.role, nome: user.nome, turma: user.turma }, 
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // 5. Update last login
        user.lastLogin = Date.now(); 
        await user.save();
        
        res.json({ 
            token, 
            role: user.role, 
            nome: user.nome, 
            turma: user.turma, 
            avatar: user.avatar 
        });

    } catch (e) {
        console.error("❌ CRITICAL LOGIN CRASH:", e);
        res.status(500).json({ msg: "Erro interno no processamento do login" });
    }
});

// --- CORE ---
app.get('/api/mural', authorize(), async (req, res) => {
    const posts = await Mural.find({ turma: req.user.turma }).sort({ createdAt: -1 });
    res.json(posts);
});

app.post('/api/mural', authorize(['professor', 'direcao']), async (req, res) => {
    const post = await Mural.create({ titulo: req.body.titulo, autor: req.user.nome, turma: req.user.turma });
    res.json(post);
});

app.get('/api/homeworks', authorize(), async (req, res) => {
    const hws = await Homework.find({ turma: req.user.turma }).sort({ dataEntrega: 1 });
    res.json(hws);
});

app.post('/api/homeworks', authorize(['professor', 'direcao']), async (req, res) => {
    const hw = await Homework.create({ ...req.body, autor: req.user.nome, turma: req.user.turma });
    res.json(hw);
});

app.get('/api/forum', authorize(), async (req, res) => {
    const threads = await Thread.find({ turma: req.user.turma }).sort({ createdAt: -1 });
    res.json(threads);
});

app.get('/api/forum/:id', authorize(), async (req, res) => {
    const thread = await Thread.findById(req.params.id);
    res.json(thread);
});

app.post('/api/forum', authorize(), async (req, res) => {
    const thread = await Thread.create({ ...req.body, autor: req.user.nome, turma: req.user.turma });
    res.json(thread);
});

app.post('/api/forum/reply', authorize(), async (req, res) => {
    const reply = { 
        id: new mongoose.Types.ObjectId().toString(), 
        autor: req.user.nome, 
        texto: req.body.texto, 
        parentId: req.body.parentId,
        createdAt: new Date()
    };
    await Thread.findByIdAndUpdate(req.body.threadId, { $push: { replies: reply } });
    res.json(reply);
});

app.get('/api/direcao/users', authorize(['direcao']), async (req, res) => {
    const users = await User.find({}, '-senha').sort({ role: 1 });
    res.json(users);
});

app.get('/api/me/grades', authorize(), async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json(user.grades || []);
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Listen on 0.0.0.0 is mandatory for Render
app.listen(PORT, '0.0.0.0', () => console.log(`Vertex Live on port ${PORT}`));
