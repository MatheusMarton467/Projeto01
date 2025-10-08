/* QuestMe - app.js
 * Padrão Profissional: Organização por Módulos
 * Gerencia Missões, XP, Gems, Gacha, Achieves, e Confetti.
 */

// ====================================================================
// 1. ESTADO E PERSISTÊNCIA (localStorage)
// ====================================================================

const STORAGE_KEY = 'questme_state_v1';

function defaultState() {
  return {
    xp: 0,
    gems: 0,
    missions: [], // {id, text, diff, done, createdAt}
    chars: [],    // Personagens desbloqueados (ids)
    achieved: []  // Conquistas (ids)

  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    return JSON.parse(raw)
  } catch (e) {
    // Em caso de erro, retorna estado inicial seguro
    console.error("Erro ao carregar estado:", e);
    return defaultState()
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const state = loadState();

// ---------------------- LEVELING & REWARDS --------------------------

function xpForNext(level) {
  // nextXP = 50 * level^2 (Fórmula levemente exponencial)
  return 50 * Math.pow(level, 2);
}

function levelFromXp(xp) {
  // Fórmula inversa para calcular o nível atual
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function getRewardForLevel(level) {
  // Recompensa por alcançar um novo nível
  return {
    gems: level * 5, // Gems aumentam conforme o nível
    xpBonus: 100    // Bônus fixo de XP para ajudar a acelerar o próximo nível
  };
}

function rewardForDifficulty(diff) {
  if (diff === 1) return {
    xp: 5,
    gems: 1
  };
  if (diff === 2) return {
    xp: 10,
    gems: 2
  };
  return {
    xp: 20,
    gems: 4
  };
}


// ====================================================================
// 2. ELEMENTOS DOM (CACHE)
// ====================================================================

const el = {
  // Status
  xpValue: document.getElementById('xp-value'),
  xpFill: document.getElementById('xp-fill'),
  levelValue: document.getElementById('level-value'),
  gemsValue: document.getElementById('gems-value'),

  // Inputs e Botões
  missionInput: document.getElementById('mission-input'),
  difficulty: document.getElementById('difficulty'),
  addBtn: document.getElementById('add-btn'),
  btnGacha: document.getElementById('btn-gacha'),
  btnChar: document.getElementById('btn-char'),
  btnAch: document.getElementById('btn-ach'),

  // Missões
  missionList: document.getElementById('mission-list'),
  empty: document.getElementById('empty'),

  // Modal
  modal: document.getElementById('modal'),
  modalContent: document.getElementById('modal-content'),
  modalClose: document.getElementById('modal-close'),

  // Confetti
  confettiCanvas: document.getElementById('confetti')
};

// ====================================================================
// 3. RENDERIZAÇÃO E UI
// ====================================================================

function renderStatus() {
  const lvl = levelFromXp(state.xp);
  const currentXpForLevel = 50 * Math.pow(lvl - 1, 2);
  const next = xpForNext(lvl);

  // Calcula progresso da XP
  const progress = Math.max(0, Math.min(100, ((state.xp - currentXpForLevel) / (next - currentXpForLevel)) * 100));

  // Atualiza o DOM
  el.xpValue.textContent = state.xp;
  el.levelValue.textContent = lvl;
  el.xpFill.style.width = `${progress}%`;
  el.gemsValue.textContent = state.gems;
}

function renderMissions() {
  el.missionList.innerHTML = '';

  if (state.missions.length === 0) {
    el.empty.style.display = 'block';
    return; // Sai da função se não houver missões
  }

  el.empty.style.display = 'none';

  state.missions.forEach(m => {
    const li = document.createElement('li');
    li.className = 'mission' + (m.done ? ' done' : '');
    li.dataset.id = m.id;

    // Estrutura complexa do item da lista (limpo no JS)
    li.innerHTML = `
            <div class="ch">
                <input type="checkbox" ${m.done ? 'checked' : ''} data-mission-id="${m.id}" />
            </div>
            <div class="title">
                <div>${m.text}</div>
                <div class="meta">${m.diff === 1 ? 'Fácil (5 XP)' : m.diff === 2 ? 'Médio (10 XP)' : 'Difícil (20 XP)'}</div>
            </div>
            <div class="actions">
                <button class="btn btn-remove" data-mission-id="${m.id}">Remover</button>
            </div>
        `;

    el.missionList.appendChild(li);
  });

  // Atacha eventos aos botões de Remover e Checkbox (delegação ou seletor)
  el.missionList.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => removeMission(e.target.dataset.missionId));
  });
  el.missionList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', (e) => toggleMission(e.target.dataset.missionId));
  });
}


// ====================================================================
// 4. LÓGICA DAS MISSÕES
// ====================================================================

function addMission(text, diff) {
  if (!text || text.trim().length === 0) return;
  const id = Date.now() + Math.floor(Math.random() * 999);
  state.missions.push({
    id,
    text: text.trim(),
    diff: Number(diff),
    done: false,
    createdAt: Date.now()
  });
  saveState();
  renderMissions();
}

let cachedLevel;

// Função para verificar se o XP acumulado resultou em um Level Up
function checkLevelUp() {
  const newLevel = levelFromXp(state.xp);
  if (newLevel <= cachedLevel) return;

  // 1. GERA A RECOMPENSA E O HTML DA MENSAGEM
  const reward = getRewardForLevel(newLevel);
  cachedLevel = newLevel;

  showModal(`
        <div data-action="level-up" data-level="${newLevel}" data-gems="${reward.gems}" data-xp-bonus="${reward.xpBonus}">
            <h3> Level Up! - Recompensas!</h3>
            <p style="text-align: center;">Você alcançou o nível **${newLevel}** — Parabéns! Continue evoluindo!</p>
            <div class="modal-reward" style="font-weight: 700; color: var(--accent-c); margin-top: 15px; text-align: center;">
                Recompensa: +${reward.gems} 💎 Gems e +${reward.xpBonus} XP de Bônus!
            </div>
        </div>
    `);
}

function removeMission(id) {
  // Converte ID para número, pois veio de dataset
  const numericId = Number(id);
  const idx = state.missions.findIndex(m => m.id === numericId);
  if (idx >= 0) {
    state.missions.splice(idx, 1);
    saveState();
    renderMissions();
  }
}

function toggleMission(id) {
  const numericId = Number(id);
  const m = state.missions.find(x => x.id === numericId);
  if (!m) return;

  m.done = !m.done; // Inverte o estado

  if (m.done) {
    // Recompensa ao completar
    const reward = rewardForDifficulty(m.diff);
    state.xp += reward.xp;
    state.gems += reward.gems;

    checkAchievements();
    checkLevelUp();
    showFloating(`+${reward.xp} XP | +${reward.gems} 💎`);
    fireConfetti(18);
  }
  // Se estiver desmarcando, não há penalidade (simplificação)

  saveState();
  renderStatus();
  renderMissions();
}


// ====================================================================
// 5. CONQUISTAS (ACHIEVEMENTS)
// ====================================================================

const ACHIEVEMENT_LIST = {
  // ----------------------------------------------------
  // 1. PROGRESSO GERAL DE MISSÕES
  // ----------------------------------------------------
  'first': {
    name: 'Primeiro Passo',
    desc: 'Completar 1 missão.',
    condition: (s) => s.missions.filter(m => m.done).length >= 1,
    reward: { gems: 3, xp: 0 }
  },
  'five': {
    name: 'Persistente',
    desc: 'Completar 5 missões.',
    condition: (s) => s.missions.filter(m => m.done).length >= 5,
    reward: { gems: 10, xp: 50 }
  },
  'twenty': {
    name: 'Mestre da Rotina',
    desc: 'Completar 20 missões.',
    condition: (s) => s.missions.filter(m => m.done).length >= 20,
    reward: { gems: 25, xp: 200 }
  },
  'fifty': {
    name: 'Imparável',
    desc: 'Completar 50 missões.',
    condition: (s) => s.missions.filter(m => m.done).length >= 50,
    reward: { gems: 50, xp: 500 }
  },

  // ----------------------------------------------------
  // 2. CONQUISTAS DE GACHA E COLEÇÃO
  // ----------------------------------------------------
  'gacha_first': {
    name: 'Primeira Puxada',
    desc: 'Desbloquear 1 carta.',
    condition: (s) => s.chars.length >= 1,
    reward: { gems: 5, xp: 50 }
  },
  'gacha_ten': {
    name: 'Iniciante Colecionador',
    desc: 'Desbloquear 10 cartas.',
    condition: (s) => s.chars.length >= 10,
    reward: { gems: 15, xp: 100 }
  },
  'gacha_half': {
    name: 'Metade do Baralho',
    desc: 'Desbloquear 50% das cartas disponíveis (20 cartas).',
    // Lembre-se, o CHAR_POOL tem 40 cartas no total
    condition: (s) => s.chars.length >= 20,
    reward: { gems: 30, xp: 300 }
  },

  // ----------------------------------------------------
  // 3. CONQUISTAS DE NÍVEL (XP)
  // ----------------------------------------------------
  'lvl_5': {
    name: 'Ascensão',
    desc: 'Alcançar o Nível 5.',
    condition: (s) => levelFromXp(s.xp) >= 5,
    reward: { gems: 20, xp: 0 }
  },
  'lvl_10': {
    name: 'Veterano',
    desc: 'Alcançar o Nível 10.',
    condition: (s) => levelFromXp(s.xp) >= 10,
    reward: { gems: 40, xp: 0 }
  },

  // ----------------------------------------------------
  // 4. CONQUISTAS DE ECONOMIA (GEMS)
  // ----------------------------------------------------
  'gem_hoarder': {
    name: 'Acumulador de Brilho',
    desc: 'Ter 50 Gems simultaneamente.',
    // Usa o estado atual das gems
    condition: (s) => s.gems >= 50,
    reward: { gems: 10, xp: 50 }
  },
  'gem_rich': {
    name: 'Magnata do Gacha',
    desc: 'Ter 100 Gems simultaneamente.',
    condition: (s) => s.gems >= 100,
    reward: { gems: 25, xp: 100 }
  },

  // ----------------------------------------------------
  // 5. CONQUISTAS DE DESAFIO (DIFICULDADE)
  // ----------------------------------------------------
  'hard_five': {
    name: 'Superando Desafios',
    desc: 'Completar 5 missões de dificuldade "Difícil".',
    // Filtra missões concluídas onde diff é 3
    condition: (s) => s.missions.filter(m => m.done && m.diff === 3).length >= 5,
    reward: { gems: 20, xp: 150 }
  },
};


function checkAchievements() {
  for (const id in ACHIEVEMENT_LIST) {
    const ach = ACHIEVEMENT_LIST[id];

    // 1. Condição: Checa se foi alcançada E se AINDA não está no estado
    if (ach.condition(state) && !state.achieved.includes(id)) {

      state.achieved.push(id); 
      saveState(); 

      showModal(`
                <div data-action="achievement" data-ach-id="${id}" data-gems="${ach.reward.gems}" data-xp="${ach.reward.xp}">
                    <h3>🏆 NOVA CONQUISTA!</h3>
                    <h4 style="text-align: center;">${ach.name}</h4>
                    <p style="margin-bottom: 15px; text-align: center;">"${ach.desc}"</p>
                    <div class="modal-reward" style="font-weight: 700; color: var(--accent-c); text-align: center;">
                        Recompensa: +${ach.reward.gems} 💎 Gems ${ach.reward.xp > 0 ? `e +${ach.reward.xp} XP!` : ''}
                    </div>
                </div>
            `);
    }
  }
}

function openAchievements() {
  let html = `<h3>🏅 Conquistas (${state.achieved.length} / ${Object.keys(ACHIEVEMENT_LIST).length})</h3>
                
                <div class="gallery-scroll-wrapper" style="max-height: 80vh; overflow-y: auto; padding-right: 10px;">
                
                    <ul class="achieve-list" style="list-style:none;padding:0;display:grid;gap:10px">`;

  for (const id in ACHIEVEMENT_LIST) {
    const ach = ACHIEVEMENT_LIST[id];
    const achieved = state.achieved.includes(id);
    const color = achieved ? 'var(--accent-c)' : 'var(--muted)';
    const status = achieved ? 'Desbloqueado' : 'Incompleto';

    let rewardText = '';
    if (ach.reward.gems > 0) rewardText += `+${ach.reward.gems} 💎`;
    if (ach.reward.xp > 0) rewardText += (rewardText ? ' | ' : '+') + `${ach.reward.xp} XP`;
    if (!rewardText) rewardText = 'Sem Recompensa';

    html += `<li style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:var(--card);border:1px solid rgba(255,255,255,0.02)">
                    <div>
                        <strong>${ach.name}</strong> 
                        <div style="color:${color};font-size:0.9rem">${ach.desc}</div>
                    </div>
                    <small style="color:${color}; text-align: right;">
                        ${status}<br/>
                        <span style="font-weight: 700;">${rewardText}</span>
                    </small>
                </li>`;
  }

  html += `</ul>
             </div>`;

  updateModalContent(html);
}

// ====================================================================
// 6. GACHA E PERSONAGENS
// ====================================================================

// --- DADOS DE TEMAS E CARTAS ---
// CORREÇÃO: Adicionando 'img/' aos paths para resolver Erros 404 (Not Found)
const GACHA_THEMES = [
  // Assumimos que a maioria é PNG
  { id: 'pokemon', name: 'Pokémon', path: 'Gatcha/Pokemon', cost: 5, coverExt: 'png' },
  { id: 'digimon', name: 'Digimon', path: 'Gatcha/Digimon Cards', cost: 5, coverExt: 'jpg' }, // PNG
  { id: 'yugioh', name: 'Yu-Gi-Oh!', path: 'Gatcha/Yugioh', cost: 5, coverExt: 'png' },
  { id: 'naruto', name: 'Naruto', path: 'Gatcha/NarutoTCG', cost: 5, coverExt: 'jpg' },
  { id: 'genshin', name: 'Genshin', path: 'Gatcha/Genshin', cost: 5, coverExt: 'png' },
];

