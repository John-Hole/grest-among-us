import { db, ensureAuth } from './firebase-config.js';
import { ref, update, onValue, onDisconnect, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { escapeHtml } from './game-logic.js';

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
let myPlayerName = urlParams.get('player');

if (!roomCode || !myPlayerName) {
    alert("Manca il codice stanza o il nome giocatore.");
    window.location.href = "/";
}

// Elements
const roleScreen = document.getElementById('role-screen');
const roleText = document.getElementById('role-text');
const btnHideRole = document.getElementById('btn-hide-role');

const gameScreen = document.getElementById('game-screen');
const playerNameDisplay = document.getElementById('player-name-display');
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

const playerNameBox = document.getElementById('player-name-box');
const playerStatusIcon = document.getElementById('player-status-icon');
const ghostBanner = document.getElementById('ghost-banner');
const btnHideDead = document.getElementById('btn-hide-dead');

const taskList = document.getElementById('task-list');

const votingUI = document.getElementById('voting-ui');
const votingOptions = document.getElementById('voting-options');
const votingTimer = document.getElementById('voting-timer');
const votingStatus = document.getElementById('voting-status');

const notInRoomScreen = document.getElementById('not-in-room-screen');
const btnRejoinRoom = document.getElementById('btn-rejoin-room');
const btnNotInRoomChangeName = document.getElementById('btn-not-in-room-change-name');

// Initialization
ensureAuth();
gameScreen.classList.remove('hidden');
playerNameDisplay.textContent = myPlayerName;

let myData = null;
let currentState = null;
let roomConfig = null;
let hasSeenRoleThisRound = false;
let hasSeenDeadOverlay = false;

let killCooldownEnd = 0;
let killInterval = null;

let currentRoundTracker = 0;
let currentVotes = {};
let previousStatus = null;
let isAutoRejoining = false;

btnHideRole.addEventListener('click', () => {
    roleScreen.classList.add('hidden');
});

if (btnHideDead) {
    btnHideDead.addEventListener('click', () => {
        hasSeenDeadOverlay = true;
        overlayDead.classList.add('hidden');
    });
}

// Setup onDisconnect to remove ghost players and their votes
let myPlayerRef = ref(db, `rooms/${roomCode}/players/${myPlayerName}`);
onDisconnect(myPlayerRef).remove();

let myVoteRef = ref(db, `rooms/${roomCode}/votes/${myPlayerName}`);
onDisconnect(myVoteRef).remove();

const roomRef = ref(db, `rooms/${roomCode}`);
onValue(roomRef, async (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();

        // 24-hour expiration check
        if (data.createdAt && (Date.now() - data.createdAt > 24 * 60 * 60 * 1000)) {
            try {
                await remove(ref(db, `rooms/${roomCode}`));
                await remove(ref(db, `images/${roomCode}`));
            } catch (e) {}
            alert("La stanza è scaduta (superato 1 giorno dalla creazione) ed è stata eliminata.");
            window.location.href = "/";
            return;
        }

        currentState = data.state;
        roomConfig = data.config;
        currentVotes = data.votes || {};
        
        if (previousStatus === 'waiting' && currentState.game_status === 'playing') {
            hasSeenRoleThisRound = false; 
            hasSeenDeadOverlay = false;
        }

        // Manage onDisconnect: Protect player node during active game so F5 refresh doesn't remove the player
        if (currentState && currentState.game_status !== 'waiting') {
            try { onDisconnect(myPlayerRef).cancel(); } catch(e){}
            try { onDisconnect(myVoteRef).cancel(); } catch(e){}
        } else {
            onDisconnect(myPlayerRef).remove();
            onDisconnect(myVoteRef).remove();
        }

        if (data.players && data.players[myPlayerName]) {
            myData = data.players[myPlayerName];

            // Session Token Validation
            const localToken = sessionStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`) ||
                               localStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`);
            if (myData.token) {
                if (!localToken || myData.token !== localToken) {
                    alert("Accesso non autorizzato: questa sessione di gioco appartiene a un altro utente o a un'altra scheda.");
                    window.location.href = "/";
                    return;
                }
            } else if (localToken) {
                // Sync token to RTDB if missing (e.g. legacy rooms)
                update(ref(db, `rooms/${roomCode}/players/${myPlayerName}`), { token: localToken }).catch(() => {});
            }

            if (notInRoomScreen) notInRoomScreen.classList.add('hidden');
            if (playerNameDisplay) playerNameDisplay.textContent = myPlayerName;
            updateUI(currentState, data.players);
        } else {
            myData = null;

            // Check if player was kicked
            const isKicked = data.kickedPlayers && Object.keys(data.kickedPlayers).some(
                p => p.toLowerCase() === myPlayerName.toLowerCase()
            );

            if (isKicked) {
                if (playerStatusIcon) playerStatusIcon.textContent = "🚫";
                if (playerNameDisplay) playerNameDisplay.textContent = "ESPULSO";
            } else {
                if (playerStatusIcon) playerStatusIcon.textContent = "❌";
                if (playerNameDisplay) playerNameDisplay.textContent = "FUORI";
            }

            // Hide all game UIs
            crewmateUI.classList.add('hidden');
            scientistUI.classList.add('hidden');
            killSection.classList.add('hidden');
            document.getElementById('report-section').classList.add('hidden');
            waitingScreen.classList.add('hidden');
            votingUI.classList.add('hidden');
            roleScreen.classList.add('hidden');
            overlayMeeting.classList.add('hidden');
            overlayDead.classList.add('hidden');

            // Show Not-In-Room UI & check game status
            const localToken = sessionStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`) ||
                               localStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`);
            const canRejoinMidGame = !!localToken;

            if (notInRoomScreen) {
                notInRoomScreen.classList.remove('hidden');
                if (btnRejoinRoom) {
                    if (isKicked) {
                        btnRejoinRoom.disabled = true;
                        btnRejoinRoom.textContent = "SEI STATO ESPULSO";
                        btnRejoinRoom.style.background = "#555";
                        btnRejoinRoom.style.color = "#aaa";
                    } else if (currentState && currentState.game_status !== 'waiting' && !canRejoinMidGame) {
                        btnRejoinRoom.disabled = true;
                        btnRejoinRoom.textContent = "PARTITA GIÀ AVVIATA";
                        btnRejoinRoom.style.background = "#555";
                        btnRejoinRoom.style.color = "#aaa";
                    } else {
                        btnRejoinRoom.disabled = false;
                        btnRejoinRoom.textContent = "RIENTRA / ENTRA IN STANZA";
                        btnRejoinRoom.style.background = "var(--accent-green)";
                        btnRejoinRoom.style.color = "black";
                    }
                }
            }

            // Auto-rejoin if not kicked and (in waiting state OR possesses valid session token)
            if (!isKicked && (!currentState || currentState.game_status === 'waiting' || canRejoinMidGame) && !isAutoRejoining) {
                isAutoRejoining = true;
                rejoinRoom().finally(() => {
                    setTimeout(() => { isAutoRejoining = false; }, 2000);
                });
            }
        }
        
        previousStatus = currentState ? currentState.game_status : null;
    } else {
        myData = null;
        if (crewmateUI) crewmateUI.classList.add('hidden');
        if (scientistUI) scientistUI.classList.add('hidden');
        if (killSection) killSection.classList.add('hidden');
        const reportSec = document.getElementById('report-section');
        if (reportSec) reportSec.classList.add('hidden');
        if (waitingScreen) waitingScreen.classList.add('hidden');
        if (votingUI) votingUI.classList.add('hidden');
        if (roleScreen) roleScreen.classList.add('hidden');
        if (overlayMeeting) overlayMeeting.classList.add('hidden');
        if (overlayDead) overlayDead.classList.add('hidden');

        if (notInRoomScreen) {
            notInRoomScreen.classList.remove('hidden');
            const msgEl = document.getElementById('not-in-room-msg');
            if (msgEl) msgEl.textContent = `La stanza "${roomCode}" non esiste o è stata eliminata.`;
            if (btnRejoinRoom) {
                btnRejoinRoom.disabled = true;
                btnRejoinRoom.textContent = "STANZA NON ESISTENTE";
                btnRejoinRoom.style.background = "#555";
                btnRejoinRoom.style.color = "#aaa";
            }
        }
    }
});

