const express = require('express');
const path = require('path');
const app = express();

// Rota para servir o seu HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Vertex rodando na porta ${PORT}`);
});
