import { db } from './firebase-config.js';
import { ref, get, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { getRandomTasks, ROUND_TIMES, formatTime } from './game-logic.js';

// Get room code
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');

if (!roomCode) {
    alert("Nessun codice stanza fornito.");
    window.location.href = "index.html";
}

// Elements
const statusBadge = document.getElementById('current-status');
const currentRoundEl = document.getElementById('current-round');
const currentTimerEl = document.getElementById('current-timer');
const currentTimerPill = document.getElementById('current-timer-pill');
const btnStart = document.getElementById('btn-start');
const btnStartRandom = document.getElementById('btn-start-random');
const btnCallMeeting = document.getElementById('btn-call-meeting');
const btnStartMeeting = null; // Removed
const btnStartDiscussion = document.getElementById('btn-start-discussion');
const btnStartVoting = document.getElementById('btn-start-voting');
const btnEndMeeting = document.getElementById('btn-end-meeting');
const btnReset = document.getElementById('btn-reset');
const votingSection = document.getElementById('voting-section');

// Modals & Cards Elements
const modalConfigTempi = document.getElementById('modal-config-tempi');
const btnCloseConfigTempi = document.getElementById('btn-close-config-tempi');
const btnOpenConfigTempiCard = document.getElementById('btn-open-config-tempi-card');
const btnOpenConfigTempiFromModal = document.getElementById('btn-open-config-tempi-from-modal');
const presetTimeConfigCard = document.getElementById('preset-time-config-card');

const modalTimer = document.getElementById('modal-timer');
const btnOpenTimerModal = document.getElementById('btn-open-timer-modal');
const btnOpenTimerModalCard = document.getElementById('btn-open-timer-modal-card');
const btnCloseTimerModal = document.getElementById('btn-close-timer-modal');

const timerControls = document.getElementById('timer-controls');
const masterLiveClockEl = document.getElementById('master-live-clock');
const masterModalClockEl = document.getElementById('master-modal-clock');

const modalLiveTimerSection = document.getElementById('modal-live-timer-section');
const modalVotingTimerSection = document.getElementById('modal-voting-timer-section');

const btnTimerPauseCard = document.getElementById('btn-timer-pause-card');
const btnTimerAddCard = document.getElementById('btn-timer-add-card');

const btnTimerPause = document.getElementById('btn-timer-pause');
const btnTimerAdd = document.getElementById('btn-timer-add');
const btnTimerSub = document.getElementById('btn-timer-sub');
const btnTimerAdd5 = document.getElementById('btn-timer-add5');
const btnTimerSub5 = document.getElementById('btn-timer-sub5');
const inputCustomMin = document.getElementById('input-custom-min');
const inputCustomSec = document.getElementById('input-custom-sec');
const btnSetCustomTime = document.getElementById('btn-set-custom-time');

const btnVotingAdd30 = document.getElementById('btn-voting-add30');
const btnVotingSub30 = document.getElementById('btn-voting-sub30');

const cfgDiscussion = document.getElementById('cfg-discussion');
const cfgVoting = document.getElementById('cfg-voting');
const btnSaveTimeCfg = document.getElementById('btn-save-time-cfg');
const masterRoundTimesContainer = document.getElementById('master-round-times-container');
const btnMasterAddRound = document.getElementById('btn-master-add-round');

// Preset Picker Pop-up Elements
const modalPresetPicker = document.getElementById('modal-preset-picker');
const btnClosePresetPicker = document.getElementById('btn-close-preset-picker');
const presetPickerTitle = document.getElementById('preset-picker-title');
const presetPickerSubtitle = document.getElementById('preset-picker-subtitle');
const presetButtonsGrid = document.getElementById('preset-buttons-grid');
const inputPresetCustomVal = document.getElementById('input-preset-custom-val');
const btnApplyPresetCustom = document.getElementById('btn-apply-preset-custom');

const modalLogs = document.getElementById('modal-logs');
const btnOpenLogModal = document.getElementById('btn-open-log-modal');
const cardOpenLogModal = document.getElementById('card-open-log-modal');
const btnCloseLogModal = document.getElementById('btn-close-log-modal');

const heroRoomCodeBanner = document.getElementById('hero-room-code-banner');
const heroRoomCodeEl = document.getElementById('hero-room-code');

if (heroRoomCodeEl && roomCode) {
    heroRoomCodeEl.textContent = roomCode;
}

let currentTargetInput = null;

const monitorContainer = document.getElementById('monitor-container');
const logContainer = document.getElementById('log-container');
const btnProjector = document.getElementById('btn-projector');

// --- Pop-up 1: Configurazione Tempi Predefiniti ---
function openConfigTempiModal() {
    if (modalConfigTempi) modalConfigTempi.classList.remove('hidden');
}

function closeConfigTempiModal() {
    if (modalConfigTempi) modalConfigTempi.classList.add('hidden');
}

if (btnOpenConfigTempiCard) btnOpenConfigTempiCard.addEventListener('click', openConfigTempiModal);
if (btnOpenConfigTempiFromModal) {
    btnOpenConfigTempiFromModal.addEventListener('click', () => {
        closeTimerModal();
        openConfigTempiModal();
    });
}
if (btnCloseConfigTempi) btnCloseConfigTempi.addEventListener('click', closeConfigTempiModal);
if (modalConfigTempi) {
    modalConfigTempi.addEventListener('click', (e) => {
        if (e.target === modalConfigTempi) closeConfigTempiModal();
    });
}

// --- Pop-up 2: Gestione Tempo In Corso ---
function openTimerModal() {
    if (modalTimer) modalTimer.classList.remove('hidden');
}

function closeTimerModal() {
    if (modalTimer) modalTimer.classList.add('hidden');
}

if (btnOpenTimerModal) btnOpenTimerModal.addEventListener('click', openTimerModal);
if (btnOpenTimerModalCard) btnOpenTimerModalCard.addEventListener('click', openTimerModal);
if (masterLiveClockEl) masterLiveClockEl.addEventListener('click', openTimerModal);
if (currentTimerPill) currentTimerPill.addEventListener('click', openTimerModal);
if (btnCloseTimerModal) btnCloseTimerModal.addEventListener('click', closeTimerModal);

if (modalTimer) {
    modalTimer.addEventListener('click', (e) => {
        if (e.target === modalTimer) closeTimerModal();
    });
}

// --- Pop-up 3: Imposta un Tempo Esatto (Preset Picker) ---
function openPresetPicker(targetInput, titleText, optionsArray, isSeconds = false) {
    currentTargetInput = targetInput;
    if (presetPickerTitle) presetPickerTitle.textContent = titleText;
    if (presetPickerSubtitle) presetPickerSubtitle.textContent = isSeconds ? "Scegli i secondi preimpostati o inserisci un valore:" : "Scegli i minuti preimpostati o inserisci un valore:";
    
    if (presetButtonsGrid) {
        presetButtonsGrid.innerHTML = '';
        optionsArray.forEach(val => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.background = '#1e293b';
            btn.style.border = '1px solid rgba(56, 189, 248, 0.4)';
            btn.style.color = '#38bdf8';
            btn.style.borderRadius = '12px';
            btn.style.fontWeight = '800';
            btn.style.padding = '0.6rem 0.4rem';
            btn.style.fontSize = '0.85rem';
            btn.textContent = isSeconds ? `${val} Sec` : `${val} Min`;
            btn.onclick = () => {
                targetInput.value = val;
                closePresetPicker();
            };
            presetButtonsGrid.appendChild(btn);
        });
    }

    if (inputPresetCustomVal) inputPresetCustomVal.value = targetInput.value || '';
    if (modalPresetPicker) modalPresetPicker.classList.remove('hidden');
}