function updateUI(state, playersMap) {
    if (!myData) return;

    if (playerNameDisplay) playerNameDisplay.textContent = myPlayerName;

    if (myData.status === 'alive') {
        hasSeenDeadOverlay = false;
        overlayDead.classList.add('hidden');
    } else if (myData.status === 'killed_hidden' || myData.status === 'killed_revealed') {
        if (!hasSeenDeadOverlay) {
            hasSeenDeadOverlay = true;
            overlayDead.classList.remove('hidden');
        }
    } else {
        overlayDead.classList.add('hidden');
    }

    const overlayMeetingH1 = overlayMeeting.querySelector('h1');
    const overlayMeetingP = overlayMeeting.querySelector('p');

    if (state.game_status === 'emergency') {
        overlayMeeting.classList.remove('hidden');
        overlayDead.classList.add('hidden');
        roleScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
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
        overlayDead.classList.add('hidden');
        roleScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        votingUI.classList.add('hidden');
        overlayMeetingH1.textContent = "DISCUSSIONE";
        overlayMeetingH1.style.color = "#ffeb3b";
        overlayMeetingP.textContent = "Discuti! Guarda il maxischermo per i dettagli.";
        // Stop siren if it was playing during emergency
        if (sirenAudio) {
            sirenAudio.pause();
            sirenAudio.currentTime = 0;
        }
        return;
    } else if (state.game_status === 'voting') {
        if (previousStatus !== 'voting') {
            selectedVoteTarget = null;
            autoVotedOnTimeout = false;
            lastRenderedVotesSignature = '';
        }
        overlayMeeting.classList.add('hidden');
        overlayDead.classList.add('hidden');
        roleScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        votingUI.classList.remove('hidden');
        renderVotingUI(playersMap);
        return;
    } else if (state.game_status === 'voting_results') {
        overlayMeeting.classList.remove('hidden');
        overlayDead.classList.add('hidden');
        roleScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        votingUI.classList.add('hidden');
        overlayMeetingH1.textContent = "📊 ESITO VOTI";
        overlayMeetingH1.style.color = "#c084fc";
        overlayMeetingP.textContent = "Votazione conclusa! Guarda il maxischermo per vedere chi ha votato chi!";
        return;
    } else if (state.game_status === 'crewmates_win') {
        overlayMeeting.classList.remove('hidden');
        overlayDead.classList.add('hidden');
        roleScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        votingUI.classList.add('hidden');
        overlayMeetingH1.textContent = "🏆 VITTORIA CREWMATE!";
        overlayMeetingH1.style.color = "var(--accent-cyan)";
        overlayMeetingP.textContent = "I Crewmate hanno completato tutte le task!";
        return;
    } else if (state.game_status === 'impostors_win') {
        overlayMeeting.classList.remove('hidden');
        overlayDead.classList.add('hidden');
        roleScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        votingUI.classList.add('hidden');
        overlayMeetingH1.textContent = "🏆 VITTORIA IMPOSTORI!";
        overlayMeetingH1.style.color = "var(--accent-red)";
        overlayMeetingP.textContent = "Gli Impostori hanno eliminato i Crewmate!";
        return;
    } else {
        overlayMeeting.classList.add('hidden');
        votingUI.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    }

    if (myData.status === 'alive') {
        if (playerNameBox) playerNameBox.className = "header-name-status-box name-box-alive";
        if (playerStatusIcon) playerStatusIcon.textContent = "🟢";
        if (ghostBanner) ghostBanner.classList.add('hidden');
    } else {
        if (playerNameBox) playerNameBox.className = "header-name-status-box name-box-dead";
        if (playerStatusIcon) playerStatusIcon.textContent = "💀";
        if (ghostBanner) ghostBanner.classList.remove('hidden');
    }

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
    else if (state.game_status === 'playing') {
        waitingScreen.classList.add('hidden');
        document.getElementById('report-section').classList.remove('hidden');

        if (state.round !== currentRoundTracker) {
            currentRoundTracker = state.round;
            if (myData.role === 'impostor' && myData.status === 'alive') {
                const cdSec = roomConfig ? (roomConfig.killCooldown || 120) : 120;
                killCooldownEnd = Date.now() + (cdSec * 1000);
                startCooldownTimer();
            }
        }

        const maxMeetings = (roomConfig && roomConfig.maxMeetings !== undefined) ? roomConfig.maxMeetings : 1;
        const meetingsCalled = myData.meetings_called || 0;
        const meetingsLeft = Math.max(0, maxMeetings - meetingsCalled);

        if (meetingsLeft > 0) {
            meetingsLeftText.textContent = `(${meetingsLeft}/${maxMeetings})`;
            meetingsLeftText.style.color = '#94a3b8';
        } else {
            meetingsLeftText.textContent = 'ESAURITE';
            meetingsLeftText.style.color = '#ef4444';
        }

        if (meetingsLeft > 0 && myData.status === 'alive') {
            btnReport.disabled = false;
            btnReport.textContent = "🚨 RIUNIONE";
        } else {
            btnReport.disabled = true;
            btnReport.textContent = myData.status !== 'alive' ? "❌ MORTO" : "🚫 ESAURITE";
        }

        if (!hasSeenRoleThisRound) {
            hasSeenRoleThisRound = true;
            roleScreen.classList.remove('hidden');
            roleText.textContent = (myData.role || 'crewmate').toUpperCase();
            roleText.className = 'role-text';
            if (myData.role === 'impostor') roleText.classList.add('role-impostor');
            else roleText.classList.add('role-crewmate');
            
            const cdSec = (roomConfig && roomConfig.killCooldown) ? roomConfig.killCooldown : 120;
            killCooldownEnd = Date.now() + (cdSec * 1000);
            startCooldownTimer();
        }

        crewmateUI.classList.remove('hidden'); // Everyone sees tasks now

        if (myData.role === 'impostor') {
            scientistUI.classList.add('hidden');
            if (myData.status === 'alive') {
                killSection.classList.remove('hidden');
            } else {
                killSection.classList.add('hidden');
            }
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

// Header Name Click Listener
if (playerNameBox) {
    playerNameBox.addEventListener('click', () => {
        if (currentState && currentState.game_status === 'waiting') {
            promptChangeName();
        } else {
            const roleCap = myData && myData.role ? myData.role.toUpperCase() : 'CREWMATE';
            const statusCap = myData && myData.status ? myData.status.toUpperCase() : 'ALIVE';
            alert(`Sei connesso come: ${myPlayerName}\nStanza: ${roomCode}\nRuolo: ${roleCap}\nStato: ${statusCap}`);
        }
    });
}

let selectedVoteTarget = null;
let lastRenderedVotesSignature = '';
let autoVotedOnTimeout = false;

function updatePlayerVotingTimer() {
    if (!votingTimer) return;
    if (!currentState || currentState.game_status !== 'voting') {
        return;
    }

    if (!currentState.voting_endtime || currentState.voting_endtime === 0) {
        votingTimer.textContent = '⏱️ Libera';
        votingTimer.style.color = '#c084fc';
        votingTimer.style.borderColor = '#a855f7';
    } else {
        const remaining = Math.max(0, currentState.voting_endtime - Date.now());
        const sec = Math.ceil(remaining / 1000);
        votingTimer.textContent = `⏱️ ${sec}s`;

        if (remaining <= 10000) {
            votingTimer.style.color = '#ef4444';
            votingTimer.style.borderColor = '#ef4444';
        } else {
            votingTimer.style.color = '#c084fc';
            votingTimer.style.borderColor = '#a855f7';
        }

        // Timer expiration auto-vote check
        if (remaining <= 0 && selectedVoteTarget && !autoVotedOnTimeout) {
            const isAlive = myData && myData.status === 'alive';
            const myVote = currentVotes ? currentVotes[myPlayerName] : null;
            if (isAlive && !myVote) {
                autoVotedOnTimeout = true;
                castVote(selectedVoteTarget);
            }
        }
    }
}
setInterval(updatePlayerVotingTimer, 250);

function renderVotingUI(playersMap) {
    const isAlive = myData && myData.status === 'alive';
    const myVote = currentVotes ? currentVotes[myPlayerName] : null;

    if (!isAlive) {
        votingOptions.innerHTML = '';
        votingStatus.innerHTML = '<h3 style="color: var(--accent-red); margin-top: 0.5rem; text-align: center;">Sei morto, non puoi votare. Attendi l\'esito.</h3>';
        lastRenderedVotesSignature = 'dead';
        return;
    }

    const alivePlayers = [];
    for (const name in playersMap) {
        if (playersMap[name].status === 'alive') {
            alivePlayers.push(name);
        }
    }
    alivePlayers.sort();

    const currentSig = `alive_${alivePlayers.join(',')}_selected_${selectedVoteTarget || 'none'}_myvote_${myVote || 'none'}`;
    if (lastRenderedVotesSignature === currentSig && votingOptions.children.length > 0) {
        return;
    }

    lastRenderedVotesSignature = currentSig;
    votingStatus.innerHTML = '';
    votingOptions.innerHTML = '';

    // If player has already voted: show confirmed state with final yellow/red colors
    if (myVote) {
        votingStatus.innerHTML = `<div style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid #10b981; color: #34d399; padding: 0.75rem 1rem; border-radius: 12px; font-weight: 800; font-size: 0.95rem; text-align: center; margin-bottom: 1rem; box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);">✔ Voto confermato per: <strong>${escapeHtml(myVote)}</strong></div>`;

        alivePlayers.forEach(name => {
            const isTarget = myVote === name;
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.disabled = true;
            btn.style.width = '100%';
            btn.style.padding = '0.95rem';
            btn.style.fontSize = '0.95rem';
            btn.style.fontWeight = 'bold';
            btn.style.borderRadius = '12px';

            if (isTarget) {
                // Final voted color: yellow/red/gold accent gradient
                btn.style.background = 'linear-gradient(135deg, rgba(234, 179, 8, 0.35), rgba(220, 38, 38, 0.35))';
                btn.style.border = '2px solid #eab308';
                btn.style.color = '#fef08a';
                btn.style.boxShadow = '0 0 12px rgba(234, 179, 8, 0.4)';
                btn.textContent = name === myPlayerName ? `✔ VOTATO: ${name} (Tu)` : `✔ VOTATO: ${name}`;
            } else {
                btn.style.background = 'rgba(255, 255, 255, 0.04)';
                btn.style.border = '1px solid rgba(255,255,255,0.08)';
                btn.style.color = '#64748b';
                btn.style.opacity = '0.6';
                btn.textContent = name === myPlayerName ? `${name} (Tu)` : name;
            }
            votingOptions.appendChild(btn);
        });

        // Skip option display when voted
        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn';
        skipBtn.disabled = true;
        skipBtn.style.width = '100%';
        skipBtn.style.padding = '0.95rem';
        skipBtn.style.fontSize = '0.95rem';
        skipBtn.style.fontWeight = 'bold';
        skipBtn.style.borderRadius = '12px';

        if (myVote === 'SKIP') {
            skipBtn.style.background = 'linear-gradient(135deg, rgba(234, 179, 8, 0.35), rgba(220, 38, 38, 0.35))';
            skipBtn.style.border = '2px solid #eab308';
            skipBtn.style.color = '#fef08a';
            skipBtn.style.boxShadow = '0 0 12px rgba(234, 179, 8, 0.4)';
            skipBtn.textContent = '✔ VOTATO: ⏭️ SKIP';
        } else {
            skipBtn.style.background = 'rgba(255, 255, 255, 0.04)';
            skipBtn.style.border = '1px solid rgba(255,255,255,0.08)';
            skipBtn.style.color = '#64748b';
            skipBtn.style.opacity = '0.6';
            skipBtn.textContent = '⏭️ SKIP';
        }
        votingOptions.appendChild(skipBtn);
        return;
    }

    // Active Voting Selection State
    if (selectedVoteTarget) {
        votingStatus.innerHTML = `<div style="background: rgba(245, 158, 11, 0.25); border: 1.5px solid #f59e0b; color: #fbbf24; padding: 0.75rem 1rem; border-radius: 12px; font-weight: 800; font-size: 0.95rem; text-align: center; margin-bottom: 0.8rem; box-shadow: 0 0 12px rgba(245, 158, 11, 0.3); animation: pulse 1.5s infinite;">⚠️ Clicca di nuovo su <strong>${escapeHtml(selectedVoteTarget)}</strong> per CONFERMARE!</div>`;
    } else {
        votingStatus.innerHTML = `<div style="color: #94a3b8; font-size: 0.88rem; font-weight: 600; text-align: center; margin-bottom: 0.5rem;">💡 Seleziona un giocatore per votarlo</div>`;
    }

    alivePlayers.forEach(name => {
        const isSelected = selectedVoteTarget === name;
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.width = '100%';
        btn.style.padding = '0.95rem';
        btn.style.fontSize = '0.95rem';
        btn.style.fontWeight = 'bold';
        btn.style.borderRadius = '12px';
        btn.style.transition = 'all 0.2s ease';
        
        if (isSelected) {
            // Colore medio per la pre-selezione (ambra / arancione medio)
            btn.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.35))';
            btn.style.border = '2px solid #f59e0b';
            btn.style.color = '#fbbf24';
            btn.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.4)';
            btn.textContent = name === myPlayerName ? `⚠️ RICLICCA PER CONFERMARE: ${name} (Tu)` : `⚠️ RICLICCA PER CONFERMARE: ${name}`;
        } else {
            // Senza colore (Stato normale)
            btn.style.background = name === myPlayerName ? 'rgba(255, 255, 255, 0.08)' : 'var(--card-bg)';
            btn.style.border = name === myPlayerName ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.15)';
            btn.style.color = '#fff';
            btn.textContent = name === myPlayerName ? `${name} (Tu)` : name;
        }

        btn.onclick = async () => {
            if (selectedVoteTarget === name) {
                // 2nd click on same target -> Confirm vote!
                btn.disabled = true;
                btn.textContent = 'CONFERMA IN CORSO...';
                await castVote(name);
            } else {
                // 1st click -> Pre-select target
                selectedVoteTarget = name;
                lastRenderedVotesSignature = '';
                renderVotingUI(playersMap);
            }
        };
        votingOptions.appendChild(btn);
    });

    // Skip button
    const isSkipSelected = selectedVoteTarget === 'SKIP';
    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn';
    skipBtn.style.width = '100%';
    skipBtn.style.padding = '0.95rem';
    skipBtn.style.fontSize = '0.95rem';
    skipBtn.style.fontWeight = 'bold';
    skipBtn.style.borderRadius = '12px';
    skipBtn.style.transition = 'all 0.2s ease';

    if (isSkipSelected) {
        // Colore medio per la pre-selezione dello SKIP
        skipBtn.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(220, 38, 38, 0.35))';
        skipBtn.style.border = '2px solid #f59e0b';
        skipBtn.style.color = '#fbbf24';
        skipBtn.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.4)';
        skipBtn.textContent = '⚠️ RICLICCA PER CONFERMARE: ⏭️ SKIP';
    } else {
        skipBtn.style.background = 'rgba(117, 117, 117, 0.2)';
        skipBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        skipBtn.style.color = '#e2e8f0';
        skipBtn.textContent = '⏭️ SKIP (Non espellere)';
    }

    skipBtn.onclick = async () => {
        if (selectedVoteTarget === 'SKIP') {
            // 2nd click on SKIP -> Confirm vote!
            skipBtn.disabled = true;
            skipBtn.textContent = 'CONFERMA IN CORSO...';
            await castVote('SKIP');
        } else {
            // 1st click -> Pre-select SKIP
            selectedVoteTarget = 'SKIP';
            lastRenderedVotesSignature = '';
            renderVotingUI(playersMap);
        }
    };
    votingOptions.appendChild(skipBtn);

    // Explicit Confirm Button at bottom (secondary touch target)
    if (selectedVoteTarget) {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn';
        confirmBtn.style.width = '100%';
        confirmBtn.style.padding = '1rem';
        confirmBtn.style.marginTop = '0.5rem';
        confirmBtn.style.fontSize = '1rem';
        confirmBtn.style.fontWeight = '800';
        confirmBtn.style.borderRadius = '14px';
        confirmBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        confirmBtn.style.color = '#ffffff';
        confirmBtn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
        confirmBtn.style.border = 'none';
        confirmBtn.textContent = selectedVoteTarget === 'SKIP' ? 'CONFERMA SKIP VOTO ➔' : `CONFERMA VOTO PER ${selectedVoteTarget.toUpperCase()} ➔`;

        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'INVIO VOTO IN CORSO...';
            await castVote(selectedVoteTarget);
        };
        votingOptions.appendChild(confirmBtn);
    }
}

