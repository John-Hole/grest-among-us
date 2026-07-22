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
const btnStart = document.getElementById('btn-start');
const btnStartRandom = document.getElementById('btn-start-random');
const btnCallMeeting = document.getElementById('btn-call-meeting');
const btnStartMeeting = null; // Removed
const btnStartDiscussion = document.getElementById('btn-start-discussion');
const btnStartVoting = document.getElementById('btn-start-voting');
const btnEndMeeting = document.getElementById('btn-end-meeting');
const btnReset = document.getElementById('btn-reset');
const votingSection = document.getElementById('voting-section');

// Timer Controls Elements
const timerControls = document.getElementById('timer-controls');
const masterLiveClockEl = document.getElementById('master-live-clock');
const liveTimerActions = document.getElementById('live-timer-actions');
const votingTimerActions = document.getElementById('voting-timer-actions');

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

const cfgRound1 = document.getElementById('cfg-round1');
const cfgRound2 = document.getElementById('cfg-round2');
const cfgRound3 = document.getElementById('cfg-round3');
const cfgVoting = document.getElementById('cfg-voting');
const btnSaveTimeCfg = document.getElementById('btn-save-time-cfg');

const monitorContainer = document.getElementById('monitor-container');
const logContainer = document.getElementById('log-container');
const btnProjector = document.getElementById('btn-projector');

if (btnProjector) {
    btnProjector.addEventListener('click', () => {
        window.open(`schermo.html?room=${roomCode}`, '_blank');
    });
}

// Update UI text
btnStart.classList.add('hidden'); // Hide fixed roles button since we don't have hardcoded players
btnStartRandom.textContent = "Avvia Partita";

document.querySelector('h1').textContent = `PANNELLO MASTER - [${roomCode}]`;

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

function syncTimeConfigUI() {
    if (!roomConfig) return;
    const activeId = document.activeElement ? document.activeElement.id : null;
    
    if (roomConfig.roundTimes && Array.isArray(roomConfig.roundTimes)) {
        if (cfgRound1 && activeId !== 'cfg-round1') cfgRound1.value = Math.round(roomConfig.roundTimes[0] / 60000) || 10;
        if (cfgRound2 && activeId !== 'cfg-round2') cfgRound2.value = Math.round(roomConfig.roundTimes[1] / 60000) || 7;
        if (cfgRound3 && activeId !== 'cfg-round3') cfgRound3.value = Math.round(roomConfig.roundTimes[2] / 60000) || 5;
    }
    if (cfgVoting && activeId !== 'cfg-voting') {
        cfgVoting.value = roomConfig.meetingDuration || 60;
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
    
    statusBadge.textContent = state.game_status.toUpperCase();
    currentRoundEl.textContent = state.round || 1;

    // Reset styles
    statusBadge.style.backgroundColor = "var(--dead-gray)";
    btnStartRandom.disabled = false;
    btnCallMeeting.disabled = true;
    btnCallMeeting.classList.remove('hidden');
    btnStartDiscussion.classList.add('hidden');
    btnStartVoting.classList.add('hidden');
    votingSection.classList.add('hidden');

    if (btnStartVoting) {
        btnStartVoting.textContent = `Inizio Votazioni (${roomConfig.meetingDuration || 60}s)`;
    }

    if (timerControls) timerControls.classList.remove('hidden');

    if (liveTimerActions) {
        if (state.game_status === 'playing') liveTimerActions.classList.remove('hidden');
        else liveTimerActions.classList.add('hidden');
    }

    if (votingTimerActions) {
        if (state.game_status === 'voting') votingTimerActions.classList.remove('hidden');
        else votingTimerActions.classList.add('hidden');
    }

    if (state.game_status === 'waiting') {
        // waiting
    }
    else if (state.game_status === 'video_playing') {
        statusBadge.style.backgroundColor = "#ff9800";
        btnStartRandom.disabled = true;
        btnCallMeeting.disabled = true;
    }
    else if (state.game_status === 'playing') {
        statusBadge.style.backgroundColor = "var(--accent-green)";
        btnStartRandom.disabled = true;
        btnCallMeeting.disabled = false;
        
        if (btnTimerPause) {
            if (state.timer_paused) {
                btnTimerPause.textContent = "Riprendi";
                btnTimerPause.style.background = "var(--accent-green)";
            } else {
                btnTimerPause.textContent = "Pausa";
                btnTimerPause.style.background = "#ea580c";
            }
        }
    } 
    else if (state.game_status === 'emergency') {
        statusBadge.style.backgroundColor = "var(--accent-red)";
        btnStartRandom.disabled = true;
        btnCallMeeting.classList.add('hidden');
        btnStartDiscussion.classList.remove('hidden');
    } 
    else if (state.game_status === 'discussion') {
        statusBadge.style.backgroundColor = "#ffeb3b";
        btnStartRandom.disabled = true;
        btnCallMeeting.classList.add('hidden');
        btnStartVoting.classList.remove('hidden');
    }
    else if (state.game_status === 'voting') {
        statusBadge.style.backgroundColor = "#9c27b0";
        btnStartRandom.disabled = true;
        btnCallMeeting.classList.add('hidden');
        votingSection.classList.remove('hidden');
    }
    else if (state.game_status === 'impostors_win' || state.game_status === 'crewmates_win') {
        statusBadge.style.backgroundColor = state.game_status === 'impostors_win' ? "var(--accent-red)" : "var(--accent-cyan)";
        btnStartRandom.disabled = true;
    }
}

function renderMasterTimer() {
    if (!currentState || !currentState.game_status) {
        if (currentTimerEl) currentTimerEl.textContent = "--:--";
        if (masterLiveClockEl) masterLiveClockEl.textContent = "--:--";
        return;
    }

    const status = currentState.game_status;
    let timerText = "00:00";
    let timerColor = "#38bdf8";

    if (status === 'waiting') {
        timerText = "IN ATTESA";
        timerColor = "#94a3b8";
    } else if (status === 'video_playing') {
        timerText = "VIDEO INTRO";
        timerColor = "#ff9800";
    } else if (status === 'playing') {
        if (currentState.timer_paused) {
            const remSec = formatTime(currentState.timer_remaining || 0);
            timerText = `PAUSA (${remSec})`;
            timerColor = "#ff9800";
        } else {
            const left = Math.max(0, (currentState.timer || 0) - Date.now());
            timerText = formatTime(left);
            timerColor = left <= 30000 ? "#ef4444" : "#38bdf8";
        }
    } else if (status === 'emergency') {
        timerText = "EMERGENZA";
        timerColor = "#ef4444";
    } else if (status === 'discussion') {
        timerText = "DISCUSSIONE";
        timerColor = "#ffeb3b";
    } else if (status === 'voting') {
        const remaining = Math.max(0, (currentState.voting_endtime || 0) - Date.now());
        const sec = Math.ceil(remaining / 1000);
        timerText = `VOTAZIONE: ${sec}s`;
        timerColor = "#9c27b0";
    } else if (status === 'impostors_win' || status === 'crewmates_win') {
        timerText = "FINE PARTITA";
        timerColor = "#64748b";
    }

    if (currentTimerEl) {
        currentTimerEl.textContent = timerText;
        currentTimerEl.style.color = timerColor;
    }
    if (masterLiveClockEl) {
        masterLiveClockEl.textContent = timerText;
        masterLiveClockEl.style.color = timerColor;
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
        const r1 = Math.max(1, parseInt(cfgRound1.value) || 10);
        const r2 = Math.max(1, parseInt(cfgRound2.value) || 7);
        const r3 = Math.max(1, parseInt(cfgRound3.value) || 5);
        const votingSec = Math.max(10, parseInt(cfgVoting.value) || 60);

        const roundTimes = [r1 * 60000, r2 * 60000, r3 * 60000];

        await update(roomRef, {
            'config/roundTimes': roundTimes,
            'config/meetingDuration': votingSec
        });

        addLog(`⏱️ Tempi aggiornati dal Master: R1=${r1}m, R2=${r2}m, R3+=${r3}m, Votazione=${votingSec}s.`);
        alert("Impostazioni tempi salvate!");
    });
}