// O CHAR_POOL deve ser uma lista plana de *todas* as cartas.
const CHAR_POOL = [
  { id: 'poke-001', themeId: 'pokemon', name: 'Pokemon Card 001', fileCode: 'Carta015', rarity: 'Comum' },
  { id: 'poke-002', themeId: 'pokemon', name: 'Pokemon Card 002', fileCode: 'Carta027', rarity: 'Comum' },
  { id: 'poke-003', themeId: 'pokemon', name: 'Pokemon Card 003', fileCode: 'Carta003', rarity: 'Comum' },
  { id: 'poke-004', themeId: 'pokemon', name: 'Pokemon Card 004', fileCode: 'Carta030', rarity: 'Comum' },
  { id: 'poke-005', themeId: 'pokemon', name: 'Pokemon Card 005', fileCode: 'Carta012', rarity: 'Comum' },
  { id: 'poke-006', themeId: 'pokemon', name: 'Pokemon Card 006', fileCode: 'Carta022', rarity: 'Comum' },
  { id: 'poke-007', themeId: 'pokemon', name: 'Pokemon Card 007', fileCode: 'Carta006', rarity: 'Comum' },
  { id: 'poke-008', themeId: 'pokemon', name: 'Pokemon Card 008', fileCode: 'Carta033', rarity: 'Comum' },
  { id: 'poke-009', themeId: 'pokemon', name: 'Pokemon Card 009', fileCode: 'Carta017', rarity: 'Comum' },
  { id: 'poke-010', themeId: 'pokemon', name: 'Pokemon Card 010', fileCode: 'Carta021', rarity: 'Comum' },
  { id: 'poke-011', themeId: 'pokemon', name: 'Pokemon Card 011', fileCode: 'Carta008', rarity: 'Comum' },
  { id: 'poke-012', themeId: 'pokemon', name: 'Pokemon Card 012', fileCode: 'Carta024', rarity: 'Comum' },
  { id: 'poke-013', themeId: 'pokemon', name: 'Pokemon Card 013', fileCode: 'Carta004', rarity: 'Comum' },
  { id: 'poke-014', themeId: 'pokemon', name: 'Pokemon Card 014', fileCode: 'Carta019', rarity: 'Comum' },
  { id: 'poke-015', themeId: 'pokemon', name: 'Pokemon Card 015', fileCode: 'Carta034', rarity: 'Comum' },
  { id: 'poke-016', themeId: 'pokemon', name: 'Pokemon Card 016', fileCode: 'Carta009', rarity: 'Comum' },
  { id: 'poke-017', themeId: 'pokemon', name: 'Pokemon Card 017', fileCode: 'Carta016', rarity: 'Comum' },
  { id: 'poke-018', themeId: 'pokemon', name: 'Pokemon Card 018', fileCode: 'Carta028', rarity: 'Comum' },
  { id: 'poke-019', themeId: 'pokemon', name: 'Pokemon Card 019', fileCode: 'Carta005', rarity: 'Comum' },
  { id: 'poke-020', themeId: 'pokemon', name: 'Pokemon Card 020', fileCode: 'Carta011', rarity: 'Comum' },
  { id: 'poke-021', themeId: 'pokemon', name: 'Pokemon Card 021', fileCode: 'Carta035', rarity: 'Rara' },
  { id: 'poke-022', themeId: 'pokemon', name: 'Pokemon Card 022', fileCode: 'Carta025', rarity: 'Rara' },
  { id: 'poke-023', themeId: 'pokemon', name: 'Pokemon Card 023', fileCode: 'Carta007', rarity: 'Rara' },
  { id: 'poke-024', themeId: 'pokemon', name: 'Pokemon Card 024', fileCode: 'Carta029', rarity: 'Rara' },
  { id: 'poke-025', themeId: 'pokemon', name: 'Pokemon Card 025', fileCode: 'Carta018', rarity: 'Rara' },
  { id: 'poke-026', themeId: 'pokemon', name: 'Pokemon Card 026', fileCode: 'Carta010', rarity: 'Rara' },
  { id: 'poke-027', themeId: 'pokemon', name: 'Pokemon Card 027', fileCode: 'Carta026', rarity: 'Rara' },
  { id: 'poke-028', themeId: 'pokemon', name: 'Pokemon Card 028', fileCode: 'Carta013', rarity: 'Rara' },
  { id: 'poke-029', themeId: 'pokemon', name: 'Pokemon Card 029', fileCode: 'Carta032', rarity: 'Rara' },
  { id: 'poke-030', themeId: 'pokemon', name: 'Pokemon Card 030', fileCode: 'Carta020', rarity: 'Rara' },
  { id: 'poke-031', themeId: 'pokemon', name: 'Pokemon Card 031', fileCode: 'Carta001', rarity: 'Épica' },
  { id: 'poke-032', themeId: 'pokemon', name: 'Pokemon Card 032', fileCode: 'Carta014', rarity: 'Épica' },
  { id: 'poke-033', themeId: 'pokemon', name: 'Pokemon Card 033', fileCode: 'Carta023', rarity: 'Épica' },
  { id: 'poke-034', themeId: 'pokemon', name: 'Pokemon Card 034', fileCode: 'Carta031', rarity: 'Épica' },
  { id: 'poke-035', themeId: 'pokemon', name: 'Pokemon Card 035', fileCode: 'Carta002', rarity: 'Lendária' },
  // Digimon
  { id: 'digi-001', themeId: 'digimon', name: 'Digimon Card 001', fileCode: 'Carta015', rarity: 'Comum' },
  { id: 'digi-002', themeId: 'digimon', name: 'Digimon Card 002', fileCode: 'Carta112', rarity: 'Comum' },
  { id: 'digi-003', themeId: 'digimon', name: 'Digimon Card 003', fileCode: 'Carta088', rarity: 'Comum' },
  { id: 'digi-004', themeId: 'digimon', name: 'Digimon Card 004', fileCode: 'Carta037', rarity: 'Comum' },
  { id: 'digi-005', themeId: 'digimon', name: 'Digimon Card 005', fileCode: 'Carta071', rarity: 'Comum' },
  { id: 'digi-006', themeId: 'digimon', name: 'Digimon Card 006', fileCode: 'Carta023', rarity: 'Comum' },
  { id: 'digi-007', themeId: 'digimon', name: 'Digimon Card 007', fileCode: 'Carta005', rarity: 'Comum' },
  { id: 'digi-008', themeId: 'digimon', name: 'Digimon Card 008', fileCode: 'Carta109', rarity: 'Comum' },
  { id: 'digi-009', themeId: 'digimon', name: 'Digimon Card 009', fileCode: 'Carta058', rarity: 'Comum' },
  { id: 'digi-010', themeId: 'digimon', name: 'Digimon Card 010', fileCode: 'Carta063', rarity: 'Comum' },
  { id: 'digi-011', themeId: 'digimon', name: 'Digimon Card 011', fileCode: 'Carta041', rarity: 'Comum' },
  { id: 'digi-012', themeId: 'digimon', name: 'Digimon Card 012', fileCode: 'Carta090', rarity: 'Comum' },
  { id: 'digi-013', themeId: 'digimon', name: 'Digimon Card 013', fileCode: 'Carta076', rarity: 'Comum' },
  { id: 'digi-014', themeId: 'digimon', name: 'Digimon Card 014', fileCode: 'Carta033', rarity: 'Comum' },
  { id: 'digi-015', themeId: 'digimon', name: 'Digimon Card 015', fileCode: 'Carta101', rarity: 'Comum' },
  { id: 'digi-016', themeId: 'digimon', name: 'Digimon Card 016', fileCode: 'Carta020', rarity: 'Comum' },
  { id: 'digi-017', themeId: 'digimon', name: 'Digimon Card 017', fileCode: 'Carta096', rarity: 'Comum' },
  { id: 'digi-018', themeId: 'digimon', name: 'Digimon Card 018', fileCode: 'Carta045', rarity: 'Comum' },
  { id: 'digi-019', themeId: 'digimon', name: 'Digimon Card 019', fileCode: 'Carta064', rarity: 'Comum' },
  { id: 'digi-020', themeId: 'digimon', name: 'Digimon Card 020', fileCode: 'Carta084', rarity: 'Comum' },
  { id: 'digi-021', themeId: 'digimon', name: 'Digimon Card 021', fileCode: 'Carta029', rarity: 'Comum' },
  { id: 'digi-022', themeId: 'digimon', name: 'Digimon Card 022', fileCode: 'Carta074', rarity: 'Comum' },
  { id: 'digi-023', themeId: 'digimon', name: 'Digimon Card 023', fileCode: 'Carta121', rarity: 'Comum' },
  { id: 'digi-024', themeId: 'digimon', name: 'Digimon Card 024', fileCode: 'Carta035', rarity: 'Comum' },
  { id: 'digi-025', themeId: 'digimon', name: 'Digimon Card 025', fileCode: 'Carta013', rarity: 'Comum' },
  { id: 'digi-026', themeId: 'digimon', name: 'Digimon Card 026', fileCode: 'Carta129', rarity: 'Comum' },
  { id: 'digi-027', themeId: 'digimon', name: 'Digimon Card 027', fileCode: 'Carta053', rarity: 'Comum' },
  { id: 'digi-028', themeId: 'digimon', name: 'Digimon Card 028', fileCode: 'Carta081', rarity: 'Comum' },
  { id: 'digi-029', themeId: 'digimon', name: 'Digimon Card 029', fileCode: 'Carta079', rarity: 'Comum' },
  { id: 'digi-030', themeId: 'digimon', name: 'Digimon Card 030', fileCode: 'Carta066', rarity: 'Comum' },
  { id: 'digi-031', themeId: 'digimon', name: 'Digimon Card 031', fileCode: 'Carta042', rarity: 'Comum' },
  { id: 'digi-032', themeId: 'digimon', name: 'Digimon Card 032', fileCode: 'Carta115', rarity: 'Comum' },
  { id: 'digi-033', themeId: 'digimon', name: 'Digimon Card 033', fileCode: 'Carta094', rarity: 'Comum' },
  { id: 'digi-034', themeId: 'digimon', name: 'Digimon Card 034', fileCode: 'Carta061', rarity: 'Comum' },
  { id: 'digi-035', themeId: 'digimon', name: 'Digimon Card 035', fileCode: 'Carta107', rarity: 'Comum' },
  { id: 'digi-036', themeId: 'digimon', name: 'Digimon Card 036', fileCode: 'Carta027', rarity: 'Comum' },
  { id: 'digi-037', themeId: 'digimon', name: 'Digimon Card 037', fileCode: 'Carta070', rarity: 'Comum' },
  { id: 'digi-038', themeId: 'digimon', name: 'Digimon Card 038', fileCode: 'Carta044', rarity: 'Comum' },
  { id: 'digi-039', themeId: 'digimon', name: 'Digimon Card 039', fileCode: 'Carta051', rarity: 'Comum' },
  { id: 'digi-040', themeId: 'digimon', name: 'Digimon Card 040', fileCode: 'Carta085', rarity: 'Comum' },
  { id: 'digi-041', themeId: 'digimon', name: 'Digimon Card 041', fileCode: 'Carta011', rarity: 'Comum' },
  { id: 'digi-042', themeId: 'digimon', name: 'Digimon Card 042', fileCode: 'Carta099', rarity: 'Comum' },
  { id: 'digi-043', themeId: 'digimon', name: 'Digimon Card 043', fileCode: 'Carta125', rarity: 'Comum' },
  { id: 'digi-044', themeId: 'digimon', name: 'Digimon Card 044', fileCode: 'Carta075', rarity: 'Comum' },
  { id: 'digi-045', themeId: 'digimon', name: 'Digimon Card 045', fileCode: 'Carta056', rarity: 'Comum' },
  { id: 'digi-046', themeId: 'digimon', name: 'Digimon Card 046', fileCode: 'Carta123', rarity: 'Comum' },
  { id: 'digi-047', themeId: 'digimon', name: 'Digimon Card 047', fileCode: 'Carta039', rarity: 'Comum' },
  { id: 'digi-048', themeId: 'digimon', name: 'Digimon Card 048', fileCode: 'Carta024', rarity: 'Comum' },
  { id: 'digi-049', themeId: 'digimon', name: 'Digimon Card 049', fileCode: 'Carta092', rarity: 'Comum' },
  { id: 'digi-050', themeId: 'digimon', name: 'Digimon Card 050', fileCode: 'Carta065', rarity: 'Comum' },
  { id: 'digi-051', themeId: 'digimon', name: 'Digimon Card 051', fileCode: 'Carta117', rarity: 'Comum' },
  { id: 'digi-052', themeId: 'digimon', name: 'Digimon Card 052', fileCode: 'Carta050', rarity: 'Comum' },
  { id: 'digi-053', themeId: 'digimon', name: 'Digimon Card 053', fileCode: 'Carta086', rarity: 'Comum' },
  { id: 'digi-054', themeId: 'digimon', name: 'Digimon Card 054', fileCode: 'Carta098', rarity: 'Comum' },
  { id: 'digi-055', themeId: 'digimon', name: 'Digimon Card 055', fileCode: 'Carta102', rarity: 'Comum' },
  { id: 'digi-056', themeId: 'digimon', name: 'Digimon Card 056', fileCode: 'Carta032', rarity: 'Comum' },
  { id: 'digi-057', themeId: 'digimon', name: 'Digimon Card 057', fileCode: 'Carta025', rarity: 'Comum' },
  { id: 'digi-058', themeId: 'digimon', name: 'Digimon Card 058', fileCode: 'Carta073', rarity: 'Comum' },
  { id: 'digi-059', themeId: 'digimon', name: 'Digimon Card 059', fileCode: 'Carta091', rarity: 'Comum' },
  { id: 'digi-060', themeId: 'digimon', name: 'Digimon Card 060', fileCode: 'Carta046', rarity: 'Comum' },
  { id: 'digi-061', themeId: 'digimon', name: 'Digimon Card 061', fileCode: 'Carta114', rarity: 'Comum' },
  { id: 'digi-062', themeId: 'digimon', name: 'Digimon Card 062', fileCode: 'Carta106', rarity: 'Comum' },
  { id: 'digi-063', themeId: 'digimon', name: 'Digimon Card 063', fileCode: 'Carta077', rarity: 'Comum' },
  { id: 'digi-064', themeId: 'digimon', name: 'Digimon Card 064', fileCode: 'Carta012', rarity: 'Comum' },
  { id: 'digi-065', themeId: 'digimon', name: 'Digimon Card 065', fileCode: 'Carta026', rarity: 'Comum' },
  { id: 'digi-066', themeId: 'digimon', name: 'Digimon Card 066', fileCode: 'Carta016', rarity: 'Rara' },
  { id: 'digi-067', themeId: 'digimon', name: 'Digimon Card 067', fileCode: 'Carta047', rarity: 'Rara' },
  { id: 'digi-068', themeId: 'digimon', name: 'Digimon Card 068', fileCode: 'Carta126', rarity: 'Rara' },
  { id: 'digi-069', themeId: 'digimon', name: 'Digimon Card 069', fileCode: 'Carta068', rarity: 'Rara' },
  { id: 'digi-070', themeId: 'digimon', name: 'Digimon Card 070', fileCode: 'Carta082', rarity: 'Rara' },
  { id: 'digi-071', themeId: 'digimon', name: 'Digimon Card 071', fileCode: 'Carta105', rarity: 'Rara' },
  { id: 'digi-072', themeId: 'digimon', name: 'Digimon Card 072', fileCode: 'Carta059', rarity: 'Rara' },
  { id: 'digi-073', themeId: 'digimon', name: 'Digimon Card 073', fileCode: 'Carta118', rarity: 'Rara' },
  { id: 'digi-074', themeId: 'digimon', name: 'Digimon Card 074', fileCode: 'Carta019', rarity: 'Rara' },
  { id: 'digi-075', themeId: 'digimon', name: 'Digimon Card 075', fileCode: 'Carta067', rarity: 'Rara' },
  { id: 'digi-076', themeId: 'digimon', name: 'Digimon Card 076', fileCode: 'Carta028', rarity: 'Rara' },
  { id: 'digi-077', themeId: 'digimon', name: 'Digimon Card 077', fileCode: 'Carta089', rarity: 'Rara' },
  { id: 'digi-078', themeId: 'digimon', name: 'Digimon Card 078', fileCode: 'Carta110', rarity: 'Rara' },
  { id: 'digi-079', themeId: 'digimon', name: 'Digimon Card 079', fileCode: 'Carta007', rarity: 'Rara' },
  { id: 'digi-080', themeId: 'digimon', name: 'Digimon Card 080', fileCode: 'Carta120', rarity: 'Rara' },
  { id: 'digi-081', themeId: 'digimon', name: 'Digimon Card 081', fileCode: 'Carta034', rarity: 'Rara' },
  { id: 'digi-082', themeId: 'digimon', name: 'Digimon Card 082', fileCode: 'Carta078', rarity: 'Rara' },
  { id: 'digi-083', themeId: 'digimon', name: 'Digimon Card 083', fileCode: 'Carta018', rarity: 'Rara' },
  { id: 'digi-084', themeId: 'digimon', name: 'Digimon Card 084', fileCode: 'Carta048', rarity: 'Rara' },
  { id: 'digi-085', themeId: 'digimon', name: 'Digimon Card 085', fileCode: 'Carta097', rarity: 'Rara' },
  { id: 'digi-086', themeId: 'digimon', name: 'Digimon Card 086', fileCode: 'Carta055', rarity: 'Rara' },
  { id: 'digi-087', themeId: 'digimon', name: 'Digimon Card 087', fileCode: 'Carta127', rarity: 'Rara' },
  { id: 'digi-088', themeId: 'digimon', name: 'Digimon Card 088', fileCode: 'Carta014', rarity: 'Rara' },
  { id: 'digi-089', themeId: 'digimon', name: 'Digimon Card 089', fileCode: 'Carta093', rarity: 'Rara' },
  { id: 'digi-090', themeId: 'digimon', name: 'Digimon Card 090', fileCode: 'Carta124', rarity: 'Rara' },
  { id: 'digi-091', themeId: 'digimon', name: 'Digimon Card 091', fileCode: 'Carta054', rarity: 'Rara' },
  { id: 'digi-092', themeId: 'digimon', name: 'Digimon Card 092', fileCode: 'Carta080', rarity: 'Rara' },
  { id: 'digi-093', themeId: 'digimon', name: 'Digimon Card 093', fileCode: 'Carta010', rarity: 'Rara' },
  { id: 'digi-094', themeId: 'digimon', name: 'Digimon Card 094', fileCode: 'Carta038', rarity: 'Rara' },
  { id: 'digi-095', themeId: 'digimon', name: 'Digimon Card 095', fileCode: 'Carta116', rarity: 'Rara' },
  { id: 'digi-096', themeId: 'digimon', name: 'Digimon Card 096', fileCode: 'Carta022', rarity: 'Rara' },
  { id: 'digi-097', themeId: 'digimon', name: 'Digimon Card 097', fileCode: 'Carta009', rarity: 'Rara' },
  { id: 'digi-098', themeId: 'digimon', name: 'Digimon Card 098', fileCode: 'Carta049', rarity: 'Rara' },
  { id: 'digi-099', themeId: 'digimon', name: 'Digimon Card 099', fileCode: 'Carta100', rarity: 'Rara' },
  { id: 'digi-100', themeId: 'digimon', name: 'Digimon Card 100', fileCode: 'Carta087', rarity: 'Rara' },
  { id: 'digi-101', themeId: 'digimon', name: 'Digimon Card 101', fileCode: 'Carta021', rarity: 'Rara' },
  { id: 'digi-102', themeId: 'digimon', name: 'Digimon Card 102', fileCode: 'Carta060', rarity: 'Rara' },
  { id: 'digi-103', themeId: 'digimon', name: 'Digimon Card 103', fileCode: 'Carta095', rarity: 'Rara' },
  { id: 'digi-104', themeId: 'digimon', name: 'Digimon Card 104', fileCode: 'Carta108', rarity: 'Rara' },
  { id: 'digi-105', themeId: 'digimon', name: 'Digimon Card 105', fileCode: 'Carta119', rarity: 'Rara' },
  { id: 'digi-106', themeId: 'digimon', name: 'Digimon Card 106', fileCode: 'Carta030', rarity: 'Épica' },
  { id: 'digi-107', themeId: 'digimon', name: 'Digimon Card 107', fileCode: 'Carta104', rarity: 'Épica' },
  { id: 'digi-108', themeId: 'digimon', name: 'Digimon Card 108', fileCode: 'Carta031', rarity: 'Épica' },
  { id: 'digi-109', themeId: 'digimon', name: 'Digimon Card 109', fileCode: 'Carta052', rarity: 'Épica' },
  { id: 'digi-110', themeId: 'digimon', name: 'Digimon Card 110', fileCode: 'Carta122', rarity: 'Épica' },
  { id: 'digi-111', themeId: 'digimon', name: 'Digimon Card 111', fileCode: 'Carta017', rarity: 'Épica' },
  { id: 'digi-112', themeId: 'digimon', name: 'Digimon Card 112', fileCode: 'Carta113', rarity: 'Épica' },
  { id: 'digi-113', themeId: 'digimon', name: 'Digimon Card 113', fileCode: 'Carta069', rarity: 'Épica' },
  { id: 'digi-114', themeId: 'digimon', name: 'Digimon Card 114', fileCode: 'Carta128', rarity: 'Épica' },
  { id: 'digi-115', themeId: 'digimon', name: 'Digimon Card 115', fileCode: 'Carta043', rarity: 'Épica' },
  { id: 'digi-116', themeId: 'digimon', name: 'Digimon Card 116', fileCode: 'Carta003', rarity: 'Épica' },
  { id: 'digi-117', themeId: 'digimon', name: 'Digimon Card 117', fileCode: 'Carta072', rarity: 'Épica' },
  { id: 'digi-118', themeId: 'digimon', name: 'Digimon Card 118', fileCode: 'Carta036', rarity: 'Épica' },
  { id: 'digi-119', themeId: 'digimon', name: 'Digimon Card 119', fileCode: 'Carta008', rarity: 'Épica' },
  { id: 'digi-120', themeId: 'digimon', name: 'Digimon Card 120', fileCode: 'Carta062', rarity: 'Épica' },
  { id: 'digi-121', themeId: 'digimon', name: 'Digimon Card 121', fileCode: 'Carta111', rarity: 'Épica' },
  { id: 'digi-122', themeId: 'digimon', name: 'Digimon Card 122', fileCode: 'Carta006', rarity: 'Épica' },
  { id: 'digi-123', themeId: 'digimon', name: 'Digimon Card 123', fileCode: 'Carta040', rarity: 'Épica' },
  { id: 'digi-124', themeId: 'digimon', name: 'Digimon Card 124', fileCode: 'Carta130', rarity: 'Lendária' },
  { id: 'digi-125', themeId: 'digimon', name: 'Digimon Card 125', fileCode: 'Carta001', rarity: 'Lendária' },
  { id: 'digi-126', themeId: 'digimon', name: 'Digimon Card 126', fileCode: 'Carta002', rarity: 'Lendária' },
  { id: 'digi-127', themeId: 'digimon', name: 'Digimon Card 127', fileCode: 'Carta046', rarity: 'Lendária' },
  { id: 'digi-128', themeId: 'digimon', name: 'Digimon Card 128', fileCode: 'Carta103', rarity: 'Lendária' },
  { id: 'digi-129', themeId: 'digimon', name: 'Digimon Card 129', fileCode: 'Carta090', rarity: 'Lendária' },
  { id: 'digi-130', themeId: 'digimon', name: 'Digimon Card 130', fileCode: 'Carta107', rarity: 'Lendária' },
  // Yu-Gi-Oh!
  { id: 'yugi-001', themeId: 'yugioh', name: 'YuGiOh Card 001', fileCode: 'Carta093', rarity: 'Comum' },
  { id: 'yugi-002', themeId: 'yugioh', name: 'YuGiOh Card 002', fileCode: 'Carta030', rarity: 'Comum' },
  { id: 'yugi-003', themeId: 'yugioh', name: 'YuGiOh Card 003', fileCode: 'Carta165', rarity: 'Comum' },
  { id: 'yugi-004', themeId: 'yugioh', name: 'YuGiOh Card 004', fileCode: 'Carta012', rarity: 'Comum' },
  { id: 'yugi-005', themeId: 'yugioh', name: 'YuGiOh Card 005', fileCode: 'Carta173', rarity: 'Comum' },
  { id: 'yugi-006', themeId: 'yugioh', name: 'YuGiOh Card 006', fileCode: 'Carta039', rarity: 'Comum' },
  { id: 'yugi-007', themeId: 'yugioh', name: 'YuGiOh Card 007', fileCode: 'Carta140', rarity: 'Comum' },
  { id: 'yugi-008', themeId: 'yugioh', name: 'YuGiOh Card 008', fileCode: 'Carta144', rarity: 'Comum' },
  { id: 'yugi-009', themeId: 'yugioh', name: 'YuGiOh Card 009', fileCode: 'Carta078', rarity: 'Comum' },
  { id: 'yugi-010', themeId: 'yugioh', name: 'YuGiOh Card 010', fileCode: 'Carta164', rarity: 'Comum' },
  { id: 'yugi-011', themeId: 'yugioh', name: 'YuGiOh Card 011', fileCode: 'Carta082', rarity: 'Comum' },
  { id: 'yugi-012', themeId: 'yugioh', name: 'YuGiOh Card 012', fileCode: 'Carta063', rarity: 'Comum' },
  { id: 'yugi-013', themeId: 'yugioh', name: 'YuGiOh Card 013', fileCode: 'Carta052', rarity: 'Comum' },
  { id: 'yugi-014', themeId: 'yugioh', name: 'YuGiOh Card 014', fileCode: 'Carta117', rarity: 'Comum' },
  { id: 'yugi-015', themeId: 'yugioh', name: 'YuGiOh Card 015', fileCode: 'Carta126', rarity: 'Comum' },
  { id: 'yugi-016', themeId: 'yugioh', name: 'YuGiOh Card 016', fileCode: 'Carta075', rarity: 'Comum' },
  { id: 'yugi-017', themeId: 'yugioh', name: 'YuGiOh Card 017', fileCode: 'Carta017', rarity: 'Comum' },
  { id: 'yugi-018', themeId: 'yugioh', name: 'YuGiOh Card 018', fileCode: 'Carta094', rarity: 'Comum' },
  { id: 'yugi-019', themeId: 'yugioh', name: 'YuGiOh Card 019', fileCode: 'Carta085', rarity: 'Comum' },
  { id: 'yugi-020', themeId: 'yugioh', name: 'YuGiOh Card 020', fileCode: 'Carta015', rarity: 'Comum' },
  { id: 'yugi-021', themeId: 'yugioh', name: 'YuGiOh Card 021', fileCode: 'Carta114', rarity: 'Comum' },
  { id: 'yugi-022', themeId: 'yugioh', name: 'YuGiOh Card 022', fileCode: 'Carta090', rarity: 'Comum' },
  { id: 'yugi-023', themeId: 'yugioh', name: 'YuGiOh Card 023', fileCode: 'Carta047', rarity: 'Comum' },
  { id: 'yugi-024', themeId: 'yugioh', name: 'YuGiOh Card 024', fileCode: 'Carta037', rarity: 'Comum' },
  { id: 'yugi-025', themeId: 'yugioh', name: 'YuGiOh Card 025', fileCode: 'Carta142', rarity: 'Comum' },
  { id: 'yugi-026', themeId: 'yugioh', name: 'YuGiOh Card 026', fileCode: 'Carta072', rarity: 'Comum' },
  { id: 'yugi-027', themeId: 'yugioh', name: 'YuGiOh Card 027', fileCode: 'Carta064', rarity: 'Comum' },
  { id: 'yugi-028', themeId: 'yugioh', name: 'YuGiOh Card 028', fileCode: 'Carta029', rarity: 'Comum' },
  { id: 'yugi-029', themeId: 'yugioh', name: 'YuGiOh Card 029', fileCode: 'Carta077', rarity: 'Comum' },
  { id: 'yugi-030', themeId: 'yugioh', name: 'YuGiOh Card 030', fileCode: 'Carta002', rarity: 'Comum' },
  { id: 'yugi-031', themeId: 'yugioh', name: 'YuGiOh Card 031', fileCode: 'Carta076', rarity: 'Comum' },
  { id: 'yugi-032', themeId: 'yugioh', name: 'YuGiOh Card 032', fileCode: 'Carta096', rarity: 'Comum' },
  { id: 'yugi-033', themeId: 'yugioh', name: 'YuGiOh Card 033', fileCode: 'Carta163', rarity: 'Comum' },
  { id: 'yugi-034', themeId: 'yugioh', name: 'YuGiOh Card 034', fileCode: 'Carta169', rarity: 'Comum' },
  { id: 'yugi-035', themeId: 'yugioh', name: 'YuGiOh Card 035', fileCode: 'Carta174', rarity: 'Comum' },
  { id: 'yugi-036', themeId: 'yugioh', name: 'YuGiOh Card 036', fileCode: 'Carta088', rarity: 'Comum' },
  { id: 'yugi-037', themeId: 'yugioh', name: 'YuGiOh Card 037', fileCode: 'Carta107', rarity: 'Comum' },
  { id: 'yugi-038', themeId: 'yugioh', name: 'YuGiOh Card 038', fileCode: 'Carta019', rarity: 'Comum' },
  { id: 'yugi-039', themeId: 'yugioh', name: 'YuGiOh Card 039', fileCode: 'Carta166', rarity: 'Comum' },
  { id: 'yugi-040', themeId: 'yugioh', name: 'YuGiOh Card 040', fileCode: 'Carta138', rarity: 'Comum' },
  { id: 'yugi-041', themeId: 'yugioh', name: 'YuGiOh Card 041', fileCode: 'Carta069', rarity: 'Comum' },
  { id: 'yugi-042', themeId: 'yugioh', name: 'YuGiOh Card 042', fileCode: 'Carta109', rarity: 'Comum' },
  { id: 'yugi-043', themeId: 'yugioh', name: 'YuGiOh Card 043', fileCode: 'Carta141', rarity: 'Comum' },
  { id: 'yugi-044', themeId: 'yugioh', name: 'YuGiOh Card 044', fileCode: 'Carta087', rarity: 'Comum' },
  { id: 'yugi-045', themeId: 'yugioh', name: 'YuGiOh Card 045', fileCode: 'Carta150', rarity: 'Comum' },
  { id: 'yugi-046', themeId: 'yugioh', name: 'YuGiOh Card 046', fileCode: 'Carta156', rarity: 'Comum' },
  { id: 'yugi-047', themeId: 'yugioh', name: 'YuGiOh Card 047', fileCode: 'Carta110', rarity: 'Comum' },
  { id: 'yugi-048', themeId: 'yugioh', name: 'YuGiOh Card 048', fileCode: 'Carta049', rarity: 'Comum' },
  { id: 'yugi-049', themeId: 'yugioh', name: 'YuGiOh Card 049', fileCode: 'Carta048', rarity: 'Comum' },
  { id: 'yugi-050', themeId: 'yugioh', name: 'YuGiOh Card 050', fileCode: 'Carta022', rarity: 'Comum' },
  { id: 'yugi-051', themeId: 'yugioh', name: 'YuGiOh Card 051', fileCode: 'Carta100', rarity: 'Comum' },
  { id: 'yugi-052', themeId: 'yugioh', name: 'YuGiOh Card 052', fileCode: 'Carta118', rarity: 'Comum' },
  { id: 'yugi-053', themeId: 'yugioh', name: 'YuGiOh Card 053', fileCode: 'Carta062', rarity: 'Comum' },
  { id: 'yugi-054', themeId: 'yugioh', name: 'YuGiOh Card 054', fileCode: 'Carta155', rarity: 'Comum' },
  { id: 'yugi-055', themeId: 'yugioh', name: 'YuGiOh Card 055', fileCode: 'Carta007', rarity: 'Comum' },
  { id: 'yugi-056', themeId: 'yugioh', name: 'YuGiOh Card 056', fileCode: 'Carta134', rarity: 'Comum' },
  { id: 'yugi-057', themeId: 'yugioh', name: 'YuGiOh Card 057', fileCode: 'Carta106', rarity: 'Comum' },
  { id: 'yugi-058', themeId: 'yugioh', name: 'YuGiOh Card 058', fileCode: 'Carta035', rarity: 'Comum' },
  { id: 'yugi-059', themeId: 'yugioh', name: 'YuGiOh Card 059', fileCode: 'Carta050', rarity: 'Comum' },
  { id: 'yugi-060', themeId: 'yugioh', name: 'YuGiOh Card 060', fileCode: 'Carta054', rarity: 'Comum' },
  { id: 'yugi-061', themeId: 'yugioh', name: 'YuGiOh Card 061', fileCode: 'Carta148', rarity: 'Comum' },
  { id: 'yugi-062', themeId: 'yugioh', name: 'YuGiOh Card 062', fileCode: 'Carta108', rarity: 'Comum' },
  { id: 'yugi-063', themeId: 'yugioh', name: 'YuGiOh Card 063', fileCode: 'Carta170', rarity: 'Comum' },
  { id: 'yugi-064', themeId: 'yugioh', name: 'YuGiOh Card 064', fileCode: 'Carta102', rarity: 'Comum' },
  { id: 'yugi-065', themeId: 'yugioh', name: 'YuGiOh Card 065', fileCode: 'Carta013', rarity: 'Comum' },
  { id: 'yugi-066', themeId: 'yugioh', name: 'YuGiOh Card 066', fileCode: 'Carta136', rarity: 'Comum' },
  { id: 'yugi-067', themeId: 'yugioh', name: 'YuGiOh Card 067', fileCode: 'Carta036', rarity: 'Comum' },
  { id: 'yugi-068', themeId: 'yugioh', name: 'YuGiOh Card 068', fileCode: 'Carta004', rarity: 'Comum' },
  { id: 'yugi-069', themeId: 'yugioh', name: 'YuGiOh Card 069', fileCode: 'Carta172', rarity: 'Comum' },
  { id: 'yugi-070', themeId: 'yugioh', name: 'YuGiOh Card 070', fileCode: 'Carta061', rarity: 'Comum' },
  { id: 'yugi-071', themeId: 'yugioh', name: 'YuGiOh Card 071', fileCode: 'Carta139', rarity: 'Comum' },
  { id: 'yugi-072', themeId: 'yugioh', name: 'YuGiOh Card 072', fileCode: 'Carta083', rarity: 'Comum' },
  { id: 'yugi-073', themeId: 'yugioh', name: 'YuGiOh Card 073', fileCode: 'Carta157', rarity: 'Comum' },
  { id: 'yugi-074', themeId: 'yugioh', name: 'YuGiOh Card 074', fileCode: 'Carta146', rarity: 'Comum' },
  { id: 'yugi-075', themeId: 'yugioh', name: 'YuGiOh Card 075', fileCode: 'Carta070', rarity: 'Comum' },
  { id: 'yugi-076', themeId: 'yugioh', name: 'YuGiOh Card 076', fileCode: 'Carta032', rarity: 'Comum' },
  { id: 'yugi-077', themeId: 'yugioh', name: 'YuGiOh Card 077', fileCode: 'Carta158', rarity: 'Comum' },
  { id: 'yugi-078', themeId: 'yugioh', name: 'YuGiOh Card 078', fileCode: 'Carta161', rarity: 'Comum' },
  { id: 'yugi-079', themeId: 'yugioh', name: 'YuGiOh Card 079', fileCode: 'Carta133', rarity: 'Comum' },
  { id: 'yugi-080', themeId: 'yugioh', name: 'YuGiOh Card 080', fileCode: 'Carta028', rarity: 'Comum' },
  { id: 'yugi-081', themeId: 'yugioh', name: 'YuGiOh Card 081', fileCode: 'Carta086', rarity: 'Comum' },
  { id: 'yugi-082', themeId: 'yugioh', name: 'YuGiOh Card 082', fileCode: 'Carta121', rarity: 'Comum' },
  { id: 'yugi-083', themeId: 'yugioh', name: 'YuGiOh Card 083', fileCode: 'Carta079', rarity: 'Comum' },
  { id: 'yugi-084', themeId: 'yugioh', name: 'YuGiOh Card 084', fileCode: 'Carta057', rarity: 'Comum' },
  { id: 'yugi-085', themeId: 'yugioh', name: 'YuGiOh Card 085', fileCode: 'Carta081', rarity: 'Comum' },
  { id: 'yugi-086', themeId: 'yugioh', name: 'YuGiOh Card 086', fileCode: 'Carta097', rarity: 'Comum' },
  { id: 'yugi-087', themeId: 'yugioh', name: 'YuGiOh Card 087', fileCode: 'Carta101', rarity: 'Comum' },
  { id: 'yugi-088', themeId: 'yugioh', name: 'YuGiOh Card 088', fileCode: 'Carta125', rarity: 'Comum' },
  { id: 'yugi-089', themeId: 'yugioh', name: 'YuGiOh Card 089', fileCode: 'Carta089', rarity: 'Comum' },
  { id: 'yugi-090', themeId: 'yugioh', name: 'YuGiOh Card 090', fileCode: 'Carta011', rarity: 'Comum' },
  { id: 'yugi-091', themeId: 'yugioh', name: 'YuGiOh Card 091', fileCode: 'Carta099', rarity: 'Comum' },
  { id: 'yugi-092', themeId: 'yugioh', name: 'YuGiOh Card 092', fileCode: 'Carta046', rarity: 'Comum' },
  { id: 'yugi-093', themeId: 'yugioh', name: 'YuGiOh Card 093', fileCode: 'Carta123', rarity: 'Comum' },
  { id: 'yugi-094', themeId: 'yugioh', name: 'YuGiOh Card 094', fileCode: 'Carta098', rarity: 'Comum' },
  { id: 'yugi-095', themeId: 'yugioh', name: 'YuGiOh Card 095', fileCode: 'Carta175', rarity: 'Comum' },
  { id: 'yugi-096', themeId: 'yugioh', name: 'YuGiOh Card 096', fileCode: 'Carta071', rarity: 'Comum' },
  { id: 'yugi-097', themeId: 'yugioh', name: 'YuGiOh Card 097', fileCode: 'Carta056', rarity: 'Comum' },
  { id: 'yugi-098', themeId: 'yugioh', name: 'YuGiOh Card 098', fileCode: 'Carta058', rarity: 'Comum' },
  { id: 'yugi-099', themeId: 'yugioh', name: 'YuGiOh Card 099', fileCode: 'Carta130', rarity: 'Comum' },
  { id: 'yugi-100', themeId: 'yugioh', name: 'YuGiOh Card 100', fileCode: 'Carta034', rarity: 'Comum' },
  { id: 'yugi-101', themeId: 'yugioh', name: 'YuGiOh Card 101', fileCode: 'Carta027', rarity: 'Comum' },
  { id: 'yugi-102', themeId: 'yugioh', name: 'YuGiOh Card 102', fileCode: 'Carta111', rarity: 'Comum' },
  { id: 'yugi-103', themeId: 'yugioh', name: 'YuGiOh Card 103', fileCode: 'Carta017', rarity: 'Comum' },
  { id: 'yugi-104', themeId: 'yugioh', name: 'YuGiOh Card 104', fileCode: 'Carta115', rarity: 'Comum' },
  { id: 'yugi-105', themeId: 'yugioh', name: 'YuGiOh Card 105', fileCode: 'Carta127', rarity: 'Comum' },
  { id: 'yugi-106', themeId: 'yugioh', name: 'YuGiOh Card 106', fileCode: 'Carta145', rarity: 'Rara' },
  { id: 'yugi-107', themeId: 'yugioh', name: 'YuGiOh Card 107', fileCode: 'Carta053', rarity: 'Rara' },
  { id: 'yugi-108', themeId: 'yugioh', name: 'YuGiOh Card 108', fileCode: 'Carta168', rarity: 'Rara' },
  { id: 'yugi-109', themeId: 'yugioh', name: 'YuGiOh Card 109', fileCode: 'Carta045', rarity: 'Rara' },
  { id: 'yugi-110', themeId: 'yugioh', name: 'YuGiOh Card 110', fileCode: 'Carta159', rarity: 'Rara' },
  { id: 'yugi-111', themeId: 'yugioh', name: 'YuGiOh Card 111', fileCode: 'Carta116', rarity: 'Rara' },
  { id: 'yugi-112', themeId: 'yugioh', name: 'YuGiOh Card 112', fileCode: 'Carta008', rarity: 'Rara' },
  { id: 'yugi-113', themeId: 'yugioh', name: 'YuGiOh Card 113', fileCode: 'Carta131', rarity: 'Rara' },
  { id: 'yugi-114', themeId: 'yugioh', name: 'YuGiOh Card 114', fileCode: 'Carta124', rarity: 'Rara' },
  { id: 'yugi-115', themeId: 'yugioh', name: 'YuGiOh Card 115', fileCode: 'Carta023', rarity: 'Rara' },
  { id: 'yugi-116', themeId: 'yugioh', name: 'YuGiOh Card 116', fileCode: 'Carta073', rarity: 'Rara' },
  { id: 'yugi-117', themeId: 'yugioh', name: 'YuGiOh Card 117', fileCode: 'Carta162', rarity: 'Rara' },
  { id: 'yugi-118', themeId: 'yugioh', name: 'YuGiOh Card 118', fileCode: 'Carta040', rarity: 'Rara' },
  { id: 'yugi-119', themeId: 'yugioh', name: 'YuGiOh Card 119', fileCode: 'Carta113', rarity: 'Rara' },
  { id: 'yugi-120', themeId: 'yugioh', name: 'YuGiOh Card 120', fileCode: 'Carta016', rarity: 'Rara' },
  { id: 'yugi-121', themeId: 'yugioh', name: 'YuGiOh Card 121', fileCode: 'Carta060', rarity: 'Rara' },
  { id: 'yugi-122', themeId: 'yugioh', name: 'YuGiOh Card 122', fileCode: 'Carta143', rarity: 'Rara' },
  { id: 'yugi-123', themeId: 'yugioh', name: 'YuGiOh Card 123', fileCode: 'Carta135', rarity: 'Rara' },
  { id: 'yugi-124', themeId: 'yugioh', name: 'YuGiOh Card 124', fileCode: 'Carta065', rarity: 'Rara' },
  { id: 'yugi-125', themeId: 'yugioh', name: 'YuGiOh Card 125', fileCode: 'Carta176', rarity: 'Rara' },
  { id: 'yugi-126', themeId: 'yugioh', name: 'YuGiOh Card 126', fileCode: 'Carta059', rarity: 'Rara' },
  { id: 'yugi-127', themeId: 'yugioh', name: 'YuGiOh Card 127', fileCode: 'Carta112', rarity: 'Rara' },
  { id: 'yugi-128', themeId: 'yugioh', name: 'YuGiOh Card 128', fileCode: 'Carta122', rarity: 'Rara' },
  { id: 'yugi-129', themeId: 'yugioh', name: 'YuGiOh Card 129', fileCode: 'Carta055', rarity: 'Rara' },
  { id: 'yugi-130', themeId: 'yugioh', name: 'YuGiOh Card 130', fileCode: 'Carta074', rarity: 'Rara' },
  { id: 'yugi-131', themeId: 'yugioh', name: 'YuGiOh Card 131', fileCode: 'Carta153', rarity: 'Rara' },
  { id: 'yugi-132', themeId: 'yugioh', name: 'YuGiOh Card 132', fileCode: 'Carta129', rarity: 'Rara' },
  { id: 'yugi-133', themeId: 'yugioh', name: 'YuGiOh Card 133', fileCode: 'Carta132', rarity: 'Rara' },
  { id: 'yugi-134', themeId: 'yugioh', name: 'YuGiOh Card 134', fileCode: 'Carta068', rarity: 'Rara' },
  { id: 'yugi-135', themeId: 'yugioh', name: 'YuGiOh Card 135', fileCode: 'Carta147', rarity: 'Rara' },
  { id: 'yugi-136', themeId: 'yugioh', name: 'YuGiOh Card 136', fileCode: 'Carta080', rarity: 'Rara' },
  { id: 'yugi-137', themeId: 'yugioh', name: 'YuGiOh Card 137', fileCode: 'Carta095', rarity: 'Rara' },
  { id: 'yugi-138', themeId: 'yugioh', name: 'YuGiOh Card 138', fileCode: 'Carta154', rarity: 'Rara' },
  { id: 'yugi-139', themeId: 'yugioh', name: 'YuGiOh Card 139', fileCode: 'Carta120', rarity: 'Rara' },
  { id: 'yugi-140', themeId: 'yugioh', name: 'YuGiOh Card 140', fileCode: 'Carta105', rarity: 'Rara' },
  { id: 'yugi-141', themeId: 'yugioh', name: 'YuGiOh Card 141', fileCode: 'Carta033', rarity: 'Rara' },
  { id: 'yugi-142', themeId: 'yugioh', name: 'YuGiOh Card 142', fileCode: 'Carta160', rarity: 'Rara' },
  { id: 'yugi-143', themeId: 'yugioh', name: 'YuGiOh Card 143', fileCode: 'Carta014', rarity: 'Rara' },
  { id: 'yugi-144', themeId: 'yugioh', name: 'YuGiOh Card 144', fileCode: 'Carta066', rarity: 'Rara' },
  { id: 'yugi-145', themeId: 'yugioh', name: 'YuGiOh Card 145', fileCode: 'Carta043', rarity: 'Rara' },
  { id: 'yugi-146', themeId: 'yugioh', name: 'YuGiOh Card 146', fileCode: 'Carta041', rarity: 'Rara' },
  { id: 'yugi-147', themeId: 'yugioh', name: 'YuGiOh Card 147', fileCode: 'Carta025', rarity: 'Rara' },
  { id: 'yugi-148', themeId: 'yugioh', name: 'YuGiOh Card 148', fileCode: 'Carta084', rarity: 'Rara' },
  { id: 'yugi-149', themeId: 'yugioh', name: 'YuGiOh Card 149', fileCode: 'Carta026', rarity: 'Rara' },
  { id: 'yugi-150', themeId: 'yugioh', name: 'YuGiOh Card 150', fileCode: 'Carta092', rarity: 'Épica' },
  { id: 'yugi-151', themeId: 'yugioh', name: 'YuGiOh Card 151', fileCode: 'Carta020', rarity: 'Épica' },
  { id: 'yugi-152', themeId: 'yugioh', name: 'YuGiOh Card 152', fileCode: 'Carta051', rarity: 'Épica' },
  { id: 'yugi-153', themeId: 'yugioh', name: 'YuGiOh Card 153', fileCode: 'Carta103', rarity: 'Épica' },
  { id: 'yugi-154', themeId: 'yugioh', name: 'YuGiOh Card 154', fileCode: 'Carta018', rarity: 'Épica' },
  { id: 'yugi-155', themeId: 'yugioh', name: 'YuGiOh Card 155', fileCode: 'Carta128', rarity: 'Épica' },
  { id: 'yugi-156', themeId: 'yugioh', name: 'YuGiOh Card 156', fileCode: 'Carta042', rarity: 'Épica' },
  { id: 'yugi-157', themeId: 'yugioh', name: 'YuGiOh Card 157', fileCode: 'Carta044', rarity: 'Épica' },
  { id: 'yugi-158', themeId: 'yugioh', name: 'YuGiOh Card 158', fileCode: 'Carta001', rarity: 'Épica' },
  { id: 'yugi-159', themeId: 'yugioh', name: 'YuGiOh Card 159', fileCode: 'Carta067', rarity: 'Épica' },
  { id: 'yugi-160', themeId: 'yugioh', name: 'YuGiOh Card 160', fileCode: 'Carta151', rarity: 'Épica' },
  { id: 'yugi-161', themeId: 'yugioh', name: 'YuGiOh Card 161', fileCode: 'Carta038', rarity: 'Épica' },
  { id: 'yugi-162', themeId: 'yugioh', name: 'YuGiOh Card 162', fileCode: 'Carta137', rarity: 'Épica' },
  { id: 'yugi-163', themeId: 'yugioh', name: 'YuGiOh Card 163', fileCode: 'Carta119', rarity: 'Épica' },
  { id: 'yugi-164', themeId: 'yugioh', name: 'YuGiOh Card 164', fileCode: 'Carta104', rarity: 'Épica' },
  { id: 'yugi-165', themeId: 'yugioh', name: 'YuGiOh Card 165', fileCode: 'Carta031', rarity: 'Épica' },
  { id: 'yugi-166', themeId: 'yugioh', name: 'YuGiOh Card 166', fileCode: 'Carta024', rarity: 'Épica' },
  { id: 'yugi-167', themeId: 'yugioh', name: 'YuGiOh Card 167', fileCode: 'Carta006', rarity: 'Épica' },
  { id: 'yugi-168', themeId: 'yugioh', name: 'YuGiOh Card 168', fileCode: 'Carta005', rarity: 'Lendária' },
  { id: 'yugi-169', themeId: 'yugioh', name: 'YuGiOh Card 169', fileCode: 'Carta010', rarity: 'Lendária' },
  { id: 'yugi-170', themeId: 'yugioh', name: 'YuGiOh Card 170', fileCode: 'Carta091', rarity: 'Lendária' },
  { id: 'yugi-171', themeId: 'yugioh', name: 'YuGiOh Card 171', fileCode: 'Carta084', rarity: 'Lendária' },
  { id: 'yugi-172', themeId: 'yugioh', name: 'YuGiOh Card 172', fileCode: 'Carta009', rarity: 'Lendária' },
  { id: 'yugi-173', themeId: 'yugioh', name: 'YuGiOh Card 173', fileCode: 'Carta086', rarity: 'Lendária' },
  { id: 'yugi-174', themeId: 'yugioh', name: 'YuGiOh Card 174', fileCode: 'Carta003', rarity: 'Lendária' },
  { id: 'yugi-175', themeId: 'yugioh', name: 'YuGiOh Card 175', fileCode: 'Carta046', rarity: 'Lendária' }, // CORRIGIDO: Era Carta084 (duplicata)
  { id: 'yugi-176', themeId: 'yugioh', name: 'YuGiOh Card 176', fileCode: 'Carta021', rarity: 'Lendária' },
  // Naruto
  { id: 'naru-001', themeId: 'naruto', name: 'Naruto Card 001', fileCode: 'Carta105', rarity: 'Comum' },
  { id: 'naru-002', themeId: 'naruto', name: 'Naruto Card 002', fileCode: 'Carta030', rarity: 'Comum' },
  { id: 'naru-003', themeId: 'naruto', name: 'Naruto Card 003', fileCode: 'Carta011', rarity: 'Comum' },
  { id: 'naru-004', themeId: 'naruto', name: 'Naruto Card 004', fileCode: 'Carta165', rarity: 'Comum' },
  { id: 'naru-005', themeId: 'naruto', name: 'Naruto Card 005', fileCode: 'Carta093', rarity: 'Comum' },
  { id: 'naru-006', themeId: 'naruto', name: 'Naruto Card 006', fileCode: 'Carta099', rarity: 'Comum' },
  { id: 'naru-007', themeId: 'naruto', name: 'Naruto Card 007', fileCode: 'Carta184', rarity: 'Comum' },
  { id: 'naru-008', themeId: 'naruto', name: 'Naruto Card 008', fileCode: 'Carta063', rarity: 'Comum' },
  { id: 'naru-009', themeId: 'naruto', name: 'Naruto Card 009', fileCode: 'Carta218', rarity: 'Comum' },
  { id: 'naru-010', themeId: 'naruto', name: 'Naruto Card 010', fileCode: 'Carta012', rarity: 'Comum' },
  { id: 'naru-011', themeId: 'naruto', name: 'Naruto Card 011', fileCode: 'Carta267', rarity: 'Comum' },
  { id: 'naru-012', themeId: 'naruto', name: 'Naruto Card 012', fileCode: 'Carta173', rarity: 'Comum' },
  { id: 'naru-013', themeId: 'naruto', name: 'Naruto Card 013', fileCode: 'Carta098', rarity: 'Comum' },
  { id: 'naru-014', themeId: 'naruto', name: 'Naruto Card 014', fileCode: 'Carta039', rarity: 'Comum' },
  { id: 'naru-015', themeId: 'naruto', name: 'Naruto Card 015', fileCode: 'Carta276', rarity: 'Comum' },
  { id: 'naru-016', themeId: 'naruto', name: 'Naruto Card 016', fileCode: 'Carta198', rarity: 'Comum' },
  { id: 'naru-017', themeId: 'naruto', name: 'Naruto Card 017', fileCode: 'Carta163', rarity: 'Comum' },
  { id: 'naru-018', themeId: 'naruto', name: 'Naruto Card 018', fileCode: 'Carta071', rarity: 'Comum' },
  { id: 'naru-019', themeId: 'naruto', name: 'Naruto Card 019', fileCode: 'Carta206', rarity: 'Comum' },
  { id: 'naru-020', themeId: 'naruto', name: 'Naruto Card 020', fileCode: 'Carta229', rarity: 'Comum' },
  { id: 'naru-021', themeId: 'naruto', name: 'Naruto Card 021', fileCode: 'Carta078', rarity: 'Comum' },
  { id: 'naru-022', themeId: 'naruto', name: 'Naruto Card 022', fileCode: 'Carta058', rarity: 'Comum' },
  { id: 'naru-023', themeId: 'naruto', name: 'Naruto Card 023', fileCode: 'Carta237', rarity: 'Comum' },
  { id: 'naru-024', themeId: 'naruto', name: 'Naruto Card 024', fileCode: 'Carta130', rarity: 'Comum' },
  { id: 'naru-025', themeId: 'naruto', name: 'Naruto Card 025', fileCode: 'Carta082', rarity: 'Comum' },
  { id: 'naru-026', themeId: 'naruto', name: 'Naruto Card 026', fileCode: 'Carta186', rarity: 'Comum' },
  { id: 'naru-027', themeId: 'naruto', name: 'Naruto Card 027', fileCode: 'Carta234', rarity: 'Comum' },
  { id: 'naru-028', themeId: 'naruto', name: 'Naruto Card 028', fileCode: 'Carta266', rarity: 'Comum' },
  { id: 'naru-029', themeId: 'naruto', name: 'Naruto Card 029', fileCode: 'Carta200', rarity: 'Comum' },
  { id: 'naru-030', themeId: 'naruto', name: 'Naruto Card 030', fileCode: 'Carta224', rarity: 'Comum' },
  { id: 'naru-031', themeId: 'naruto', name: 'Naruto Card 031', fileCode: 'Carta117', rarity: 'Comum' },
  { id: 'naru-032', themeId: 'naruto', name: 'Naruto Card 032', fileCode: 'Carta084', rarity: 'Comum' },
  { id: 'naru-033', themeId: 'naruto', name: 'Naruto Card 033', fileCode: 'Carta126', rarity: 'Comum' },
  { id: 'naru-034', themeId: 'naruto', name: 'Naruto Card 034', fileCode: 'Carta216', rarity: 'Comum' },
  { id: 'naru-035', themeId: 'naruto', name: 'Naruto Card 035', fileCode: 'Carta183', rarity: 'Comum' },
  { id: 'naru-036', themeId: 'naruto', name: 'Naruto Card 036', fileCode: 'Carta115', rarity: 'Comum' },
  { id: 'naru-037', themeId: 'naruto', name: 'Naruto Card 037', fileCode: 'Carta144', rarity: 'Comum' },
  { id: 'naru-038', themeId: 'naruto', name: 'Naruto Card 038', fileCode: 'Carta238', rarity: 'Comum' },
  { id: 'naru-039', themeId: 'naruto', name: 'Naruto Card 039', fileCode: 'Carta269', rarity: 'Comum' },
  { id: 'naru-040', themeId: 'naruto', name: 'Naruto Card 040', fileCode: 'Carta102', rarity: 'Comum' },
  { id: 'naru-041', themeId: 'naruto', name: 'Naruto Card 041', fileCode: 'Carta255', rarity: 'Comum' },
  { id: 'naru-042', themeId: 'naruto', name: 'Naruto Card 042', fileCode: 'Carta100', rarity: 'Comum' },
  { id: 'naru-043', themeId: 'naruto', name: 'Naruto Card 043', fileCode: 'Carta015', rarity: 'Comum' },
  { id: 'naru-044', themeId: 'naruto', name: 'Naruto Card 044', fileCode: 'Carta214', rarity: 'Comum' },
  { id: 'naru-045', themeId: 'naruto', name: 'Naruto Card 045', fileCode: 'Carta114', rarity: 'Comum' },
  { id: 'naru-046', themeId: 'naruto', name: 'Naruto Card 046', fileCode: 'Carta075', rarity: 'Comum' },
  { id: 'naru-047', themeId: 'naruto', name: 'Naruto Card 047', fileCode: 'Carta090', rarity: 'Comum' },
  { id: 'naru-048', themeId: 'naruto', name: 'Naruto Card 048', fileCode: 'Carta299', rarity: 'Comum' },
  { id: 'naru-049', themeId: 'naruto', name: 'Naruto Card 049', fileCode: 'Carta047', rarity: 'Comum' },
  { id: 'naru-050', themeId: 'naruto', name: 'Naruto Card 050', fileCode: 'Carta121', rarity: 'Comum' },
  { id: 'naru-051', themeId: 'naruto', name: 'Naruto Card 051', fileCode: 'Carta037', rarity: 'Comum' },
  { id: 'naru-052', themeId: 'naruto', name: 'Naruto Card 052', fileCode: 'Carta122', rarity: 'Comum' },
  { id: 'naru-053', themeId: 'naruto', name: 'Naruto Card 053', fileCode: 'Carta142', rarity: 'Comum' },
  { id: 'naru-054', themeId: 'naruto', name: 'Naruto Card 054', fileCode: 'Carta056', rarity: 'Comum' },
  { id: 'naru-055', themeId: 'naruto', name: 'Naruto Card 055', fileCode: 'Carta217', rarity: 'Comum' },
  { id: 'naru-056', themeId: 'naruto', name: 'Naruto Card 056', fileCode: 'Carta045', rarity: 'Comum' },
  { id: 'naru-057', themeId: 'naruto', name: 'Naruto Card 057', fileCode: 'Carta244', rarity: 'Comum' },
  { id: 'naru-058', themeId: 'naruto', name: 'Naruto Card 058', fileCode: 'Carta154', rarity: 'Comum' },
  { id: 'naru-059', themeId: 'naruto', name: 'Naruto Card 059', fileCode: 'Carta029', rarity: 'Comum' },
  { id: 'naru-060', themeId: 'naruto', name: 'Naruto Card 060', fileCode: 'Carta175', rarity: 'Comum' },
  { id: 'naru-061', themeId: 'naruto', name: 'Naruto Card 061', fileCode: 'Carta085', rarity: 'Comum' },
  { id: 'naru-062', themeId: 'naruto', name: 'Naruto Card 062', fileCode: 'Carta219', rarity: 'Comum' },
  { id: 'naru-063', themeId: 'naruto', name: 'Naruto Card 063', fileCode: 'Carta002', rarity: 'Comum' },
  { id: 'naru-064', themeId: 'naruto', name: 'Naruto Card 064', fileCode: 'Carta226', rarity: 'Comum' },
  { id: 'naru-065', themeId: 'naruto', name: 'Naruto Card 065', fileCode: 'Carta273', rarity: 'Comum' },
  { id: 'naru-066', themeId: 'naruto', name: 'Naruto Card 066', fileCode: 'Carta291', rarity: 'Comum' },
  { id: 'naru-067', themeId: 'naruto', name: 'Naruto Card 067', fileCode: 'Carta096', rarity: 'Comum' },
  { id: 'naru-068', themeId: 'naruto', name: 'Naruto Card 068', fileCode: 'Carta180', rarity: 'Comum' },
  { id: 'naru-069', themeId: 'naruto', name: 'Naruto Card 069', fileCode: 'Carta222', rarity: 'Comum' },
  { id: 'naru-070', themeId: 'naruto', name: 'Naruto Card 070', fileCode: 'Carta027', rarity: 'Comum' },
  { id: 'naru-071', themeId: 'naruto', name: 'Naruto Card 071', fileCode: 'Carta215', rarity: 'Comum' },
  { id: 'naru-072', themeId: 'naruto', name: 'Naruto Card 072', fileCode: 'Carta018', rarity: 'Comum' },
  { id: 'naru-073', themeId: 'naruto', name: 'Naruto Card 073', fileCode: 'Carta174', rarity: 'Comum' },
  { id: 'naru-074', themeId: 'naruto', name: 'Naruto Card 074', fileCode: 'Carta097', rarity: 'Comum' },
  { id: 'naru-075', themeId: 'naruto', name: 'Naruto Card 075', fileCode: 'Carta088', rarity: 'Comum' },
  { id: 'naru-076', themeId: 'naruto', name: 'Naruto Card 076', fileCode: 'Carta211', rarity: 'Comum' },
  { id: 'naru-077', themeId: 'naruto', name: 'Naruto Card 077', fileCode: 'Carta107', rarity: 'Comum' },
  { id: 'naru-078', themeId: 'naruto', name: 'Naruto Card 078', fileCode: 'Carta248', rarity: 'Comum' },
  { id: 'naru-079', themeId: 'naruto', name: 'Naruto Card 079', fileCode: 'Carta019', rarity: 'Comum' },
  { id: 'naru-080', themeId: 'naruto', name: 'Naruto Card 080', fileCode: 'Carta280', rarity: 'Comum' },
  { id: 'naru-081', themeId: 'naruto', name: 'Naruto Card 081', fileCode: 'Carta191', rarity: 'Comum' },
  { id: 'naru-082', themeId: 'naruto', name: 'Naruto Card 082', fileCode: 'Carta062', rarity: 'Comum' },
  { id: 'naru-083', themeId: 'naruto', name: 'Naruto Card 083', fileCode: 'Carta041', rarity: 'Comum' },
  { id: 'naru-084', themeId: 'naruto', name: 'Naruto Card 084', fileCode: 'Carta138', rarity: 'Comum' },
  { id: 'naru-085', themeId: 'naruto', name: 'Naruto Card 085', fileCode: 'Carta069', rarity: 'Comum' },
  { id: 'naru-086', themeId: 'naruto', name: 'Naruto Card 086', fileCode: 'Carta230', rarity: 'Comum' },
  { id: 'naru-087', themeId: 'naruto', name: 'Naruto Card 087', fileCode: 'Carta109', rarity: 'Comum' },
  { id: 'naru-088', themeId: 'naruto', name: 'Naruto Card 088', fileCode: 'Carta046', rarity: 'Comum' },
  { id: 'naru-089', themeId: 'naruto', name: 'Naruto Card 089', fileCode: 'Carta247', rarity: 'Comum' },
  { id: 'naru-090', themeId: 'naruto', name: 'Naruto Card 090', fileCode: 'Carta140', rarity: 'Comum' },
  { id: 'naru-091', themeId: 'naruto', name: 'Naruto Card 091', fileCode: 'Carta087', rarity: 'Comum' },
  { id: 'naru-092', themeId: 'naruto', name: 'Naruto Card 092', fileCode: 'Carta050', rarity: 'Comum' },
  { id: 'naru-093', themeId: 'naruto', name: 'Naruto Card 093', fileCode: 'Carta150', rarity: 'Comum' },
  { id: 'naru-094', themeId: 'naruto', name: 'Naruto Card 094', fileCode: 'Carta289', rarity: 'Comum' },
  { id: 'naru-095', themeId: 'naruto', name: 'Naruto Card 095', fileCode: 'Carta156', rarity: 'Comum' },
  { id: 'naru-096', themeId: 'naruto', name: 'Naruto Card 096', fileCode: 'Carta153', rarity: 'Comum' },
  { id: 'naru-097', themeId: 'naruto', name: 'Naruto Card 097', fileCode: 'Carta110', rarity: 'Comum' },
  { id: 'naru-098', themeId: 'naruto', name: 'Naruto Card 098', fileCode: 'Carta083', rarity: 'Comum' },
  { id: 'naru-099', themeId: 'naruto', name: 'Naruto Card 099', fileCode: 'Carta049', rarity: 'Comum' },
  { id: 'naru-100', themeId: 'naruto', name: 'Naruto Card 100', fileCode: 'Carta292', rarity: 'Comum' },
  { id: 'naru-101', themeId: 'naruto', name: 'Naruto Card 101', fileCode: 'Carta282', rarity: 'Comum' },
  { id: 'naru-102', themeId: 'naruto', name: 'Naruto Card 102', fileCode: 'Carta223', rarity: 'Comum' },
  { id: 'naru-103', themeId: 'naruto', name: 'Naruto Card 103', fileCode: 'Carta022', rarity: 'Comum' },
  { id: 'naru-104', themeId: 'naruto', name: 'Naruto Card 104', fileCode: 'Carta169', rarity: 'Comum' },
  { id: 'naru-105', themeId: 'naruto', name: 'Naruto Card 105', fileCode: 'Carta268', rarity: 'Comum' },
  { id: 'naru-106', themeId: 'naruto', name: 'Naruto Card 106', fileCode: 'Carta185', rarity: 'Comum' },
  { id: 'naru-107', themeId: 'naruto', name: 'Naruto Card 107', fileCode: 'Carta118', rarity: 'Comum' },
  { id: 'naru-108', themeId: 'naruto', name: 'Naruto Card 108', fileCode: 'Carta076', rarity: 'Comum' },
  { id: 'naru-109', themeId: 'naruto', name: 'Naruto Card 109', fileCode: 'Carta021', rarity: 'Comum' },
  { id: 'naru-110', themeId: 'naruto', name: 'Naruto Card 110', fileCode: 'Carta271', rarity: 'Comum' },
  { id: 'naru-111', themeId: 'naruto', name: 'Naruto Card 111', fileCode: 'Carta297', rarity: 'Comum' },
  { id: 'naru-112', themeId: 'naruto', name: 'Naruto Card 112', fileCode: 'Carta202', rarity: 'Comum' },
  { id: 'naru-113', themeId: 'naruto', name: 'Naruto Card 113', fileCode: 'Carta007', rarity: 'Comum' },
  { id: 'naru-114', themeId: 'naruto', name: 'Naruto Card 114', fileCode: 'Carta272', rarity: 'Comum' },
  { id: 'naru-115', themeId: 'naruto', name: 'Naruto Card 115', fileCode: 'Carta189', rarity: 'Comum' },
  { id: 'naru-116', themeId: 'naruto', name: 'Naruto Card 116', fileCode: 'Carta208', rarity: 'Comum' },
  { id: 'naru-117', themeId: 'naruto', name: 'Naruto Card 117', fileCode: 'Carta141', rarity: 'Comum' },
  { id: 'naru-118', themeId: 'naruto', name: 'Naruto Card 118', fileCode: 'Carta064', rarity: 'Comum' },
  { id: 'naru-119', themeId: 'naruto', name: 'Naruto Card 119', fileCode: 'Carta035', rarity: 'Comum' },
  { id: 'naru-120', themeId: 'naruto', name: 'Naruto Card 120', fileCode: 'Carta264', rarity: 'Comum' },
  { id: 'naru-121', themeId: 'naruto', name: 'Naruto Card 121', fileCode: 'Carta190', rarity: 'Comum' },
  { id: 'naru-122', themeId: 'naruto', name: 'Naruto Card 122', fileCode: 'Carta079', rarity: 'Comum' },
  { id: 'naru-123', themeId: 'naruto', name: 'Naruto Card 123', fileCode: 'Carta149', rarity: 'Comum' },
  { id: 'naru-124', themeId: 'naruto', name: 'Naruto Card 124', fileCode: 'Carta281', rarity: 'Comum' },
  { id: 'naru-125', themeId: 'naruto', name: 'Naruto Card 125', fileCode: 'Carta148', rarity: 'Comum' },
  { id: 'naru-126', themeId: 'naruto', name: 'Naruto Card 126', fileCode: 'Carta106', rarity: 'Comum' },
  { id: 'naru-127', themeId: 'naruto', name: 'Naruto Card 127', fileCode: 'Carta108', rarity: 'Comum' },
  { id: 'naru-128', themeId: 'naruto', name: 'Naruto Card 128', fileCode: 'Carta232', rarity: 'Comum' },
  { id: 'naru-129', themeId: 'naruto', name: 'Naruto Card 129', fileCode: 'Carta179', rarity: 'Comum' },
  { id: 'naru-130', themeId: 'naruto', name: 'Naruto Card 130', fileCode: 'Carta166', rarity: 'Comum' },
  { id: 'naru-131', themeId: 'naruto', name: 'Naruto Card 131', fileCode: 'Carta209', rarity: 'Comum' },
  { id: 'naru-132', themeId: 'naruto', name: 'Naruto Card 132', fileCode: 'Carta194', rarity: 'Comum' },
  { id: 'naru-133', themeId: 'naruto', name: 'Naruto Card 133', fileCode: 'Carta013', rarity: 'Comum' },
  { id: 'naru-134', themeId: 'naruto', name: 'Naruto Card 134', fileCode: 'Carta178', rarity: 'Comum' },
  { id: 'naru-135', themeId: 'naruto', name: 'Naruto Card 135', fileCode: 'Carta136', rarity: 'Comum' },
  { id: 'naru-136', themeId: 'naruto', name: 'Naruto Card 136', fileCode: 'Carta240', rarity: 'Comum' },
  { id: 'naru-137', themeId: 'naruto', name: 'Naruto Card 137', fileCode: 'Carta036', rarity: 'Comum' },
  { id: 'naru-138', themeId: 'naruto', name: 'Naruto Card 138', fileCode: 'Carta145', rarity: 'Comum' },
  { id: 'naru-139', themeId: 'naruto', name: 'Naruto Card 139', fileCode: 'Carta004', rarity: 'Comum' },
  { id: 'naru-140', themeId: 'naruto', name: 'Naruto Card 140', fileCode: 'Carta124', rarity: 'Comum' },
  { id: 'naru-141', themeId: 'naruto', name: 'Naruto Card 141', fileCode: 'Carta251', rarity: 'Comum' },
  { id: 'naru-142', themeId: 'naruto', name: 'Naruto Card 142', fileCode: 'Carta220', rarity: 'Comum' },
  { id: 'naru-143', themeId: 'naruto', name: 'Naruto Card 143', fileCode: 'Carta061', rarity: 'Comum' },
  { id: 'naru-144', themeId: 'naruto', name: 'Naruto Card 144', fileCode: 'Carta253', rarity: 'Comum' },
  { id: 'naru-145', themeId: 'naruto', name: 'Naruto Card 145', fileCode: 'Carta139', rarity: 'Comum' },
  { id: 'naru-146', themeId: 'naruto', name: 'Naruto Card 146', fileCode: 'Carta274', rarity: 'Comum' },
  { id: 'naru-147', themeId: 'naruto', name: 'Naruto Card 147', fileCode: 'Carta048', rarity: 'Comum' },
  { id: 'naru-148', themeId: 'naruto', name: 'Naruto Card 148', fileCode: 'Carta294', rarity: 'Comum' },
  { id: 'naru-149', themeId: 'naruto', name: 'Naruto Card 149', fileCode: 'Carta054', rarity: 'Comum' },
  { id: 'naru-150', themeId: 'naruto', name: 'Naruto Card 150', fileCode: 'Carta074', rarity: 'Comum' },
  { id: 'naru-151', themeId: 'naruto', name: 'Naruto Card 151', fileCode: 'Carta146', rarity: 'Comum' },
  { id: 'naru-152', themeId: 'naruto', name: 'Naruto Card 152', fileCode: 'Carta298', rarity: 'Comum' },
  { id: 'naru-153', themeId: 'naruto', name: 'Naruto Card 153', fileCode: 'Carta070', rarity: 'Comum' },
  { id: 'naru-154', themeId: 'naruto', name: 'Naruto Card 154', fileCode: 'Carta285', rarity: 'Comum' },
  { id: 'naru-155', themeId: 'naruto', name: 'Naruto Card 155', fileCode: 'Carta032', rarity: 'Comum' },
  { id: 'naru-156', themeId: 'naruto', name: 'Naruto Card 156', fileCode: 'Carta055', rarity: 'Comum' },
  { id: 'naru-157', themeId: 'naruto', name: 'Naruto Card 157', fileCode: 'Carta157', rarity: 'Comum' },
  { id: 'naru-158', themeId: 'naruto', name: 'Naruto Card 158', fileCode: 'Carta111', rarity: 'Comum' },
  { id: 'naru-159', themeId: 'naruto', name: 'Naruto Card 159', fileCode: 'Carta161', rarity: 'Comum' },
  { id: 'naru-160', themeId: 'naruto', name: 'Naruto Card 160', fileCode: 'Carta034', rarity: 'Comum' },
  { id: 'naru-161', themeId: 'naruto', name: 'Naruto Card 161', fileCode: 'Carta241', rarity: 'Comum' },
  { id: 'naru-162', themeId: 'naruto', name: 'Naruto Card 162', fileCode: 'Carta028', rarity: 'Comum' },
  { id: 'naru-163', themeId: 'naruto', name: 'Naruto Card 163', fileCode: 'Carta086', rarity: 'Comum' },
  { id: 'naru-164', themeId: 'naruto', name: 'Naruto Card 164', fileCode: 'Carta044', rarity: 'Comum' },
  { id: 'naru-165', themeId: 'naruto', name: 'Naruto Card 165', fileCode: 'Carta212', rarity: 'Comum' },
  { id: 'naru-166', themeId: 'naruto', name: 'Naruto Card 166', fileCode: 'Carta204', rarity: 'Comum' },
  { id: 'naru-167', themeId: 'naruto', name: 'Naruto Card 167', fileCode: 'Carta155', rarity: 'Comum' },
  { id: 'naru-168', themeId: 'naruto', name: 'Naruto Card 168', fileCode: 'Carta043', rarity: 'Comum' },
  { id: 'naru-169', themeId: 'naruto', name: 'Naruto Card 169', fileCode: 'Carta057', rarity: 'Comum' },
  { id: 'naru-170', themeId: 'naruto', name: 'Naruto Card 170', fileCode: 'Carta210', rarity: 'Comum' },
  { id: 'naru-171', themeId: 'naruto', name: 'Naruto Card 171', fileCode: 'Carta081', rarity: 'Comum' },
  { id: 'naru-172', themeId: 'naruto', name: 'Naruto Card 172', fileCode: 'Carta134', rarity: 'Comum' },
  { id: 'naru-173', themeId: 'naruto', name: 'Naruto Card 173', fileCode: 'Carta017', rarity: 'Comum' },
  { id: 'naru-174', themeId: 'naruto', name: 'Naruto Card 174', fileCode: 'Carta171', rarity: 'Comum' },
  { id: 'naru-175', themeId: 'naruto', name: 'Naruto Card 175', fileCode: 'Carta101', rarity: 'Comum' },
  { id: 'naru-176', themeId: 'naruto', name: 'Naruto Card 176', fileCode: 'Carta123', rarity: 'Comum' },
  { id: 'naru-177', themeId: 'naruto', name: 'Naruto Card 177', fileCode: 'Carta260', rarity: 'Comum' },
  { id: 'naru-178', themeId: 'naruto', name: 'Naruto Card 178', fileCode: 'Carta052', rarity: 'Comum' },
  { id: 'naru-179', themeId: 'naruto', name: 'Naruto Card 179', fileCode: 'Carta089', rarity: 'Comum' },
  { id: 'naru-180', themeId: 'naruto', name: 'Naruto Card 180', fileCode: 'Carta293', rarity: 'Comum' },
  { id: 'naru-181', themeId: 'naruto', name: 'Naruto Card 181', fileCode: 'Carta277', rarity: 'Rara' },
  { id: 'naru-182', themeId: 'naruto', name: 'Naruto Card 182', fileCode: 'Carta197', rarity: 'Rara' },
  { id: 'naru-183', themeId: 'naruto', name: 'Naruto Card 183', fileCode: 'Carta053', rarity: 'Rara' },
  { id: 'naru-184', themeId: 'naruto', name: 'Naruto Card 184', fileCode: 'Carta168', rarity: 'Rara' },
  { id: 'naru-185', themeId: 'naruto', name: 'Naruto Card 185', fileCode: 'Carta259', rarity: 'Rara' },
  { id: 'naru-186', themeId: 'naruto', name: 'Naruto Card 186', fileCode: 'Carta257', rarity: 'Rara' },
  { id: 'naru-187', themeId: 'naruto', name: 'Naruto Card 187', fileCode: 'Carta152', rarity: 'Rara' },
  { id: 'naru-188', themeId: 'naruto', name: 'Naruto Card 188', fileCode: 'Carta133', rarity: 'Rara' },
  { id: 'naru-189', themeId: 'naruto', name: 'Naruto Card 189', fileCode: 'Carta263', rarity: 'Rara' },
  { id: 'naru-190', themeId: 'naruto', name: 'Naruto Card 190', fileCode: 'Carta196', rarity: 'Rara' },
  { id: 'naru-191', themeId: 'naruto', name: 'Naruto Card 191', fileCode: 'Carta235', rarity: 'Rara' },
  { id: 'naru-192', themeId: 'naruto', name: 'Naruto Card 192', fileCode: 'Carta073', rarity: 'Rara' },
  { id: 'naru-193', themeId: 'naruto', name: 'Naruto Card 193', fileCode: 'Carta275', rarity: 'Rara' },
  { id: 'naru-194', themeId: 'naruto', name: 'Naruto Card 194', fileCode: 'Carta203', rarity: 'Rara' },
  { id: 'naru-195', themeId: 'naruto', name: 'Naruto Card 195', fileCode: 'Carta016', rarity: 'Rara' },
  { id: 'naru-196', themeId: 'naruto', name: 'Naruto Card 196', fileCode: 'Carta201', rarity: 'Rara' },
  { id: 'naru-197', themeId: 'naruto', name: 'Naruto Card 197', fileCode: 'Carta172', rarity: 'Rara' },
  { id: 'naru-198', themeId: 'naruto', name: 'Naruto Card 198', fileCode: 'Carta170', rarity: 'Rara' },
  { id: 'naru-199', themeId: 'naruto', name: 'Naruto Card 199', fileCode: 'Carta227', rarity: 'Rara' },
  { id: 'naru-200', themeId: 'naruto', name: 'Naruto Card 200', fileCode: 'Carta296', rarity: 'Rara' },
  { id: 'naru-201', themeId: 'naruto', name: 'Naruto Card 201', fileCode: 'Carta077', rarity: 'Rara' },
  { id: 'naru-202', themeId: 'naruto', name: 'Naruto Card 202', fileCode: 'Carta059', rarity: 'Rara' },
  { id: 'naru-203', themeId: 'naruto', name: 'Naruto Card 203', fileCode: 'Carta250', rarity: 'Rara' },
  { id: 'naru-204', themeId: 'naruto', name: 'Naruto Card 204', fileCode: 'Carta162', rarity: 'Rara' },
  { id: 'naru-205', themeId: 'naruto', name: 'Naruto Card 205', fileCode: 'Carta008', rarity: 'Rara' },
  { id: 'naru-206', themeId: 'naruto', name: 'Naruto Card 206', fileCode: 'Carta195', rarity: 'Rara' },
  { id: 'naru-207', themeId: 'naruto', name: 'Naruto Card 207', fileCode: 'Carta239', rarity: 'Rara' },
  { id: 'naru-208', themeId: 'naruto', name: 'Naruto Card 208', fileCode: 'Carta182', rarity: 'Rara' },
  { id: 'naru-209', themeId: 'naruto', name: 'Naruto Card 209', fileCode: 'Carta116', rarity: 'Rara' },
  { id: 'naru-210', themeId: 'naruto', name: 'Naruto Card 210', fileCode: 'Carta147', rarity: 'Rara' },
  { id: 'naru-211', themeId: 'naruto', name: 'Naruto Card 211', fileCode: 'Carta065', rarity: 'Rara' },
  { id: 'naru-212', themeId: 'naruto', name: 'Naruto Card 212', fileCode: 'Carta033', rarity: 'Rara' },
  { id: 'naru-213', themeId: 'naruto', name: 'Naruto Card 213', fileCode: 'Carta040', rarity: 'Rara' },
  { id: 'naru-214', themeId: 'naruto', name: 'Naruto Card 214', fileCode: 'Carta283', rarity: 'Rara' },
  { id: 'naru-215', themeId: 'naruto', name: 'Naruto Card 215', fileCode: 'Carta131', rarity: 'Rara' },
  { id: 'naru-216', themeId: 'naruto', name: 'Naruto Card 216', fileCode: 'Carta199', rarity: 'Rara' },
  { id: 'naru-217', themeId: 'naruto', name: 'Naruto Card 217', fileCode: 'Carta159', rarity: 'Rara' },
  { id: 'naru-218', themeId: 'naruto', name: 'Naruto Card 218', fileCode: 'Carta112', rarity: 'Rara' },
  { id: 'naru-219', themeId: 'naruto', name: 'Naruto Card 219', fileCode: 'Carta290', rarity: 'Rara' },
  { id: 'naru-220', themeId: 'naruto', name: 'Naruto Card 220', fileCode: 'Carta193', rarity: 'Rara' },
  { id: 'naru-221', themeId: 'naruto', name: 'Naruto Card 221', fileCode: 'Carta254', rarity: 'Rara' },
  { id: 'naru-222', themeId: 'naruto', name: 'Naruto Card 222', fileCode: 'Carta060', rarity: 'Rara' },
  { id: 'naru-223', themeId: 'naruto', name: 'Naruto Card 223', fileCode: 'Carta207', rarity: 'Rara' },
  { id: 'naru-224', themeId: 'naruto', name: 'Naruto Card 224', fileCode: 'Carta236', rarity: 'Rara' },
  { id: 'naru-225', themeId: 'naruto', name: 'Naruto Card 225', fileCode: 'Carta095', rarity: 'Rara' },
  { id: 'naru-226', themeId: 'naruto', name: 'Naruto Card 226', fileCode: 'Carta127', rarity: 'Rara' },
  { id: 'naru-227', themeId: 'naruto', name: 'Naruto Card 227', fileCode: 'Carta023', rarity: 'Rara' },
  { id: 'naru-228', themeId: 'naruto', name: 'Naruto Card 228', fileCode: 'Carta080', rarity: 'Rara' },
  { id: 'naru-229', themeId: 'naruto', name: 'Naruto Card 229', fileCode: 'Carta135', rarity: 'Rara' },
  { id: 'naru-230', themeId: 'naruto', name: 'Naruto Card 230', fileCode: 'Carta158', rarity: 'Rara' },
  { id: 'naru-231', themeId: 'naruto', name: 'Naruto Card 231', fileCode: 'Carta243', rarity: 'Rara' },
  { id: 'naru-232', themeId: 'naruto', name: 'Naruto Card 232', fileCode: 'Carta026', rarity: 'Rara' },
  { id: 'naru-233', themeId: 'naruto', name: 'Naruto Card 233', fileCode: 'Carta256', rarity: 'Rara' },
  { id: 'naru-234', themeId: 'naruto', name: 'Naruto Card 234', fileCode: 'Carta066', rarity: 'Rara' },
  { id: 'naru-235', themeId: 'naruto', name: 'Naruto Card 235', fileCode: 'Carta249', rarity: 'Rara' },
  { id: 'naru-236', themeId: 'naruto', name: 'Naruto Card 236', fileCode: 'Carta094', rarity: 'Rara' },
  { id: 'naru-237', themeId: 'naruto', name: 'Naruto Card 237', fileCode: 'Carta160', rarity: 'Rara' },
  { id: 'naru-238', themeId: 'naruto', name: 'Naruto Card 238', fileCode: 'Carta164', rarity: 'Rara' },
  { id: 'naru-239', themeId: 'naruto', name: 'Naruto Card 239', fileCode: 'Carta119', rarity: 'Rara' },
  { id: 'naru-240', themeId: 'naruto', name: 'Naruto Card 240', fileCode: 'Carta176', rarity: 'Rara' },
  { id: 'naru-241', themeId: 'naruto', name: 'Naruto Card 241', fileCode: 'Carta009', rarity: 'Rara' },
  { id: 'naru-242', themeId: 'naruto', name: 'Naruto Card 242', fileCode: 'Carta270', rarity: 'Rara' },
  { id: 'naru-243', themeId: 'naruto', name: 'Naruto Card 243', fileCode: 'Carta072', rarity: 'Rara' },
  { id: 'naru-244', themeId: 'naruto', name: 'Naruto Card 244', fileCode: 'Carta265', rarity: 'Rara' },
  { id: 'naru-245', themeId: 'naruto', name: 'Naruto Card 245', fileCode: 'Carta113', rarity: 'Rara' },
  { id: 'naru-246', themeId: 'naruto', name: 'Naruto Card 246', fileCode: 'Carta231', rarity: 'Rara' },
  { id: 'naru-247', themeId: 'naruto', name: 'Naruto Card 247', fileCode: 'Carta025', rarity: 'Rara' },
  { id: 'naru-248', themeId: 'naruto', name: 'Naruto Card 248', fileCode: 'Carta246', rarity: 'Rara' },
  { id: 'naru-249', themeId: 'naruto', name: 'Naruto Card 249', fileCode: 'Carta014', rarity: 'Rara' },
  { id: 'naru-250', themeId: 'naruto', name: 'Naruto Card 250', fileCode: 'Carta233', rarity: 'Rara' },
  { id: 'naru-251', themeId: 'naruto', name: 'Naruto Card 251', fileCode: 'Carta188', rarity: 'Rara' },
  { id: 'naru-252', themeId: 'naruto', name: 'Naruto Card 252', fileCode: 'Carta068', rarity: 'Rara' },
  { id: 'naru-253', themeId: 'naruto', name: 'Naruto Card 253', fileCode: 'Carta143', rarity: 'Rara' },
  { id: 'naru-254', themeId: 'naruto', name: 'Naruto Card 254', fileCode: 'Carta129', rarity: 'Rara' },
  { id: 'naru-255', themeId: 'naruto', name: 'Naruto Card 255', fileCode: 'Carta177', rarity: 'Rara' },
  { id: 'naru-256', themeId: 'naruto', name: 'Naruto Card 256', fileCode: 'Carta284', rarity: 'Épica' },
  { id: 'naru-257', themeId: 'naruto', name: 'Naruto Card 257', fileCode: 'Carta242', rarity: 'Épica' },
  { id: 'naru-258', themeId: 'naruto', name: 'Naruto Card 258', fileCode: 'Carta225', rarity: 'Épica' },
  { id: 'naru-259', themeId: 'naruto', name: 'Naruto Card 259', fileCode: 'Carta092', rarity: 'Épica' },
  { id: 'naru-260', themeId: 'naruto', name: 'Naruto Card 260', fileCode: 'Carta020', rarity: 'Épica' },
  { id: 'naru-261', themeId: 'naruto', name: 'Naruto Card 261', fileCode: 'Carta295', rarity: 'Épica' },
  { id: 'naru-262', themeId: 'naruto', name: 'Naruto Card 262', fileCode: 'Carta024', rarity: 'Épica' },
  { id: 'naru-263', themeId: 'naruto', name: 'Naruto Card 263', fileCode: 'Carta051', rarity: 'Épica' },
  { id: 'naru-264', themeId: 'naruto', name: 'Naruto Card 264', fileCode: 'Carta103', rarity: 'Épica' },
  { id: 'naru-265', themeId: 'naruto', name: 'Naruto Card 265', fileCode: 'Carta192', rarity: 'Épica' },
  { id: 'naru-266', themeId: 'naruto', name: 'Naruto Card 266', fileCode: 'Carta286', rarity: 'Épica' },
  { id: 'naru-267', themeId: 'naruto', name: 'Naruto Card 267', fileCode: 'Carta228', rarity: 'Épica' },
  { id: 'naru-268', themeId: 'naruto', name: 'Naruto Card 268', fileCode: 'Carta128', rarity: 'Épica' },
  { id: 'naru-269', themeId: 'naruto', name: 'Naruto Card 269', fileCode: 'Carta042', rarity: 'Épica' },
  { id: 'naru-270', themeId: 'naruto', name: 'Naruto Card 270', fileCode: 'Carta205', rarity: 'Épica' },
  { id: 'naru-271', themeId: 'naruto', name: 'Naruto Card 271', fileCode: 'Carta001', rarity: 'Épica' },
  { id: 'naru-272', themeId: 'naruto', name: 'Naruto Card 272', fileCode: 'Carta067', rarity: 'Épica' },
  { id: 'naru-273', themeId: 'naruto', name: 'Naruto Card 273', fileCode: 'Carta151', rarity: 'Épica' },
  { id: 'naru-274', themeId: 'naruto', name: 'Naruto Card 274', fileCode: 'Carta213', rarity: 'Épica' },
  { id: 'naru-275', themeId: 'naruto', name: 'Naruto Card 275', fileCode: 'Carta006', rarity: 'Épica' },
  { id: 'naru-276', themeId: 'naruto', name: 'Naruto Card 276', fileCode: 'Carta252', rarity: 'Épica' },
  { id: 'naru-277', themeId: 'naruto', name: 'Naruto Card 277', fileCode: 'Carta038', rarity: 'Épica' },
  { id: 'naru-278', themeId: 'naruto', name: 'Naruto Card 278', fileCode: 'Carta137', rarity: 'Épica' },
  { id: 'naru-279', themeId: 'naruto', name: 'Naruto Card 279', fileCode: 'Carta287', rarity: 'Épica' },
  { id: 'naru-280', themeId: 'naruto', name: 'Naruto Card 280', fileCode: 'Carta181', rarity: 'Épica' },
  { id: 'naru-281', themeId: 'naruto', name: 'Naruto Card 281', fileCode: 'Carta104', rarity: 'Épica' },
  { id: 'naru-282', themeId: 'naruto', name: 'Naruto Card 282', fileCode: 'Carta300', rarity: 'Épica' },
  { id: 'naru-283', themeId: 'naruto', name: 'Naruto Card 283', fileCode: 'Carta258', rarity: 'Épica' },
  { id: 'naru-284', themeId: 'naruto', name: 'Naruto Card 284', fileCode: 'Carta120', rarity: 'Épica' },
  { id: 'naru-285', themeId: 'naruto', name: 'Naruto Card 285', fileCode: 'Carta031', rarity: 'Épica' },
  { id: 'naru-286', themeId: 'naruto', name: 'Naruto Card 286', fileCode: 'Carta005', rarity: 'Lendária' },
  { id: 'naru-287', themeId: 'naruto', name: 'Naruto Card 287', fileCode: 'Carta261', rarity: 'Lendária' },
  { id: 'naru-288', themeId: 'naruto', name: 'Naruto Card 288', fileCode: 'Carta288', rarity: 'Lendária' },
  { id: 'naru-289', themeId: 'naruto', name: 'Naruto Card 289', fileCode: 'Carta003', rarity: 'Lendária' },
  { id: 'naru-290', themeId: 'naruto', name: 'Naruto Card 290', fileCode: 'Carta010', rarity: 'Lendária' },
  { id: 'naru-291', themeId: 'naruto', name: 'Naruto Card 291', fileCode: 'Carta245', rarity: 'Lendária' },
  { id: 'naru-292', themeId: 'naruto', name: 'Naruto Card 292', fileCode: 'Carta167', rarity: 'Lendária' },
  { id: 'naru-293', themeId: 'naruto', name: 'Naruto Card 293', fileCode: 'Carta091', rarity: 'Lendária' },
  { id: 'naru-294', themeId: 'naruto', name: 'Naruto Card 294', fileCode: 'Carta040', rarity: 'Lendária' },
  { id: 'naru-295', themeId: 'naruto', name: 'Naruto Card 295', fileCode: 'Carta040', rarity: 'Lendária' },
  { id: 'naru-296', themeId: 'naruto', name: 'Naruto Card 296', fileCode: 'Carta221', rarity: 'Lendária' },
  { id: 'naru-297', themeId: 'naruto', name: 'Naruto Card 297', fileCode: 'Carta120', rarity: 'Lendária' },
  { id: 'naru-298', themeId: 'naruto', name: 'Naruto Card 298', fileCode: 'Carta084', rarity: 'Lendária' },
  { id: 'naru-299', themeId: 'naruto', name: 'Naruto Card 299', fileCode: 'Carta129', rarity: 'Lendária' },
  { id: 'naru-300', themeId: 'naruto', name: 'Naruto Card 300', fileCode: 'Carta286', rarity: 'Lendária' },
  // Genshin
  { id: 'genshin-001', themeId: 'genshin', name: 'Genshin Card 001', fileCode: 'Carta022', rarity: 'Comum' },
  { id: 'genshin-002', themeId: 'genshin', name: 'Genshin Card 002', fileCode: 'Carta090', rarity: 'Comum' },
  { id: 'genshin-003', themeId: 'genshin', name: 'Genshin Card 003', fileCode: 'Carta058', rarity: 'Comum' },
  { id: 'genshin-004', themeId: 'genshin', name: 'Genshin Card 004', fileCode: 'Carta018', rarity: 'Comum' },
  { id: 'genshin-005', themeId: 'genshin', name: 'Genshin Card 005', fileCode: 'Carta030', rarity: 'Comum' },
  { id: 'genshin-006', themeId: 'genshin', name: 'Genshin Card 006', fileCode: 'Carta084', rarity: 'Comum' },
  { id: 'genshin-007', themeId: 'genshin', name: 'Genshin Card 007', fileCode: 'Carta003', rarity: 'Comum' },
  { id: 'genshin-008', themeId: 'genshin', name: 'Genshin Card 008', fileCode: 'Carta046', rarity: 'Comum' },
  { id: 'genshin-009', themeId: 'genshin', name: 'Genshin Card 009', fileCode: 'Carta007', rarity: 'Comum' },
  { id: 'genshin-010', themeId: 'genshin', name: 'Genshin Card 010', fileCode: 'Carta034', rarity: 'Comum' },
  { id: 'genshin-011', themeId: 'genshin', name: 'Genshin Card 011', fileCode: 'Carta048', rarity: 'Comum' },
  { id: 'genshin-012', themeId: 'genshin', name: 'Genshin Card 012', fileCode: 'Carta054', rarity: 'Comum' },
  { id: 'genshin-013', themeId: 'genshin', name: 'Genshin Card 013', fileCode: 'Carta061', rarity: 'Comum' },
  { id: 'genshin-014', themeId: 'genshin', name: 'Genshin Card 014', fileCode: 'Carta072', rarity: 'Comum' },
  { id: 'genshin-015', themeId: 'genshin', name: 'Genshin Card 015', fileCode: 'Carta068', rarity: 'Comum' },
  { id: 'genshin-016', themeId: 'genshin', name: 'Genshin Card 016', fileCode: 'Carta015', rarity: 'Comum' },
  { id: 'genshin-017', themeId: 'genshin', name: 'Genshin Card 017', fileCode: 'Carta004', rarity: 'Comum' },
  { id: 'genshin-018', themeId: 'genshin', name: 'Genshin Card 018', fileCode: 'Carta016', rarity: 'Comum' },
  { id: 'genshin-019', themeId: 'genshin', name: 'Genshin Card 019', fileCode: 'Carta071', rarity: 'Comum' },
  { id: 'genshin-020', themeId: 'genshin', name: 'Genshin Card 020', fileCode: 'Carta056', rarity: 'Comum' },
  { id: 'genshin-021', themeId: 'genshin', name: 'Genshin Card 021', fileCode: 'Carta053', rarity: 'Comum' },
  { id: 'genshin-022', themeId: 'genshin', name: 'Genshin Card 022', fileCode: 'Carta078', rarity: 'Comum' },
  { id: 'genshin-023', themeId: 'genshin', name: 'Genshin Card 023', fileCode: 'Carta085', rarity: 'Comum' },
  { id: 'genshin-024', themeId: 'genshin', name: 'Genshin Card 024', fileCode: 'Carta031', rarity: 'Comum' },
  { id: 'genshin-025', themeId: 'genshin', name: 'Genshin Card 025', fileCode: 'Carta036', rarity: 'Comum' },
  { id: 'genshin-026', themeId: 'genshin', name: 'Genshin Card 026', fileCode: 'Carta039', rarity: 'Comum' },
  { id: 'genshin-027', themeId: 'genshin', name: 'Genshin Card 027', fileCode: 'Carta047', rarity: 'Comum' },
  { id: 'genshin-028', themeId: 'genshin', name: 'Genshin Card 028', fileCode: 'Carta008', rarity: 'Comum' },
  { id: 'genshin-029', themeId: 'genshin', name: 'Genshin Card 029', fileCode: 'Carta010', rarity: 'Comum' },
  { id: 'genshin-030', themeId: 'genshin', name: 'Genshin Card 030', fileCode: 'Carta040', rarity: 'Comum' },
  { id: 'genshin-031', themeId: 'genshin', name: 'Genshin Card 031', fileCode: 'Carta026', rarity: 'Comum' },
  { id: 'genshin-032', themeId: 'genshin', name: 'Genshin Card 032', fileCode: 'Carta065', rarity: 'Comum' },
  { id: 'genshin-033', themeId: 'genshin', name: 'Genshin Card 033', fileCode: 'Carta074', rarity: 'Comum' },
  { id: 'genshin-034', themeId: 'genshin', name: 'Genshin Card 034', fileCode: 'Carta006', rarity: 'Comum' },
  { id: 'genshin-035', themeId: 'genshin', name: 'Genshin Card 035', fileCode: 'Carta070', rarity: 'Comum' },
  { id: 'genshin-036', themeId: 'genshin', name: 'Genshin Card 036', fileCode: 'Carta089', rarity: 'Comum' },
  { id: 'genshin-037', themeId: 'genshin', name: 'Genshin Card 037', fileCode: 'Carta057', rarity: 'Comum' },
  { id: 'genshin-038', themeId: 'genshin', name: 'Genshin Card 038', fileCode: 'Carta013', rarity: 'Comum' },
  { id: 'genshin-039', themeId: 'genshin', name: 'Genshin Card 039', fileCode: 'Carta066', rarity: 'Comum' },
  { id: 'genshin-040', themeId: 'genshin', name: 'Genshin Card 040', fileCode: 'Carta028', rarity: 'Comum' },
  { id: 'genshin-041', themeId: 'genshin', name: 'Genshin Card 041', fileCode: 'Carta033', rarity: 'Comum' },
  { id: 'genshin-042', themeId: 'genshin', name: 'Genshin Card 042', fileCode: 'Carta014', rarity: 'Comum' },
  { id: 'genshin-043', themeId: 'genshin', name: 'Genshin Card 043', fileCode: 'Carta025', rarity: 'Comum' },
  { id: 'genshin-044', themeId: 'genshin', name: 'Genshin Card 044', fileCode: 'Carta019', rarity: 'Comum' },
  { id: 'genshin-045', themeId: 'genshin', name: 'Genshin Card 045', fileCode: 'Carta077', rarity: 'Comum' },
  { id: 'genshin-046', themeId: 'genshin', name: 'Genshin Card 046', fileCode: 'Carta041', rarity: 'Comum' },
  { id: 'genshin-047', themeId: 'genshin', name: 'Genshin Card 047', fileCode: 'Carta083', rarity: 'Comum' },
  { id: 'genshin-048', themeId: 'genshin', name: 'Genshin Card 048', fileCode: 'Carta029', rarity: 'Comum' },
  { id: 'genshin-049', themeId: 'genshin', name: 'Genshin Card 049', fileCode: 'Carta080', rarity: 'Comum' },
  { id: 'genshin-050', themeId: 'genshin', name: 'Genshin Card 050', fileCode: 'Carta050', rarity: 'Comum' },
  { id: 'genshin-051', themeId: 'genshin', name: 'Genshin Card 051', fileCode: 'Carta067', rarity: 'Comum' },
  { id: 'genshin-052', themeId: 'genshin', name: 'Genshin Card 052', fileCode: 'Carta005', rarity: 'Comum' },
  { id: 'genshin-053', themeId: 'genshin', name: 'Genshin Card 053', fileCode: 'Carta081', rarity: 'Comum' },
  { id: 'genshin-054', themeId: 'genshin', name: 'Genshin Card 054', fileCode: 'Carta011', rarity: 'Comum' },
  { id: 'genshin-055', themeId: 'genshin', name: 'Genshin Card 055', fileCode: 'Carta043', rarity: 'Comum' },
  { id: 'genshin-056', themeId: 'genshin', name: 'Genshin Card 056', fileCode: 'Carta055', rarity: 'Comum' },
  { id: 'genshin-057', themeId: 'genshin', name: 'Genshin Card 057', fileCode: 'Carta060', rarity: 'Comum' },
  { id: 'genshin-058', themeId: 'genshin', name: 'Genshin Card 058', fileCode: 'Carta049', rarity: 'Comum' },
  { id: 'genshin-059', themeId: 'genshin', name: 'Genshin Card 059', fileCode: 'Carta051', rarity: 'Comum' },
  { id: 'genshin-060', themeId: 'genshin', name: 'Genshin Card 060', fileCode: 'Carta073', rarity: 'Comum' },
  { id: 'genshin-061', themeId: 'genshin', name: 'Genshin Card 061', fileCode: 'Carta027', rarity: 'Comum' },
  { id: 'genshin-062', themeId: 'genshin', name: 'Genshin Card 062', fileCode: 'Carta052', rarity: 'Comum' },
  { id: 'genshin-063', themeId: 'genshin', name: 'Genshin Card 063', fileCode: 'Carta075', rarity: 'Rara' },
  { id: 'genshin-064', themeId: 'genshin', name: 'Genshin Card 064', fileCode: 'Carta002', rarity: 'Rara' },
  { id: 'genshin-065', themeId: 'genshin', name: 'Genshin Card 065', fileCode: 'Carta097', rarity: 'Rara' },
  { id: 'genshin-066', themeId: 'genshin', name: 'Genshin Card 066', fileCode: 'Carta044', rarity: 'Rara' },
  { id: 'genshin-067', themeId: 'genshin', name: 'Genshin Card 067', fileCode: 'Carta012', rarity: 'Rara' },
  { id: 'genshin-068', themeId: 'genshin', name: 'Genshin Card 068', fileCode: 'Carta082', rarity: 'Rara' },
  { id: 'genshin-069', themeId: 'genshin', name: 'Genshin Card 069', fileCode: 'Carta087', rarity: 'Rara' },
  { id: 'genshin-070', themeId: 'genshin', name: 'Genshin Card 070', fileCode: 'Carta032', rarity: 'Rara' },
  { id: 'genshin-071', themeId: 'genshin', name: 'Genshin Card 071', fileCode: 'Carta059', rarity: 'Rara' },
  { id: 'genshin-072', themeId: 'genshin', name: 'Genshin Card 072', fileCode: 'Carta021', rarity: 'Rara' },
  { id: 'genshin-073', themeId: 'genshin', name: 'Genshin Card 073', fileCode: 'Carta038', rarity: 'Rara' },
  { id: 'genshin-074', themeId: 'genshin', name: 'Genshin Card 074', fileCode: 'Carta079', rarity: 'Rara' },
  { id: 'genshin-075', themeId: 'genshin', name: 'Genshin Card 075', fileCode: 'Carta069', rarity: 'Rara' },
  { id: 'genshin-076', themeId: 'genshin', name: 'Genshin Card 076', fileCode: 'Carta091', rarity: 'Rara' },
  { id: 'genshin-077', themeId: 'genshin', name: 'Genshin Card 077', fileCode: 'Carta024', rarity: 'Rara' },
  { id: 'genshin-078', themeId: 'genshin', name: 'Genshin Card 078', fileCode: 'Carta094', rarity: 'Rara' },
  { id: 'genshin-079', themeId: 'genshin', name: 'Genshin Card 079', fileCode: 'Carta023', rarity: 'Rara' },
  { id: 'genshin-080', themeId: 'genshin', name: 'Genshin Card 080', fileCode: 'Carta045', rarity: 'Rara' },
  { id: 'genshin-081', themeId: 'genshin', name: 'Genshin Card 081', fileCode: 'Carta086', rarity: 'Rara' },
  { id: 'genshin-082', themeId: 'genshin', name: 'Genshin Card 082', fileCode: 'Carta064', rarity: 'Rara' },
  { id: 'genshin-083', themeId: 'genshin', name: 'Genshin Card 083', fileCode: 'Carta099', rarity: 'Rara' },
  { id: 'genshin-084', themeId: 'genshin', name: 'Genshin Card 084', fileCode: 'Carta009', rarity: 'Rara' },
  { id: 'genshin-085', themeId: 'genshin', name: 'Genshin Card 085', fileCode: 'Carta098', rarity: 'Rara' },
  { id: 'genshin-086', themeId: 'genshin', name: 'Genshin Card 086', fileCode: 'Carta062', rarity: 'Rara' },
  { id: 'genshin-087', themeId: 'genshin', name: 'Genshin Card 087', fileCode: 'Carta076', rarity: 'Rara' },
  { id: 'genshin-088', themeId: 'genshin', name: 'Genshin Card 088', fileCode: 'Carta095', rarity: 'Rara' },
  { id: 'genshin-089', themeId: 'genshin', name: 'Genshin Card 089', fileCode: 'Carta093', rarity: 'Rara' },
  { id: 'genshin-090', themeId: 'genshin', name: 'Genshin Card 090', fileCode: 'Carta088', rarity: 'Rara' },
  { id: 'genshin-091', themeId: 'genshin', name: 'Genshin Card 091', fileCode: 'Carta063', rarity: 'Rara' },
  { id: 'genshin-092', themeId: 'genshin', name: 'Genshin Card 092', fileCode: 'Carta042', rarity: 'Rara' },
  { id: 'genshin-093', themeId: 'genshin', name: 'Genshin Card 093', fileCode: 'Carta017', rarity: 'Rara' },
  { id: 'genshin-094', themeId: 'genshin', name: 'Genshin Card 094', fileCode: 'Carta096', rarity: 'Rara' },
  { id: 'genshin-095', themeId: 'genshin', name: 'Genshin Card 095', fileCode: 'Carta020', rarity: 'Rara' },
  { id: 'genshin-096', themeId: 'genshin', name: 'Genshin Card 096', fileCode: 'Carta105', rarity: 'Épica' },
  { id: 'genshin-097', themeId: 'genshin', name: 'Genshin Card 097', fileCode: 'Carta102', rarity: 'Épica' },
  { id: 'genshin-098', themeId: 'genshin', name: 'Genshin Card 098', fileCode: 'Carta101', rarity: 'Épica' },
  { id: 'genshin-099', themeId: 'genshin', name: 'Genshin Card 099', fileCode: 'Carta104', rarity: 'Épica' },
  { id: 'genshin-100', themeId: 'genshin', name: 'Genshin Card 100', fileCode: 'Carta108', rarity: 'Épica' },
  { id: 'genshin-101', themeId: 'genshin', name: 'Genshin Card 101', fileCode: 'Carta109', rarity: 'Épica' },
  { id: 'genshin-102', themeId: 'genshin', name: 'Genshin Card 102', fileCode: 'Carta100', rarity: 'Épica' },
  { id: 'genshin-103', themeId: 'genshin', name: 'Genshin Card 103', fileCode: 'Carta107', rarity: 'Épica' },
  { id: 'genshin-104', themeId: 'genshin', name: 'Genshin Card 104', fileCode: 'Carta103', rarity: 'Épica' },
  { id: 'genshin-105', themeId: 'genshin', name: 'Genshin Card 105', fileCode: 'Carta037', rarity: 'Épica' },
  { id: 'genshin-106', themeId: 'genshin', name: 'Genshin Card 106', fileCode: 'Carta001', rarity: 'Lendária' },
  { id: 'genshin-107', themeId: 'genshin', name: 'Genshin Card 107', fileCode: 'Carta092', rarity: 'Lendária' },
  { id: 'genshin-108', themeId: 'genshin', name: 'Genshin Card 108', fileCode: 'Carta035', rarity: 'Lendária' },
  { id: 'genshin-109', themeId: 'genshin', name: 'Genshin Card 109', fileCode: 'Carta019', rarity: 'Lendária' },
];