async function castVote(voteTarget) {
    const updates = {};
    updates[`rooms/${roomCode}/votes/${myPlayerName}`] = voteTarget;
    await update(ref(db), updates);
}

async function completeTask(taskId) {
    if (!myData) return;
    const taskData = myData.tasks[taskId];
    if (!taskData || taskData.completed) return;

    const updates = {};
    updates[`rooms/${roomCode}/players/${myPlayerName}/tasks/${taskId}/completed`] = true;
    await update(ref(db), updates);
}

function parseTaskDesc(descStr, defaultIdx) {
    if (!descStr) return { num: defaultIdx, title: '', location: '' };
    // Matches "10. Descrizione | Luogo" or "10. Descrizione" or "Descrizione | Luogo"
    const matchWithNum = descStr.match(/^(\d+)\.\s*([^|]+)(?:\|\s*(.+))?$/);
    if (matchWithNum) {
        return {
            num: matchWithNum[1],
            title: matchWithNum[2].trim(),
            location: matchWithNum[3] ? matchWithNum[3].trim() : ''
        };
    }
    const matchPipe = descStr.match(/^([^|]+)\|\s*(.+)$/);
    if (matchPipe) {
        return {
            num: defaultIdx,
            title: matchPipe[1].trim(),
            location: matchPipe[2].trim()
        };
    }
    return { num: defaultIdx, title: descStr.trim(), location: '' };
}

