const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// ==================== CONSTANTS ====================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://beilianalvarenga_db_user:Beilian1010@cluster0.hhyotua.mongodb.net/Vertex?retryWrites=true&w=majority";
const JWT_SECRET = process.env.JWT_SECRET || "beilian_secret_key_123";
const PORT = process.env.PORT || 10000;

// ==================== DATABASE CONNECTION ====================
mongoose.connect(MONGO_URI, { 
    dbName: 'Vertex',
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ [DATABASE] Vertex Blue Edition Conectada"))
.catch(err => console.error("❌ [DATABASE] Erro:", err.message));

// ==================== SCHEMAS ====================
const UserSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['Aluno', 'Professor', 'Direcao', 'Admin'], 
        default: 'Aluno' 
    },
    avatar: String,
    createdAt: { type: Date, default: Date.now }
});

const ThreadSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    conteudo: { type: String, required: true },
    autor: { type: String, required: true },
    temEnquete: { type: Boolean, default: false },
    enquete: {
        pergunta: String,
        opcoes: [{
            texto: String,
            votos: { type: Number, default: 0 }
        }],
        votosUsuarios: [String]
    },
    comentarios: [{
        autor: String,
        texto: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const NoticiaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    conteudo: String,
    autor: { type: String, required: true },
    temEnquete: { type: Boolean, default: false },
    enquete: {
        pergunta: String,
        opcoes: [{
            texto: String,
            votos: { type: Number, default: 0 }
        }],
        votosUsuarios: [String]
    },
    comentarios: [{
        autor: String,
        texto: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const AtividadeSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    descricao: String,
    materia: { type: String, required: true },
    dataEntrega: { type: Date, required: true },
    autor: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const OcorrenciaSchema = new mongoose.Schema({
    alunoNome: { type: String, required: true },
    descricao: { type: String, required: true },
    tipo: { 
        type: String, 
        enum: ['Advertência', 'Suspensão', 'Elogio', 'Observação'],
        required: true 
    },
    status: { type: String, default: 'Em Processo' },
    autor: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const MateriaSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    professor: String,
    createdAt: { type: Date, default: Date.now }
});

const NotaSchema = new mongoose.Schema({
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materia: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', required: true },
    bimestre: { type: Number, min: 1, max: 4, required: true },
    tipo: { type: String, enum: ['AV1', 'AV2', 'P1'], required: true },
    nota: { type: Number, min: 0, max: 10, required: true },
    createdAt: { type: Date, default: Date.now }
});

const PresencaSchema = new mongoose.Schema({
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materia: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', required: true },
    data: { type: Date, required: true },
    status: { type: String, enum: ['P', 'F'], required: true },
    createdAt: { type: Date, default: Date.now }
});

// ==================== MODELS ====================
const User = mongoose.model('User', UserSchema);
const Thread = mongoose.model('Thread', ThreadSchema);
const Noticia = mongoose.model('Noticia', NoticiaSchema);
const Atividade = mongoose.model('Atividade', AtividadeSchema);
const Ocorrencia = mongoose.model('Ocorrencia', OcorrenciaSchema);
const Materia = mongoose.model('Materia', MateriaSchema);
const Nota = mongoose.model('Nota', NotaSchema);
const Presenca = mongoose.model('Presenca', PresencaSchema);

// ==================== AUTH MIDDLEWARE ====================
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ msg: "Token não fornecido" });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ msg: "Token inválido ou expirado" });
    }
};

