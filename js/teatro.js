import { db } from './firebase-config.js';
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { formatTime } from './game-logic.js';

const urlParams = new URLSearchParams(window.location.search);
let roomCode = urlParams.get('room');

if (!roomCode) {
    document.getElementById('join-overlay').classList.remove('hidden');
    document.getElementById('btn-join-room').addEventListener('click', () => {
        const code = document.getElementById('join-room-input').value.trim().toUpperCase();
        if(!code) {
            alert("Inserisci il codice della stanza!");
            return;
        }
        console.log('Tentativo di connessione alla stanza:', code);
        roomCode = code;
        
        // Update URL without reloading
        const url = new URL(window.location);
        url.searchParams.set('room', code);
        window.history.replaceState({}, '', url);
        
        startConnection();
    });
} else {
    startConnection();
}

function startConnection() {
    document.getElementById('join-overlay').classList.add('hidden');
    const headerEl = document.getElementById('header-room-code');
    if(headerEl) headerEl.textContent = roomCode;
    
    // Elements
const overlayMeeting = document.getElementById('overlay-meeting');
const overlayText = document.getElementById('overlay-text');
const overlayEjected = document.getElementById('overlay-ejected');
const ejectedText = document.getElementById('ejected-text');
const globalTimer = document.getElementById('global-timer');
const taskProgressFill = document.getElementById('task-progress-fill');
const taskProgressText = document.getElementById('task-progress-text');
const playersListContainer = document.getElementById('players-list-container');
const sirenAudio = document.getElementById('siren-audio');

const mapImage = document.getElementById('map-image');
const textMapContainer = document.getElementById('text-map-container');
const textTasksBody = document.getElementById('text-tasks-body');

let previousStatus = null;
let timerInterval = null;
let currentTimerEndTime = 0;

let currentMapMode = null;

// Initialize players list on the right (and in the lobby)
function renderPlayers(playersData, votesData, maxPlayers) {
    playersListContainer.innerHTML = '';
    const lobbyRoster = document.getElementById('waiting-players-list');
    if (lobbyRoster) lobbyRoster.innerHTML = '';
    
    let playerCount = 0;

    if(playersData) {
        for (const playerName in playersData) {
            playerCount++;
            const pData = playersData[playerName];
            const isRevealedDead = pData.status === 'killed_revealed';
            const hasVoted = votesData && votesData[playerName] !== undefined;
            
            // In-game sidebar
            const div = document.createElement('div');
            div.className = `player-row ${isRevealedDead ? 'dead' : ''}`;
            
            let statusHtml = '';
            if (isRevealedDead) {
                statusHtml = '<span style="margin-left:auto; color: red;">❌</span>';
            } else if (previousStatus === 'voting') {
                statusHtml = hasVoted ? '<span style="margin-left:auto; color: var(--accent-green); font-size: 0.8rem;">VOTATO</span>' : '<span style="margin-left:auto; color: var(--dead-gray); font-size: 0.8rem;">IN ATTESA</span>';
            }

            div.innerHTML = `
                <span>${playerName}</span>
                ${statusHtml}
            `;
            playersListContainer.appendChild(div);

            // Lobby Roster
            if (lobbyRoster) {
                const badge = document.createElement('div');
                badge.style.background = 'var(--card-bg)';
                badge.style.padding = '1rem 2rem';
                badge.style.borderRadius = '20px';
                badge.style.fontSize = '1.2rem';
                badge.style.fontWeight = 'bold';
                badge.style.border = '2px solid var(--accent-cyan)';
                badge.textContent = playerName;
                lobbyRoster.appendChild(badge);
            }
        }
    }
    
    const countDisplay = document.getElementById('waiting-players-count');
    if (countDisplay) {
        countDisplay.textContent = `Giocatori: ${playerCount} / ${maxPlayers === 'unlimited' ? '∞' : (maxPlayers || '?')}`;
    }
}

// ... keeping existing updateTaskBar, renderMapConfig, updateTimerUI functions unchanged ...
function updateTaskBar(playersData) {
    if (!playersData) return;
    let totalTasks = 0;
    let completedTasks = 0;

    for (const name in playersData) {
        const pData = playersData[name];
        if (pData.role !== 'impostor' && pData.role !== 'scientist' && pData.tasks) { 
            const tasksKeys = Object.keys(pData.tasks);
            totalTasks += tasksKeys.length;
            tasksKeys.forEach(key => {
                if(pData.tasks[key].completed) completedTasks++;
            });
        }
    }

    const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    taskProgressFill.style.height = `${percentage}%`;
    taskProgressText.textContent = `${Math.round(percentage)}%`;
}

async function renderMapConfig(config) {
    if (config.mapMode === currentMapMode) return; // Only update if changed
    currentMapMode = config.mapMode;

    if (config.mapMode === 'text') {
        mapImage.classList.add('hidden');
        textMapContainer.classList.remove('hidden');
        
        textTasksBody.innerHTML = '';
        if (config.tasks) {
            config.tasks.forEach(t => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #333";
                tr.innerHTML = `
                    <td style="padding: 0.5rem;">${t.num}</td>
                    <td style="padding: 0.5rem; font-weight: bold; color: var(--accent-cyan);">${t.name}</td>
                    <td style="padding: 0.5rem;">${t.obj}</td>
                    <td style="padding: 0.5rem;">${t.pos}</td>
                `;
                textTasksBody.appendChild(tr);
            });
        }
    } else {
        mapImage.classList.remove('hidden');
        textMapContainer.classList.add('hidden');
        
        // Fetch image separately
        const imgSnapshot = await get(ref(db, `images/${roomCode}`));
        if (imgSnapshot.exists()) {
            mapImage.src = imgSnapshot.val();
        } else {
            mapImage.src = "public/assets/mappa.jpg";
        }
    }
}