function closePresetPicker() {
    if (modalPresetPicker) modalPresetPicker.classList.add('hidden');
    currentTargetInput = null;
}

if (btnClosePresetPicker) btnClosePresetPicker.addEventListener('click', closePresetPicker);
if (modalPresetPicker) {
    modalPresetPicker.addEventListener('click', (e) => {
        if (e.target === modalPresetPicker) closePresetPicker();
    });
}

if (btnApplyPresetCustom) {
    btnApplyPresetCustom.addEventListener('click', () => {
        if (currentTargetInput && inputPresetCustomVal) {
            const val = parseInt(inputPresetCustomVal.value);
            if (!val || val <= 0) return alert("Inserisci un numero valido.");
            currentTargetInput.value = val;
            closePresetPicker();
        }
    });
}

// --- Pop-up 4: Log Eventi di Gioco ---
function openLogModal() {
    if (modalLogs) modalLogs.classList.remove('hidden');
}

function closeLogModal() {
    if (modalLogs) modalLogs.classList.add('hidden');
}

if (btnOpenLogModal) btnOpenLogModal.addEventListener('click', openLogModal);
if (cardOpenLogModal) {
    cardOpenLogModal.addEventListener('click', (e) => {
        if (e.target.id !== 'btn-open-log-modal') openLogModal();
    });
}
if (btnCloseLogModal) btnCloseLogModal.addEventListener('click', closeLogModal);
if (modalLogs) {
    modalLogs.addEventListener('click', (e) => {
        if (e.target === modalLogs) closeLogModal();
    });
}

// Click Listeners for Preset Inputs inside Pop-up 1
const roundPresets = [3, 5, 7, 10, 12, 15];
const votingPresets = [0, 30, 45, 60, 90, 120];

if (cfgRound1) {
    const parentBox = cfgRound1.closest('.preset-input-box') || cfgRound1;
    parentBox.addEventListener('click', () => {
        openPresetPicker(cfgRound1, "🎯 TEMPO ROUND 1", roundPresets, false);
    });
}
if (cfgRound2) {
    const parentBox = cfgRound2.closest('.preset-input-box') || cfgRound2;
    parentBox.addEventListener('click', () => {
        openPresetPicker(cfgRound2, "🎯 TEMPO ROUND 2", roundPresets, false);
    });
}
if (cfgRound3) {
    const parentBox = cfgRound3.closest('.preset-input-box') || cfgRound3;
    parentBox.addEventListener('click', () => {
        openPresetPicker(cfgRound3, "🎯 TEMPO ROUND 3+", roundPresets, false);
    });
}
if (cfgVoting) {
    const parentBox = cfgVoting.closest('.preset-input-box') || cfgVoting;
    parentBox.addEventListener('click', () => {
        openPresetPicker(cfgVoting, "🎯 DURATA VOTAZIONE", votingPresets, true);
    });
}

if (btnProjector) {
    btnProjector.href = `schermo.html?room=${roomCode}`;
}

// Update UI text
btnStart.classList.add('hidden'); // Hide fixed roles button since we don't have hardcoded players
btnStartRandom.textContent = "Avvia Partita";

document.querySelector('h1').textContent = `PANNELLO MASTER • ${roomCode}`;

let currentState = {};
let roomConfig = {};
let currentPlayers = {};
let currentVotes = {};
let currentKicked = {};
let resolvingMeeting = false;
let previousPlayers = null;

const roomRef = ref(db, `rooms/${roomCode}`);

function getRoundDuration(roundNum) {
    if (roomConfig && roomConfig.roundTimes && Array.isArray(roomConfig.roundTimes) && roomConfig.roundTimes.length > 0) {
        const idx = Math.min(roundNum - 1, roomConfig.roundTimes.length - 1);
        return roomConfig.roundTimes[idx];
    }
    return ROUND_TIMES[Math.min(roundNum - 1, ROUND_TIMES.length - 1)];
}