const authorize = (minRole) => {
    return (req, res, next) => {
        const roles = ['Aluno', 'Professor', 'Direcao', 'Admin'];
        const userRoleIndex = roles.indexOf(req.user.role);
        const minRoleIndex = roles.indexOf(minRole);
        
        if (userRoleIndex >= minRoleIndex) {
            return next();
        }
        
        return res.status(403).json({ msg: "Permissão insuficiente" });
    };
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        
        if (!nome || !email || !senha) {
            return res.status(400).json({ msg: "Preencha todos os campos" });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: "Email já cadastrado" });
        }
        
        const hashedPassword = await bcrypt.hash(senha, 10);
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${nome}`;
        
        await User.create({
            nome,
            email,
            senha: hashedPassword,
            avatar
        });
        
        res.status(201).json({ msg: "Usuário criado com sucesso" });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ msg: "Erro ao criar usuário" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        if (!email || !senha) {
            return res.status(400).json({ msg: "Preencha todos os campos" });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ msg: "Credenciais inválidas" });
        }
        
        const isValidPassword = await bcrypt.compare(senha, user.senha);
        
        if (!isValidPassword) {
            return res.status(401).json({ msg: "Credenciais inválidas" });
        }
        
        const token = jwt.sign(
            { id: user._id, role: user.role, nome: user.nome },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            token,
            nome: user.nome,
            role: user.role,
            avatar: user.avatar
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ msg: "Erro ao fazer login" });
    }
});

// ==================== FORUM ROUTES ====================
app.get('/api/forum', authenticate, async (req, res) => {
    try {
        const threads = await Thread.find().sort({ createdAt: -1 });
        res.json(threads);
    } catch (error) {
        console.error('Forum get error:', error);
        res.status(500).json({ msg: "Erro ao buscar fórum" });
    }
});

app.post('/api/forum', authenticate, async (req, res) => {
    try {
        const { titulo, conteudo, enquete } = req.body;
        
        const threadData = {
            titulo,
            conteudo,
            autor: req.user.nome
        };
        
        if (enquete && enquete.pergunta && enquete.opcoes) {
            threadData.temEnquete = true;
            threadData.enquete = {
                pergunta: enquete.pergunta,
                opcoes: enquete.opcoes.map(texto => ({ texto, votos: 0 })),
                votosUsuarios: []
            };
        }
        
        const thread = await Thread.create(threadData);
        res.status(201).json(thread);
    } catch (error) {
        console.error('Forum post error:', error);
        res.status(500).json({ msg: "Erro ao criar thread" });
    }
});

app.post('/api/forum/comentar/:id', authenticate, async (req, res) => {
    try {
        const { texto } = req.body;
        const thread = await Thread.findById(req.params.id);
        
        if (!thread) {
            return res.status(404).json({ msg: "Thread não encontrada" });
        }
        
        thread.comentarios.push({
            autor: req.user.nome,
            texto
        });
        
        await thread.save();
        res.json(thread);
    } catch (error) {
        console.error('Comment error:', error);
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
        
        if (!thread.enquete.votosUsuarios) {
            thread.enquete.votosUsuarios = [];
        }
        
        if (thread.enquete.votosUsuarios.includes(req.user.id)) {
            return res.status(400).json({ msg: "Você já votou nesta enquete" });
        }
        
        thread.enquete.opcoes[opcaoIndex].votos += 1;
        thread.enquete.votosUsuarios.push(req.user.id);
        
        await thread.save();
        res.json(thread);
    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ msg: "Erro ao votar" });
    }
});

// ==================== NOTICIAS ROUTES ====================
app.get('/api/noticias', authenticate, async (req, res) => {
    try {
        const noticias = await Noticia.find().sort({ createdAt: -1 });
        res.json(noticias);
    } catch (error) {
        console.error('Noticias get error:', error);
        res.status(500).json({ msg: "Erro ao buscar notícias" });
    }
});

app.post('/api/noticias', authenticate, authorize('Direcao'), async (req, res) => {
    try {
        const { titulo, conteudo, enquete } = req.body;
        
        const noticiaData = {
            titulo,
            conteudo,
            autor: req.user.nome
        };
        
        if (enquete && enquete.pergunta && enquete.opcoes) {
            noticiaData.temEnquete = true;
            noticiaData.enquete = {
                pergunta: enquete.pergunta,
                opcoes: enquete.opcoes.map(texto => ({ texto, votos: 0 })),
                votosUsuarios: []
            };
        }
        
        const noticia = await Noticia.create(noticiaData);
        res.status(201).json(noticia);
    } catch (error) {
        console.error('Noticia post error:', error);
        res.status(500).json({ msg: "Erro ao criar notícia" });
    }
});

app.post('/api/noticias/comentar/:id', authenticate, async (req, res) => {
    try {
        const { texto } = req.body;
        const noticia = await Noticia.findById(req.params.id);
        
        if (!noticia) {
            return res.status(404).json({ msg: "Notícia não encontrada" });
        }
        
        noticia.comentarios.push({
            autor: req.user.nome,
            texto
        });
        
        await noticia.save();
        res.json(noticia);
    } catch (error) {
        console.error('Comment noticia error:', error);
        res.status(500).json({ msg: "Erro ao comentar" });
    }
});

app.post('/api/noticias/votar/:id', authenticate, async (req, res) => {
    try {
        const { opcaoIndex } = req.body;
        const noticia = await Noticia.findById(req.params.id);
        
        if (!noticia || !noticia.temEnquete) {
            return res.status(404).json({ msg: "Enquete não encontrada" });
        }
        
        if (!noticia.enquete.votosUsuarios) {
            noticia.enquete.votosUsuarios = [];
        }
        
        if (noticia.enquete.votosUsuarios.includes(req.user.id)) {
            return res.status(400).json({ msg: "Você já votou nesta enquete" });
        }
        
        noticia.enquete.opcoes[opcaoIndex].votos += 1;
        noticia.enquete.votosUsuarios.push(req.user.id);
        
        await noticia.save();
        res.json(noticia);
    } catch (error) {
        console.error('Vote noticia error:', error);
        res.status(500).json({ msg: "Erro ao votar" });
    }
});

// ==================== ATIVIDADES ROUTES ====================
app.get('/api/atividades', authenticate, async (req, res) => {
    try {
        const atividades = await Atividade.find().sort({ dataEntrega: 1 });
        res.json(atividades);
    } catch (error) {
        console.error('Atividades get error:', error);
        res.status(500).json({ msg: "Erro ao buscar atividades" });
    }
});

app.post('/api/atividades', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { materia, titulo, descricao, dataEntrega } = req.body;
        
        const atividade = await Atividade.create({
            materia,
            titulo,
            descricao,
            dataEntrega,
            autor: req.user.nome
        });
        
        res.status(201).json(atividade);
    } catch (error) {
        console.error('Atividade post error:', error);
        res.status(500).json({ msg: "Erro ao criar atividade" });
    }
});

// ==================== OCORRENCIAS ROUTES ====================
app.get('/api/ocorrencias', authenticate, async (req, res) => {
    try {
        let query = {};
        
        if (req.user.role === 'Aluno') {
            query.alunoNome = req.user.nome;
        }
        
        const ocorrencias = await Ocorrencia.find(query).sort({ createdAt: -1 });
        res.json(ocorrencias);
    } catch (error) {
        console.error('Ocorrencias get error:', error);
        res.status(500).json({ msg: "Erro ao buscar ocorrências" });
    }
});

app.post('/api/ocorrencias', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { alunoNome, tipo, descricao } = req.body;
        
        const ocorrencia = await Ocorrencia.create({
            alunoNome,
            tipo,
            descricao,
            autor: req.user.nome
        });
        
        res.status(201).json(ocorrencia);
    } catch (error) {
        console.error('Ocorrencia post error:', error);
        res.status(500).json({ msg: "Erro ao criar ocorrência" });
    }
});

// ==================== MATERIAS ROUTES ====================
app.get('/api/materias', authenticate, async (req, res) => {
    try {
        const materias = await Materia.find();
        res.json(materias);
    } catch (error) {
        console.error('Materias get error:', error);
        res.status(500).json({ msg: "Erro ao buscar matérias" });
    }
});

app.post('/api/materias', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const materia = await Materia.create(req.body);
        res.status(201).json(materia);
    } catch (error) {
        console.error('Materia post error:', error);
        res.status(500).json({ msg: "Erro ao criar matéria" });
    }
});

// ==================== NOTAS ROUTES ====================
app.get('/api/notas', authenticate, async (req, res) => {
    try {
        const { materia, bimestre } = req.query;
        let query = {};
        
        if (materia) query.materia = materia;
        if (bimestre) query.bimestre = parseInt(bimestre);
        
        if (req.user.role === 'Aluno') {
            query.alunoId = req.user.id;
        }
        
        const notas = await Nota.find(query);
        res.json(notas);
    } catch (error) {
        console.error('Notas get error:', error);
        res.status(500).json({ msg: "Erro ao buscar notas" });
    }
});

app.post('/api/notas', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { alunoId, materia, bimestre, tipo, nota } = req.body;
        
        const existing = await Nota.findOne({ alunoId, materia, bimestre, tipo });
        
        if (existing) {
            existing.nota = nota;
            await existing.save();
            res.json(existing);
        } else {
            const newNota = await Nota.create({ alunoId, materia, bimestre, tipo, nota });
            res.status(201).json(newNota);
        }
    } catch (error) {
        console.error('Nota post error:', error);
        res.status(500).json({ msg: "Erro ao salvar nota" });
    }
});

// ==================== PRESENCAS ROUTES ====================
app.get('/api/presencas', authenticate, async (req, res) => {
    try {
        const { materia, data } = req.query;
        let query = {};
        
        if (materia) query.materia = materia;
        if (data) query.data = new Date(data);
        
        const presencas = await Presenca.find(query);
        res.json(presencas);
    } catch (error) {
        console.error('Presencas get error:', error);
        res.status(500).json({ msg: "Erro ao buscar presenças" });
    }
});

app.post('/api/presencas/batch', authenticate, authorize('Professor'), async (req, res) => {
    try {
        const { registros } = req.body;
        
        for (const registro of registros) {
            const { alunoId, materia, data, status } = registro;
            
            const existing = await Presenca.findOne({
                alunoId,
                materia,
                data: new Date(data)
            });
            
            if (existing) {
                existing.status = status;
                await existing.save();
            } else {
                await Presenca.create(registro);
            }
        }
        
        res.json({ msg: "Presenças salvas com sucesso" });
    } catch (error) {
        console.error('Presenca batch error:', error);
        res.status(500).json({ msg: "Erro ao salvar presenças" });
    }
});

// ==================== ALUNOS ROUTE ====================
app.get('/api/alunos', authenticate, async (req, res) => {
    try {
        const alunos = await User.find({ role: 'Aluno' }, 'nome email');
        res.json(alunos);
    } catch (error) {
        console.error('Alunos get error:', error);
        res.status(500).json({ msg: "Erro ao buscar alunos" });
    }
});

// ==================== ADMIN ROUTES ====================
app.get('/api/admin/users', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const users = await User.find({}, 'nome email role');
        res.json(users);
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ msg: "Erro ao buscar usuários" });
    }
});

app.post('/api/admin/update-role', authenticate, authorize('Admin'), async (req, res) => {
    try {
        const { userId, role } = req.body;
        
        await User.findByIdAndUpdate(userId, { role });
        res.json({ msg: "Role atualizada com sucesso" });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ msg: "Erro ao atualizar role" });
    }
});

// ==================== CATCH ALL ====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ VERTEX ONLINE NA PORTA ${PORT}`);
});