function getSortedTaskEntries(tasksObj) {
    if (!tasksObj) return [];
    let entries = [];
    if (Array.isArray(tasksObj)) {
        entries = tasksObj.map((taskData, index) => ({ id: index, data: taskData }));
    } else {
        entries = Object.keys(tasksObj).map(key => ({ id: key, data: tasksObj[key] }));
    }
    
    // Sort: uncompleted (completed == false) first, completed (completed == true) last
    entries.sort((a, b) => {
        const aDone = a.data && a.data.completed ? 1 : 0;
        const bDone = b.data && b.data.completed ? 1 : 0;
        return aDone - bDone;
    });

    return entries;
}

function renderRealTasks(tasksObj) {
    taskList.innerHTML = '';
    if (!tasksObj) return;
    
    const sortedEntries = getSortedTaskEntries(tasksObj);
    
    sortedEntries.forEach((entry, idx) => {
        const taskId = entry.id;
        const taskData = entry.data;
        if (!taskData) return;
        const isDone = !!taskData.completed;
        const parsed = parseTaskDesc(taskData.desc, idx + 1);
        const li = document.createElement('li');
        li.className = `giocatore-task-item ${isDone ? 'completed' : ''}`;
        
        li.innerHTML = `
            <div class="giocatore-task-main">
                <div class="giocatore-task-header">
                    <span class="task-num">#${escapeHtml(parsed.num)}</span>
                </div>
                <div class="task-info">
                    <div class="task-title">${escapeHtml(parsed.title)}</div>
                    ${parsed.location ? `<div class="task-location">📍 ${escapeHtml(parsed.location)}</div>` : ''}
                </div>
            </div>
            <button class="task-btn ${isDone ? 'btn-done' : ''}" ${isDone ? 'disabled' : ''} id="task-btn-${taskId}">
                ${isDone ? '✔ DONE' : 'SPUNTA'}
            </button>
        `;
        
        if (!isDone) {
            const btn = li.querySelector(`#task-btn-${taskId}`);
            btn.onclick = async (e) => {
                const targetBtn = e.currentTarget;
                targetBtn.disabled = true;
                targetBtn.classList.add('btn-done');
                targetBtn.textContent = '✔ DONE';
                li.classList.add('completed');
                await completeTask(taskId);
            };
        }
        taskList.appendChild(li);
    });
}