function updateTimerUI(endTime, isPaused, remaining) {
    clearInterval(timerInterval);
    
    if (isPaused) {
        if (remaining <= 0) {
            globalTimer.textContent = "00:00";
            globalTimer.style.color = "red";
        } else {
            globalTimer.textContent = "PAUSA - " + formatTime(remaining);
            globalTimer.style.color = "#ff9800";
        }
        return;
    }

    currentTimerEndTime = endTime;
    timerInterval = setInterval(() => {
        const now = Date.now();
        const rem = currentTimerEndTime - now;
        
        if (rem <= 0) {
            globalTimer.textContent = "00:00";
            globalTimer.style.color = "red";
            clearInterval(timerInterval);
        } else {
            globalTimer.textContent = formatTime(rem);
            globalTimer.style.color = "white";
        }
    }, 1000);
}

// Init QR Code
let qrInitialized = false;
const lobbyCodeDisplay = document.getElementById('waiting-room-code');
if (lobbyCodeDisplay) lobbyCodeDisplay.textContent = roomCode;

// Initial render
renderPlayers(null, null, null);

const roomRef = ref(db, `rooms/${roomCode}`);
onValue(roomRef, (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        
        if (!qrInitialized && typeof QRCode !== 'undefined') {
            qrInitialized = true;
            const joinUrl = `${window.location.origin}${window.location.pathname.replace('teatro.html', 'index.html')}?room=${roomCode}`;
            new QRCode(document.getElementById("qrcode"), {
                text: joinUrl,
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
        
        if(data.config) {
            renderMapConfig(data.config);
        }

        if(data.state) {
            const status = data.state.game_status;
            const players = data.players || {};
            const votes = data.votes || {};
            const maxPlayers = data.config ? data.config.maxPlayers : null;

            if (status === 'waiting') {
                if(overlayMeeting) overlayMeeting.classList.add('hidden');
                if(overlayEjected) overlayEjected.classList.add('hidden');
                
                const mainDashboard = document.getElementById('main-dashboard-layout');
                if (mainDashboard) mainDashboard.classList.add('hidden');
                
                const waitingScreen = document.getElementById('waiting-screen');
                if (waitingScreen) waitingScreen.classList.remove('hidden');
                
                clearInterval(timerInterval);
                renderPlayers(players, votes, maxPlayers);
                updateTaskBar(players);
            } 
            else if (status === 'playing') {
                if(overlayMeeting) overlayMeeting.classList.add('hidden');
                const waitingScreen = document.getElementById('waiting-screen');
                if (waitingScreen) waitingScreen.classList.add('hidden');
                
                const mainDashboard = document.getElementById('main-dashboard-layout');
                if (mainDashboard) mainDashboard.classList.remove('hidden');
                
                if (previousStatus === 'waiting') {
                    const roleOverlay = document.getElementById('role-assignment-overlay');
                    if (roleOverlay) {
                        roleOverlay.classList.remove('hidden');
                        setTimeout(() => {
                            roleOverlay.classList.add('hidden');
                        }, 5000);
                    }
                }
                
                if (previousStatus === 'voting' || previousStatus === 'discussion' || previousStatus === 'emergency') {
                    if(overlayEjected) {
                        overlayEjected.classList.remove('hidden');
                        if(ejectedText) ejectedText.textContent = data.state.last_ejected && data.state.last_ejected !== 'SKIP' 
                            ? `${data.state.last_ejected} è stato espulso` 
                            : "Nessuno è stato espulso";
                        setTimeout(() => {
                            overlayEjected.classList.add('hidden');
                        }, 5000);
                    }
                }

                renderPlayers(players, votes);
                updateTaskBar(players);
                
                updateTimerUI(data.state.timer, data.state.timer_paused, data.state.timer_remaining);
            }
            else if (status === 'emergency') {
                if(overlayMeeting) overlayMeeting.classList.remove('hidden');
                if(overlayText) {
                    overlayText.textContent = "RIUNIONE D'EMERGENZA";
                    overlayText.style.color = "var(--accent-red)";
                }
                clearInterval(timerInterval);
                globalTimer.textContent = "EMERGENZA";
                
                if (previousStatus !== 'emergency' && sirenAudio) {
                    sirenAudio.volume = 1.0;
                    sirenAudio.play().catch(e => console.log("Siren autoplay blocked", e));
                }
            }
            else if (status === 'discussion') {
                if(overlayMeeting) overlayMeeting.classList.add('hidden'); 
                globalTimer.textContent = "DISCUSSIONE";
                globalTimer.style.color = "#ffeb3b";
                clearInterval(timerInterval);
                renderPlayers(players, votes);
            }
            else if (status === 'voting') {
                if(overlayMeeting) overlayMeeting.classList.add('hidden');
                globalTimer.style.color = "var(--accent-red)";
                clearInterval(timerInterval);
                timerInterval = setInterval(() => {
                    const remaining = Math.max(0, data.state.voting_endtime - Date.now());
                    const sec = Math.ceil(remaining / 1000);
                    globalTimer.textContent = `VOTAZIONE: ${sec}s`;
                    if(remaining <= 0) clearInterval(timerInterval);
                }, 100);
                renderPlayers(players, votes);
            }
            else if (status === 'impostors_win') {
                if(overlayMeeting) overlayMeeting.classList.remove('hidden');
                if(overlayText) {
                    overlayText.textContent = "VITTORIA IMPOSTORI";
                    overlayText.style.color = "var(--accent-red)";
                }
                clearInterval(timerInterval);
                globalTimer.textContent = "GAME OVER";
            }
            else if (status === 'crewmates_win') {
                if(overlayMeeting) overlayMeeting.classList.remove('hidden');
                if(overlayText) {
                    overlayText.textContent = "VITTORIA CREWMATE";
                    overlayText.style.color = "var(--accent-cyan)";
                }
                clearInterval(timerInterval);
                globalTimer.textContent = "GAME OVER";
            }

            previousStatus = status;
        }
    }
});
}
