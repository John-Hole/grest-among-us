import { db } from './firebase-config.js';
import { doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { PLAYERS_LIST } from './game-logic.js';

const loginScreen = document.getElementById('login-screen');
const playerSelect = document.getElementById('player-select');
const btnLogin = document.getElementById('btn-login');

const roleScreen = document.getElementById('role-screen');
const roleText = document.getElementById('role-text');
const btnHideRole = document.getElementById('btn-hide-role');

const gameScreen = document.getElementById('game-screen');
const playerNameDisplay = document.getElementById('player-name-display');
const statusBadge = document.getElementById('status-badge');
const crewmateUI = document.getElementById('crewmate-ui');
const impostorUI = document.getElementById('impostor-ui');
const waitingScreen = document.getElementById('waiting-screen');
const overlayMeeting = document.getElementById('overlay-meeting');

const scientistUI = document.getElementById('scientist-ui');
const vitalsContainer = document.getElementById('vitals-container');
const btnEmergency = document.getElementById('btn-emergency');
const gameStatusText = document.getElementById('game-status-text');

const taskList = document.getElementById('task-list');
const fakeTaskList = document.getElementById('fake-task-list');
const killTargetSelect = document.getElementById('kill-target-select');
const btnKill = document.getElementById('btn-kill');

let myPlayerName = null;
let myData = null;
let currentState = null;
let hasSeenRoleThisRound = false;

let killCooldownEnd = 0;
let killInterval = null;
const KILL_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

let hasUsedMeetingThisRound = false;
let currentRoundTracker = 0;

// Setup Login
PLAYERS_LIST.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    playerSelect.appendChild(opt);
});

btnLogin.addEventListener('click', () => {
    if (playerSelect.value) {
        myPlayerName = playerSelect.value;
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        playerNameDisplay.textContent = myPlayerName;
        // The snapshot listener will handle the rest
        if(currentState) updateUI(currentState);
    }
});

btnHideRole.addEventListener('click', () => {
    roleScreen.classList.add('hidden');
});

const gameRef = doc(db, 'game', 'state');
onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
        const prevState = currentState;
        currentState = docSnap.data();
        
        // Detect round change or game start
        if (prevState && prevState.game_status === 'waiting' && currentState.game_status === 'playing') {
            hasSeenRoleThisRound = false; 
        }
        if (prevState && currentState.round > prevState.round) {
            // New round, reset some things if needed, but role is already seen usually.
        }

        if (myPlayerName) {
            updateUI(currentState);
        }
    }
});

function updateUI(state) {
    myData = state.players[myPlayerName];
    if (!myData) return;

    // Handle Meeting Overlay
    if (state.game_status === 'meeting_called' || state.game_status === 'meeting_in_progress') {
        overlayMeeting.classList.remove('hidden');
        return;
    } else {
        overlayMeeting.classList.add('hidden');
    }

    // Update Status Badge
    statusBadge.textContent = myData.status.toUpperCase();
    if (myData.status === 'alive') statusBadge.style.background = 'var(--accent-green)';
    else statusBadge.style.background = 'var(--accent-red)';

    // Handle Game States
    if (state.game_status === 'waiting') {
        crewmateUI.classList.add('hidden');
        impostorUI.classList.add('hidden');
        scientistUI.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        hasSeenRoleThisRound = false;
    } 
    else if (state.game_status === 'playing') {
        waitingScreen.classList.add('hidden');

        // Show Role Screen if not seen yet
        if (!hasSeenRoleThisRound) {
            hasSeenRoleThisRound = true;
            roleScreen.classList.remove('hidden');
            roleText.textContent = myData.role.toUpperCase();
            roleText.className = 'role-text'; // reset
            if (myData.role === 'impostor') roleText.classList.add('role-impostor');
            else roleText.classList.add('role-crewmate');
            
            // Reset cooldown on game start
            killCooldownEnd = Date.now() + KILL_COOLDOWN_MS;
            startCooldownTimer();
        }

        if (myData.role === 'impostor') {
            crewmateUI.classList.add('hidden');
            impostorUI.classList.remove('hidden');
            scientistUI.classList.add('hidden');
            renderFakeTasks(myData.tasks);
            updateKillSelector(state.players);
        } else {
            // Crewmate or Scientist
            impostorUI.classList.add('hidden');
            crewmateUI.classList.remove('hidden');
            renderRealTasks(myData.tasks);
            
            if (myData.role === 'scientist') {
                scientistUI.classList.remove('hidden');
                updateScientistUI(state);
            } else {
                scientistUI.classList.add('hidden');
            }
        }
        
        // If dead, disable actions
        if(myData.status !== 'alive') {
            btnKill.disabled = true;
            btnKill.textContent = "SEI MORTO";
        }
    }
}