function getCardImagePath(charData) {
  // 1. Encontra os dados do tema
  const theme = GACHA_THEMES.find(t => t.id === charData.themeId);
  if (!theme) return '';

  // 2. Monta o caminho base sem extensão
  return `${theme.path}/${charData.fileCode}`;
}

// --- FUNÇÕES DE NAVEGAÇÃO E RENDERIZAÇÃO ---

// Função auxiliar para obter o caminho base da imagem
function getThemePath(themeId) {
  return GACHA_THEMES.find(t => t.id === themeId)?.path || 'img/Gatcha/Pokemon';
}

function openChars() {
  let html = `<h3> Escolha a Galeria</h3><div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:15px; margin-bottom: 20px;">`;

  GACHA_THEMES.forEach(theme => {
    // As contagens são cruciais para o texto abaixo
    const ownedCount = state.chars.filter(c => CHAR_POOL.find(p => p.id === c)?.themeId === theme.id).length;
    const totalCount = CHAR_POOL.filter(c => c.themeId === theme.id).length;

    // Caminho da imagem (mantido como funcionou)
    const imagePath = `${theme.path}/Galeria.${theme.coverExt}`;

    html += `
            <div 
                class="char-theme-card" 
                data-theme-id="${theme.id}"
                style="
                    background: var(--card); 
                    padding: 10px; 
                    border-radius: 10px; 
                    text-align: center; 
                    cursor: pointer;
                    border: 1px solid rgba(255,255,255,0.05);
                    transition: transform 0.2s, box-shadow 0.2s;
                "
            >
                <img src="${imagePath}" alt="Capa ${theme.name}" 
                    style="
                        width: 100%; 
                        height: 150px; 
                        object-fit: contain; 
                        border-radius: 8px; 
                        margin-bottom: 8px;
                        background-color: rgba(0, 0, 0, 0.4); 
                    "
                >
                
                <div style="font-weight: 700; margin-top: 5px;">${theme.name}</div>
                <div style="font-size: 0.85rem; color: var(--muted);">
                    Coleção: ${ownedCount}/${totalCount}
                </div>
                
            </div>
        `;
  });

  html += `</div>`;

  updateModalContent(html);

  // CORREÇÃO DOS LISTENERS: Usando el.modalContent
  el.modalContent.querySelectorAll('.char-theme-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const themeId = e.currentTarget.dataset.themeId;
      renderCharGallery(themeId);
    });

    card.addEventListener('mouseover', (e) => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 6px 15px rgba(0, 255, 255, 0.2)';
    });
    card.addEventListener('mouseout', (e) => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = 'none';
    });
  });
}

