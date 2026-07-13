import { db } from './firebase-config.js';
import { ref, update, onValue, onDisconnect, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
let myPlayerName = urlParams.get('player');

if (!roomCode || !myPlayerName) {
    alert("Manca il codice stanza o il nome giocatore.");
    window.location.href = "index.html";
}

// Elements
const roleScreen = document.getElementById('role-screen');
const roleText = document.getElementById('role-text');
const btnHideRole = document.getElementById('btn-hide-role');

const gameScreen = document.getElementById('game-screen');
const playerNameDisplay = document.getElementById('player-name-display');
const statusBadge = document.getElementById('status-badge');
const crewmateUI = document.getElementById('crewmate-ui');
const waitingScreen = document.getElementById('waiting-screen');
const overlayMeeting = document.getElementById('overlay-meeting');
const overlayDead = document.getElementById('overlay-dead');
const sirenAudio = document.getElementById('siren-audio');

const killSection = document.getElementById('kill-section');
const killTargetSelect = document.getElementById('kill-target-select');
const btnKill = document.getElementById('btn-kill');

const scientistUI = document.getElementById('scientist-ui');
const vitalsContainer = document.getElementById('vitals-container');
const btnReport = document.getElementById('btn-report');
const gameStatusText = document.getElementById('game-status-text');
const meetingsLeftText = document.getElementById('meetings-left-text');

const taskList = document.getElementById('task-list');

const votingUI = document.getElementById('voting-ui');
const votingOptions = document.getElementById('voting-options');
const votingStatus = document.getElementById('voting-status');

// Initialization
gameScreen.classList.remove('hidden');
playerNameDisplay.textContent = myPlayerName;

let myData = null;
let currentState = null;
let roomConfig = null;
let hasSeenRoleThisRound = false;

let killCooldownEnd = 0;
let killInterval = null;

let currentRoundTracker = 0;
let currentVotes = {};
let previousStatus = null;

btnHideRole.addEventListener('click', () => {
    roleScreen.classList.add('hidden');
});

// Setup onDisconnect to remove ghost players and their votes
const myPlayerRef = ref(db, `rooms/${roomCode}/players/${myPlayerName}`);
onDisconnect(myPlayerRef).remove();

const myVoteRef = ref(db, `rooms/${roomCode}/votes/${myPlayerName}`);
onDisconnect(myVoteRef).remove();

const roomRef = ref(db, `rooms/${roomCode}`);
onValue(roomRef, (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        currentState = data.state;
        roomConfig = data.config;
        currentVotes = data.votes || {};
        
        if (previousStatus === 'waiting' && currentState.game_status === 'playing') {
            hasSeenRoleThisRound = false; 
        }

        if (data.players && data.players[myPlayerName]) {
            myData = data.players[myPlayerName];
            updateUI(currentState, data.players);
        } else {
            statusBadge.textContent = "NON NELLA STANZA";
        }
        
        previousStatus = currentState.game_status;
    }
});

