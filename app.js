// ==================== CONFIGURAÇÃO GLOBAL ====================
const API_BASE = '';
let currentUser = null;
let isOnline = navigator.onLine;
let syncQueue = [];

// ==================== OFFLINE MODE ====================
window.addEventListener('online', () => {
    isOnline = true;
    document.getElementById('offline-indicator').classList.remove('show');
    processSyncQueue();
});

window.addEventListener('offline', () => {
    isOnline = false;
    document.getElementById('offline-indicator').classList.add('show');
});

function addToSyncQueue(request) {
    syncQueue.push(request);
    localStorage.setItem('v-sync-queue', JSON.stringify(syncQueue));
}

async function processSyncQueue() {
    const queue = JSON.parse(localStorage.getItem('v-sync-queue') || '[]');
    for (const req of queue) {
        try {
            await fetch(req.url, {
                method: req.method,
                headers: req.headers,
                body: req.body
            });
        } catch (e) {
            console.error('Sync failed:', e);
        }
    }
    localStorage.removeItem('v-sync-queue');
    syncQueue = [];
}

// ==================== API WRAPPER ====================
const api = async (url, method = 'GET', body = null) => {
    const headers = { 
        'Content-Type': 'application/json', 
        'Authorization': localStorage.getItem('v-token') || '' 
    };
    
    if (!isOnline && method !== 'GET') {
        addToSyncQueue({ url: API_BASE + url, method, headers, body: body ? JSON.stringify(body) : null });
        return { offline: true, success: true };
    }
    
    try {
        const response = await fetch(API_BASE + url, { 
            method, 
            headers, 
            body: body ? JSON.stringify(body) : null 
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        if (method !== 'GET') {
            addToSyncQueue({ url: API_BASE + url, method, headers, body: body ? JSON.stringify(body) : null });
        }
        return null;
    }
};

// ==================== SKELETON LOADERS ====================
function showSkeleton(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = Array(count).fill(0).map(() => `
        <div class="card">
            <div class="skeleton" style="width:60%; height: 24px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="width:40%; height:16px; margin-bottom: 8px;"></div>
            <div class="skeleton" style="width:80%; height:16px;"></div>
        </div>
    `).join('');
}

// ==================== AUTH ====================
let isLogin = true;

function toggleAuthMode() {
    isLogin = !isLogin;
    const regNome = document.getElementById('reg-nome');
    const btn = document.querySelector('#auth-page .btn');
    
    if (isLogin) {
        regNome.style.display = 'none';
        btn.textContent = 'ENTRAR';
    } else {
        regNome.style.display = 'block';
        btn.textContent = 'CRIAR CONTA';
    }
}

async function handleAuth() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const nome = document.getElementById('reg-nome').value;
    
    if (!email || !senha) {
        alert('Preencha todos os campos!');
        return;
    }
    
    if (!isLogin && !nome) {
        alert('Preencha seu nome completo!');
        return;
    }
    
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = { email, senha };
    if (!isLogin) payload.nome = nome;
    
    const result = await api(endpoint, 'POST', payload);
    
    if (result) {
        if (isLogin && result.token) {
            localStorage.setItem('v-token', result.token);
            localStorage.setItem('v-user', JSON.stringify(result));
            location.reload();
        } else if (!isLogin) {
            alert('Conta criada! Faça login agora.');
            toggleAuthMode();
        }
    } else {
        alert('Erro ao autenticar. Verifique suas credenciais.');
    }
}

// ==================== INIT APP ====================
function initApp(user) {
    currentUser = user;
    
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
    document.getElementById('user-avatar').src = user.avatar;
    document.getElementById('user-name-label').textContent = user.nome;
    document.getElementById('user-role-label').textContent = user.role;
    
    // Configurar permissões por role
    const permissions = {
        Admin: ['nav-gestao', 'nav-notas', 'nav-presenca', 'nav-admin', 'gestao-noticias', 'gestao-tarefas', 'gestao-ocorrencias'],
        Direcao: ['nav-gestao', 'nav-notas', 'gestao-noticias', 'gestao-tarefas', 'gestao-ocorrencias'],
        Professor: ['nav-gestao', 'nav-notas', 'nav-presenca', 'gestao-tarefas', 'gestao-ocorrencias'],
        Aluno: ['nav-notas']
    };
    
    const userPermissions = permissions[user.role] || [];
    userPermissions.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'block';
    });
    
    switchView('home');
    loadMaterias();
}