// app.js - Seção 6. GACHA E PERSONAGENS -> Função renderCharGallery(themeId)

function renderCharGallery(themeId) {
  const theme = GACHA_THEMES.find(t => t.id === themeId);
  if (!theme) return;

  const themeChars = CHAR_POOL.filter(c => c.themeId === themeId);
  const totalOwned = themeChars.filter(char => state.chars.includes(char.id)).length;

  let html = `
        <button class="btn-back-gallery" onclick="openChars()" style="margin-bottom: 10px;">
            ← Voltar para Galerias
        </button>
        
        <h3 style="text-align: center;"> Galeria: ${theme.name} (${totalOwned} / ${themeChars.length} Coletadas)</h3>
        
        <div class="gallery-scroll-wrapper" style="
            overflow-y: auto; 
            width: 100%; 
            flex-grow: 1;
            margin-top: 15px; 
        "> 
            
            <div class="gallery-grid" style="
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); 
                gap: 15px; 
                padding: 10px;
            "> 
    `;

  themeChars.forEach(char => {
    const isOwned = state.chars.includes(char.id);
    const cardImagePathBase = getCardImagePath(char);

    const cardImageClass = isOwned ? '' : 'locked';
    const cardName = isOwned ? char.name : '???';
    const cardDesc = isOwned ? char.rarity.toUpperCase() : 'BLOQUEADA';
    // 1. Determina a classe de raridade (Ex: rarity-Lendária)
    const rarityClass = `rarity-${char.rarity.replace(/ /g, '_')}`;

    // 2. Determina a classe de brilho (somente se a carta for desbloqueada)
    const glowClass = isOwned ? 'card-gallery-glow' : '';

    // 3. Combina as classes no contêiner principal da carta
    const containerClasses = `card-item ${isOwned ? rarityClass : ''} ${glowClass}`;

    html += `
            <div class="${containerClasses}" 
            onclick="viewCardDetail('${char.id}')"
            style="
                background: var(--card); 
                border-radius: 8px; 
                padding: 8px; 
                text-align: center;
                cursor: pointer;
            ">
                <img 
                    src="${cardImagePathBase}.png" 
                    alt="${cardName}" 
                    class="card-image-final ${cardImageClass}" 
                    onerror="this.onerror=null; this.src='${cardImagePathBase}.jpg';"
                    style="height: auto; width: 100%; object-fit: cover;"
                >
                <div class="card-name">${cardName}</div>
                <div class="card-desc">${cardDesc}</div>
            </div>
        `;
  });

  html += `</div></div>`;
  updateModalContent(html);
}