let masterRoundTimes = [10, 7, 5];

function renderMasterRoundTimesUI(timesArr = [10, 7, 5]) {
    if (!masterRoundTimesContainer) return;
    masterRoundTimesContainer.innerHTML = '';
    masterRoundTimes = timesArr;

    timesArr.forEach((mins, idx) => {
        const isLast = idx === timesArr.length - 1;
        const div = document.createElement('div');
        div.style = `display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.25); padding: 0.35rem 0.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);`;
        
        const labelText = isLast && idx > 0 ? `Round ${idx + 1}+ (ripete ∞)` : `Round ${idx + 1}`;
        
        div.innerHTML = `
            <span style="font-size: 0.75rem; font-weight: bold; width: 120px; color: ${isLast ? 'var(--accent-cyan, #00e5ff)' : 'white'};">${labelText}:</span>
            <input type="number" class="master-round-time-input" value="${mins}" min="1" max="120" style="flex: 1; padding: 0.35rem; border-radius: 6px; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.15); font-weight: 600;">
            <span style="font-size: 0.75rem; color: #aaa;">min</span>
            ${timesArr.length > 1 ? `<button type="button" class="btn-master-remove-round" style="background: none; border: none; color: #ff4b4b; cursor: pointer; font-weight: bold; padding: 0 0.3rem;">✕</button>` : ''}
        `;

        if (timesArr.length > 1) {
            const removeBtn = div.querySelector('.btn-master-remove-round');
            if (removeBtn) {
                removeBtn.onclick = () => {
                    masterRoundTimes.splice(idx, 1);
                    renderMasterRoundTimesUI(masterRoundTimes);
                };
            }
        }

        const inputEl = div.querySelector('.master-round-time-input');
        if (inputEl) {
            inputEl.onchange = (e) => {
                const val = parseInt(e.target.value) || 1;
                masterRoundTimes[idx] = val;
            };
        }

        masterRoundTimesContainer.appendChild(div);
    });
}

if (btnMasterAddRound) {
    btnMasterAddRound.addEventListener('click', () => {
        const lastVal = masterRoundTimes.length > 0 ? masterRoundTimes[masterRoundTimes.length - 1] : 5;
        masterRoundTimes.push(lastVal);
        renderMasterRoundTimesUI(masterRoundTimes);
    });
}

function syncTimeConfigUI() {
    if (!roomConfig) return;
    const activeId = document.activeElement ? document.activeElement.id : null;
    
    if (cfgDiscussion && activeId !== 'cfg-discussion') {
        cfgDiscussion.value = roomConfig.discussionDuration !== undefined ? roomConfig.discussionDuration : 0;
    }
    if (cfgVoting && activeId !== 'cfg-voting') {
        const vVal = roomConfig.votingDuration !== undefined ? roomConfig.votingDuration : roomConfig.meetingDuration;
        cfgVoting.value = vVal !== undefined ? vVal : 60;
    }

    if (roomConfig.roundTimes && Array.isArray(roomConfig.roundTimes) && roomConfig.roundTimes.length > 0) {
        const minsArr = roomConfig.roundTimes.map(ms => Math.max(1, Math.round(ms / 60000)));
        renderMasterRoundTimesUI(minsArr);
    } else {
        renderMasterRoundTimesUI([10, 7, 5]);
    }
}

// Toggle Espulsi section listener
const btnToggleKicked = document.getElementById('btn-toggle-kicked');
const kickedSection = document.getElementById('kicked-section');
if (btnToggleKicked && kickedSection) {
    btnToggleKicked.addEventListener('click', () => {
        kickedSection.classList.toggle('hidden');
    });
}

// Logging Helper
function addLog(msg) {
    const el = document.createElement('div');
    const time = new Date().toLocaleTimeString();
    el.innerHTML = `<span style="color:#aaa;">[${time}]</span> ${msg}`;
    logContainer.prepend(el); // newest first
}

function processPlayerLogs(oldPlayers, newPlayers) {
    if (!oldPlayers) return;
    for (const name in oldPlayers) {
        if (!newPlayers[name] && (!currentKicked || !currentKicked[name])) {
            addLog(`🥾 <span style="color:var(--accent-red);">${name}</span> ha lasciato la stanza.`);
        }
    }
    for (const name in newPlayers) {
        const oldP = oldPlayers[name];
        const newP = newPlayers[name];
        if (!oldP) continue;

        if (oldP.status === 'alive' && newP.status === 'killed_hidden') {
            addLog(`💀 <span style="color:var(--accent-red);">${name}</span> è STATO UCCISO.`);
        }
        if (oldP.status === 'alive' && newP.status === 'killed_revealed') {
            addLog(`🥾 <span style="color:var(--accent-cyan);">${name}</span> è STATO ESPULSO DA VOTAZIONE.`);
        }

        // Check tasks
        if (oldP.tasks && newP.tasks) {
            for (const t in newP.tasks) {
                if (newP.tasks[t].completed && !oldP.tasks[t].completed) {
                    addLog(`✅ <span style="color:#4caf50;">${name}</span> ha completato una task: ${newP.tasks[t].desc}`);
                }
            }
        }
    }
}