function updateUI(state, playersMap) {
    if (!myData) return;

    if (myData.status === 'killed_hidden' || myData.status === 'killed_revealed') {
        overlayDead.classList.remove('hidden');
    } else {
        overlayDead.classList.add('hidden');
    }

    const overlayMeetingH1 = overlayMeeting.querySelector('h1');
    const overlayMeetingP = overlayMeeting.querySelector('p');

    if (state.game_status === 'emergency') {
        overlayMeeting.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        votingUI.classList.add('hidden');
        overlayMeetingH1.textContent = "EMERGENZA!";
        overlayMeetingH1.style.color = "var(--accent-red)";
        overlayMeetingP.textContent = "Il gioco è in pausa. Raggiungi il punto di raduno!";
        
        if (previousStatus !== 'emergency' && sirenAudio) {
            sirenAudio.volume = 1.0;
            sirenAudio.play().catch(e => console.log("Audio blocked", e));
        }
        return;
    } else if (state.game_status === 'discussion') {
        overlayMeeting.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        votingUI.classList.add('hidden');
        overlayMeetingH1.textContent = "DISCUSSIONE";
        overlayMeetingH1.style.color = "#ffeb3b";
        overlayMeetingP.textContent = "Discuti! Guarda il maxischermo per i dettagli.";
        return;
    } else if (state.game_status === 'voting') {
        overlayMeeting.classList.add('hidden');
        gameScreen.classList.add('hidden');
        votingUI.classList.remove('hidden');
        renderVotingUI(playersMap);
        return;
    } else {
        overlayMeeting.classList.add('hidden');
        votingUI.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    }

    statusBadge.textContent = myData.status.toUpperCase();
    if (myData.status === 'alive') statusBadge.style.background = 'var(--accent-green)';
    else statusBadge.style.background = 'var(--accent-red)';

    if (state.game_status === 'waiting') {
        crewmateUI.classList.add('hidden');
        scientistUI.classList.add('hidden');
        killSection.classList.add('hidden');
        document.getElementById('report-section').classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        hasSeenRoleThisRound = false;

        // Populate Waiting Screen UI
        document.getElementById('waiting-player-name').textContent = myPlayerName;
        document.getElementById('waiting-room-code').textContent = `Stanza: ${roomCode}`;
    }
    else if (state.game_status === 'video_playing') {
        waitingScreen.classList.add('hidden');
        crewmateUI.classList.add('hidden');
        scientistUI.classList.add('hidden');
        killSection.classList.add('hidden');
        document.getElementById('report-section').classList.add('hidden');
    }
    else if (state.game_status === 'playing') {
        waitingScreen.classList.add('hidden');
        document.getElementById('report-section').classList.remove('hidden');

        if (state.round !== currentRoundTracker) {
            currentRoundTracker = state.round;
        }

        const maxMeetings = roomConfig.maxMeetings || 1;
        const meetingsCalled = myData.meetings_called || 0;
        const meetingsLeft = maxMeetings - meetingsCalled;
        meetingsLeftText.textContent = `Riunioni rimanenti: ${meetingsLeft}`;

        if (meetingsLeft > 0 && myData.status === 'alive') {
            btnReport.disabled = false;
            btnReport.textContent = "SEGNALA / RIUNIONE";
        } else {
            btnReport.disabled = true;
            btnReport.textContent = myData.status !== 'alive' ? "SEI MORTO" : "ESURITE";
        }

        if (!hasSeenRoleThisRound) {
            hasSeenRoleThisRound = true;
            roleScreen.classList.remove('hidden');
            roleText.textContent = myData.role.toUpperCase();
            roleText.className = 'role-text';
            if (myData.role === 'impostor') roleText.classList.add('role-impostor');
            else roleText.classList.add('role-crewmate');
            
            const cdSec = roomConfig.killCooldown || 120;
            killCooldownEnd = Date.now() + (cdSec * 1000);
            startCooldownTimer();
        }

        crewmateUI.classList.remove('hidden'); // Everyone sees tasks now

        if (myData.role === 'impostor') {
            scientistUI.classList.add('hidden');
            renderImpostorTasks(myData.tasks || []);
            updateKillSelector(playersMap);
        } else {
            killSection.classList.add('hidden');
            renderRealTasks(myData.tasks || []);
            
            if (myData.role === 'scientist') {
                scientistUI.classList.remove('hidden');
                updateScientistUI(state, playersMap);
            } else {
                scientistUI.classList.add('hidden');
            }
        }
        
        if(myData.status !== 'alive') {
            btnKill.disabled = true;
            btnKill.textContent = "SEI MORTO";
        }
    }
}

// Impostor Toggle Kill Menu
playerNameDisplay.addEventListener('click', () => {
    if (myData && myData.role === 'impostor' && myData.status === 'alive') {
        killSection.classList.toggle('hidden');
    }
});

