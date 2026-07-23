import { db } from './firebase-config.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const myPlayerName = urlParams.get('player');

const vitalsContainer = document.getElementById('vitals-container');
const btnEmergency = document.getElementById('btn-emergency');
const gameStatusText = document.getElementById('game-status-text');

if (!roomCode) {
    alert("Nessun codice stanza fornito.");
    window.location.href = "/";
}

const roomRef = ref(db, `rooms/${roomCode}`);
let currentState = null;
let currentPlayers = {};
let currentRound = 1;
let hasUsedMeetingThisRound = false;

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function updateMeetingButton() {
    const canCall = currentState && currentState.game_status === 'playing' && !hasUsedMeetingThisRound;
    btnEmergency.disabled = !canCall;
    btnEmergency.classList.toggle('available', canCall);

    if (hasUsedMeetingThisRound) {
        btnEmergency.textContent = "USATA QUESTO ROUND";
    } else if (currentState && currentState.game_status === 'playing') {
        btnEmergency.textContent = "CHIAMA RIUNIONE";
    } else {
        btnEmergency.textContent = "NON DISPONIBILE ORA";
    }
}

function updateUI(state, players) {
    currentState = state || {};
    currentPlayers = players || {};

    const nextRound = Number(currentState.round) || 1;
    if (nextRound !== currentRound) {
        currentRound = nextRound;
        hasUsedMeetingThisRound = false;
    }
    hasUsedMeetingThisRound = Number(currentState.scientist_meeting_round) === currentRound;

    const status = currentState.game_status || 'waiting';
    gameStatusText.textContent = `Stato: ${status.toUpperCase()} | Round: ${currentRound}`;
    renderVitals(currentPlayers);
    updateMeetingButton();
}

function renderVitals(players) {
    vitalsContainer.innerHTML = '';
    const playerNames = Object.keys(players).sort((a, b) => a.localeCompare(b, 'it'));

    if (playerNames.length === 0) {
        vitalsContainer.innerHTML = '<p style="color:#94a3b8;">Nessun giocatore nella stanza.</p>';
        return;
    }

    playerNames.forEach(name => {
        const player = players[name] || {};
        const card = document.createElement('div');
        card.className = 'vital-card';

        let statusClass = 'vital-revealed';
        let statusText = 'SCONOSCIUTO';
        if (player.status === 'alive') {
            statusClass = 'vital-alive';
            statusText = 'ALIVE';
        } else if (player.status === 'killed_hidden') {
            statusClass = 'vital-killed';
            statusText = 'KILLED!';
        } else if (player.status === 'killed_revealed') {
            statusText = 'DEAD';
        }

        card.classList.add(statusClass);
        card.innerHTML = `
            <div style="font-size:1.2rem; font-family:var(--font-pixel); margin-bottom:0.5rem; word-break:break-word;">${escapeHtml(name)}</div>
            <div style="font-size:0.9rem;">${statusText}</div>
        `;
        vitalsContainer.appendChild(card);
    });
}

if (roomCode) {
    onValue(roomRef, snapshot => {
        if (!snapshot.exists()) {
            alert("La stanza non esiste più.");
            window.location.href = "/";
            return;
        }

        const room = snapshot.val() || {};

        // Role verification check: Only scientist can access this view
        const players = room.players || {};
        if (!myPlayerName || !players[myPlayerName] || players[myPlayerName].role !== 'scientist') {
            alert("Accesso negato: Solo il giocatore con ruolo 'Scienziato' può accedere a questo monitor.");
            window.location.href = `giocatore?room=${encodeURIComponent(roomCode)}${myPlayerName ? `&player=${encodeURIComponent(myPlayerName)}` : ''}`;
            return;
        }

        // 24-hour expiration check
        if (room.createdAt && (Date.now() - room.createdAt > 24 * 60 * 60 * 1000)) {
            alert("La stanza è scaduta (durata massima: 24h).");
            window.location.href = "/";
            return;
        }

        updateUI(room.state, room.players);
    }, error => {
        console.error('Errore sincronizzazione monitor:', error);
        gameStatusText.textContent = 'Errore di connessione alla stanza';
    });
}

btnEmergency.addEventListener('click', async () => {
    if (!currentState || currentState.game_status !== 'playing' || hasUsedMeetingThisRound) return;
    if (!confirm("Vuoi chiamare una riunione di emergenza? Puoi farlo solo 1 volta per round.")) return;

    const remaining = Math.max(0, (Number(currentState.timer) || Date.now()) - Date.now());
    hasUsedMeetingThisRound = true;
    updateMeetingButton();

    try {
        await update(roomRef, {
            'state/game_status': 'emergency',
            'state/timer_paused': true,
            'state/timer_remaining': remaining,
            'state/scientist_meeting_round': currentRound
        });
    } catch (error) {
        hasUsedMeetingThisRound = false;
        updateMeetingButton();
        alert(`Errore durante la chiamata della riunione: ${error.message}`);
    }
});