function updateMonitor(players) {
    monitorContainer.innerHTML = '';
    const isGameWaiting = !currentState || !currentState.game_status || currentState.game_status === 'waiting';

    for (const name in players) {
        const p = players[name];
        const div = document.createElement('div');
        div.className = 'master-player-row';

        const roleColors = {
            'impostor': 'var(--accent-red)',
            'crewmate': 'var(--accent-cyan)',
            'scientist': '#4caf50'
        };

        const statusLabel = p.status === 'alive' ? 'VIVO' : 'MORTO';
        const color = p.status === 'alive' ? roleColors[p.role || 'crewmate'] : 'var(--dead-gray)';
        const roleLabel = (p.role || 'crewmate').toUpperCase();

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <strong style="color: ${color}; font-size: 0.95rem;">${name}</strong> 
                <span style="font-size: 0.75rem; padding: 2px 7px; border-radius: 6px; background: rgba(255,255,255,0.06); color:#94a3b8; font-weight: 600;">${roleLabel}</span>
                <span style="font-size: 0.75rem; padding: 2px 7px; border-radius: 6px; background: ${p.status==='alive'?'rgba(0,230,118,0.15)':'rgba(255,255,255,0.05)'}; color: ${p.status==='alive'?'var(--accent-green)':'#64748b'}; font-weight: 700;">${statusLabel}</span>
            </div>
        `;

        if (isGameWaiting) {
            // Prima che il gioco parti: mostra tasto ESPELLI
            const btnKick = document.createElement('button');
            btnKick.textContent = "ESPELLI";
            btnKick.className = "btn btn-danger";
            btnKick.style.padding = "0.3rem 0.7rem";
            btnKick.style.fontSize = "0.75rem";
            btnKick.onclick = async () => {
                if(confirm(`Espellere ${name} dalla stanza?`)) {
                    await update(roomRef, {
                        [`players/${name}`]: null,
                        [`kickedPlayers/${name}`]: true
                    });
                    addLog(`🥾 <span style="color:var(--accent-red);">${name}</span> è stato espulso dal Master.`);
                }
            };
            div.appendChild(btnKick);
        } else {
            // Durante la partita:
            if (p.status === 'alive') {
                // Giocatore vivo: tasto KILL
                const btnKill = document.createElement('button');
                btnKill.textContent = "KILL";
                btnKill.className = "btn btn-danger";
                btnKill.style.padding = "0.3rem 0.7rem";
                btnKill.style.fontSize = "0.75rem";
                btnKill.onclick = async () => {
                    if(confirm(`Forzare l'uccisione di ${name}?`)) {
                        await update(roomRef, { [`players/${name}/status`]: 'killed_hidden' });
                    }
                };
                div.appendChild(btnKill);
            } else {
                // Giocatore morto: sostituisci KILL con tasto ESPELLI
                const btnKick = document.createElement('button');
                btnKick.textContent = "ESPELLI";
                btnKick.className = "btn btn-danger";
                btnKick.style.padding = "0.3rem 0.7rem";
                btnKick.style.fontSize = "0.75rem";
                btnKick.onclick = async () => {
                    if(confirm(`Espellere ${name} dalla partita?`)) {
                        await update(roomRef, {
                            [`players/${name}`]: null,
                            [`kickedPlayers/${name}`]: true
                        });
                        addLog(`🥾 <span style="color:var(--accent-red);">${name}</span> è stato espulso dal Master.`);
                    }
                };
                div.appendChild(btnKick);
            }
        }

        monitorContainer.appendChild(div);
    }
}

function updateKickedSection(kickedMap) {
    const kickedNames = Object.keys(kickedMap || {});
    const btnToggleKicked = document.getElementById('btn-toggle-kicked');
    const kickedCountEl = document.getElementById('kicked-count');
    const kickedListContainer = document.getElementById('kicked-list-container');

    if (!btnToggleKicked || !kickedCountEl || !kickedListContainer) return;

    if (kickedNames.length === 0) {
        btnToggleKicked.classList.add('hidden');
        if (kickedSection) kickedSection.classList.add('hidden');
        kickedListContainer.innerHTML = '';
        return;
    }

    btnToggleKicked.classList.remove('hidden');
    kickedCountEl.textContent = kickedNames.length;

    kickedListContainer.innerHTML = '';
    kickedNames.forEach(name => {
        const div = document.createElement('div');
        div.className = 'master-kicked-row';

        div.innerHTML = `
            <strong style="color: #f87171; font-size: 0.9rem;">${name}</strong>
        `;

        const btnReadmit = document.createElement('button');
        btnReadmit.textContent = "RIAMMETTI";
        btnReadmit.className = "btn";
        btnReadmit.style.background = "#16a34a";
        btnReadmit.style.color = "white";
        btnReadmit.style.padding = "0.3rem 0.7rem";
        btnReadmit.style.fontSize = "0.75rem";
        btnReadmit.style.cursor = "pointer";
        btnReadmit.onclick = async () => {
            if (confirm(`Riammettere ${name} nella stanza?`)) {
                await remove(ref(db, `rooms/${roomCode}/kickedPlayers/${name}`));
                addLog(`🔄 <span style="color:#4caf50;">${name}</span> è stato riammesso dal Master.`);
            }
        };

        div.appendChild(btnReadmit);
        kickedListContainer.appendChild(div);
    });
}

// Listen to changes
onValue(roomRef, (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        currentState = data.state || {};
        roomConfig = data.config || {};
        currentPlayers = data.players || {};
        currentVotes = data.votes || {};
        currentKicked = data.kickedPlayers || {};
        
        syncTimeConfigUI();
        updateUI(currentState, currentPlayers);
        updateMonitor(currentPlayers);
        updateKickedSection(currentKicked);
        
        processPlayerLogs(previousPlayers, currentPlayers);
        previousPlayers = JSON.parse(JSON.stringify(currentPlayers));
        
        // As a Master, perform automatic checks
        if (!resolvingMeeting) {
            checkWinCondition(currentState, currentPlayers);
            checkVotes(currentState, currentPlayers, currentVotes);
        }
    } else {
        statusBadge.textContent = "STANZA NON TROVATA";
    }
});