function renderImpostorTasks(tasksObj) {
    taskList.innerHTML = '';
    if (!tasksObj) return;
    
    const sortedEntries = getSortedTaskEntries(tasksObj);
    
    sortedEntries.forEach((entry, idx) => {
        const taskId = entry.id;
        const taskData = entry.data;
        if (!taskData) return;
        const isDone = !!taskData.completed;
        const parsed = parseTaskDesc(taskData.desc, idx + 1);
        const li = document.createElement('li');
        li.className = `giocatore-task-item ${isDone ? 'completed' : ''}`;
        li.innerHTML = `
            <div class="giocatore-task-main">
                <div class="giocatore-task-header">
                    <span class="task-num">#${escapeHtml(parsed.num)}</span>
                </div>
                <div class="task-info">
                    <div class="task-title">${escapeHtml(parsed.title)}</div>
                    ${parsed.location ? `<div class="task-location">📍 ${escapeHtml(parsed.location)}</div>` : ''}
                </div>
            </div>
            <button class="task-btn ${isDone ? 'btn-done' : ''}" ${isDone ? 'disabled' : ''} id="fake-btn-${taskId}">
                ${isDone ? '✔ DONE' : 'SPUNTA'}
            </button>
        `;
        if (!isDone) {
            const btn = li.querySelector(`#fake-btn-${taskId}`);
            btn.onclick = (e) => {
                const targetBtn = e.currentTarget;
                targetBtn.disabled = true;
                targetBtn.classList.add('btn-done');
                targetBtn.textContent = '✔ DONE';
                li.classList.add('completed');
                completeTask(taskId);
            };
        }
        taskList.appendChild(li);
    });
}