// ==================== MATÉRIAS ====================
let materiasCache = [];

async function loadMaterias() {
    const materias = await api('/api/materias');
    if (materias) {
        materiasCache = materias;
        const options = materias.map(m => `<option value="${m._id}">${m.nome}</option>`).join('');
        
        const notaMateriaSelect = document.getElementById('nota-materia');
        const presencaMateriaSelect = document.getElementById('presenca-materia');
        
        if (notaMateriaSelect) {
            notaMateriaSelect.innerHTML = '<option value="">Selecione uma Matéria</option>' + options;
        }
        
        if (presencaMateriaSelect) {
            presencaMateriaSelect.innerHTML = '<option value="">Selecione uma Matéria</option>' + options;
        }
    }
}

// ==================== FORUM ====================
async function loadForum() {
    showSkeleton('forum-list', 3);
    const threads = await api('/api/forum');
    
    const container = document.getElementById('forum-list');
    if (!container) return;
    
    if (!threads || threads.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <p>Nenhum tópico ainda. Seja o primeiro a postar!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = threads.map(t => `
        <div class="card">
            <h4>${t.titulo}</h4>
            <p style="font-size:14px; margin: 12px 0; line-height: 1.6;">${t.conteudo}</p>
            <small style="color:var(--text-dim)">por <strong>${t.autor}</strong></small>
            
            ${t.temEnquete ? `
                <div style="margin-top:20px; padding:16px; background:rgba(59,130,246,0.05); border-radius:12px; border: 2px solid rgba(59,130,246,0.2);">
                    <strong style="font-size:13px; display: block; margin-bottom: 12px;">${t.enquete.pergunta}</strong>
                    ${t.enquete.opcoes.map((o, idx) => {
                        const total = t.enquete.opcoes.reduce((sum, opt) => sum + (opt.votos || 0), 0);
                        const percentage = total > 0 ? Math.round((o.votos / total) * 100) : 0;
                        return `
                            <div class="poll-option" onclick="votar('${t._id}', ${idx})" style="--percentage: ${percentage}%">
                                <div style="position: relative; z-index: 1; display: flex; justify-content: space-between;">
                                    <span>${o.texto}</span>
                                    <span style="color:var(--primary); font-weight: 700;">${o.votos || 0} votos (${percentage}%)</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
            
            <div style="margin-top:20px;">
                ${(t.comentarios || []).map(c => `
                    <div class="comment">
                        <strong>${c.autor}:</strong> ${c.texto}
                    </div>
                `).join('')}
                <input id="in-${t._id}" placeholder="Escreva um comentário..." style="margin-top:12px;">
                <button class="btn" onclick="comentar('${t._id}')" style="margin-top: 8px;">COMENTAR</button>
            </div>
        </div>
    `).join('');
}

async function postarThread() {
    const titulo = document.getElementById('f-tit').value;
    const conteudo = document.getElementById('f-con').value;
    const enquetaPergunta = document.getElementById('f-enq-p').value;
    const enqueteOpcoes = document.getElementById('f-enq-o').value;
    
    if (!titulo || !conteudo) {
        alert('Preencha título e conteúdo!');
        return;
    }
    
    const payload = { titulo, conteudo };
    
    if (enquetaPergunta && enqueteOpcoes) {
        payload.enquete = {
            pergunta: enquetaPergunta,
            opcoes: enqueteOpcoes.split(',').map(s => s.trim()).filter(s => s)
        };
    }
    
    await api('/api/forum', 'POST', payload);
    
    document.getElementById('f-tit').value = '';
    document.getElementById('f-con').value = '';
    document.getElementById('f-enq-p').value = '';
    document.getElementById('f-enq-o').value = '';
    
    loadForum();
}

async function comentar(threadId) {
    const input = document.getElementById('in-' + threadId);
    const texto = input.value;
    
    if (!texto) {
        alert('Digite um comentário!');
        return;
    }
    
    await api(`/api/forum/comentar/${threadId}`, 'POST', { texto });
    input.value = '';
    loadForum();
}

async function votar(threadId, opcaoIndex) {
    await api(`/api/forum/votar/${threadId}`, 'POST', { opcaoIndex });
    loadForum();
}

// ==================== NOTICIAS ====================
async function loadNoticias() {
    showSkeleton('noticias-list', 3);
    const noticias = await api('/api/noticias');
    
    const container = document.getElementById('noticias-list');
    if (!container) return;
    
    if (!noticias || noticias.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📢</div>
                <p>Nenhuma notícia publicada ainda.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = noticias.map(n => `
        <div class="card">
            <h4>${n.titulo}</h4>
            <p style="font-size:14px; margin: 12px 0; line-height: 1.6;">${n.conteudo || ''}</p>
            <small style="color:var(--text-dim)">por <strong>${n.autor}</strong></small>
            
            ${n.temEnquete ? `
                <div style="margin-top:20px; padding:16px; background:rgba(59,130,246,0.05); border-radius:12px; border: 2px solid rgba(59,130,246,0.2);">
                    <strong style="font-size:13px; display: block; margin-bottom: 12px;">${n.enquete.pergunta}</strong>
                    ${n.enquete.opcoes.map((o, idx) => {
                        const total = n.enquete.opcoes.reduce((sum, opt) => sum + (opt.votos || 0), 0);
                        const percentage = total > 0 ? Math.round((o.votos / total) * 100) : 0;
                        return `
                            <div class="poll-option" onclick="votarNoticia('${n._id}', ${idx})" style="--percentage: ${percentage}%">
                                <div style="position: relative; z-index: 1; display: flex; justify-content: space-between;">
                                    <span>${o.texto}</span>
                                    <span style="color:var(--primary); font-weight: 700;">${o.votos || 0} votos (${percentage}%)</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
            
            <div style="margin-top:20px;">
                ${(n.comentarios || []).map(c => `
                    <div class="comment">
                        <strong>${c.autor}:</strong> ${c.texto}
                    </div>
                `).join('')}
                <input id="nc-in-${n._id}" placeholder="Escreva um comentário..." style="margin-top:12px;">
                <button class="btn" onclick="comentarNoticia('${n._id}')" style="margin-top: 8px;">COMENTAR</button>
            </div>
        </div>
    `).join('');
}

async function criarNoticia() {
    const titulo = document.getElementById('n-tit').value;
    const conteudo = document.getElementById('n-con').value;
    const enquetaPergunta = document.getElementById('n-enq-p').value;
    const enqueteOpcoes = document.getElementById('n-enq-o').value;
    
    if (!titulo || !conteudo) {
        alert('Preencha título e conteúdo!');
        return;
    }
    
    const payload = { titulo, conteudo };
    
    if (enquetaPergunta && enqueteOpcoes) {
        payload.enquete = {
            pergunta: enquetaPergunta,
            opcoes: enqueteOpcoes.split(',').map(s => s.trim()).filter(s => s)
        };
    }
    
    await api('/api/noticias', 'POST', payload);
    
    document.getElementById('n-tit').value = '';
    document.getElementById('n-con').value = '';
    document.getElementById('n-enq-p').value = '';
    document.getElementById('n-enq-o').value = '';
    
    loadNoticias();
}

async function comentarNoticia(noticiaId) {
    const input = document.getElementById('nc-in-' + noticiaId);
    const texto = input.value;
    
    if (!texto) {
        alert('Digite um comentário!');
        return;
    }
    
    await api(`/api/noticias/comentar/${noticiaId}`, 'POST', { texto });
    input.value = '';
    loadNoticias();
}

async function votarNoticia(noticiaId, opcaoIndex) {
    await api(`/api/noticias/votar/${noticiaId}`, 'POST', { opcaoIndex });
    loadNoticias();
}

// ==================== ATIVIDADES ====================
async function loadAtividades() {
    showSkeleton('atividades-list', 3);
    const atividades = await api('/api/atividades');
    
    const container = document.getElementById('atividades-list');
    if (!container) return;
    
    if (!atividades || atividades.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <p>Nenhuma tarefa cadastrada.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = atividades.map(a => `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <span class="badge primary">${a.materia}</span>
                <span style="font-size: 12px; color: var(--text-dim);">
                    📅 ${new Date(a.dataEntrega).toLocaleDateString('pt-BR')}
                </span>
            </div>
            <h4>${a.titulo}</h4>
            ${a.descricao ? `<p style="font-size: 13px; color: var(--text-dim); margin-top: 8px;">${a.descricao}</p>` : ''}
        </div>
    `).join('');
}

async function criarTarefa() {
    const materia = document.getElementById('t-mat').value;
    const titulo = document.getElementById('t-tit').value;
    const descricao = document.getElementById('t-desc').value;
    const dataEntrega = document.getElementById('t-data').value;
    
    if (!materia || !titulo || !dataEntrega) {
        alert('Preencha os campos obrigatórios!');
        return;
    }
    
    await api('/api/atividades', 'POST', { materia, titulo, descricao, dataEntrega });
    
    document.getElementById('t-mat').value = '';
    document.getElementById('t-tit').value = '';
    document.getElementById('t-desc').value = '';
    document.getElementById('t-data').value = '';
    
    loadAtividades();
}

// ==================== OCORRENCIAS ====================
async function loadOcorrencias() {
    showSkeleton('ocorrencias-list', 3);
    const ocorrencias = await api('/api/ocorrencias');
    
    const container = document.getElementById('ocorrencias-list');
    if (!container) return;
    
    if (!ocorrencias || ocorrencias.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Nenhuma ocorrência registrada.</p>
            </div>
        `;
        return;
    }
    
    const tipoColors = {
        'Advertência': 'danger',
        'Suspensão': 'danger',
        'Elogio': 'success',
        'Observação': 'warning'
    };
    
    container.innerHTML = ocorrencias.map(o => `
        <div class="card" style="border-left: 4px solid var(--${tipoColors[o.tipo] === 'danger' ? 'danger' : tipoColors[o.tipo] === 'success' ? 'success' : 'warning'});">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <strong>${o.alunoNome}</strong>
                <span class="badge ${tipoColors[o.tipo]}">${o.tipo}</span>
            </div>
            <p style="font-size: 13px; margin: 8px 0;">${o.descricao}</p>
            <small style="color: var(--text-dim);">Registrado por <strong>${o.autor}</strong></small>
        </div>
    `).join('');
}

async function criarOcorrencia() {
    const alunoNome = document.getElementById('o-aluno').value;
    const tipo = document.getElementById('o-tipo').value;
    const descricao = document.getElementById('o-desc').value;
    
    if (!alunoNome || !descricao) {
        alert('Preencha todos os campos!');
        return;
    }
    
    await api('/api/ocorrencias', 'POST', { alunoNome, tipo, descricao });
    
    document.getElementById('o-aluno').value = '';
    document.getElementById('o-desc').value = '';
    
    loadOcorrencias();
}

// ==================== SISTEMA DE NOTAS ====================
let gradeInputs = [];
let currentGradeIndex = 0;
let ctrlPressed = false;
let numberBuffer = '';

document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') {
        ctrlPressed = true;
    }
    
    if (ctrlPressed && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        numberBuffer += e.key;
    }
});

document.addEventListener('keyup', async (e) => {
    if (e.key === 'Control' && numberBuffer && gradeInputs.length > 0) {
        const value = parseFloat(numberBuffer) / 10;
        
        if (gradeInputs[currentGradeIndex] && value >= 0 && value <= 10) {
            const input = gradeInputs[currentGradeIndex];
            input.value = value.toFixed(1);
            input.classList.add('filled');
            
            await api('/api/notas', 'POST', {
                alunoId: input.dataset.aluno,
                materia: document.getElementById('nota-materia').value,
                bimestre: parseInt(document.getElementById('nota-bimestre').value),
                tipo: input.dataset.tipo,
                nota: value
            });
            
            currentGradeIndex++;
            if (gradeInputs[currentGradeIndex]) {
                gradeInputs[currentGradeIndex].focus();
            }
        }
        
        numberBuffer = '';
        ctrlPressed = false;
    }
});

async function loadNotasMateria() {
    const materiaId = document.getElementById('nota-materia').value;
    const bimestre = document.getElementById('nota-bimestre').value;
    
    if (!materiaId) return;
    
    showSkeleton('notas-table-container', 1);
    
    const alunos = await api('/api/alunos');
    const notas = await api(`/api/notas?materia=${materiaId}&bimestre=${bimestre}`);
    
    if (!alunos) {
        document.getElementById('notas-table-container').innerHTML = '<p class="empty-state">Erro ao carregar alunos</p>';
        return;
    }
    
    const notasMap = {};
    if (notas) {
        notas.forEach(n => {
            if (!notasMap[n.alunoId]) notasMap[n.alunoId] = {};
            notasMap[n.alunoId][n.tipo] = n.nota;
        });
    }
    
    const isTeacher = currentUser && ['Professor', 'Admin', 'Direcao'].includes(currentUser.role);
    const isStudent = currentUser && currentUser.role === 'Aluno';
    
    gradeInputs = [];
    currentGradeIndex = 0;
    
    let tableHTML = `
        <div class="card" style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Aluno</th>
                        <th>AV1</th>
                        <th>AV2</th>
                        <th>P1</th>
                        <th>Média</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    alunos.forEach(aluno => {
        const av1 = notasMap[aluno._id]?.AV1 || '';
        const av2 = notasMap[aluno._id]?.AV2 || '';
        const p1 = notasMap[aluno._id]?.P1 || '';
        
        let media = '-';
        let mediaColor = 'var(--text-dim)';
        
        if (av1 && av2 && p1) {
            const m = ((av1 + av2 + p1) / 3).toFixed(1);
            media = m;
            mediaColor = m >= 6 ? 'var(--success)' : 'var(--danger)';
        }
        
        tableHTML += `<tr>`;
        tableHTML += `<td><strong>${aluno.nome}</strong></td>`;
        
        if (isTeacher) {
            tableHTML += `<td><input type="number" class="grade-input ${av1 ? 'filled' : ''}" value="${av1}" data-aluno="${aluno._id}" data-tipo="AV1" step="0.1" min="0" max="10"></td>`;
            tableHTML += `<td><input type="number" class="grade-input ${av2 ? 'filled' : ''}" value="${av2}" data-aluno="${aluno._id}" data-tipo="AV2" step="0.1" min="0" max="10"></td>`;
            tableHTML += `<td><input type="number" class="grade-input ${p1 ? 'filled' : ''}" value="${p1}" data-aluno="${aluno._id}" data-tipo="P1" step="0.1" min="0" max="10"></td>`;
        } else {
            tableHTML += `<td>${av1 || '-'}</td>`;
            tableHTML += `<td>${av2 || '-'}</td>`;
            tableHTML += `<td>${p1 || '-'}</td>`;
        }
        
        tableHTML += `<td style="color: ${mediaColor}; font-weight: 700; font-size: 16px;">${media}</td>`;
        tableHTML += `</tr>`;
    });
    
    tableHTML += `</tbody></table></div>`;
    
    document.getElementById('notas-table-container').innerHTML = tableHTML;
    
    if (isTeacher) {
        gradeInputs = Array.from(document.querySelectorAll('.grade-input'));
        gradeInputs.forEach((input, idx) => {
            input.addEventListener('focus', () => {
                currentGradeIndex = idx;
            });
            
            input.addEventListener('blur', async () => {
                if (input.value && input.value >= 0 && input.value <= 10) {
                    input.classList.add('filled');
                    await api('/api/notas', 'POST', {
                        alunoId: input.dataset.aluno,
                        materia: document.getElementById('nota-materia').value,
                        bimestre: parseInt(document.getElementById('nota-bimestre').value),
                        tipo: input.dataset.tipo,
                        nota: parseFloat(input.value)
                    });
                }
            });
        });
        
        if (gradeInputs[0]) {
            gradeInputs[0].focus();
        }
    }
}

// ==================== PRESENÇA ====================
let presencaState = {};

async function loadPresenca() {
    const materiaId = document.getElementById('presenca-materia').value;
    const data = document.getElementById('presenca-data').value;
    
    if (!materiaId || !data) return;
    
    showSkeleton('presenca-list', 3);
    
    const alunos = await api('/api/alunos');
    const presencas = await api(`/api/presencas?materia=${materiaId}&data=${data}`);
    
    if (!alunos) return;
    
    presencaState = {};
    if (presencas) {
        presencas.forEach(p => {
            presencaState[p.alunoId] = p.status;
        });
    }
    
    document.getElementById('presenca-list').innerHTML = alunos.map(aluno => `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
            <strong>${aluno.nome}</strong>
            <div>
                <button class="attendance-btn ${presencaState[aluno._id] === 'P' ? 'present' : ''}" 
                        onclick="togglePresenca('${aluno._id}', 'P')">
                    ✓ Presente
                </button>
                <button class="attendance-btn ${presencaState[aluno._id] === 'F' ? 'absent' : ''}" 
                        onclick="togglePresenca('${aluno._id}', 'F')">
                    ✗ Falta
                </button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('salvar-presenca-btn').style.display = 'block';
}

function togglePresenca(alunoId, status) {
    presencaState[alunoId] = presencaState[alunoId] === status ? null : status;
    loadPresenca();
}

async function salvarPresenca() {
    const materiaId = document.getElementById('presenca-materia').value;
    const data = document.getElementById('presenca-data').value;
    
    const registros = Object.entries(presencaState)
        .filter(([_, status]) => status)
        .map(([alunoId, status]) => ({
            alunoId,
            materia: materiaId,
            data,
            status
        }));
    
    await api('/api/presencas/batch', 'POST', { registros });
    alert('✅ Presença salva com sucesso!');
}

// ==================== ADMIN ====================
async function loadAdminUsers() {
    showSkeleton('admin-users-list', 3);
    const users = await api('/api/admin/users');
    
    const container = document.getElementById('admin-users-list');
    if (!container) return;
    
    if (!users) return;
    
    container.innerHTML = users.map(user => `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div style="flex: 1;">
                <strong style="display: block; margin-bottom: 4px;">${user.nome}</strong>
                <small style="color: var(--text-dim); display: block; margin-bottom: 8px;">${user.email}</small>
                <span class="badge primary">${user.role}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <select id="role-${user._id}" style="padding: 10px; border-radius: 8px; background: rgba(15, 23, 42, 0.6); border: 2px solid var(--border); color: var(--text); font-size: 12px;">
                    <option ${user.role === 'Aluno' ? 'selected' : ''}>Aluno</option>
                    <option ${user.role === 'Professor' ? 'selected' : ''}>Professor</option>
                    <option ${user.role === 'Direcao' ? 'selected' : ''}>Direcao</option>
                    <option ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="btn" style="padding: 10px 16px;" onclick="updateRole('${user._id}')">
                    SALVAR
                </button>
            </div>
        </div>
    `).join('');
}

async function updateRole(userId) {
    const newRole = document.getElementById('role-' + userId).value;
    await api('/api/admin/update-role', 'POST', { userId, role: newRole });
    loadAdminUsers();
}

// ==================== NAVIGATION ====================
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const view = document.getElementById('view-' + viewName);
    if (view) {
        view.classList.add('active');
    }
    
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.onclick && item.onclick.toString().includes(`'${viewName}'`)) {
            item.classList.add('active');
        }
    });
    
    // Load data for each view
    if (viewName === 'home') loadNoticias();
    if (viewName === 'atividades') loadAtividades();
    if (viewName === 'ocorrencias') loadOcorrencias();
    if (viewName === 'forum') loadForum();
    if (viewName === 'admin') loadAdminUsers();
}

function logout() {
    if (confirm('Deseja realmente sair?')) {
        localStorage.clear();
        location.reload();
    }
}

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
    const userJson = localStorage.getItem('v-user');
    
    if (userJson) {
        try {
            const user = JSON.parse(userJson);
            initApp(user);
        } catch (e) {
            console.error('Invalid user data:', e);
            localStorage.clear();
        }
    }
    
    // Set today as default date for presenca
    const presencaDataInput = document.getElementById('presenca-data');
    if (presencaDataInput) {
        presencaDataInput.valueAsDate = new Date();
    }
});