function updateUI(state, players) {
    if(!state.game_status) return;
    
    currentRoundEl.textContent = state.round || 1;

    if (heroRoomCodeBanner) {
        if (state.game_status === 'waiting') {
            heroRoomCodeBanner.classList.remove('hidden');
        } else {
            heroRoomCodeBanner.classList.add('hidden');
        }
    }

    if (statusBadge) {
        let statusText = state.game_status.toUpperCase();
        let statusBg = "rgba(117, 117, 117, 0.2)";
        let statusColor = "#cbd5e1";

        if (state.game_status === 'waiting') {
            statusText = "⏳ IN ATTESA";
            statusBg = "rgba(148, 163, 184, 0.2)";
            statusColor = "#94a3b8";
        } else if (state.game_status === 'playing') {
            statusText = "🟢 IN CORSO";
            statusBg = "rgba(0, 230, 118, 0.2)";
            statusColor = "#00e676";
        } else if (state.game_status === 'emergency') {
            statusText = "🚨 EMERGENZA";
            statusBg = "rgba(255, 75, 75, 0.25)";
            statusColor = "#ff4b4b";
        } else if (state.game_status === 'discussion') {
            statusText = "💬 DISCUSSIONE";
            statusBg = "rgba(255, 235, 59, 0.25)";
            statusColor = "#ffeb3b";
        } else if (state.game_status === 'voting') {
            statusText = "🗳️ VOTAZIONE";
            statusBg = "rgba(156, 39, 176, 0.25)";
            statusColor = "#ce93d8";
        } else if (state.game_status === 'crewmates_win') {
            statusText = "🏆 VITTORIA CREWMATE";
            statusBg = "rgba(0, 229, 255, 0.2)";
            statusColor = "#00e5ff";
        } else if (state.game_status === 'impostors_win') {
            statusText = "🏆 VITTORIA IMPOSTORI";
            statusBg = "rgba(255, 75, 75, 0.2)";
            statusColor = "#ff4b4b";
        }

        statusBadge.textContent = statusText;
        statusBadge.style.backgroundColor = statusBg;
        statusBadge.style.color = statusColor;
    }

    if (heroRoomCodeEl && roomCode) {
        heroRoomCodeEl.textContent = roomCode;
    }

    if (heroRoomCodeBanner) {
        if (state.game_status === 'waiting') {
            heroRoomCodeBanner.classList.remove('hidden');
        } else {
            heroRoomCodeBanner.classList.add('hidden');
        }
    }

    if (presetTimeConfigCard) {
        if (state.game_status === 'waiting') {
            presetTimeConfigCard.classList.remove('hidden');
        } else {
            presetTimeConfigCard.classList.add('hidden');
        }
    }

    if (timerControls) {
        if (state.game_status === 'waiting') {
            timerControls.classList.add('hidden');
        } else {
            timerControls.classList.remove('hidden');
        }
    }

    // Reset buttons state
    btnStartRandom.disabled = false;
    btnCallMeeting.disabled = true;
    btnCallMeeting.classList.remove('hidden');
    btnStartDiscussion.classList.add('hidden');
    btnStartVoting.classList.add('hidden');
    votingSection.classList.add('hidden');

    if (btnStartVoting) {
        const vVal = roomConfig ? (roomConfig.votingDuration !== undefined ? roomConfig.votingDuration : roomConfig.meetingDuration) : 60;
        const votSec = (vVal !== undefined && vVal !== null && !isNaN(parseInt(vVal))) ? parseInt(vVal) : 60;
        btnStartVoting.textContent = votSec > 0 ? `Inizio Votazioni (${votSec}s)` : `Inizio Votazioni (Libera)`;
    }

    if (modalLiveTimerSection) {
        if (state.game_status === 'playing') modalLiveTimerSection.classList.remove('hidden');
        else modalLiveTimerSection.classList.add('hidden');
    }

    if (modalVotingTimerSection) {
        if (state.game_status === 'voting') modalVotingTimerSection.classList.remove('hidden');
        else modalVotingTimerSection.classList.add('hidden');
    }

    if (state.game_status === 'waiting') {
        // waiting
    }
    else if (state.game_status === 'playing') {
        btnStartRandom.disabled = true;
        btnCallMeeting.disabled = false;
        
        if (btnTimerPause) {
            if (state.timer_paused) {
                btnTimerPause.textContent = "▶️ RIPRENDI";
                btnTimerPause.style.background = "#00c853";
            } else {
                btnTimerPause.textContent = "⏸️ PAUSA";
                btnTimerPause.style.background = "#ea580c";
            }
        }
        if (btnTimerPauseCard) {
            if (state.timer_paused) {
                btnTimerPauseCard.textContent = "▶️ RIPRENDI";
                btnTimerPauseCard.style.background = "#00c853";
            } else {
                btnTimerPauseCard.textContent = "⏸️ PAUSA";
                btnTimerPauseCard.style.background = "#ea580c";
            }
        }
    } 
    else if (state.game_status === 'emergency') {
        btnStartRandom.disabled = true;
        btnCallMeeting.classList.add('hidden');
        btnStartDiscussion.classList.remove('hidden');
    } 
    else if (state.game_status === 'discussion') {
        btnStartRandom.disabled = true;
        btnCallMeeting.classList.add('hidden');
        btnStartVoting.classList.remove('hidden');
    }
    else if (state.game_status === 'voting') {
        btnStartRandom.disabled = true;
        btnCallMeeting.classList.add('hidden');
        votingSection.classList.remove('hidden');
    }
    else if (state.game_status === 'impostors_win' || state.game_status === 'crewmates_win') {
        btnStartRandom.disabled = true;
    }
}