function updateKillSelector(players) {
    if (!killTargetSelect) return;
    const currentVal = killTargetSelect.value;
    
    const aliveTargets = [];
    for (const name in players) {
        if (players[name] && players[name].status === 'alive' && name !== myPlayerName && players[name].role !== 'impostor') {
            aliveTargets.push(name);
        }
    }
    aliveTargets.sort();

    killTargetSelect.innerHTML = '<option value="">-- Seleziona Vittima --</option>';
    aliveTargets.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        killTargetSelect.appendChild(opt);
    });

    if (currentVal && aliveTargets.includes(currentVal)) {
        killTargetSelect.value = currentVal;
    }
}

function startCooldownTimer() {
    clearInterval(killInterval);
    if (!myData || myData.role !== 'impostor') return;

    const tick = () => {
        if (!myData || myData.status !== 'alive') {
            clearInterval(killInterval);
            if (btnKill) {
                btnKill.disabled = true;
                btnKill.textContent = "SEI MORTO";
            }
            return;
        }

        const remaining = killCooldownEnd - Date.now();
        if (remaining <= 0) {
            if (btnKill) {
                btnKill.textContent = "🗡️ KILL BERSAGLIO";
                btnKill.disabled = false;
            }
            clearInterval(killInterval);
        } else {
            const secs = Math.floor(remaining / 1000);
            const m = Math.floor(secs / 60);
            const s = secs % 60;
            if (btnKill) {
                btnKill.textContent = `COOLDOWN (${m}:${s.toString().padStart(2, '0')})`;
                btnKill.disabled = true;
            }
        }
    };

    tick();
    killInterval = setInterval(tick, 1000);
}

