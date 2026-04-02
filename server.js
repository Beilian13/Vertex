const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

mongoose.connect(process.env.MONGO_URI.replace(/['"]+/g, '').trim());

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: String, email: { type: String, unique: true }, senha: String,
    role: { type: String, default: 'aluno' }, turma: String,
    grades: [{ materia: String, av1: Number, av2: Number }] // Official grades
}));

const Thread = mongoose.model('Thread', new mongoose.Schema({
    titulo: String, conteudo: String, autor: String, turma: String,
    upvotes: { type: [String], default: [] }, // Array of user IDs
    poll: { 
        question: String, 
        options: [{ text: String, votes: { type: Number, default: 0 } }] 
    },
    replies: [{ autor: String, texto: String, createdAt: { type: Date, default: Date.now } }],
    createdAt: { type: Date, default: Date.now }
}));

// --- FORUM ROUTES ---

app.get('/api/forum', async (req, res) => res.json(await Thread.find().sort({ createdAt: -1 })));

app.post('/api/forum/vote', async (req, res) => {
    const { threadId, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const thread = await Thread.findById(threadId);
    if (thread.upvotes.includes(decoded.id)) {
        thread.upvotes = thread.upvotes.filter(id => id !== decoded.id);
    } else {
        thread.upvotes.push(decoded.id);
    }
    await thread.save();
    res.json({ count: thread.upvotes.length });
});

app.post('/api/forum/reply', async (req, res) => {
    const { threadId, texto, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await Thread.findByIdAndUpdate(threadId, { 
        $push: { replies: { autor: decoded.nome, texto } } 
    });
    res.send("Resposta enviada");
});

// --- GRADE ROUTES ---

// Teacher uploads grades for a student
app.post('/api/admin/set-grades', async (req, res) => {
    const { email, materia, av1, av2, token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!['admin', 'professor'].includes(decoded.role)) return res.status(403).send("Negado");
    
    await User.findOneAndUpdate(
        { email }, 
        { $pull: { grades: { materia } } } // Remove old to update
    );
    await User.findOneAndUpdate(
        { email },
        { $push: { grades: { materia, av1, av2 } } }
    );
    res.send("Nota atualizada!");
});

app.get('/api/my-grades', async (req, res) => {
    const token = req.headers.authorization;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    res.json(user.grades);
});

// Keep your Auth and Task routes from the previous version...
// [Insert Auth/Login/Register logic here]

app.listen(process.env.PORT || 3000);