function renderMasterTimer() {
    if (!currentState || !currentState.game_status) {
        if (currentTimerPill) currentTimerPill.classList.add('hidden');
        return;
    }

    const status = currentState.game_status;
    let headerTimerText = "00:00";
    let liveClockText = "00:00";
    let modalTimerText = "00:00";
    let timerColor = "#38bdf8";

    if (status === 'waiting') {
        if (currentTimerPill) currentTimerPill.classList.add('hidden');
        liveClockText = "⏳ IN ATTESA";
        modalTimerText = "⏳ IN ATTESA";
        timerColor = "#94a3b8";
    } else if (status === 'playing') {
        if (currentTimerPill) currentTimerPill.classList.remove('hidden');
        if (currentState.timer_paused) {
            const remSec = formatTime(currentState.timer_remaining || 0);
            headerTimerText = remSec;
            liveClockText = `⏸️ PAUSA (${remSec})`;
            modalTimerText = `PAUSA (${remSec})`;
            timerColor = "#f59e0b";
        } else {
            const left = Math.max(0, (currentState.timer || 0) - Date.now());
            const remSec = formatTime(left);
            headerTimerText = remSec;
            liveClockText = `▶️ ${remSec}`;
            modalTimerText = `▶️ ${remSec}`;
            timerColor = left <= 30000 ? "#ef4444" : "#38bdf8";
        }
    } else if (status === 'emergency') {
        if (currentTimerPill) currentTimerPill.classList.add('hidden');
        liveClockText = "🚨 EMERGENZA";
        modalTimerText = "🚨 EMERGENZA";
        timerColor = "#ef4444";
    } else if (status === 'discussion') {
        if (currentTimerPill) currentTimerPill.classList.add('hidden');
        liveClockText = "💬 DISCUSSIONE";
        modalTimerText = "💬 DISCUSSIONE";
        timerColor = "#ffeb3b";
    } else if (status === 'voting') {
        if (currentTimerPill) currentTimerPill.classList.remove('hidden');
        if (!currentState.voting_endtime || currentState.voting_endtime === 0) {
            headerTimerText = "Libera";
            liveClockText = "🗳️ VOTAZIONE LIBERA";
            modalTimerText = "🗳️ VOTAZIONE LIBERA";
        } else {
            const remaining = Math.max(0, currentState.voting_endtime - Date.now());
            const sec = Math.ceil(remaining / 1000);
            headerTimerText = `${sec}s`;
            liveClockText = `🗳️ VOTAZIONE: ${sec}s`;
            modalTimerText = `🗳️ VOTAZIONE: ${sec}s`;
        }
        timerColor = "#9c27b0";
    } else if (status === 'impostors_win' || status === 'crewmates_win') {
        if (currentTimerPill) currentTimerPill.classList.add('hidden');
        liveClockText = "🏆 FINE PARTITA";
        modalTimerText = "🏆 FINE PARTITA";
        timerColor = "#64748b";
    }

    if (currentTimerEl) {
        currentTimerEl.textContent = headerTimerText;
        currentTimerEl.style.color = timerColor;
    }
    if (masterLiveClockEl) {
        masterLiveClockEl.textContent = liveClockText;
        masterLiveClockEl.style.color = timerColor;
    }
    if (masterModalClockEl) {
        masterModalClockEl.textContent = modalTimerText;
        masterModalClockEl.style.color = timerColor;
    }
}

setInterval(renderMasterTimer, 200);

async function checkWinCondition(state, players) {
    if (state.game_status !== 'playing') return;

    let impostors = 0;
    let crewmates = 0;
    for (const name in players) {
        if (players[name].status === 'alive') {
            if (players[name].role === 'impostor') impostors++;
            else crewmates++;
        }
    }
    
    // Only apply if the game has actually started with players
    if (impostors + crewmates === 0) return; 

    if (impostors === 0) {
        await update(roomRef, { 'state/game_status': 'crewmates_win' });
    } else if (impostors >= crewmates) {
        await update(roomRef, { 'state/game_status': 'impostors_win' });
    }
}

async function checkVotes(state, players, votes) {
    if (state.game_status !== 'voting') return;

    let aliveCount = 0;
    for (const p in players) {
        if (players[p].status === 'alive') aliveCount++;
    }

    const voteKeys = Object.keys(votes || {});
    if (voteKeys.length >= aliveCount && aliveCount > 0) {
        await resolveMeeting(players, votes || {}, state);
    }
}

async function resolveMeeting(players, votes, state) {
    if (resolvingMeeting || state.game_status !== 'voting') return;
    resolvingMeeting = true;

    // Count votes
    const voteCounts = {};
    for (const p in votes) {
        const v = votes[p];
        voteCounts[v] = (voteCounts[v] || 0) + 1;
    }

    let maxVotes = 0;
    let ejected = null;
    let tie = false;

    for (const v in voteCounts) {
        if (voteCounts[v] > maxVotes) {
            maxVotes = voteCounts[v];
            ejected = v;
            tie = false;
        } else if (voteCounts[v] === maxVotes) {
            tie = true;
        }
    }

    if (tie || !ejected) {
        ejected = 'SKIP';
    }

    // Now build updates
    let nextRound = (state.round || 1) + 1;

    if (ejected !== 'SKIP' && players[ejected]) {
        players[ejected].status = 'killed_revealed';
    }

    // Convert killed_hidden to killed_revealed
    for (const name in players) {
        if (players[name].status === 'killed_hidden') {
            players[name].status = 'killed_revealed';
        }
    }

    const roundDuration = getRoundDuration(nextRound);
    const endTime = Date.now() + roundDuration;

    const updates = {};
    updates['state/game_status'] = 'playing';
    updates['state/round'] = nextRound;
    updates['state/timer'] = endTime;
    updates['state/timer_paused'] = false;
    updates['state/timer_remaining'] = 0;
    updates['state/last_ejected'] = ejected;
    updates['votes'] = null; // Clear votes

    for (const name in players) {
        updates[`players/${name}`] = players[name];
    }

    await update(roomRef, updates);
    resolvingMeeting = false;
}

