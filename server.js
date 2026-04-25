const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ==================== SECURITY MIDDLEWARE ====================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.static(__dirname));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://beilianalvarenga_db_user:Beilian1010@cluster0.hhyotua.mongodb.net/Vertex?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || "beilian_secret_key_super_secure_123456789";
const PORT = process.env.PORT || 10000;

mongoose.connect(MONGO_URI, { dbName: 'Vertex' })
    .then(() => {
        console.log("✅ [DATABASE] Conectado");
        initializeDefaultData();
    })
    .catch(err => console.error("❌ [DATABASE] Erro:", err.message));

// ==================== SCHEMAS ====================
const UserSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senha: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['Aluno', 'Professor', 'Direcao', 'Admin'], 
        default: 'Aluno'
    },
    avatar: { type: String, default: '' },
    bio: { type: String, maxlength: 500, default: '' },
    bannerColor: { type: String, default: '#3b82f6' },
    serie: String,
    amigos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    bloqueados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    solicitacoesAmizade: [{
        de: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dataEnvio: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now }
});

const MateriaSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    series: [String],
    professor: String,
    cor: { type: String, default: '#3b82f6' },
    createdAt: { type: Date, default: Date.now }
});

const ThreadSchema = new mongoose.Schema({
    titulo: { type: String, required: true, maxlength: 200 },
    conteudo: { type: String, required: true, maxlength: 5000 },
    autor: { type: String, required: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    temEnquete: { type: Boolean, default: false },
    enquete: {
        pergunta: String,
        opcoes: [{ texto: String, votos: { type: Number, default: 0 } }],
        votosUsuarios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    comentarios: [{
        autor: String,
        autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        texto: { type: String, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now }
    }],
    visualizacoes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const NoticiaSchema = new mongoose.Schema({
    titulo: { type: String, required: true, maxlength: 200 },
    conteudo: { type: String, maxlength: 5000 },
    autor: { type: String, required: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    imagem: String,
    prioridade: { type: String, enum: ['Normal', 'Importante', 'Urgente'], default: 'Normal' },
    createdAt: { type: Date, default: Date.now }
});

const AtividadeSchema = new mongoose.Schema({
    titulo: { type: String, required: true, maxlength: 200 },
    descricao: { type: String, maxlength: 2000 },
    materia: { type: String, required: true },
    dataEntrega: { type: Date, required: true },
    autor: { type: String, required: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    anexos: [String],
    entregas: [{
        alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        arquivo: String,
        dataEntrega: { type: Date, default: Date.now },
        nota: Number,
        feedback: String
    }],
    createdAt: { type: Date, default: Date.now }
});

const OcorrenciaSchema = new mongoose.Schema({
    alunoNome: { type: String, required: true },
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    descricao: { type: String, required: true, maxlength: 1000 },
    tipo: { 
        type: String, 
        enum: ['Advertência', 'Suspensão', 'Elogio', 'Observação'], 
        required: true 
    },
    autor: { type: String, required: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resolvido: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const NotaSchema = new mongoose.Schema({
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materia: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', required: true },
    bimestre: { type: Number, min: 1, max: 4, required: true },
    tipo: { type: String, enum: ['AV1', 'AV2', 'P1'], required: true },
    nota: { type: Number, min: 0, max: 10, required: true },
    professorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const PresencaSchema = new mongoose.Schema({
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materia: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', required: true },
    data: { type: Date, required: true },
    status: { type: String, enum: ['P', 'F'], required: true },
    professorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const ArtigoSchema = new mongoose.Schema({
    titulo: { type: String, required: true, maxlength: 200 },
    conteudo: { type: String, required: true, maxlength: 10000 },
    autor: { type: String, required: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    videoUrl: String,
    exercicio: {
        pergunta: String,
        opcoes: [String],
        respostaCorreta: Number
    },
    visualizacoes: { type: Number, default: 0 },
    curtidas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const TesteSchema = new mongoose.Schema({
    titulo: { type: String, required: true, maxlength: 200 },
    materia: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', required: true },
    bimestre: { type: Number, min: 1, max: 4, required: true },
    professor: { type: String, required: true },
    professorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questoes: [{
        pergunta: { type: String, required: true },
        opcoes: [String],
        respostaCorreta: Number
    }],
    tempoLimite: Number, // minutos
    ativo: { type: Boolean, default: true },
    dataInicio: Date,
    dataFim: Date,
    createdAt: { type: Date, default: Date.now }
});

const RespostaTesteSchema = new mongoose.Schema({
    testeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teste', required: true },
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    respostas: [Number],
    nota: Number,
    tempo: Number, // segundos gastos
    createdAt: { type: Date, default: Date.now }
});

// ==================== MODELS ====================
const User = mongoose.model('User', UserSchema);
const Materia = mongoose.model('Materia', MateriaSchema);
const Thread = mongoose.model('Thread', ThreadSchema);
const Noticia = mongoose.model('Noticia', NoticiaSchema);
const Atividade = mongoose.model('Atividade', AtividadeSchema);
const Ocorrencia = mongoose.model('Ocorrencia', OcorrenciaSchema);
const Nota = mongoose.model('Nota', NotaSchema);
const Presenca = mongoose.model('Presenca', PresencaSchema);
const Artigo = mongoose.model('Artigo', ArtigoSchema);
const Teste = mongoose.model('Teste', TesteSchema);
const RespostaTeste = mongoose.model('RespostaTeste', RespostaTesteSchema);

// ==================== INIT DEFAULT DATA ====================
async function initializeDefaultData() {
    try {
        const count = await Materia.countDocuments();
        if (count === 0) {
            const materias = [
                { nome: 'Polivalente', series: ['1', '2', '3', '4', '5'], cor: '#f59e0b' },
                { nome: 'Matemática', series: ['6', '7', '8', '9', '1EM', '2EM', '3EM'], cor: '#ef4444' },
                { nome: 'Português', series: ['6', '7', '8', '9', '1EM', '2EM', '3EM'], cor: '#3b82f6' },
                { nome: 'Inglês', series: ['6', '7', '8', '9', '1EM', '2EM', '3EM'], cor: '#8b5cf6' },
                { nome: 'Ciências', series: ['6', '7', '8', '9'], cor: '#10b981' },
                { nome: 'História', series: ['6', '7', '8', '9', '1EM', '2EM', '3EM'], cor: '#f97316' },
                { nome: 'Geografia', series: ['6', '7', '8', '9', '1EM', '2EM', '3EM'], cor: '#06b6d4' },
                { nome: 'Arte', series: ['6', '7', '8', '9', '1EM', '2EM', '3EM'], cor: '#ec4899' },
                { nome: 'Educação Física', series: ['6', '7', '8', '9', '1EM', '2EM', '3EM'], cor: '#84cc16' },
                { nome: 'Física', series: ['1EM', '2EM', '3EM'], cor: '#6366f1' },
                { nome: 'Química', series: ['1EM', '2EM', '3EM'], cor: '#14b8a6' },
                { nome: 'Biologia', series: ['1EM', '2EM', '3EM'], cor: '#22c55e' },
                { nome: 'Filosofia', series: ['1EM', '2EM', '3EM'], cor: '#a855f7' },
                { nome: 'Sociologia', series: ['1EM', '2EM', '3EM'], cor: '#f43f5e' },
                { nome: 'Redação', series: ['1EM', '2EM', '3EM'], cor: '#0ea5e9' }
            ];
            
            await Materia.insertMany(materias);
            console.log("✅ Matérias padrão criadas");
        }
    } catch (error) {
        console.error("Erro ao criar matérias:", error);
    }
}

// ==================== SECURITY MIDDLEWARE ====================
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        if (!token) return res.status(401).json({ msg: "Token não fornecido" });
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // CRITICAL: Buscar usuário do banco para verificar role REAL
        const user = await User.findById(decoded.id).select('_id nome email role');
        if (!user) return res.status(401).json({ msg: "Usuário não encontrado" });
        
        // Usar role do BANCO, não do token
        req.user = {
            id: user._id.toString(),
            nome: user.nome,
            email: user.email,
            role: user.role // ROLE DO BANCO, NÃO DO TOKEN!
        };
        
        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ msg: "Token inválido" });
    }
};

const authorize = (minRole) => (req, res, next) => {
    const roles = ['Aluno', 'Professor', 'Direcao', 'Admin'];
    const userRoleIndex = roles.indexOf(req.user.role);
    const minRoleIndex = roles.indexOf(minRole);
    
    if (userRoleIndex >= minRoleIndex) return next();
    
    console.warn(`⚠️ Tentativa de acesso não autorizado: ${req.user.email} (${req.user.role}) tentou acessar rota ${minRole}`);
    return res.status(403).json({ msg: "Permissão insuficiente" });
};

// Validação de input
const sanitize = (str) => {
    if (!str) return '';
    return str.toString().trim().substring(0, 5000);
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        
        if (!nome || !email || !senha) {
            return res.status(400).json({ msg: "Preencha todos os campos" });
        }
        
        if (senha.length < 6) {
            return res.status(400).json({ msg: "Senha deve ter no mínimo 6 caracteres" });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ msg: "Email inválido" });
        }
        
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ msg: "Email já cadastrado" });
        }
        
        const hashedPassword = await bcrypt.hash(senha, 12);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nome)}`;
        
        await User.create({
            nome: sanitize(nome),
            email: email.toLowerCase().trim(),
            senha: hashedPassword,
            avatar
        });
        
        res.status(201).json({ msg: "Usuário criado com sucesso" });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ msg: "Erro ao registrar" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        if (!email || !senha) {
            return res.status(400).json({ msg: "Preencha todos os campos" });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ msg: "Credenciais inválidas" });
        }
        
        const isValid = await bcrypt.compare(senha, user.senha);
        if (!isValid) {
            return res.status(401).json({ msg: "Credenciais inválidas" });
        }
        
        // Atualizar último login
        user.lastLogin = new Date();
        await user.save();
        
        // Token SEM role (role vem sempre do banco)
        const token = jwt.sign(
            { id: user._id.toString() },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            token,
            user: {
                id: user._id,
                nome: user.nome,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                bio: user.bio,
                bannerColor: user.bannerColor
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ msg: "Erro ao fazer login" });
    }
});

// Verificar token e retornar dados atualizados
app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-senha');
        if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
        
        res.json({
            user: {
                id: user._id,
                nome: user.nome,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                bio: user.bio,
                bannerColor: user.bannerColor
            }
        });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar usuário" });
    }
});

// ==================== USER PROFILE ====================
app.get('/api/users/:id', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('nome email role avatar bio bannerColor serie createdAt')
            .populate('amigos', 'nome avatar');
        
        if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
        
        // Verificar se está bloqueado
        const currentUser = await User.findById(req.user.id);
        if (currentUser.bloqueados.includes(user._id)) {
            return res.status(403).json({ msg: "Usuário bloqueado" });
        }
        
        const isAmigo = currentUser.amigos.includes(user._id);
        const temSolicitacao = user.solicitacoesAmizade.some(s => s.de.toString() === req.user.id);
        
        res.json({
            user,
            isAmigo,
            temSolicitacao,
            isBloqueado: user.bloqueados.includes(currentUser._id)
        });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar perfil" });
    }
});

app.put('/api/users/profile', authenticate, async (req, res) => {
    try {
        const { bio, bannerColor, avatar } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: "Usuário não encontrado" });
        
        if (bio !== undefined) user.bio = sanitize(bio).substring(0, 500);
        if (bannerColor) user.bannerColor = bannerColor;
        if (avatar) user.avatar = avatar;
        
        await user.save();
        
        res.json({
            user: {
                id: user._id,
                nome: user.nome,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                bio: user.bio,
                bannerColor: user.bannerColor
            }
        });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao atualizar perfil" });
    }
});

// ==================== AMIZADES ====================
app.post('/api/users/:id/friend-request', authenticate, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user.id);
        
        if (!targetUser) return res.status(404).json({ msg: "Usuário não encontrado" });
        
        // Verificar se já são amigos
        if (currentUser.amigos.includes(targetUser._id)) {
            return res.status(400).json({ msg: "Já são amigos" });
        }
        
        // Verificar se já tem solicitação
        const jaTemSolicitacao = targetUser.solicitacoesAmizade.some(
            s => s.de.toString() === req.user.id
        );
        
        if (jaTemSolicitacao) {
            return res.status(400).json({ msg: "Solicitação já enviada" });
        }
        
        targetUser.solicitacoesAmizade.push({ de: req.user.id });
        await targetUser.save();
        
        res.json({ msg: "Solicitação enviada" });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao enviar solicitação" });
    }
});

app.post('/api/users/friend-requests/:id/accept', authenticate, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);
        const otherUser = await User.findById(req.params.id);
        
        if (!otherUser) return res.status(404).json({ msg: "Usuário não encontrado" });
        
        // Remover solicitação
        currentUser.solicitacoesAmizade = currentUser.solicitacoesAmizade.filter(
            s => s.de.toString() !== req.params.id
        );
        
        // Adicionar como amigos
        if (!currentUser.amigos.includes(otherUser._id)) {
            currentUser.amigos.push(otherUser._id);
        }
        if (!otherUser.amigos.includes(currentUser._id)) {
            otherUser.amigos.push(currentUser._id);
        }
        
        await currentUser.save();
        await otherUser.save();
        
        res.json({ msg: "Amizade aceita" });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao aceitar amizade" });
    }
});

app.post('/api/users/:id/block', authenticate, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);
        
        if (!currentUser.bloqueados.includes(req.params.id)) {
            currentUser.bloqueados.push(req.params.id);
        }
        
        // Remover amizade se existir
        currentUser.amigos = currentUser.amigos.filter(
            a => a.toString() !== req.params.id
        );
        
        await currentUser.save();
        
        res.json({ msg: "Usuário bloqueado" });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao bloquear usuário" });
    }
});

app.get('/api/users/friend-requests', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('solicitacoesAmizade.de', 'nome avatar');
        
        res.json(user.solicitacoesAmizade);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar solicitações" });
    }
});

// ==================== MATERIAS ====================
app.get('/api/materias', authenticate, async (req, res) => {
    try {
        const materias = await Materia.find();
        res.json(materias);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar matérias" });
    }
});

// ==================== FORUM ====================
app.get('/api/forum', authenticate, async (req, res) => {
    try {
        const threads = await Thread.find()
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(threads);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar fórum" });
    }
});

app.post('/api/forum', authenticate, async (req, res) => {
    try {
        const { titulo, conteudo, enquete } = req.body;
        
        if (!titulo || !conteudo) {
            return res.status(400).json({ msg: "Campos obrigatórios" });
        }
        
        const threadData = {
            titulo: sanitize(titulo).substring(0, 200),
            conteudo: sanitize(conteudo),
            autor: req.user.nome,
            autorId: req.user.id
        };
        
        if (enquete && enquete.pergunta && enquete.opcoes) {
            threadData.temEnquete = true;
            threadData.enquete = {
                pergunta: sanitize(enquete.pergunta),
                opcoes: enquete.opcoes.map(o => ({ 
                    texto: sanitize(o).substring(0, 100), 
                    votos: 0 
                })),
                votosUsuarios: []
            };
        }
        
        const thread = await Thread.create(threadData);
        res.status(201).json(thread);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao criar thread" });
    }
});

app.post('/api/forum/comentar/:id', authenticate, async (req, res) => {
    try {
        const { texto } = req.body;
        
        if (!texto) {
            return res.status(400).json({ msg: "Texto obrigatório" });
        }
        
        const thread = await Thread.findById(req.params.id);
        if (!thread) return res.status(404).json({ msg: "Thread não encontrada" });
        
        thread.comentarios.push({
            autor: req.user.nome,
            autorId: req.user.id,
            texto: sanitize(texto).substring(0, 1000)
        });
        
        await thread.save();
        res.json(thread);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao comentar" });
    }
});

app.post('/api/forum/votar/:id', authenticate, async (req, res) => {
    try {
        const { opcaoIndex } = req.body;
        const thread = await Thread.findById(req.params.id);
        
        if (!thread || !thread.temEnquete) {
            return res.status(404).json({ msg: "Enquete não encontrada" });
        }
        
        if (!thread.enquete.votosUsuarios) thread.enquete.votosUsuarios = [];
        
        // Verificar se já votou
        const jaVotou = thread.enquete.votosUsuarios.some(
            id => id.toString() === req.user.id
        );
        
        if (jaVotou) {
            return res.status(400).json({ msg: "Você já votou" });
        }
        
        if (opcaoIndex < 0 || opcaoIndex >= thread.enquete.opcoes.length) {
            return res.status(400).json({ msg: "Opção inválida" });
        }
        
        thread.enquete.opcoes[opcaoIndex].votos += 1;
        thread.enquete.votosUsuarios.push(req.user.id);
        
        await thread.save();
        res.json(thread);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao votar" });
    }
});

// ==================== NOTICIAS ====================
app.get('/api/noticias', authenticate, async (req, res) => {
    try {
        const noticias = await Noticia.find()
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(noticias);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar notícias" });
    }
});

app.post('/api/noticias', authenticate, authorize('Direcao'), async (req, res) => {
    try {
        const { titulo, conteudo, prioridade } = req.body;
        
        if (!titulo) {
            return res.status(400).json({ msg: "Título obrigatório" });
        }
        
        const noticia = await Noticia.create({
            titulo: sanitize(titulo).substring(0, 200),
            conteudo: sanitize(conteudo),
            autor: req.user.nome,
            autorId: req.user.id,
            prioridade: prioridade || 'Normal'
        });
        
        res.status(201).json(noticia);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao criar notícia" });
    }
});

// ==================== ATIVIDADES ====================
app.get('/api/atividades', authenticate, async (req, res) => {
    try {
        const atividades = await Atividade.find()
            .sort({ dataEntrega: 1 })
            .limit(100);
        res.json(atividades);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar atividades" });
    }
});

app.post('/api/atividades', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { materia, titulo, descricao, dataEntrega } = req.body;
        
        if (!materia || !titulo || !dataEntrega) {
            return res.status(400).json({ msg: "Campos obrigatórios" });
        }
        
        const atividade = await Atividade.create({
            materia,
            titulo: sanitize(titulo).substring(0, 200),
            descricao: sanitize(descricao),
            dataEntrega,
            autor: req.user.nome,
            autorId: req.user.id
        });
        
        res.status(201).json(atividade);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao criar atividade" });
    }
});

// ==================== OCORRENCIAS ====================
app.get('/api/ocorrencias', authenticate, async (req, res) => {
    try {
        let query = {};
        
        if (req.user.role === 'Aluno') {
            query.alunoNome = req.user.nome;
        }
        
        const ocorrencias = await Ocorrencia.find(query)
            .sort({ createdAt: -1 })
            .limit(100);
        
        res.json(ocorrencias);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar ocorrências" });
    }
});

app.post('/api/ocorrencias', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { alunoNome, tipo, descricao } = req.body;
        
        if (!alunoNome || !tipo || !descricao) {
            return res.status(400).json({ msg: "Campos obrigatórios" });
        }
        
        const ocorrencia = await Ocorrencia.create({
            alunoNome: sanitize(alunoNome),
            tipo,
            descricao: sanitize(descricao).substring(0, 1000),
            autor: req.user.nome,
            autorId: req.user.id
        });
        
        res.status(201).json(ocorrencia);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao criar ocorrência" });
    }
});

// ==================== NOTAS ====================
app.get('/api/notas', authenticate, async (req, res) => {
    try {
        const { materia, bimestre } = req.query;
        let query = {};
        
        if (materia) query.materia = materia;
        if (bimestre) query.bimestre = parseInt(bimestre);
        if (req.user.role === 'Aluno') query.alunoId = req.user.id;
        
        const notas = await Nota.find(query);
        res.json(notas);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar notas" });
    }
});

app.post('/api/notas', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { alunoId, materia, bimestre, tipo, nota } = req.body;
        
        if (!alunoId || !materia || !bimestre || !tipo || nota === undefined) {
            return res.status(400).json({ msg: "Campos obrigatórios" });
        }
        
        if (nota < 0 || nota > 10) {
            return res.status(400).json({ msg: "Nota deve estar entre 0 e 10" });
        }
        
        const existing = await Nota.findOne({ alunoId, materia, bimestre, tipo });
        
        if (existing) {
            existing.nota = nota;
            existing.professorId = req.user.id;
            await existing.save();
            res.json(existing);
        } else {
            const newNota = await Nota.create({
                alunoId,
                materia,
                bimestre,
                tipo,
                nota,
                professorId: req.user.id
            });
            res.status(201).json(newNota);
        }
    } catch (error) {
        res.status(500).json({ msg: "Erro ao salvar nota" });
    }
});

// ==================== PRESENCAS ====================
app.get('/api/presencas', authenticate, async (req, res) => {
    try {
        const { materia, data } = req.query;
        let query = {};
        
        if (materia) query.materia = materia;
        if (data) query.data = new Date(data);
        
        const presencas = await Presenca.find(query);
        res.json(presencas);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar presenças" });
    }
});

app.post('/api/presencas/batch', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { registros } = req.body;
        
        if (!registros || !Array.isArray(registros)) {
            return res.status(400).json({ msg: "Registros inválidos" });
        }
        
        for (const reg of registros) {
            const { alunoId, materia, data, status } = reg;
            
            const existing = await Presenca.findOne({
                alunoId,
                materia,
                data: new Date(data)
            });
            
            if (existing) {
                existing.status = status;
                existing.professorId = req.user.id;
                await existing.save();
            } else {
                await Presenca.create({
                    alunoId,
                    materia,
                    data: new Date(data),
                    status,
                    professorId: req.user.id
                });
            }
        }
        
        res.json({ msg: "Presenças salvas" });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao salvar presenças" });
    }
});

// ==================== BIBLIOTECA ====================
app.get('/api/artigos', authenticate, async (req, res) => {
    try {
        const artigos = await Artigo.find()
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(artigos);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar artigos" });
    }
});

app.post('/api/artigos', authenticate, async (req, res) => {
    try {
        const { titulo, conteudo, videoUrl, exercicio } = req.body;
        
        if (!titulo || !conteudo) {
            return res.status(400).json({ msg: "Campos obrigatórios" });
        }
        
        const artigo = await Artigo.create({
            titulo: sanitize(titulo).substring(0, 200),
            conteudo: sanitize(conteudo),
            autor: req.user.nome,
            autorId: req.user.id,
            videoUrl,
            exercicio
        });
        
        res.status(201).json(artigo);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao criar artigo" });
    }
});

app.post('/api/artigos/exercicio/:id', authenticate, async (req, res) => {
    try {
        const artigo = await Artigo.findById(req.params.id);
        if (!artigo || !artigo.exercicio) {
            return res.status(404).json({ msg: "Exercício não encontrado" });
        }
        
        const { opcaoIndex } = req.body;
        const correto = artigo.exercicio.respostaCorreta === opcaoIndex;
        
        res.json({ correto, respostaCorreta: artigo.exercicio.respostaCorreta });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao responder exercício" });
    }
});

app.post('/api/artigos/:id/curtir', authenticate, async (req, res) => {
    try {
        const artigo = await Artigo.findById(req.params.id);
        if (!artigo) return res.status(404).json({ msg: "Artigo não encontrado" });
        
        const index = artigo.curtidas.indexOf(req.user.id);
        if (index > -1) {
            artigo.curtidas.splice(index, 1);
        } else {
            artigo.curtidas.push(req.user.id);
        }
        
        await artigo.save();
        res.json({ curtidas: artigo.curtidas.length });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao curtir artigo" });
    }
});

// ==================== TESTES ====================
app.get('/api/testes', authenticate, async (req, res) => {
    try {
        const testes = await Teste.find({ ativo: true })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(testes);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar testes" });
    }
});

app.post('/api/testes', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { titulo, materia, bimestre, questoes, tempoLimite } = req.body;
        
        if (!titulo || !materia || !bimestre) {
            return res.status(400).json({ msg: "Campos obrigatórios" });
        }
        
        const teste = await Teste.create({
            titulo: sanitize(titulo).substring(0, 200),
            materia,
            bimestre,
            professor: req.user.nome,
            professorId: req.user.id,
            questoes: questoes || [],
            tempoLimite
        });
        
        res.status(201).json(teste);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao criar teste" });
    }
});

app.post('/api/testes/:id/responder', authenticate, async (req, res) => {
    try {
        const { respostas, tempo } = req.body;
        const teste = await Teste.findById(req.params.id);
        
        if (!teste) return res.status(404).json({ msg: "Teste não encontrado" });
        
        // Verificar se já respondeu
        const jaRespondeu = await RespostaTeste.findOne({
            testeId: req.params.id,
            alunoId: req.user.id
        });
        
        if (jaRespondeu) {
            return res.status(400).json({ msg: "Você já respondeu este teste" });
        }
        
        // Calcular nota
        let acertos = 0;
        teste.questoes.forEach((q, idx) => {
            if (q.respostaCorreta === respostas[idx]) {
                acertos++;
            }
        });
        
        const nota = (acertos / teste.questoes.length) * 10;
        
        const resposta = await RespostaTeste.create({
            testeId: req.params.id,
            alunoId: req.user.id,
            respostas,
            nota,
            tempo
        });
        
        res.json({ nota, acertos, total: teste.questoes.length });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao responder teste" });
    }
});

// ==================== ALUNOS ====================
app.get('/api/alunos', authenticate, async (req, res) => {
    try {
        const alunos = await User.find({ role: 'Aluno' })
            .select('nome email avatar')
            .limit(500);
        res.json(alunos);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar alunos" });
    }
});

// ==================== ADMIN ====================
app.get('/api/admin/users', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const users = await User.find()
            .select('nome email role createdAt lastLogin')
            .limit(1000);
        res.json(users);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar usuários" });
    }
});

app.post('/api/admin/update-role', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const { userId, role } = req.body;
        
        if (!['Aluno', 'Professor', 'Direcao', 'Admin'].includes(role)) {
            return res.status(400).json({ msg: "Role inválida" });
        }
        
        await User.findByIdAndUpdate(userId, { role });
        
        console.log(`✅ Admin ${req.user.email} alterou role de usuário ${userId} para ${role}`);
        
        res.json({ msg: "Role atualizada com sucesso" });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao atualizar role" });
    }
});

app.delete('/api/admin/users/:id', authenticate, authorize('Admin'), async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        console.log(`⚠️ Admin ${req.user.email} deletou usuário ${req.params.id}`);
        res.json({ msg: "Usuário deletado" });
    } catch (error) {
        res.status(500).json({ msg: "Erro ao deletar usuário" });
    }
});

// ==================== STATS ====================
app.get('/api/stats', authenticate, async (req, res) => {
    try {
        const stats = {
            totalUsuarios: await User.countDocuments(),
            totalAlunos: await User.countDocuments({ role: 'Aluno' }),
            totalProfessores: await User.countDocuments({ role: 'Professor' }),
            totalThreads: await Thread.countDocuments(),
            totalArtigos: await Artigo.countDocuments(),
            totalAtividades: await Atividade.countDocuments()
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ msg: "Erro ao buscar estatísticas" });
    }
});

// ==================== CATCH ALL ====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ msg: "Erro interno do servidor" });
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ VERTEX SEGURO ONLINE NA PORTA ${PORT}`);
});