btnKill.addEventListener('click', async () => {
    if (!currentState || currentState.game_status !== 'playing') {
        alert("Azione non consentita in questa fase del gioco.");
        return;
    }

    if (!myData || myData.role !== 'impostor' || myData.status !== 'alive') {
        alert("Non puoi eseguire questa azione.");
        return;
    }

    const target = killTargetSelect.value;
    if (!target) {
        alert("Seleziona prima un bersaglio dal menu a tendina!");
        return;
    }
    
    if (btnKill) btnKill.disabled = true;
    try {
        await ensureAuth();
        await set(ref(db, `rooms/${roomCode}/players/${target}/status`), 'killed_hidden');

        const cdSec = (roomConfig && roomConfig.killCooldown) ? roomConfig.killCooldown : 120;
        killCooldownEnd = Date.now() + (cdSec * 1000);
        startCooldownTimer();
        killTargetSelect.value = "";
    } catch (err) {
        console.error("Kill action failed:", err);
        if (btnKill) btnKill.disabled = false;
        alert("Errore durante l'uccisione: " + err.message);
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
            <div style="font-size: 0.9rem; font-family: var(--font-pixel); margin-bottom: 0.5rem; word-break: break-all;">${escapeHtml(name)}</div>
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

    const maxMeetings = (roomConfig && roomConfig.maxMeetings) ? roomConfig.maxMeetings : 1;
    const meetingsCalled = (myData && myData.meetings_called) ? myData.meetings_called : 0;
    
    if (meetingsCalled >= maxMeetings || myData.status !== 'alive') {
        alert("Hai esaurito le tue chiamate di riunione o sei morto.");
        return;
    }
    
    btnReport.disabled = true;
    btnReport.textContent = "🚨 CHIAMATA...";
    
    try {
        await ensureAuth();
        const updates = {};
        const remaining = Math.max(0, (Number(currentState.timer) || Date.now()) - Date.now());
        updates[`rooms/${roomCode}/state/game_status`] = 'emergency';
        updates[`rooms/${roomCode}/state/timer_paused`] = true;
        updates[`rooms/${roomCode}/state/timer_remaining`] = remaining;
        updates[`rooms/${roomCode}/players/${myPlayerName}/meetings_called`] = meetingsCalled + 1;
        await update(ref(db), updates);
    } catch (err) {
        console.error("Call meeting failed:", err);
        btnReport.disabled = false;
        btnReport.textContent = "🚨 RIUNIONE";
        alert("Errore durante la chiamata della riunione: " + err.message);
    }
});

async function rejoinRoom() {
    if (!roomCode || !myPlayerName) return;
    try {
        const snapshot = await get(ref(db, `rooms/${roomCode}`));
        if (!snapshot.exists()) {
            alert("La stanza non esiste più.");
            window.location.href = "/";
            return;
        }

        const roomData = snapshot.val();
        if (roomData.kickedPlayers) {
            const isKicked = Object.keys(roomData.kickedPlayers).some(
                p => p.toLowerCase() === myPlayerName.toLowerCase()
            );
            if (isKicked) {
                alert("Sei stato espulso da questa stanza dal Master. Non puoi rientrare finché non verrai riammesso.");
                return;
            }
        }

        let localToken = sessionStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`) ||
                         localStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`);

        if (roomData.state && roomData.state.game_status !== 'waiting' && !localToken) {
            alert("Impossibile rientrare: la partita è già in corso. Puoi rientrare solo se eri già parte della partita.");
            return;
        }

        const playersMap = roomData.players || {};

        if (!localToken) {
            localToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : (Date.now() + '_' + Math.random().toString(36).substring(2));
            sessionStorage.setItem(`realmong_token_${roomCode}_${myPlayerName}`, localToken);
            localStorage.setItem(`realmong_token_${roomCode}_${myPlayerName}`, localToken);
        }

        // Re-add player node if not present
        const newPlayerRef = ref(db, `rooms/${roomCode}/players/${myPlayerName}`);
        const newVoteRef = ref(db, `rooms/${roomCode}/votes/${myPlayerName}`);

        if (!playersMap[myPlayerName]) {
            await set(newPlayerRef, {
                status: 'alive',
                role: 'crewmate',
                meetings_called: 0,
                token: localToken
            });
        } else if (!playersMap[myPlayerName].token) {
            await update(newPlayerRef, { token: localToken });
        }

        try { onDisconnect(newPlayerRef).cancel(); } catch(e){}
        try { onDisconnect(newVoteRef).cancel(); } catch(e){}

        // Setup onDisconnect: Protect node if game is in progress
        if (roomData.state && roomData.state.game_status !== 'waiting') {
            // Do not remove on disconnect during active game
        } else {
            onDisconnect(newPlayerRef).remove();
            onDisconnect(newVoteRef).remove();
        }

        if (playerNameDisplay) playerNameDisplay.textContent = myPlayerName;

    } catch (err) {
        console.error("Errore durante il rientro in stanza: ", err);
    }
}