function renderVotingUI(playersMap) {
    if (myData.status !== 'alive') {
        votingOptions.innerHTML = '';
        votingStatus.innerHTML = '<h3 style="color: var(--accent-red);">Sei morto, non puoi votare. Attendi.</h3>';
        return;
    }

    if (currentVotes[myPlayerName]) {
        votingOptions.innerHTML = '';
        votingStatus.innerHTML = `<h3 style="color: var(--accent-green);">Hai votato: ${currentVotes[myPlayerName]}</h3><p>Attendi gli altri...</p>`;
        return;
    }

    votingStatus.innerHTML = '';
    votingOptions.innerHTML = '';

    for (const name in playersMap) {
        if (playersMap[name].status === 'alive') {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.width = '100%';
            btn.style.padding = '1rem';
            btn.style.background = name === myPlayerName ? '#555' : 'var(--card-bg)';
            btn.textContent = name === myPlayerName ? `${name} (Tu)` : name;
            
            btn.onclick = async () => {
                if(confirm(`Confermi di voler votare ${name}?`)) {
                    await castVote(name);
                }
            };
            votingOptions.appendChild(btn);
        }
    }

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn';
    skipBtn.style.width = '100%';
    skipBtn.style.padding = '1rem';
    skipBtn.style.background = 'var(--dead-gray)';
    skipBtn.textContent = 'SKIP (Non espellere)';
    skipBtn.onclick = async () => {
        if(confirm("Sei sicuro di voler skippare il voto?")) {
            await castVote('SKIP');
        }
    };
    votingOptions.appendChild(skipBtn);
}

async function castVote(voteTarget) {
    const updates = {};
    updates[`rooms/${roomCode}/votes/${myPlayerName}`] = voteTarget;
    await update(ref(db), updates);
}

async function completeTask(taskId) {
    if (myData.status !== 'alive') return;
    const taskData = myData.tasks[taskId];
    if (!taskData || taskData.completed) return;

    const updates = {};
    updates[`rooms/${roomCode}/players/${myPlayerName}/tasks/${taskId}/completed`] = true;
    await update(ref(db), updates);
}

function renderRealTasks(tasksObj) {
    taskList.innerHTML = '';
    if(!tasksObj) return;
    
    for(const taskId in tasksObj) {
        const taskData = tasksObj[taskId];
        const isDone = taskData.completed;
        const li = document.createElement('li');
        li.className = `task-item ${isDone ? 'completed' : ''}`;
        
        li.innerHTML = `
            <span>${taskData.desc}</span>
            <button class="task-btn" ${isDone || myData.status !== 'alive' ? 'disabled' : ''} id="task-btn-${taskId}">
                ${isDone ? 'Fatto' : 'Spunta'}
            </button>
        `;
        
        if (!isDone && myData.status === 'alive') {
            const btn = li.querySelector(`#task-btn-${taskId}`);
            btn.onclick = async (e) => {
                e.target.disabled = true;
                e.target.textContent = 'Fatto';
                await completeTask(taskId);
            };
        }
        taskList.appendChild(li);
    }
}

function renderImpostorTasks(tasksObj) {
    taskList.innerHTML = '';
    if(!tasksObj) return;
    
    for(const taskId in tasksObj) {
        const taskData = tasksObj[taskId];
        const li = document.createElement('li');
        li.className = `task-item`;
        li.innerHTML = `
            <span>${taskData.desc}</span>
            <button class="task-btn" id="fake-task-btn-${taskId}">Spunta</button>
        `;
        const btn = li.querySelector(`#fake-task-btn-${taskId}`);
        btn.onclick = (e) => {
            li.classList.add('completed');
            btn.disabled = true;
            btn.textContent = 'Fatto';
        };
        taskList.appendChild(li);
    }
}

function updateKillSelector(players) {
    const currentVal = killTargetSelect.value;
    killTargetSelect.innerHTML = '<option value="">-- Seleziona Vittima --</option>';
    
    for (const name in players) {
        if (players[name].status === 'alive' && name !== myPlayerName && players[name].role !== 'impostor') {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            killTargetSelect.appendChild(opt);
        }
    }
    if (currentVal) {
        killTargetSelect.value = currentVal;
    }
}

function startCooldownTimer() {
    clearInterval(killInterval);
    killInterval = setInterval(() => {
        if(myData && myData.status !== 'alive') {
            clearInterval(killInterval);
            return;
        }

        const remaining = killCooldownEnd - Date.now();
        if (remaining <= 0) {
            btnKill.textContent = "KILL";
            btnKill.disabled = false;
            clearInterval(killInterval);
        } else {
            const secs = Math.floor(remaining / 1000);
            const m = Math.floor(secs / 60);
            const s = secs % 60;
            btnKill.textContent = `COOLDOWN (${m}:${s.toString().padStart(2, '0')})`;
            btnKill.disabled = true;
        }
    }, 1000);
}

