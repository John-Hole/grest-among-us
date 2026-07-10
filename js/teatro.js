import { db } from './firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { PLAYERS_LIST, formatTime } from './game-logic.js';

// Elements
const video = document.getElementById('intro-video');
const overlayMeeting = document.getElementById('overlay-meeting');
const overlayText = document.getElementById('overlay-text');
const overlayEjected = document.getElementById('overlay-ejected');
const ejectedText = document.getElementById('ejected-text');
const globalTimer = document.getElementById('global-timer');
const taskProgressFill = document.getElementById('task-progress-fill');
const taskProgressText = document.getElementById('task-progress-text');
const playersListContainer = document.getElementById('players-list-container');

let previousStatus = null;
let timerInterval = null;
let currentTimerEndTime = 0;

// Initialize players list on the right
function renderPlayers(playersData) {
    playersListContainer.innerHTML = '';
    PLAYERS_LIST.forEach(playerName => {
        const pData = playersData ? playersData[playerName] : null;
        const isRevealedDead = pData && pData.status === 'killed_revealed';
        
        const div = document.createElement('div');
        div.className = `player-row ${isRevealedDead ? 'dead' : ''}`;
        div.innerHTML = `
            <span>${playerName}</span>
            ${isRevealedDead ? '<span style="margin-left:auto; color: red;">❌</span>' : ''}
        `;
        playersListContainer.appendChild(div);
    });
}

function updateTaskBar(playersData) {
    if (!playersData) return;
    let totalTasks = 0;
    let completedTasks = 0;

    PLAYERS_LIST.forEach(name => {
        const pData = playersData[name];
        if (pData && pData.role !== 'impostor') { // Impostors don't contribute to the real task bar
            totalTasks += 8;
            completedTasks += pData.completed_tasks ? pData.completed_tasks.length : 0;
        }
    });

    const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    taskProgressFill.style.height = `${percentage}%`;
    taskProgressText.textContent = `${Math.round(percentage)}%`;
}

function startTimer(timerValue) {
    clearInterval(timerInterval);
    currentTimerEndTime = timerValue; // timerValue is the timestamp when it ends

    timerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = currentTimerEndTime - now;
        
        if (remaining <= 0) {
            globalTimer.textContent = "00:00";
            globalTimer.style.color = "red";
            clearInterval(timerInterval);
        } else {
            globalTimer.textContent = formatTime(remaining);
            globalTimer.style.color = "white";
        }
    }, 1000);
}

// Intro Video Logic on first load
// Note: Autoplay might be blocked by browsers if not muted. 
// We handle this gracefully, and spacebar can be used to resume it.
if(video) {
    video.volume = 1.0;
    video.classList.remove('hidden');
    video.play().catch(e => console.log("Autoplay blocked. Use spacebar to play.", e));
    video.onended = () => {
        video.classList.add('hidden');
    };

    // Toggle play/pause with Spacebar
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!video.classList.contains('hidden')) {
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            }
        }
    });
}

// Initial render
renderPlayers(null);

// Listen to Firestore
const gameRef = doc(db, 'game', 'state');
onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        const status = data.game_status;
        const players = data.players || {};

        // Handle State Transitions
        if (status === 'waiting') {
            overlayMeeting.classList.add('hidden');
            overlayEjected.classList.add('hidden');
            globalTimer.textContent = "IN ATTESA";
            clearInterval(timerInterval);
            renderPlayers(players);
            updateTaskBar(players);
        } 
        else if (status === 'playing') {
            overlayMeeting.classList.add('hidden');
            
            // Check if we just transitioned from meeting_called/in_progress to playing
            if (previousStatus === 'meeting_in_progress' || previousStatus === 'meeting_called') {
                // Show ejected screen temporarily
                overlayEjected.classList.remove('hidden');
                ejectedText.textContent = data.last_ejected ? `${data.last_ejected} è stato espulso` : "Nessuno è stato espulso";
                setTimeout(() => {
                    overlayEjected.classList.add('hidden');
                }, 5000); // Hide after 5 seconds
            }

            renderPlayers(players);
            updateTaskBar(players);
            
            // Start countdown
            if(data.timer) {
                startTimer(data.timer);
            }
        }
        else if (status === 'meeting_called') {
            overlayMeeting.classList.remove('hidden');
            overlayText.textContent = "RIUNIONE CHIAMATA";
            overlayText.classList.add('alert-text');
            clearInterval(timerInterval);
        }
        else if (status === 'meeting_in_progress') {
            overlayMeeting.classList.add('hidden'); // map and players become visible again
            globalTimer.textContent = "RIUNIONE IN CORSO";
            globalTimer.style.color = "var(--accent-red)";
            clearInterval(timerInterval);
            renderPlayers(players); // Update players list in case some were found dead
        }

        previousStatus = status;
    }
}, (error) => {
    console.error("Firestore Listen Error:", error);
    // In caso di problemi di autorizzazione/inesistenza
});