// --- FUNÇÕES GACHA (INCLUINDO SELEÇÃO DE TEMA) ---
function renderGachaError() {
  const needed = 5 - state.gems;
  const htmlContent = `
        <h3 style="text-align: center;">💎 Gems Insuficientes</h3>
        <p style="text-align: center; margin-top: 20px;">
            Você precisa de mais **${needed} Gems** para invocar.
        </p>
        <div style="text-align: center; margin-top: 30px;">
            <button class="btn btn-voltar" onclick="hideModal()" 
                    style="
                        background: var(--accent-c); 
                        color: var(--background-c); 
                        font-weight: 700; 
                        padding: 10px 20px; 
                        border-radius: 8px;
                    ">
                Voltar
            </button>
        </div>
    `;

  updateModalContent(htmlContent);

}

function viewCardDetail(charId) {
  const char = CHAR_POOL.find(c => c.id === charId);

  if (!char) {
    console.error('Carta não encontrada:', charId);
    return;
  }

  const theme = GACHA_THEMES.find(t => t.id === char.themeId);
  // CRÍTICO: Se não há tema, não podemos voltar.
  if (!theme) return;

  const isOwned = state.chars.includes(charId);
  const isLocked = !isOwned;

  // Sempre construímos o caminho da imagem real, confiando no CSS para o bloqueio.
  const imagePathBase = getCardImagePath(char);
  const imagePath = `${imagePathBase}.png`;

  // Classes para CSS
  const rarityClass = `rarity-${char.rarity.replace(/ /g, '_')}`;
  const lockedClass = isLocked ? 'locked-detail' : '';

  // Conteúdo
  const cardName = isOwned ? char.name : '???';
  const cardRarity = isOwned ? char.rarity.toUpperCase() : 'BLOQUEADA';

  // Fallback para .jpg, caso .png não carregue
  const fallbackError = `this.onerror=null; this.src='${imagePathBase}.jpg';`;

  // 1. Botão de Voltar
  // Passamos o theme.id para a função de voltar
  const backButtonHtml = `
      <button 
        class="btn-back-gallery" 
        onclick="renderCharGallery('${theme.id}')" 
        style="margin-bottom: 10px; align-self: flex-start; background: none; border: 1px solid var(--muted); color: var(--text);"
      >
          ← Voltar para Galeria: ${theme.name}
      </button>`;


  // 2. Constrói o conteúdo HTML para o modal
  const modalContent = `
        ${backButtonHtml}
        <div class="card-detail-view">
            <img 
                src="${imagePath}" 
                alt="${char.name}" 
                class="card-detail-image ${rarityClass} ${lockedClass}" 
                onerror="${fallbackError}" 
            />
            <h3 class="card-detail-name ${lockedClass}">${cardName}</h3>
            <p class="card-detail-rarity ${rarityClass} ${lockedClass}">${cardRarity}</p>
        </div>
    `;

  // 3. Abre o modal
  updateModalContent(modalContent);
}