// Timer Controls
if (btnTimerPause) {
    btnTimerPause.addEventListener('click', async () => {
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
    });
}

if (btnTimerAdd) {
    btnTimerAdd.addEventListener('click', async () => {
        if (currentState.timer_paused) {
            await update(roomRef, { 'state/timer_remaining': (currentState.timer_remaining || 0) + 60000 });
        } else {
            await update(roomRef, { 'state/timer': (currentState.timer || Date.now()) + 60000 });
        }
        addLog(`⏱️ +1 Minuto aggiunto al tempo di gioco.`);
    });
}

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
    const isVideoEnabled = roomConfig.videoIntro;

    const shuffledPlayers = [...playerNames].sort(() => 0.5 - Math.random());
    const randomImpostors = shuffledPlayers.slice(0, numImpostors);
    const randomScientist = hasScientist && shuffledPlayers.length > numImpostors ? shuffledPlayers[numImpostors] : null;

    let tasksSource = null;
    if (roomConfig.mapMode === 'text' && roomConfig.tasks) {
        tasksSource = roomConfig.tasks.map(t => `${t.num}. ${t.name}: ${t.obj} (${t.pos})`);
    }

    playerNames.forEach(name => {
        let role = 'crewmate';
        if (randomImpostors.includes(name)) role = 'impostor';
        else if (name === randomScientist) role = 'scientist';

        const assignedTasksList = getRandomTasks(tasksSource);
        const tasksObj = {};
        assignedTasksList.forEach((taskDesc, i) => {
            tasksObj[`task_${i}`] = {
                desc: taskDesc,
                completed: false
            };
        });

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
    const votingDuration = (roomConfig.meetingDuration || 60) * 1000;
    await update(roomRef, {
        'state/game_status': 'voting',
        'state/voting_endtime': Date.now() + votingDuration
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