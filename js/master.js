import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { PLAYERS_LIST, IMPOSTORS_LIST, SCIENTIST_LIST, getRandomTasks, ROUND_TIMES } from './game-logic.js';

// Elements
const statusBadge = document.getElementById('current-status');
const currentRoundEl = document.getElementById('current-round');
const btnStart = document.getElementById('btn-start');
const btnStartRandom = document.getElementById('btn-start-random');
const btnCallMeeting = document.getElementById('btn-call-meeting');
const btnStartMeeting = document.getElementById('btn-start-meeting');
const btnEndMeeting = document.getElementById('btn-end-meeting');
const btnReset = document.getElementById('btn-reset');
const votingSection = document.getElementById('voting-section');
const ejectSelect = document.getElementById('eject-select');

let currentState = {};

const gameRef = doc(db, 'game', 'state');

// Listen to changes
onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
        currentState = docSnap.data();
        updateUI(currentState);
    } else {
        statusBadge.textContent = "NON INIZIALIZZATO";
    }
});

function updateUI(state) {
    statusBadge.textContent = state.game_status.toUpperCase();
    currentRoundEl.textContent = state.round || 1;

    // Reset styles
    statusBadge.style.backgroundColor = "var(--dead-gray)";
    btnStart.disabled = false;
    btnStartRandom.disabled = false;
    btnCallMeeting.disabled = true;
    btnStartMeeting.disabled = true;
    votingSection.classList.add('hidden');

    if (state.game_status === 'waiting') {
        btnStart.textContent = "Avvia (Ruoli Fissi)";
    } 
    else if (state.game_status === 'playing') {
        statusBadge.style.backgroundColor = "var(--accent-green)";
        btnStart.disabled = true;
        btnStartRandom.disabled = true;
        btnCallMeeting.disabled = false;
    } 
    else if (state.game_status === 'meeting_called') {
        statusBadge.style.backgroundColor = "var(--accent-red)";
        btnStart.disabled = true;
        btnStartMeeting.disabled = false;
    } 
    else if (state.game_status === 'meeting_in_progress') {
        statusBadge.style.backgroundColor = "#9c27b0";
        btnStart.disabled = true;
        votingSection.classList.remove('hidden');
        populateEjectSelect(state.players);
    }
}

function populateEjectSelect(players) {
    ejectSelect.innerHTML = '<option value="none">Nessuno (Skip)</option>';
    if(!players) return;
    
    PLAYERS_LIST.forEach(name => {
        // Only allow voting for alive players
        if (players[name] && players[name].status === 'alive') {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            ejectSelect.appendChild(opt);
        }
    });
}

// Actions
btnStart.addEventListener('click', async () => {
    if(!confirm("Sei sicuro di voler avviare il gioco? Verranno assegnati ruoli e task.")) return;
    
    const playersMap = {};
    PLAYERS_LIST.forEach(name => {
        let role = 'crewmate';
        if (IMPOSTORS_LIST.includes(name)) role = 'impostor';
        if (SCIENTIST_LIST.includes(name)) role = 'scientist';

        playersMap[name] = {
            role: role,
            status: 'alive',
            tasks: getRandomTasks(),
            completed_tasks: []
        };
    });

    const roundDuration = ROUND_TIMES[0];
    const endTime = Date.now() + roundDuration;

    await setDoc(gameRef, {
        game_status: 'playing',
        round: 1,
        timer: endTime,
        last_ejected: null,
        players: playersMap
    });
});

btnStartRandom.addEventListener('click', async () => {
    if(!confirm("Sei sicuro di voler avviare il gioco con ruoli CASUALI? (3 Impostori, 1 Scienziato)")) return;
    
    const shuffledPlayers = [...PLAYERS_LIST].sort(() => 0.5 - Math.random());
    const randomImpostors = shuffledPlayers.slice(0, 3);
    const randomScientist = shuffledPlayers[3];

    const playersMap = {};
    PLAYERS_LIST.forEach(name => {
        let role = 'crewmate';
        if (randomImpostors.includes(name)) role = 'impostor';
        else if (name === randomScientist) role = 'scientist';

        playersMap[name] = {
            role: role,
            status: 'alive',
            tasks: getRandomTasks(),
            completed_tasks: []
        };
    });

    const roundDuration = ROUND_TIMES[0];
    const endTime = Date.now() + roundDuration;

    await setDoc(gameRef, {
        game_status: 'playing',
        round: 1,
        timer: endTime,
        last_ejected: null,
        players: playersMap
    });
});

btnCallMeeting.addEventListener('click', async () => {
    await updateDoc(gameRef, {
        game_status: 'meeting_called'
    });
});

btnStartMeeting.addEventListener('click', async () => {
    await updateDoc(gameRef, {
        game_status: 'meeting_in_progress'
    });
});

btnEndMeeting.addEventListener('click', async () => {
    const ejected = ejectSelect.value;
    const players = { ...currentState.players };
    let nextRound = (currentState.round || 1) + 1;

    // Handle Ejection
    if (ejected !== 'none' && players[ejected]) {
        players[ejected].status = 'killed_revealed';
    }

    // Convert 'killed_hidden' to 'killed_revealed' (corpses are now known)
    for (const name in players) {
        if (players[name].status === 'killed_hidden') {
            players[name].status = 'killed_revealed';
        }
    }

    // Set new timer
    const roundDuration = ROUND_TIMES[Math.min(nextRound - 1, ROUND_TIMES.length - 1)];
    const endTime = Date.now() + roundDuration;

    await updateDoc(gameRef, {
        game_status: 'playing',
        round: nextRound,
        timer: endTime,
        last_ejected: ejected !== 'none' ? ejected : null,
        players: players
    });
});

btnReset.addEventListener('click', async () => {
    if(!confirm("ATTENZIONE: Questo formatterà l'intera partita e riporterà allo stato di attesa. Confermi?")) return;
    
    // Inizializza vuoto per sicurezza
    const emptyPlayers = {};
    PLAYERS_LIST.forEach(name => {
        emptyPlayers[name] = {
            role: 'crewmate',
            status: 'alive',
            tasks: [],
            completed_tasks: []
        }
    });

    await setDoc(gameRef, {
        game_status: 'waiting',
        round: 1,
        timer: 0,
        last_ejected: null,
        players: emptyPlayers
    });
});