function openGacha() {
  const cost = 5;
  if (state.gems < cost) {
    renderGachaError();
    return;
  }

  let html = `
        <h3>💠 Invocar (Gacha)</h3>
        <p>Escolha o tema para invocar (Custo: 5 💎):</p>
        
        <div class="gacha-theme-grid" style="
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); 
            gap: 15px; 
            margin-top: 20px;
        ">
    `;

  GACHA_THEMES.forEach(theme => {
    // Caminho da imagem de capa (a mesma usada na openChars)
    const imagePath = `${theme.path}/Galeria.${theme.coverExt}`;

    html += `
            <div 
                class="gacha-theme-card" 
                data-theme-id="${theme.id}"
                style="
                    background: var(--card); 
                    padding: 10px; 
                    border-radius: 10px; 
                    text-align: center; 
                    cursor: pointer;
                    border: 1px solid rgba(255,255,255,0.05);
                    transition: transform 0.2s, box-shadow 0.2s;
                "
            >
                <img src="${imagePath}" alt="Capa ${theme.name}" 
                    style="
                        width: 100%; 
                        height: 120px; 
                        object-fit: contain; 
                        border-radius: 6px; 
                        margin-bottom: 8px;
                        background-color: rgba(0, 0, 0, 0.4); 
                    "
                >
                <div style="font-weight: 700;">${theme.name}</div>
                <small style="color: var(--accent-c); margin-top: 5px;">5 💎</small>
            </div>
        `;
  });

  html += `</div>`;

  updateModalContent(html);

  el.modalContent.querySelectorAll('.gacha-theme-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const themeId = e.currentTarget.dataset.themeId;
      processGachaPull(themeId); // Chama a função de invocação
    });

    // Efeitos de Hover para feedback visual
    card.addEventListener('mouseover', (e) => {
      e.currentTarget.style.transform = 'scale(1.03)';
      e.currentTarget.style.boxShadow = '0 6px 15px rgba(0, 255, 255, 0.2)';
    });
    card.addEventListener('mouseout', (e) => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = 'none';
    });
  });
}

