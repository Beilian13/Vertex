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

// ========== SCHEMAS ==========
const User = mongoose.model('User', new mongoose.Schema({
    nome: String, 
    email: { type: String, unique: true }, 
    senha: String,
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

const Noticia = mongoose.model('Noticia', new mongoose.Schema({ 
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

const Atividade = mongoose.model('Atividade', new mongoose.Schema({ 
    titulo: String, 
    descricao: String,
    materia: String, 
    dataEntrega: Date, 
    autor: String,
    createdAt: { type: Date, default: Date.now }
}));

const Ocorrencia = mongoose.model('Ocorrencia', new mongoose.Schema({ 
    alunoNome: String, 
    descricao: String, 
    tipo: String, 
    status: { type: String, default: 'Em Processo' }, 
    autor: String, 
    createdAt: { type: Date, default: Date.now } 
}));

const Materia = mongoose.model('Materia', new mongoose.Schema({
    nome: String,
    professor: String,
    createdAt: { type: Date, default: Date.now }
}));

const Nota = mongoose.model('Nota', new mongoose.Schema({
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    materia: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    bimestre: Number, // 1, 2, 3, 4
    tipo: { type: String, enum: ['AV1', 'AV2', 'P1'] },
    nota: { type: Number, min: 0, max: 10 },
    createdAt: { type: Date, default: Date.now }
}));

const Presenca = mongoose.model('Presenca', new mongoose.Schema({
    alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    materia: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    data: Date,
    status: { type: String, enum: ['P', 'F'] }, // Presente / Falta
    createdAt: { type: Date, default: Date.now }
}));

// ========== MIDDLEWARES ==========
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

// ========== ROTAS FÓRUM ==========
app.get('/api/forum', authenticate, async (req, res) => res.json(await Thread.find().sort({createdAt:-1})));

app.post('/api/forum', authenticate, async (req, res) => {
    const { titulo, conteudo, enquete } = req.body;
    const novaThread = { titulo, conteudo, autor: req.user.nome };
    if(enquete) {
        novaThread.temEnquete = true;
        novaThread.enquete = { pergunta: enquete.pergunta, opcoes: enquete.opcoes.map(o => ({ texto: o, votos: 0 })), votosUsuarios: [] };
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
    if (!thread.enquete) return res.status(400).json({ msg: "Thread sem enquete" });
    if (!thread.enquete.votosUsuarios) thread.enquete.votosUsuarios = [];
    if (thread.enquete.votosUsuarios.includes(req.user.id)) return res.status(400).json({ msg: "Já votou!" });
    thread.enquete.opcoes[req.body.opcaoIndex].votos += 1;
    thread.enquete.votosUsuarios.push(req.user.id);
    await thread.save();
    res.json(thread);
});

// ========== ROTAS NOTÍCIAS ==========
app.get('/api/noticias', authenticate, async (req, res) => res.json(await Noticia.find().sort({createdAt:-1})));

app.post('/api/noticias', authenticate, authorize('Direcao'), async (req, res) => {
    const { titulo, conteudo, enquete } = req.body;
    const novaNoticia = { titulo, conteudo, autor: req.user.nome };
    if(enquete) {
        novaNoticia.temEnquete = true;
        novaNoticia.enquete = { pergunta: enquete.pergunta, opcoes: enquete.opcoes.map(o => ({ texto: o, votos: 0 })), votosUsuarios: [] };
    }
    res.json(await Noticia.create(novaNoticia));
});

app.post('/api/noticias/comentar/:id', authenticate, async (req, res) => {
    const noticia = await Noticia.findById(req.params.id);
    noticia.comentarios.push({ autor: req.user.nome, texto: req.body.texto });
    await noticia.save();
    res.json(noticia);
});

app.post('/api/noticias/votar/:id', authenticate, async (req, res) => {
    const noticia = await Noticia.findById(req.params.id);
    if (!noticia.enquete) return res.status(400).json({ msg: "Notícia sem enquete" });
    if (!noticia.enquete.votosUsuarios) noticia.enquete.votosUsuarios = [];
    if (noticia.enquete.votosUsuarios.includes(req.user.id)) return res.status(400).json({ msg: "Já votou!" });
    noticia.enquete.opcoes[req.body.opcaoIndex].votos += 1;
    noticia.enquete.votosUsuarios.push(req.user.id);
    await noticia.save();
    res.json(noticia);
});

// ========== ROTAS ATIVIDADES ==========
app.get('/api/atividades', authenticate, async (req, res) => res.json(await Atividade.find().sort({dataEntrega:1})));

app.post('/api/atividades', authenticate, authorize('Professor'), async (req, res) => {
    const { materia, titulo, descricao, dataEntrega } = req.body;
    res.json(await Atividade.create({ materia, titulo, descricao, dataEntrega, autor: req.user.nome }));
});

// ========== ROTAS OCORRÊNCIAS ==========
app.get('/api/ocorrencias', authenticate, async (req, res) => {
    const q = ['Direcao', 'Admin'].includes(req.user.role) ? {} : { alunoNome: req.user.nome };
    res.json(await Ocorrencia.find(q).sort({createdAt:-1}));
});

app.post('/api/ocorrencias', authenticate, authorize('Professor'), async (req, res) => {
    const { alunoNome, tipo, descricao } = req.body;
    res.json(await Ocorrencia.create({ alunoNome, tipo, descricao, autor: req.user.nome }));
});

// ========== ROTAS MATÉRIAS ==========
app.get('/api/materias', authenticate, async (req, res) => res.json(await Materia.find()));

app.post('/api/materias', authenticate, authorize('Admin'), async (req, res) => {
    res.json(await Materia.create(req.body));
});

// ========== ROTAS NOTAS ==========
app.get('/api/notas', authenticate, async (req, res) => {
    const { materia, bimestre } = req.query;
    const query = {};
    if (materia) query.materia = materia;
    if (bimestre) query.bimestre = parseInt(bimestre);
    
    // Se for aluno, só suas notas
    if (req.user.role === 'Aluno') query.alunoId = req.user.id;
    
    res.json(await Nota.find(query));
});

app.post('/api/notas', authenticate, authorize('Professor'), async (req, res) => {
    const { alunoId, materia, bimestre, tipo, nota } = req.body;
    
    // Atualizar ou criar
    const existing = await Nota.findOne({ alunoId, materia, bimestre, tipo });
    if (existing) {
        existing.nota = nota;
        await existing.save();
        res.json(existing);
    } else {
        res.json(await Nota.create({ alunoId, materia, bimestre, tipo, nota }));
    }
});

// ========== ROTAS PRESENÇA ==========
app.get('/api/presencas', authenticate, async (req, res) => {
    const { materia, data } = req.query;
    const query = {};
    if (materia) query.materia = materia;
    if (data) query.data = new Date(data);
    
    res.json(await Presenca.find(query));
});

app.post('/api/presencas/batch', authenticate, authorize('Professor'), async (req, res) => {
    const { registros } = req.body;
    
    for (const reg of registros) {
        const existing = await Presenca.findOne({ 
            alunoId: reg.alunoId, 
            materia: reg.materia, 
            data: new Date(reg.data) 
        });
        
        if (existing) {
            existing.status = reg.status;
            await existing.save();
        } else {
            await Presenca.create(reg);
        }
    }
    
    res.json({ msg: "Presenças salvas" });
});

// ========== ROTAS ALUNOS ==========
app.get('/api/alunos', authenticate, async (req, res) => {
    res.json(await User.find({ role: 'Aluno' }, 'nome email'));
});

// ========== ROTAS AUTH ==========
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

// ========== ROTAS ADMIN ==========
app.get('/api/admin/users', authenticate, authorize('Admin'), async (req, res) => res.json(await User.find({}, 'nome email role')));

app.post('/api/admin/update-role', authenticate, authorize('Admin'), async (req, res) => {
    await User.findByIdAndUpdate(req.body.userId, { role: req.body.role });
    res.json({ msg: "OK" });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`✅ VERTEX ONLINE NA PORTA ${PORT}`));