async function promptChangeName() {
    if (myData && currentState && currentState.game_status !== 'waiting') {
        alert("Non puoi cambiare nome a partita in corso.");
        return;
    }

    const newName = prompt("Inserisci il tuo nuovo nome:", myPlayerName || "");
    if (!newName || newName.trim() === "") return;

    const cleanName = newName.trim();
    if (cleanName.toLowerCase() === (myPlayerName || "").toLowerCase() && myData) return;

    try {
        const roomSnap = await get(ref(db, `rooms/${roomCode}`));
        if (roomSnap.exists()) {
            const roomData = roomSnap.val();
            if (roomData.kickedPlayers) {
                const isKicked = Object.keys(roomData.kickedPlayers).some(
                    p => p.toLowerCase() === cleanName.toLowerCase()
                );
                if (isKicked) {
                    alert(`Il nome "${cleanName}" risulta espulso da questa stanza!`);
                    return;
                }
            }
            if (roomData.players) {
                const existingPlayers = roomData.players;
                const isTaken = Object.keys(existingPlayers).some(
                    p => p.toLowerCase() === cleanName.toLowerCase() && p.toLowerCase() !== (myPlayerName || "").toLowerCase()
                );
                if (isTaken) {
                    alert(`Il nome "${cleanName}" è già in uso in questa stanza! Per favore scegli un nome diverso.`);
                    return;
                }
            }
        }

        if (myData) {
            let currentToken = sessionStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`) ||
                               localStorage.getItem(`realmong_token_${roomCode}_${myPlayerName}`);
            if (!currentToken) {
                currentToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : (Date.now() + '_' + Math.random().toString(36).substring(2));
            }
            sessionStorage.setItem(`realmong_token_${roomCode}_${cleanName}`, currentToken);
            localStorage.setItem(`realmong_token_${roomCode}_${cleanName}`, currentToken);

            const oldNameRef = ref(db, `rooms/${roomCode}/players/${myPlayerName}`);
            const newNameRef = ref(db, `rooms/${roomCode}/players/${cleanName}`);
            const oldVoteRef = ref(db, `rooms/${roomCode}/votes/${myPlayerName}`);
            const newVoteRef = ref(db, `rooms/${roomCode}/votes/${cleanName}`);

            const playerData = await get(oldNameRef);
            if (playerData.exists()) {
                const updatedData = { ...playerData.val(), token: currentToken };
                await set(newNameRef, updatedData);
                await remove(oldNameRef);
            } else {
                await set(newNameRef, { status: 'alive', role: 'crewmate', meetings_called: 0, token: currentToken });
            }

            try { onDisconnect(oldNameRef).cancel(); } catch(e){}
            try { onDisconnect(oldVoteRef).cancel(); } catch(e){}

            onDisconnect(newNameRef).remove();
            onDisconnect(newVoteRef).remove();
        }

        myPlayerName = cleanName;
        myPlayerRef = ref(db, `rooms/${roomCode}/players/${myPlayerName}`);
        myVoteRef = ref(db, `rooms/${roomCode}/votes/${myPlayerName}`);
        playerNameDisplay.textContent = cleanName;
        localStorage.setItem('lastNickname', cleanName);

        const url = new URL(window.location);
        url.searchParams.set('player', cleanName);
        window.history.replaceState({}, '', url);

        if (!myData) {
            await rejoinRoom();
        }
    } catch (e) {
        alert("Errore durante il cambio nome: " + e.message);
    }
}

if (btnRejoinRoom) {
    btnRejoinRoom.addEventListener('click', rejoinRoom);
}
if (btnNotInRoomChangeName) {
    btnNotInRoomChangeName.addEventListener('click', promptChangeName);
}
const btnChangeName = document.getElementById('btn-change-name');
if (btnChangeName) {
    btnChangeName.addEventListener('click', promptChangeName);
}