function renderGachaReveal(themeId) {
  const theme = GACHA_THEMES.find(t => t.id === themeId);
  if (!theme) return;

  const imagePath = `${theme.path}/Galeria.${theme.coverExt}`;

  // HTML da tela de revelação
  const html = `
        <h3 style="text-align: center;">Invocação em Progresso...</h3>
        <div style="text-align: center; margin-top: 20px;">
            <div 
                id="reveal-area" 
                data-theme-id="${themeId}"
                /* MUDANÇA CRÍTICA: Aplica as classes que ativam o brilho pulsante branco */
                class="new-card-reveal rarity-White" 
                style="
                    display: inline-block;
                    position: relative;
                    width: 200px; 
                    height: 280px; 
                    background: var(--card);
                    /* Removida a borda do style inline, pois a classe rarity-White a define */
                    border-radius: 10px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: transform 0.2s;
                "
            >
                <img src="${imagePath}" alt="${theme.name}" class="reveal-icon" style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%); 
                    width: 90%; 
                    height: 90%;
                    object-fit: contain; 
                    border-radius: 8px;
                ">
            </div>
            <p style="margin-top: 25px; color: var(--accent-c); font-weight: 700;">Clique para revelar!</p>
        </div>
    `;

  // Renderiza a área de clique
  updateModalContent(html);

  // Adiciona o Event Listener para a revelação
  document.getElementById('reveal-area').addEventListener('click', () => {
    // Remove o cursor de clique para evitar spam
    document.getElementById('reveal-area').style.cursor = 'default';
    processGachaReveal(themeId);
  }, { once: true });
}