// Config save button
if (btnSaveTimeCfg) {
    btnSaveTimeCfg.addEventListener('click', async () => {
        const discSec = Math.max(0, parseInt(cfgDiscussion ? cfgDiscussion.value : 0) || 0);
        const votingValRaw = cfgVoting ? cfgVoting.value.trim() : '60';
        const votingSec = (votingValRaw === '' || isNaN(parseInt(votingValRaw))) ? 60 : Math.max(0, parseInt(votingValRaw));

        const roundInputs = document.querySelectorAll('.master-round-time-input');
        const roundTimesMins = [];
        roundInputs.forEach(input => {
            const val = parseInt(input.value) || 1;
            roundTimesMins.push(val);
        });
        if (roundTimesMins.length === 0) roundTimesMins.push(5);
        const roundTimesMs = roundTimesMins.map(m => m * 60000);

        await update(roomRef, {
            'config/roundTimes': roundTimesMs,
            'config/discussionDuration': discSec,
            'config/votingDuration': votingSec,
            'config/meetingDuration': votingSec
        });

        addLog(`⏱️ Tempi aggiornati dal Master: Discussione=${discSec}s, Votazione=${votingSec}s, Round=${roundTimesMins.join('/')}m.`);
        alert("✅ Impostazioni tempi salvate con successo!");
        closeConfigTempiModal();
    });
}

// Timer Controls
const toggleTimerPauseState = async () => {
    if (currentState.timer_paused) {
        const newTimer = Date.now() + currentState.timer_remaining;
        await update(roomRef, {
            'state/timer_paused': false,
            'state/timer': newTimer
        });
    } else {
        const remaining = Math.max(0, currentState.timer - Date.now());
        await update(roomRef, {
            'state/timer_paused': true,
            'state/timer_remaining': remaining
        });
    }
};

const addOneMinuteToTimer = async () => {
    if (currentState.timer_paused) {
        await update(roomRef, { 'state/timer_remaining': (currentState.timer_remaining || 0) + 60000 });
    } else {
        await update(roomRef, { 'state/timer': (currentState.timer || Date.now()) + 60000 });
    }
    addLog(`⏱️ +1 Minuto aggiunto al tempo di gioco.`);
};

if (btnTimerPause) btnTimerPause.addEventListener('click', toggleTimerPauseState);
if (btnTimerPauseCard) btnTimerPauseCard.addEventListener('click', toggleTimerPauseState);

if (btnTimerAdd) btnTimerAdd.addEventListener('click', addOneMinuteToTimer);
if (btnTimerAddCard) btnTimerAddCard.addEventListener('click', addOneMinuteToTimer);

if (btnTimerSub) {
    btnTimerSub.addEventListener('click', async () => {
        if (currentState.timer_paused) {
            const newRem = Math.max(0, (currentState.timer_remaining || 0) - 60000);
            await update(roomRef, { 'state/timer_remaining': newRem });
        } else {
            const newTimer = Math.max(Date.now(), (currentState.timer || Date.now()) - 60000);
            await update(roomRef, { 'state/timer': newTimer });
        }
        addLog(`⏱️ -1 Minuto sottratto al tempo di gioco.`);
    });
}

if (btnTimerAdd5) {
    btnTimerAdd5.addEventListener('click', async () => {
        if (currentState.timer_paused) {
            await update(roomRef, { 'state/timer_remaining': (currentState.timer_remaining || 0) + 300000 });
        } else {
            await update(roomRef, { 'state/timer': (currentState.timer || Date.now()) + 300000 });
        }
        addLog(`⏱️ +5 Minuti aggiunti al tempo di gioco.`);
    });
}

if (btnTimerSub5) {
    btnTimerSub5.addEventListener('click', async () => {
        if (currentState.timer_paused) {
            const newRem = Math.max(0, (currentState.timer_remaining || 0) - 300000);
            await update(roomRef, { 'state/timer_remaining': newRem });
        } else {
            const newTimer = Math.max(Date.now(), (currentState.timer || Date.now()) - 300000);
            await update(roomRef, { 'state/timer': newTimer });
        }
        addLog(`⏱️ -5 Minuti sottratti al tempo di gioco.`);
    });
}

if (btnSetCustomTime) {
    btnSetCustomTime.addEventListener('click', async () => {
        const mins = parseInt(inputCustomMin.value) || 0;
        const secs = parseInt(inputCustomSec.value) || 0;
        const targetMs = (mins * 60 + secs) * 1000;
        if (targetMs <= 0 && mins === 0 && secs === 0) return alert("Inserisci un tempo valido.");

        if (currentState.timer_paused) {
            await update(roomRef, { 'state/timer_remaining': targetMs });
        } else {
            await update(roomRef, { 'state/timer': Date.now() + targetMs });
        }
        inputCustomMin.value = '';
        inputCustomSec.value = '';
        addLog(`⏱️ Tempo di gioco impostato a ${mins}m ${secs}s dal Master.`);
    });
}

if (btnVotingAdd30) {
    btnVotingAdd30.addEventListener('click', async () => {
        if (currentState.game_status === 'voting' && currentState.voting_endtime) {
            await update(roomRef, { 'state/voting_endtime': currentState.voting_endtime + 30000 });
            addLog(`⏱️ +30 Secondi aggiunti alla votazione.`);
        }
    });
}

