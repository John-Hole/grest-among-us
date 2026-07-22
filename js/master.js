import { db } from './firebase-config.js';
import { ref, get, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { getRandomTasks, ROUND_TIMES } from './game-logic.js';

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
const btnStart = document.getElementById('btn-start');
const btnStartRandom = document.getElementById('btn-start-random');
const btnCallMeeting = document.getElementById('btn-call-meeting');
const btnStartMeeting = null; // Removed
const btnStartDiscussion = document.getElementById('btn-start-discussion');
const btnStartVoting = document.getElementById('btn-start-voting');
const btnEndMeeting = document.getElementById('btn-end-meeting');
const btnReset = document.getElementById('btn-reset');
const votingSection = document.getElementById('voting-section');

// Timer Controls
const timerControls = document.getElementById('timer-controls');
const btnTimerPause = document.getElementById('btn-timer-pause');
const btnTimerAdd = document.getElementById('btn-timer-add');
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
let resolvingMeeting = false;
let previousPlayers = null;

const roomRef = ref(db, `rooms/${roomCode}`);

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
        if (!newPlayers[name]) {
            addLog(`🥾 <span style="color:var(--accent-red);">${name}</span> è stato espulso.`);
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
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.background = '#333';
        div.style.padding = '0.5rem';
        div.style.borderRadius = '4px';

        const roleColors = {
            'impostor': 'var(--accent-red)',
            'crewmate': 'var(--accent-cyan)',
            'scientist': '#4caf50'
        };

        const statusLabel = p.status === 'alive' ? 'VIVO' : 'MORTO';
        const color = p.status === 'alive' ? roleColors[p.role || 'crewmate'] : 'var(--dead-gray)';
        const roleLabel = (p.role || 'crewmate').toUpperCase();

        div.innerHTML = `
            <div>
                <strong style="color: ${color};">${name}</strong> 
                <span style="font-size: 0.8rem; margin-left: 0.5rem; color:#aaa;">[${roleLabel}]</span>
                <span style="font-size: 0.8rem; margin-left: 0.5rem; color: ${p.status==='alive'?'#fff':'#aaa'};">${statusLabel}</span>
            </div>
        `;

        if (isGameWaiting) {
            // Prima che il gioco parti: mostra tasto ESPELLI
            const btnKick = document.createElement('button');
            btnKick.textContent = "ESPELLI";
            btnKick.className = "btn btn-danger";
            btnKick.style.padding = "0.2rem 0.5rem";
            btnKick.style.fontSize = "0.8rem";
            btnKick.onclick = async () => {
                if(confirm(`Espellere ${name} dalla stanza?`)) {
                    await remove(ref(db, `rooms/${roomCode}/players/${name}`));
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
                btnKill.style.padding = "0.2rem 0.5rem";
                btnKill.style.fontSize = "0.8rem";
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
                btnKick.style.padding = "0.2rem 0.5rem";
                btnKick.style.fontSize = "0.8rem";
                btnKick.onclick = async () => {
                    if(confirm(`Espellere ${name} dalla partita?`)) {
                        await remove(ref(db, `rooms/${roomCode}/players/${name}`));
                    }
                };
                div.appendChild(btnKick);
            }
        }

        monitorContainer.appendChild(div);
    }
}

// Listen to changes
onValue(roomRef, (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        currentState = data.state || {};
        roomConfig = data.config || {};
        currentPlayers = data.players || {};
        currentVotes = data.votes || {};
        
        updateUI(currentState, currentPlayers);
        updateMonitor(currentPlayers);
        
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
    timerControls.classList.add('hidden');

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
        timerControls.classList.remove('hidden');
        
        if (state.timer_paused) {
            btnTimerPause.textContent = "Riprendi Timer";
            btnTimerPause.style.background = "var(--accent-green)";
        } else {
            btnTimerPause.textContent = "Metti in Pausa";
            btnTimerPause.style.background = "#ff9800";
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

    const roundDuration = ROUND_TIMES[Math.min(nextRound - 1, ROUND_TIMES.length - 1)];
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

// Timer Controls
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

btnTimerAdd.addEventListener('click', async () => {
    if (currentState.timer_paused) {
        await update(roomRef, { 'state/timer_remaining': currentState.timer_remaining + 60000 });
    } else {
        await update(roomRef, { 'state/timer': currentState.timer + 60000 });
    }
});


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

    const roundDuration = ROUND_TIMES[0];

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
    const votingDuration = 60000;
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