function processGachaPull(themeId) {
  if (state.gems < 5) return;

  // 1. DEDUÇÃO E PREPARAÇÃO
  state.gems -= 5;
  saveState();
  renderStatus();

  // 2. CHAMA A TELA DE REVELAÇÃO INTERATIVA
  renderGachaReveal(themeId);
}


// app.js - Seção 6. GACHA E PERSONAGENS -> NOVA Função processGachaReveal (A lógica real de sorteio)

function processGachaReveal(themeId) {
  // O sorteio é feito AGORA (após o clique)
  const currentThemePool = CHAR_POOL.filter(x => x.themeId === themeId);

  // --- Lógica de Sorteio (A mesma lógica de antes, mas sem o setTimeout) ---
  const r = Math.random() * 100;
  let targetRarity = 'Comum';
  if (r > 60 && r <= 90) targetRarity = 'Rara';
  if (r > 90 && r <= 99) targetRarity = 'Épica';
  if (r > 99) targetRarity = 'Lendária';
  const poolByRarity = currentThemePool.filter(x => x.rarity === targetRarity);
  const pick = poolByRarity.length > 0
    ? poolByRarity[Math.floor(Math.random() * poolByRarity.length)]
    : currentThemePool[Math.floor(Math.random() * currentThemePool.length)];

  // --- LÓGICA DE RECOMPENSA E PROGRESSÃO ---
  const isNew = !state.chars.includes(pick.id);
  let statusMsg;
  if (isNew) {
    state.chars.push(pick.id);
    state.xp += 50;
    statusMsg = '✨ **NOVO** - Desbloqueado! (+50 XP)';
  } else {
    // Retorno de gems/xp para repetição
    state.gems += 5;
    state.xp += 10;
    statusMsg = 'Repetição - Reembolso! (+5 Gems, +10 XP)';
  }

  // Salva o estado atualizado com as recompensas
  saveState();
  renderStatus();

  // --- RENDERIZAÇÃO DO RESULTADO FINAL ---

  // (O resto do código de renderização do card e botões é o mesmo do passo anterior)

  const cardImagePathBase = getCardImagePath(pick);
  const srcAttempt = `${cardImagePathBase}.png`;
  const fallbackError = `this.onerror=null; this.src='${cardImagePathBase}.jpg';`;
  const cardColorClass = `rarity-${pick.rarity.replace(/ /g, '_')}`;
  const cardImageClass = isNew ? `new-card-reveal ${cardColorClass}` : '';

  const cardHtml = `
        <div class="gacha-result-card-container">
            <img 
                src="${srcAttempt}" 
                alt="${pick.name}" 
                class="gacha-result-card ${cardImageClass}" 
                onerror="${fallbackError}"
            />
            <div class="gacha-result-name">${pick.name}</div>
            <div class="gacha-result-rarity">${pick.rarity.toUpperCase()}</div>
            <p style="color:var(--accent-c); font-weight:700; margin-top:10px;">${statusMsg}</p>
        </div>
    `;

  const hasGems = state.gems >= 5;
  const btnText = hasGems ? `Invocar Novamente (5 💎)` : `Faltam ${5 - state.gems} 💎`;
  const baseStyle = 'background: var(--card); border: 1px solid var(--accent-c); color: var(--text-c);';
  const activeStyle = `background: var(--card); color: var(--accent-c); font-weight: 700; border: 1px solid var(--accent-c);`;
  const disabledStyle = 'cursor: not-allowed; opacity: 0.5; background: var(--muted); border-color: var(--muted); color: var(--background-c);';
  const backStyle = baseStyle;
  const rerollStyle = hasGems ? activeStyle : disabledStyle;

  const buttonsHtml = `
        <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-back-gacha" style="flex-grow: 1; ${backStyle}">
                ← Voltar para Temas
            </button>
            <button class="btn btn-reroll-gacha btn-primary" 
                    data-theme-id="${themeId}" 
                    data-can-reroll="${hasGems}" 
                    style="flex-grow: 1; ${rerollStyle}">
                ${btnText}
            </button>
        </div>
    `;

  // Renderiza o resultado
  updateModalContent(`
        <h3 style="text-align: center;">Invocação Completa!</h3>
        ${cardHtml}
        ${buttonsHtml}
    `);

  // --- ANEXAR EVENT LISTENERS NOVAMENTE ---
  const newRerollBtn = el.modalContent.querySelector('.btn-reroll-gacha');
  const backBtn = el.modalContent.querySelector('.btn-back-gacha');

  if (backBtn) {
    backBtn.addEventListener('click', openGacha);
  }

  if (newRerollBtn) {
    const canReroll = newRerollBtn.dataset.canReroll === 'true';

    if (canReroll) {
      // Chama o processo de invocação (que deduz gems e entra na tela de revelação)
      newRerollBtn.addEventListener('click', () => {
        processGachaPull(themeId);
      });
    } else {
      // 🛑 MUDANÇA CRÍTICA AQUI: Não usar showModal (fila), mas sim um alerta de navegação
      newRerollBtn.addEventListener('click', () => {
        renderGachaError(); // Usa a função que lida com o erro de forma prioritária
      });
    }
  }

  checkLevelUp();
  checkAchievements();

  if (!isNew) {
    fireConfetti(35);
  }
}

let isModalOpen = false;
const modalQueue = [];

function showModal(htmlContent) {
  console.log(`[showModal] Adicionando mensagem à fila.`);
  modalQueue.push(htmlContent);
  processQueue();
}

/**
 * Funções auxiliares para aplicar recompensas *somente* ao exibir a notificação.
 */
function applyNotificationReward() {
    const levelUpEl = el.modalContent.querySelector('[data-action="level-up"]');
    const achieveEl = el.modalContent.querySelector('[data-action="achievement"]'); 
    let rewardApplied = false;

    // 1. Lógica de Level Up
    if (levelUpEl) {
        // ... (Lógica de Level Up permanece inalterada) ...
        const gems = Number(levelUpEl.getAttribute('data-gems'));
        const xpBonus = Number(levelUpEl.getAttribute('data-xp-bonus'));
        const level = Number(levelUpEl.getAttribute('data-level'));
        
        if (isNaN(gems) || isNaN(xpBonus)) {
             console.error("[ERRO RECOMPENSA LVL] Dados inválidos para Level Up!");
        } else {
             state.gems += gems;
             state.xp += xpBonus;
             console.log(`[REWARD] Level Up para ${level} aplicado: +${gems} Gems, +${xpBonus} XP.`);
             rewardApplied = true;
        }
    } 
    
    // 2. Lógica de Conquista
    if (achieveEl) {
        // Verifica se a recompensa AINDA NÃO FOI APLICADA (Flag é diferente de 'APPLIED')
        if (achieveEl.getAttribute('data-reward-status') !== 'APPLIED') { 
            
            // ... (Lógica de leitura de dados permanece) ...
            const achId = achieveEl.getAttribute('data-ach-id') || achieveEl.getAttribute('data-achid') || achieveEl.getAttribute('data-ach_id');
            const gems = Number(achieveEl.getAttribute('data-gems'));
            const xp = Number(achieveEl.getAttribute('data-xp'));
            
            if (!achId || isNaN(gems) || isNaN(xp) || gems < 0) {
                 console.error("[ERRO CRÍTICO DE RECOMPENSA] Falha na leitura dos atributos da Conquista. LIDO:", { achId, gems, xp });
                 return; 
            }

            // 🏆 APLICA A RECOMPENSA
            state.gems += gems;
            state.xp += xp;
            rewardApplied = true;
            console.log(`[REWARD] Conquista "${achId}" (APLICADA!) Gems: +${gems}, XP: +${xp}.`);

            // 🛑 CRÍTICO: MARCA O ELEMENTO COMO PAGO para evitar repetição
            achieveEl.setAttribute('data-reward-status', 'APPLIED');
        } else {
            console.log(`[INFO] Conquista já processada no modal. Recompensa ignorada.`);
        }
    }

    // Se alguma recompensa foi aplicada, salve e renderize o status
    if (rewardApplied) {
        saveState();
        renderStatus();
        console.log(`[SAVE] Novo estado salvo. Gems=${state.gems}, XP=${state.xp}.`);
        checkLevelUp();
    }
}


function processQueue() {
  console.log(`[QUEUE] Processando fila: Aberto=${isModalOpen}, Fila=${modalQueue.length}`);

  if (isModalOpen || modalQueue.length === 0) {
    if (isModalOpen) {
      setTimeout(processQueue, 500);
    }
    return;
  }

  const nextHtml = modalQueue.shift();
  console.log("[QUEUE] NOTIFICAÇÃO: Exibindo nova mensagem da fila.");

  isModalOpen = true;

  // Configura o conteúdo 
  const container = el.modalContent;
  container.innerHTML = '';
  container.classList.add('message-modal-container');

  container.innerHTML += '<button class="modal-close" id="modal-close-msg">✕</button>';
  container.innerHTML += nextHtml;

  el.modal.classList.add('show');

  const closeModalBtn = document.getElementById('modal-close-msg');
  if (closeModalBtn) {
    closeModalBtn.onclick = hideModal;
  }

  el.modal.addEventListener('click', (e) => {
    if (e.target === el.modal) hideModal();
  }, { once: true });
}

function hideModal() {
  console.log("[hideModal] Fechando modal.");
  el.modal.classList.remove('show');

  // Verifica se o modal que está sendo fechado é um modal de MENSAGEM/NOTIFICAÇÃO
  const isMessageModal = el.modalContent.classList.contains('message-modal-container');

  setTimeout(() => {
    // Se for um modal de mensagem, aplicamos a recompensa antes de limpar o conteúdo!
    if (isMessageModal) {
      applyNotificationReward();
    }

    // Essas ações devem ocorrer SÓ DEPOIS do atraso:
    el.modalContent.classList.remove('message-modal-container');
    el.modalContent.innerHTML = '';
    isModalOpen = false;

    // Finalmente, processa o próximo da fila
    processQueue();
  }, 300); // Tente 300 milissegundos. Se for muito lento, use 200ms.
}

function updateModalContent(htmlContent) {
  // Este é o modal de NAVEGAÇÃO, que BLOQUEIA a fila.
  isModalOpen = true;

  el.modalContent.classList.remove('message-modal-container');
  el.modalContent.innerHTML = '';

  // Garante que o botão de fechar para NAVEGAÇÃO está sempre presente
  el.modalContent.innerHTML += '<button class="modal-close" id="modal-close-nav">✕</button>';
  el.modalContent.innerHTML += htmlContent;

  el.modal.classList.add('show');

  const closeModalBtn = document.getElementById('modal-close-nav');
  if (closeModalBtn) {
    closeModalBtn.onclick = hideModal;
  }

  // Fecha ao clicar fora (se for modal de navegação)
  el.modal.addEventListener('click', (e) => {
    if (e.target === el.modal) hideModal();
  }, { once: true });
}

// ====================================================================
// 8. SETUP E EVENTOS
// ====================================================================

function setupEventListeners() {
  // Adicionar Missão
  el.addBtn.addEventListener('click', () => {
    const txt = el.missionInput.value;
    const diff = el.difficulty.value;
    if (!txt || txt.trim() === '') return;
    addMission(txt, diff);
    el.missionInput.value = '';
  });

  // Teclado Enter
  el.missionInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') el.addBtn.click();
  });

  // Botões de Navegação (Quick Actions)
  el.btnGacha.addEventListener('click', openGacha);
  el.btnChar.addEventListener('click', openChars);

  // Botão de Conquistas (Achieves)
  if (el.btnAch) {
    el.btnAch.addEventListener('click', openAchievements);
  } else {
    console.error("ERRO CRÍTICO: Elemento do botão de Conquistas (ID #btn-ach) não foi encontrado no DOM!");
  }

  // Fechar Modal (clique fora)
  el.modal.addEventListener('click', (e) => {
    if (e.target === el.modal) hideModal();
  });

}

function init() {
  // 1. Carrega e renderiza o estado inicial
  renderStatus();
  cachedLevel = levelFromXp(state.xp);
  // 2. Se não houver missões, adiciona demos (UX)
  if (state.missions.length === 0) {
    addMission('Fazer 25 minutos de foco (Demo)', 2);
    addMission('Beber 2L de água (Demo)', 1);
  }
  renderMissions();

  // 3. Configura todos os ouvintes de eventos
  setupEventListeners();

  // 4. Salva o estado após inicialização com demos
  saveState();
}

// Inicia a aplicação
init();

// FUNÇÕES QUE FALTAVAM (Para evitar erros de referência)
function showFloating(msg) {
  console.log("Floating message: " + msg);
  // Implemente aqui a lógica visual para a mensagem flutuante
}

function fireConfetti(count) {
  console.log("Confetti fired: " + count);
  // Implemente aqui a lógica visual para o Confetti
} 