if (btnVotingSub30) {
    btnVotingSub30.addEventListener('click', async () => {
        if (currentState.game_status === 'voting' && currentState.voting_endtime) {
            const newEndTime = Math.max(Date.now(), currentState.voting_endtime - 30000);
            await update(roomRef, { 'state/voting_endtime': newEndTime });
            addLog(`⏱️ -30 Secondi sottratti alla votazione.`);
        }
    });
}

// Actions
btnStartRandom.addEventListener('click', async () => {
    const snapshot = await get(ref(db, `rooms/${roomCode}/players`));
    const playersMap = snapshot.val() || {};
    const playerNames = Object.keys(playersMap);
    
    if(playerNames.length === 0) {
        return alert("Non ci sono giocatori nella stanza!");
    }

    if(!confirm("Sei sicuro di voler avviare il gioco con i giocatori attuali?")) return;
    
    // Logic for impostors
    let numImpostors = roomConfig.impostorCount || 1;
    if (playerNames.length <= numImpostors) {
        numImpostors = 1; // Fallback rule as requested
        alert("Il numero di giocatori è troppo basso per il numero di impostori scelto. Forzato a 1 Impostore.");
    }
    
    const hasScientist = roomConfig.scientistEnabled;

    const shuffledPlayers = [...playerNames].sort(() => 0.5 - Math.random());
    const randomImpostors = shuffledPlayers.slice(0, numImpostors);
    const randomScientist = hasScientist && shuffledPlayers.length > numImpostors ? shuffledPlayers[numImpostors] : null;

    const enableTasks = roomConfig.enableTasks !== false;
    const taskType = roomConfig.taskType || (roomConfig.mapMode === 'text' ? 'custom' : 'default');

    let tasksSource = null;
    if (enableTasks && taskType === 'custom' && roomConfig.tasks && roomConfig.tasks.length > 0) {
        tasksSource = roomConfig.tasks.map(t => `${t.num}. ${t.name}: ${t.obj} (${t.pos})`);
    }

    playerNames.forEach(name => {
        let role = 'crewmate';
        if (randomImpostors.includes(name)) role = 'impostor';
        else if (name === randomScientist) role = 'scientist';

        const tasksObj = {};
        if (enableTasks) {
            const assignedTasksList = getRandomTasks(tasksSource);
            assignedTasksList.forEach((taskDesc, i) => {
                tasksObj[`task_${i}`] = {
                    desc: taskDesc,
                    completed: false
                };
            });
        }

        playersMap[name] = {
            role: role,
            status: 'alive',
            tasks: tasksObj,
            meetings_called: 0
        };
    });

    const roundDuration = getRoundDuration(1);

    const updates = {};
    updates['state/round'] = 1;
    updates['state/last_ejected'] = null;
    updates['votes'] = null;
    
    updates['state/game_status'] = 'playing';
    updates['state/timer_paused'] = false;
    updates['state/timer'] = Date.now() + roundDuration;

    // Add player updates to the same atomic payload
    for (const name in playersMap) {
        updates[`players/${name}`] = playersMap[name];
    }

    await update(roomRef, updates);
});

btnCallMeeting.addEventListener('click', async () => {
    // We are going to emergency. Pause the timer.
    const remaining = Math.max(0, currentState.timer - Date.now());
    await update(roomRef, {
        'state/game_status': 'emergency',
        'state/timer_paused': true,
        'state/timer_remaining': remaining
    });
});

btnStartDiscussion.addEventListener('click', async () => {
    await update(roomRef, {
        'state/game_status': 'discussion'
    });
});

btnStartVoting.addEventListener('click', async () => {
    let votSec = 60;
    if (roomConfig) {
        const rawVot = roomConfig.votingDuration !== undefined ? roomConfig.votingDuration : roomConfig.meetingDuration;
        if (rawVot !== undefined && rawVot !== null && !isNaN(parseInt(rawVot))) {
            votSec = parseInt(rawVot);
        }
    }
    const votingEndTime = votSec > 0 ? Date.now() + (votSec * 1000) : 0;
    await update(roomRef, {
        'state/game_status': 'voting',
        'state/voting_endtime': votingEndTime
    });
});

btnEndMeeting.addEventListener('click', async () => {
    if(confirm("Vuoi forzare il termine della votazione ora?")) {
        await resolveMeeting(currentPlayers, currentVotes, currentState);
    }
});

btnReset.addEventListener('click', async () => {
    if(!confirm("ATTENZIONE: Questo formatterà l'intera partita e riporterà allo stato di attesa. Confermi?")) return;
    
    const snapshot = await get(ref(db, `rooms/${roomCode}/players`));
    const playersMap = snapshot.val() || {};
    
    for(const name in playersMap) {
        playersMap[name] = {
            role: 'crewmate',
            status: 'alive',
            tasks: {},
            meetings_called: 0
        }
    }

    const updates = {};
    updates['state/game_status'] = 'waiting';
    updates['state/round'] = 1;
    updates['state/timer'] = 0;
    updates['state/timer_paused'] = false;
    updates['state/timer_remaining'] = 0;
    updates['state/last_ejected'] = null;
    updates['votes'] = null;
    updates['kickedPlayers'] = null;

    for (const name in playersMap) {
        updates[`players/${name}`] = playersMap[name];
    }

    await update(roomRef, updates);
});

setInterval(async () => {
    if (currentState && currentState.game_status === 'voting' && currentState.voting_endtime && !resolvingMeeting) {
        if (Date.now() >= currentState.voting_endtime) {
            await resolveMeeting(currentPlayers, currentVotes || {}, currentState);
        }
    }
}, 1000);