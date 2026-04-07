// ========== OFFLINE MODE & SYNC ==========
let isOnline = navigator.onLine;
let syncQueue = [];

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

// ========== API WRAPPER ==========
const api = async (u, m='GET', b=null) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('v-token') || '' };
    
    if (!isOnline && m !== 'GET') {
        addToSyncQueue({ url: u, method: m, headers, body: b ? JSON.stringify(b) : null });
        return { offline: true };
    }
    
    try {
        const r = await fetch(u, { method: m, headers, body: b ? JSON.stringify(b) : null });
        return r.ok ? await r.json() : null;
    } catch (e) {
        if (m !== 'GET') addToSyncQueue({ url: u, method: m, headers, body: b ? JSON.stringify(b) : null });
        return null;
    }
};

// ========== SKELETON LOADERS ==========
function showSkeleton(containerId, count = 3) {
    const container = document.getElementById(containerId);
    container.innerHTML = Array(count).fill(0).map(() => `
        <div class="glass">
            <div class="skeleton" style="width:60%"></div>
            <div class="skeleton" style="width:40%; height:15px"></div>
            <div class="skeleton" style="width:80%; height:15px"></div>
        </div>
    `).join('');
}

// ========== AUTH ==========
let isLogin = true;
function toggleAuthMode() { isLogin = !isLogin; document.getElementById('reg-nome').style.display = isLogin ? 'none' : 'block'; }

async function handleAuth() {
    const r = await api(isLogin ? '/api/auth/login' : '/api/auth/register', 'POST', { 
        email: email.value, 
        senha: senha.value, 
        nome: document.getElementById('reg-nome').value 
    });
    if(r) { 
        if(isLogin) { 
            localStorage.setItem('v-token', r.token); 
            localStorage.setItem('v-user', JSON.stringify(r)); 
            location.reload(); 
        } else toggleAuthMode(); 
    }
}

// ========== INIT APP ==========
function initApp(u) {
    document.getElementById('auth-page').style.display = 'none'; 
    document.getElementById('app-shell').style.display = 'block';
    document.getElementById('user-avatar').src = u.avatar; 
    document.getElementById('user-name-label').innerText = u.nome; 
    document.getElementById('user-role-label').innerText = u.role;
    
    // Admin: tudo
    if(u.role === 'Admin') {
        document.getElementById('nav-admin').style.display = 'block';
        document.getElementById('nav-gestao').style.display = 'block';
        document.getElementById('nav-notas').style.display = 'block';
        document.getElementById('nav-presenca').style.display = 'block';
        document.getElementById('gestao-noticias').style.display = 'block';
        document.getElementById('gestao-tarefas').style.display = 'block';
        document.getElementById('gestao-ocorrencias').style.display = 'block';
    }
    // Direção: notícias, ocorrências, tarefas, notas
    else if(u.role === 'Direcao') {
        document.getElementById('nav-gestao').style.display = 'block';
        document.getElementById('nav-notas').style.display = 'block';
        document.getElementById('gestao-noticias').style.display = 'block';
        document.getElementById('gestao-tarefas').style.display = 'block';
        document.getElementById('gestao-ocorrencias').style.display = 'block';
    }
    // Professor: tarefas, ocorrências, notas, presença
    else if(u.role === 'Professor') {
        document.getElementById('nav-gestao').style.display = 'block';
        document.getElementById('nav-notas').style.display = 'block';
        document.getElementById('nav-presenca').style.display = 'block';
        document.getElementById('gestao-tarefas').style.display = 'block';
        document.getElementById('gestao-ocorrencias').style.display = 'block';
    }
    // Aluno: ver notas
    else if(u.role === 'Aluno') {
        document.getElementById('nav-notas').style.display = 'block';
    }
    
    switchView('home');
    loadMaterias();
}

// ========== MATÉRIAS ==========
let materiasCache = [];
async function loadMaterias() {
    const m = await api('/api/materias');
    if (m) {
        materiasCache = m;
        const opts = m.map(mat => `<option value="${mat._id}">${mat.nome}</option>`).join('');
        document.getElementById('nota-materia').innerHTML = '<option value="">Selecione uma Matéria</option>' + opts;
        document.getElementById('presenca-materia').innerHTML = '<option value="">Selecione uma Matéria</option>' + opts;
    }
}

