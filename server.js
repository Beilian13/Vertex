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

mongoose.connect(process.env.MONGO_URI);

// Schema de Usuário com Role
const UserSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true },
    senha: String,
    role: { type: String, default: 'aluno' }, // aluno, representante, professor, direcao, admin
    turma: String
});
const User = mongoose.model('User', UserSchema);

// --- ROTAS DE AUTH ---

app.post('/api/auth/register', async (req, res) => {
    const { nome, email, senha, turma } = req.body;
    const hashed = await bcrypt.hash(senha, 10);
    try {
        await User.create({ nome, email, senha: hashed, turma });
        res.status(201).send("Registrado!");
    } catch(e) { res.status(400).send("Erro no registro"); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(senha, user.senha)) {
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
        res.json({ token, role: user.role, nome: user.nome });
    } else { res.status(401).send("Falha no login"); }
});

// --- ROTA DE ADMIN (Mudar Cargo) ---

app.put('/api/admin/update-role', async (req, res) => {
    const { targetEmail, newRole, token } = req.body;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin' && decoded.role !== 'direcao') return res.status(403).send("Sem permissão");
        
        await User.findOneAndUpdate({ email: targetEmail }, { role: newRole });
        res.send(`Cargo de ${targetEmail} atualizado para ${newRole}`);
    } catch(e) { res.status(401).send("Token inválido"); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(process.env.PORT || 3000, () => console.log("🚀 Vertex: Sistema de Roles Ativo"));