async function completeTask(index) {
    if (myData.status !== 'alive') return;

    let currentCompleted = myData.completed_tasks || [];
    if (currentCompleted.includes(index)) return;

    const newCompleted = [...currentCompleted, index];
    const updatePath = `players.${myPlayerName}.completed_tasks`;
    
    await updateDoc(gameRef, {
        [updatePath]: newCompleted
    });
}

function renderRealTasks(tasks) {
    taskList.innerHTML = '';
    const completedArr = myData.completed_tasks || [];
    
    tasks.forEach((taskName, index) => {
        const isDone = completedArr.includes(index);
        const li = document.createElement('li');
        li.className = `task-item ${isDone ? 'completed' : ''}`;
        
        li.innerHTML = `
            <span>${taskName}</span>
            <button class="task-btn" ${isDone || myData.status !== 'alive' ? 'disabled' : ''} id="task-btn-${index}">
                ${isDone ? 'Fatto' : 'Spunta'}
            </button>
        `;
        
        if (!isDone && myData.status === 'alive') {
            const btn = li.querySelector(`#task-btn-${index}`);
            btn.onclick = async (e) => {
                e.target.disabled = true;
                await completeTask(index);
            };
        }
        taskList.appendChild(li);
    });
}

function renderFakeTasks(tasks) {
    if(fakeTaskList.children.length > 0) return; // Render once
    
    fakeTaskList.innerHTML = '';
    tasks.forEach((taskName) => {
        const li = document.createElement('li');
        li.className = `task-item`;
        li.innerHTML = `
            <span>${taskName}</span>
            <button class="task-btn" style="background: var(--dead-gray);">Fingi</button>
        `;
        // Fake button does nothing but UI feedback
        const btn = li.querySelector('button');
        btn.onclick = (e) => {
            li.classList.add('completed');
            btn.disabled = true;
            btn.textContent = 'Fatto';
        };
        fakeTaskList.appendChild(li);
    });
}

function updateKillSelector(players) {
    // Preserve current selection if possible
    const currentVal = killTargetSelect.value;
    killTargetSelect.innerHTML = '<option value="">-- Seleziona Vittima --</option>';
    
    for (const name in players) {
        // Un Impostore può uccidere solo i giocatori VIVI e che NON sono a loro volta impostori.
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
    const target = killTargetSelect.value;
    if (!target) {
        alert("Seleziona un bersaglio!");
        return;
    }
    
    if (confirm(`Sei sicuro di voler uccidere ${target}?`)) {
        const updatePath = `players.${target}.status`;
        
        // Reset cooldown
        killCooldownEnd = Date.now() + KILL_COOLDOWN_MS;
        startCooldownTimer();

        await updateDoc(gameRef, {
            [updatePath]: 'killed_hidden'
        });
        
        killTargetSelect.value = "";
    }
});

// --- SCIENTIST LOGIC ---
function updateScientistUI(state) {
    gameStatusText.textContent = `Round: ${state.round || 1}`;

    if (state.round !== currentRoundTracker) {
        currentRoundTracker = state.round;
        hasUsedMeetingThisRound = false;
    }

    if (state.game_status === 'playing' && !hasUsedMeetingThisRound && myData.status === 'alive') {
        btnEmergency.disabled = false;
        btnEmergency.classList.add('available');
        btnEmergency.textContent = "EMERGENZA (1)";
    } else {
        btnEmergency.disabled = true;
        btnEmergency.classList.remove('available');
        if (myData.status !== 'alive') {
            btnEmergency.textContent = "SEI MORTO";
        } else {
            btnEmergency.textContent = hasUsedMeetingThisRound ? "USATA" : "NON DISPONIBILE";
        }
    }

    renderVitals(state.players);
}

function renderVitals(players) {
    vitalsContainer.innerHTML = '';
    if(!players) return;

    PLAYERS_LIST.forEach(name => {
        const pData = players[name];
        if(!pData) return;

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
    });
}

btnEmergency.addEventListener('click', async () => {
    if(hasUsedMeetingThisRound || myData.status !== 'alive') return;
    
    if(confirm("Vuoi chiamare una riunione di emergenza? Puoi farlo solo 1 volta per round.")) {
        hasUsedMeetingThisRound = true;
        btnEmergency.disabled = true;
        btnEmergency.classList.remove('available');
        
        await updateDoc(gameRef, {
            game_status: 'meeting_called'
        });
    }
});