// ========== FORUM ==========
async function loadForum() {
    showSkeleton('forum-list', 3);
    const d = await api('/api/forum');
    if(d) document.getElementById('forum-list').innerHTML = d.map(t => `
        <div class="glass">
            <h4>${t.titulo}</h4>
            <p style="font-size:12px">${t.conteudo}</p>
            <small style="color:var(--dim)">por ${t.autor}</small>
            ${t.temEnquete ? `
                <div style="margin-top:15px; padding:10px; background:rgba(0,112,255,0.1); border-radius:10px">
                    <b style="font-size:11px">${t.enquete.pergunta}</b>
                    ${t.enquete.opcoes.map((o, idx) => `
                        <div class="poll-opt" onclick="votar('${t._id}', ${idx})">
                            ${o.texto} <span style="float:right; color:var(--primary)">${o.votos} votos</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div style="margin-top:15px">
                ${t.comentarios.map(c => `<div class="comment"><b>${c.autor}:</b> ${c.texto}</div>`).join('')}
                <input id="in-${t._id}" placeholder="Comentar..." style="margin-top:10px">
                <button class="btn" onclick="comentar('${t._id}')">ENVIAR</button>
            </div>
        </div>
    `).join('');
}

async function postarThread() {
    const b = { titulo: document.getElementById('f-tit').value, conteudo: document.getElementById('f-con').value };
    if(document.getElementById('f-enq-p').value) b.enquete = { pergunta: document.getElementById('f-enq-p').value, opcoes: document.getElementById('f-enq-o').value.split(',').map(s => s.trim()) };
    await api('/api/forum', 'POST', b); 
    document.getElementById('f-tit').value = '';
    document.getElementById('f-con').value = '';
    document.getElementById('f-enq-p').value = '';
    document.getElementById('f-enq-o').value = '';
    loadForum();
}

async function comentar(id) { 
    const txt = document.getElementById('in-'+id).value; 
    await api('/api/forum/comentar/'+id, 'POST', { texto: txt }); 
    loadForum(); 
}

async function votar(id, idx) { 
    await api('/api/forum/votar/'+id, 'POST', { opcaoIndex: idx }); 
    loadForum(); 
}

// ========== NOTICIAS ==========
async function loadNoticias() {
    showSkeleton('noticias-list', 3);
    const d = await api('/api/noticias'); 
    if(d) document.getElementById('noticias-list').innerHTML = d.map(n => `
        <div class="glass">
            <b>${n.titulo}</b>
            <p style="font-size:12px; margin:10px 0">${n.conteudo || ''}</p>
            <small style="color:var(--dim)">por ${n.autor}</small>
            ${n.temEnquete ? `
                <div style="margin-top:15px; padding:10px; background:rgba(0,112,255,0.1); border-radius:10px">
                    <b style="font-size:11px">${n.enquete.pergunta}</b>
                    ${n.enquete.opcoes.map((o, idx) => `
                        <div class="poll-opt" onclick="votarNoticia('${n._id}', ${idx})">
                            ${o.texto} <span style="float:right; color:var(--primary)">${o.votos} votos</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div style="margin-top:15px">
                ${(n.comentarios || []).map(c => `<div class="comment"><b>${c.autor}:</b> ${c.texto}</div>`).join('')}
                <input id="nc-in-${n._id}" placeholder="Comentar..." style="margin-top:10px">
                <button class="btn" onclick="comentarNoticia('${n._id}')">ENVIAR</button>
            </div>
        </div>
    `).join('');
}

async function criarNoticia() {
    const b = { titulo: document.getElementById('n-tit').value, conteudo: document.getElementById('n-con').value };
    if(document.getElementById('n-enq-p').value) b.enquete = { pergunta: document.getElementById('n-enq-p').value, opcoes: document.getElementById('n-enq-o').value.split(',').map(s => s.trim()) };
    await api('/api/noticias', 'POST', b);
    document.getElementById('n-tit').value = ''; document.getElementById('n-con').value = ''; document.getElementById('n-enq-p').value = ''; document.getElementById('n-enq-o').value = '';
    loadNoticias();
}

async function comentarNoticia(id) { 
    const txt = document.getElementById('nc-in-'+id).value; 
    await api('/api/noticias/comentar/'+id, 'POST', { texto: txt }); 
    loadNoticias(); 
}

async function votarNoticia(id, idx) { 
    await api('/api/noticias/votar/'+id, 'POST', { opcaoIndex: idx }); 
    loadNoticias(); 
}

// ========== ATIVIDADES ==========
async function loadAtividades() { 
    showSkeleton('atividades-list', 3);
    const d = await api('/api/atividades'); 
    if(d) document.getElementById('atividades-list').innerHTML = d.map(a => `
        <div class="glass">
            <b>${a.materia}</b>: ${a.titulo}<br>
            <small style="color:var(--dim)">Entrega: ${new Date(a.dataEntrega).toLocaleDateString('pt-BR')}</small>
        </div>
    `).join(''); 
}

async function criarTarefa() {
    await api('/api/atividades', 'POST', { 
        materia: document.getElementById('t-mat').value, 
        titulo: document.getElementById('t-tit').value,
        descricao: document.getElementById('t-desc').value,
        dataEntrega: document.getElementById('t-data').value
    });
    document.getElementById('t-mat').value = ''; document.getElementById('t-tit').value = ''; document.getElementById('t-desc').value = ''; document.getElementById('t-data').value = '';
    loadAtividades();
}

// ========== OCORRENCIAS ==========
async function loadOcorrencias() { 
    showSkeleton('ocorrencias-list', 3);
    const d = await api('/api/ocorrencias'); 
    if(d) document.getElementById('ocorrencias-list').innerHTML = d.map(o => `
        <div class="glass" style="border-left:4px solid ${o.tipo === 'Advertência' ? '#ff3366' : o.tipo === 'Elogio' ? '#00ff88' : 'gold'}">
            <b>${o.alunoNome}</b> - ${o.tipo}<br>
            <small>${o.descricao}</small><br>
            <small style="color:var(--dim)">por ${o.autor}</small>
        </div>
    `).join(''); 
}

async function criarOcorrencia() {
    await api('/api/ocorrencias', 'POST', {
        alunoNome: document.getElementById('o-aluno').value,
        tipo: document.getElementById('o-tipo').value,
        descricao: document.getElementById('o-desc').value
    });
    document.getElementById('o-aluno').value = ''; document.getElementById('o-desc').value = '';
    loadOcorrencias();
}

// ========== SISTEMA DE NOTAS (FAST INPUT) ==========
let currentGradeIndex = 0;
let gradeInputs = [];
let ctrlPressed = false;
let numberBuffer = '';

document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') ctrlPressed = true;
    
    if (ctrlPressed && /^[0-9]$/.test(e.key)) {
        numberBuffer += e.key;
    }
});

document.addEventListener('keyup', async (e) => {
    if (e.key === 'Control' && numberBuffer) {
        const value = parseFloat(numberBuffer) / 10;
        if (gradeInputs[currentGradeIndex]) {
            gradeInputs[currentGradeIndex].value = value.toFixed(1);
            gradeInputs[currentGradeIndex].classList.add('filled');
            
            const alunoId = gradeInputs[currentGradeIndex].dataset.aluno;
            const tipo = gradeInputs[currentGradeIndex].dataset.tipo;
            const materia = document.getElementById('nota-materia').value;
            const bimestre = document.getElementById('nota-bimestre').value;
            
            await api('/api/notas', 'POST', {
                alunoId, materia, bimestre, tipo, nota: value
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
    const materia = document.getElementById('nota-materia').value;
    const bimestre = document.getElementById('nota-bimestre').value;
    
    if (!materia) return;
    
    showSkeleton('notas-table-container', 1);
    const alunos = await api('/api/alunos');
    const notas = await api(`/api/notas?materia=${materia}&bimestre=${bimestre}`);
    
    if (!alunos) return;
    
    const notasMap = {};
    if (notas) {
        notas.forEach(n => {
            if (!notasMap[n.alunoId]) notasMap[n.alunoId] = {};
            notasMap[n.alunoId][n.tipo] = n.nota;
        });
    }
    
    gradeInputs = [];
    currentGradeIndex = 0;
    
    const user = JSON.parse(localStorage.getItem('v-user'));
    const isTeacher = ['Professor', 'Admin', 'Direcao'].includes(user.role);
    
    document.getElementById('notas-table-container').innerHTML = `
        <div class="glass" style="overflow-x:auto">
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
                    ${alunos.map(a => {
                        const av1 = notasMap[a._id]?.AV1 || '';
                        const av2 = notasMap[a._id]?.AV2 || '';
                        const p1 = notasMap[a._id]?.P1 || '';
                        const media = av1 && av2 && p1 ? ((av1 + av2 + p1) / 3).toFixed(1) : '-';
                        
                        return `
                            <tr>
                                <td><b>${a.nome}</b></td>
                                <td>${isTeacher ? `<input type="number" class="grade-input ${av1 ? 'filled' : ''}" value="${av1}" data-aluno="${a._id}" data-tipo="AV1" step="0.1" min="0" max="10">` : av1 || '-'}</td>
                                <td>${isTeacher ? `<input type="number" class="grade-input ${av2 ? 'filled' : ''}" value="${av2}" data-aluno="${a._id}" data-tipo="AV2" step="0.1" min="0" max="10">` : av2 || '-'}</td>
                                <td>${isTeacher ? `<input type="number" class="grade-input ${p1 ? 'filled' : ''}" value="${p1}" data-aluno="${a._id}" data-tipo="P1" step="0.1" min="0" max="10">` : p1 || '-'}</td>
                                <td style="color:${media >= 6 ? 'var(--success)' : 'var(--danger)'}; font-weight:800">${media}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    if (isTeacher) {
        gradeInputs = Array.from(document.querySelectorAll('.grade-input'));
        gradeInputs.forEach((inp, idx) => {
            inp.addEventListener('focus', () => currentGradeIndex = idx);
            inp.addEventListener('blur', async () => {
                if (inp.value) {
                    inp.classList.add('filled');
                    await api('/api/notas', 'POST', {
                        alunoId: inp.dataset.aluno,
                        materia: document.getElementById('nota-materia').value,
                        bimestre: document.getElementById('nota-bimestre').value,
                        tipo: inp.dataset.tipo,
                        nota: parseFloat(inp.value)
                    });
                }
            });
        });
        if (gradeInputs[0]) gradeInputs[0].focus();
    }
}

// ========== PRESENÇA ==========
let presencaState = {};

async function loadPresenca() {
    const materia = document.getElementById('presenca-materia').value;
    const data = document.getElementById('presenca-data').value;
    
    if (!materia || !data) return;
    
    showSkeleton('presenca-list', 3);
    const alunos = await api('/api/alunos');
    const presencas = await api(`/api/presencas?materia=${materia}&data=${data}`);
    
    presencaState = {};
    if (presencas) {
        presencas.forEach(p => presencaState[p.alunoId] = p.status);
    }
    
    document.getElementById('presenca-list').innerHTML = alunos.map(a => `
        <div class="glass" style="display:flex; justify-content:space-between; align-items:center">
            <b>${a.nome}</b>
            <div>
                <button class="attendance-btn ${presencaState[a._id] === 'P' ? 'present' : ''}" onclick="togglePresenca('${a._id}', 'P')">P</button>
                <button class="attendance-btn ${presencaState[a._id] === 'F' ? 'absent' : ''}" onclick="togglePresenca('${a._id}', 'F')">F</button>
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
    const materia = document.getElementById('presenca-materia').value;
    const data = document.getElementById('presenca-data').value;
    
    const registros = Object.entries(presencaState).map(([alunoId, status]) => ({
        alunoId, materia, data, status
    })).filter(r => r.status);
    
    await api('/api/presencas/batch', 'POST', { registros });
    alert('Presença salva!');
}

// ========== ADMIN ==========
async function loadAdminUsers() {
    showSkeleton('admin-users-list', 3);
    const users = await api('/api/admin/users');
    if(users) document.getElementById('admin-users-list').innerHTML = users.map(u => `
        <div class="glass" style="display:flex; justify-content:space-between; align-items:center; padding:15px">
            <div>
                <b>${u.nome}</b><br>
                <small style="color:var(--dim)">${u.email}</small><br>
                <span style="color:var(--primary); font-size:10px; font-weight:800">${u.role}</span>
            </div>
            <div>
                <select id="role-${u._id}" style="background: rgba(0,0,0,0.4); border: 1px solid var(--border); color: #fff; padding: 8px; border-radius: 8px; margin-right:5px; font-size:11px">
                    <option ${u.role === 'Aluno' ? 'selected' : ''}>Aluno</option>
                    <option ${u.role === 'Professor' ? 'selected' : ''}>Professor</option>
                    <option ${u.role === 'Direcao' ? 'selected' : ''}>Direcao</option>
                    <option ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="btn" style="width:auto; padding:8px 15px; font-size:10px" onclick="updateRole('${u._id}')">ATUALIZAR</button>
            </div>
        </div>
    `).join('');
}

async function updateRole(userId) {
    const newRole = document.getElementById('role-'+userId).value;
    await api('/api/admin/update-role', 'POST', { userId, role: newRole });
    loadAdminUsers();
}

// ========== NAV ==========
function switchView(v) {
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    document.getElementById('view-'+v).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(x => { if(x.onclick && x.onclick.toString().includes(`'${v}'`)) x.classList.add('active'); });
    if(v === 'home') loadNoticias(); 
    if(v === 'atividades') loadAtividades(); 
    if(v === 'ocorrencias') loadOcorrencias(); 
    if(v === 'forum') loadForum();
    if(v === 'admin') loadAdminUsers();
    if(v === 'notas') {
        const user = JSON.parse(localStorage.getItem('v-user'));
        if (user.role === 'Aluno') loadNotasMateria();
    }
}

function logout() { localStorage.clear(); location.reload(); }

// ========== INIT ==========
window.onload = () => { 
    const u = localStorage.getItem('v-user'); 
    if(u) initApp(JSON.parse(u)); 
    
    // Set presenca data to today
    document.getElementById('presenca-data').valueAsDate = new Date();
};