btnKill.addEventListener('click', async () => {
    if (!currentState || currentState.game_status !== 'playing') {
        alert("Azione non consentita in questa fase del gioco.");
        return;
    }

    const target = killTargetSelect.value;
    if (!target) {
        alert("Seleziona un bersaglio!");
        return;
    }
    
    if (confirm(`Sei sicuro di voler uccidere ${target}?`)) {
        const cdSec = roomConfig.killCooldown || 120;
        killCooldownEnd = Date.now() + (cdSec * 1000);
        startCooldownTimer();

        await update(ref(db, `rooms/${roomCode}/players/${target}`), {
            status: 'killed_hidden'
        });
        killTargetSelect.value = "";
        killSection.classList.add('hidden'); // auto hide after kill
    }
});

function updateScientistUI(state, players) {
    gameStatusText.textContent = `Round: ${state.round || 1}`;
    renderVitals(players);
}

function renderVitals(players) {
    vitalsContainer.innerHTML = '';
    if(!players) return;

    for (const name in players) {
        const pData = players[name];
        const card = document.createElement('div');
        card.className = 'vital-card';
        
        let statusClass = 'vital-revealed';
        let statusText = 'SCONOSC.';

        if (pData.status === 'alive') {
            statusClass = 'vital-alive';
            statusText = 'ALIVE';
        } else if (pData.status === 'killed_hidden') {
            statusClass = 'vital-killed';
            statusText = 'KILLED';
        } else if (pData.status === 'killed_revealed') {
            statusClass = 'vital-revealed';
            statusText = 'DEAD';
        }

        card.classList.add(statusClass);
        card.innerHTML = `
            <div style="font-size: 0.9rem; font-family: var(--font-pixel); margin-bottom: 0.5rem; word-break: break-all;">${name}</div>
            <div style="font-size: 0.7rem;">${statusText}</div>
        `;
        vitalsContainer.appendChild(card);
    }
}

btnReport.addEventListener('click', async () => {
    if (!currentState || currentState.game_status !== 'playing') {
        alert("Attendi l'avvio ufficiale della partita prima di chiamare una riunione!");
        return;
    }

    const maxMeetings = roomConfig.maxMeetings || 1;
    const meetingsCalled = myData.meetings_called || 0;
    
    if(meetingsCalled >= maxMeetings || myData.status !== 'alive') return;
    
    if(confirm("Vuoi segnalare un corpo o chiamare una riunione di emergenza?")) {
        btnReport.disabled = true;
        
        const updates = {};
        const remaining = Math.max(0, currentState.timer - Date.now());
        updates[`rooms/${roomCode}/state/game_status`] = 'emergency';
        updates[`rooms/${roomCode}/state/timer_paused`] = true;
        updates[`rooms/${roomCode}/state/timer_remaining`] = remaining;
        updates[`rooms/${roomCode}/players/${myPlayerName}/meetings_called`] = meetingsCalled + 1;
        await update(ref(db), updates);
    }
});

document.getElementById('btn-change-name').addEventListener('click', async () => {
    if(currentState && currentState.game_status !== 'waiting') {
        alert("Non puoi cambiare nome a partita in corso.");
        return;
    }
    const newName = prompt("Inserisci il tuo nuovo nome:");
    if(!newName || newName.trim() === "" || newName.trim() === myPlayerName) return;
    
    const cleanName = newName.trim();
    
    // Check if name is taken
    const snapshot = await get(ref(db, `rooms/${roomCode}/players/${cleanName}`));
    if(snapshot.exists()) {
        alert("Questo nome è già in uso!");
        return;
    }
    
    // Update Firebase
    const oldNameRef = ref(db, `rooms/${roomCode}/players/${myPlayerName}`);
    const newNameRef = ref(db, `rooms/${roomCode}/players/${cleanName}`);
    
    const playerData = await get(oldNameRef);
    if(playerData.exists()) {
        await set(newNameRef, playerData.val());
        await remove(oldNameRef);
    } else {
        await set(newNameRef, { status: 'alive', role: 'crewmate', meetings_called: 0 });
    }
    
    // Update local variables
    myPlayerName = cleanName;
    localStorage.setItem('lastNickname', cleanName);
    
    // Update URL without reloading
    const url = new URL(window.location);
    url.searchParams.set('player', cleanName);
    window.history.replaceState({}, '', url);
});
