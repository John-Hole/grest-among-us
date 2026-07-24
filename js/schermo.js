import { db, ensureAuth } from './firebase-config.js';
import { ref, onValue, get, update } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { formatTime, TASKS_LIST, escapeHtml } from './game-logic.js';

const urlParams = new URLSearchParams(window.location.search);
let roomCode = urlParams.get('room');

function enableFullscreen() {
    if (!document.fullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(err => console.log("Fullscreen request:", err.message));
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen();
        }
    }
}

// Enable fullscreen on user gesture anywhere on screen
document.addEventListener('click', () => {
    enableFullscreen();
}, { once: false });

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
        
        enableFullscreen();

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
    
    // Attempt fullscreen
    enableFullscreen();

    const headerEl = document.getElementById('header-room-code');
    if (headerEl) headerEl.textContent = roomCode;
    
    const lobbyCodeDisplay = document.getElementById('waiting-room-code');
    if (lobbyCodeDisplay) lobbyCodeDisplay.textContent = roomCode;
    
    // Load default SVG Map of Oratorio
    loadSVGMap();
    
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
    const mapViewWrapper = document.getElementById('map-view-wrapper');
    const textMapContainer = document.getElementById('text-map-container');

    let previousStatus = null;
    let timerInterval = null;
    let currentTimerEndTime = 0;

    // Helper: Auto-Scroll overflow containers smoothly (Slow, readable pace)
    function setupAutoScroll(container) {
        if (!container) return;
        
        if (container._scrollTimer) {
            cancelAnimationFrame(container._scrollTimer);
            container._scrollTimer = null;
        }
        
        let scrollPos = container.scrollTop;
        let direction = 1;
        let pauseFrames = 240; // 4 seconds initial pause at top
        const speed = 0.15;   // Very slow, smooth crawl (easy to read on projector)
        
        function autoScrollLoop() {
            const maxScroll = container.scrollHeight - container.clientHeight;
            
            if (maxScroll > 10) {
                if (pauseFrames > 0) {
                    pauseFrames--;
                } else {
                    scrollPos += speed * direction;
                    if (scrollPos >= maxScroll) {
                        scrollPos = maxScroll;
                        direction = -1;
                        pauseFrames = 240; // 4 seconds pause at bottom
                    } else if (scrollPos <= 0) {
                        scrollPos = 0;
                        direction = 1;
                        pauseFrames = 240; // 4 seconds pause at top
                    }
                    container.scrollTop = scrollPos;
                }
            } else {
                container.scrollTop = 0;
                scrollPos = 0;
            }
            
            container._scrollTimer = requestAnimationFrame(autoScrollLoop);
        }
        
        container._scrollTimer = requestAnimationFrame(autoScrollLoop);
    }

    // Initialize players list & limit
    function renderPlayers(playersData, votesData, maxPlayers) {
        if (!playersListContainer) return;
        playersListContainer.innerHTML = '';
        
        let playerCount = 0;

        if (playersData) {
            for (const playerName in playersData) {
                playerCount++;
                const pData = playersData[playerName];
                const isRevealedDead = pData.status === 'killed_revealed';
                const hasVoted = votesData && votesData[playerName] !== undefined;
                
                const div = document.createElement('div');
                div.className = `player-card ${isRevealedDead ? 'dead' : ''}`;
                
                let statusHtml = '';
                if (isRevealedDead) {
                    statusHtml = '<span class="player-status dead-icon">❌</span>';
                } else if (previousStatus === 'voting') {
                    statusHtml = hasVoted 
                        ? '<span class="player-status voted-badge">VOTATO</span>' 
                        : '<span class="player-status waiting-badge">IN ATTESA</span>';
                }

                div.innerHTML = `
                    <div class="player-avatar">👨‍🚀</div>
                    <span class="player-name">${escapeHtml(playerName)}</span>
                    ${statusHtml}
                `;
                playersListContainer.appendChild(div);
            }
        }
        
        const countDisplay = document.getElementById('waiting-players-count');
        if (countDisplay) {
            if (maxPlayers && maxPlayers !== 'unlimited' && !isNaN(parseInt(maxPlayers))) {
                countDisplay.textContent = `(${playerCount}/${maxPlayers})`;
            } else {
                countDisplay.textContent = `(${playerCount})`;
            }
        }

        const playersScroll = document.getElementById('players-scroll-container');
        if (playersScroll) setupAutoScroll(playersScroll);
    }

    // Render task list in left panel & center table
    function renderTasks(configTasks, enableTasks = true) {
        const leftTaskList = document.getElementById('left-tasks-list');
        const textTasksBody = document.getElementById('text-tasks-body');
        
        if (leftTaskList) leftTaskList.innerHTML = '';
        if (textTasksBody) textTasksBody.innerHTML = '';

        if (enableTasks === false) {
            if (leftTaskList) {
                leftTaskList.innerHTML = '<li style="padding: 1rem; color: #888; text-align: center;">Task disabilitate</li>';
            }
            if (textTasksBody) {
                textTasksBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 1rem;">Task disabilitate</td></tr>';
            }
            return;
        }

        let tasksArray = [];

        if (configTasks && Array.isArray(configTasks) && configTasks.length > 0) {
            tasksArray = configTasks;
        } else {
            // Default fallback to TASKS_LIST from game-logic.js
            tasksArray = TASKS_LIST.map((tStr, idx) => {
                const matchPipe = tStr.match(/^(\d+)\.\s*([^|]+)(?:\|\s*(.+))?$/);
                if (matchPipe) {
                    return {
                        num: matchPipe[1],
                        name: matchPipe[2].trim(),
                        obj: "",
                        pos: matchPipe[3] ? matchPipe[3].trim() : ""
                    };
                }
                const matchColon = tStr.match(/^(\d+)\.\s*([^:]+)(?::\s*(.+))?$/);
                if (matchColon) {
                    return {
                        num: matchColon[1],
                        name: matchColon[2].trim(),
                        obj: matchColon[3] ? matchColon[3].trim() : "",
                        pos: ""
                    };
                }
                return { num: idx + 1, name: tStr, obj: "", pos: "" };
            });
        }

        // Left tasks list (cards)
        if (leftTaskList) {
            tasksArray.forEach(t => {
                const li = document.createElement('li');
                li.className = 'schermo-task-item';
                const taskMainText = t.obj || t.name || '';
                li.innerHTML = `
                    <span class="task-num">#${escapeHtml(t.num)}</span>
                    <div class="task-info">
                        <div class="task-title">${escapeHtml(taskMainText)}</div>
                        ${t.pos ? `<div class="task-location">📍 ${escapeHtml(t.pos)}</div>` : ''}
                    </div>
                `;
                leftTaskList.appendChild(li);
            });
            const leftScroll = document.getElementById('left-tasks-scroll');
            if (leftScroll) setupAutoScroll(leftScroll);
        }

        // Center tasks table (table format)
        if (textTasksBody) {
            tasksArray.forEach(t => {
                const tr = document.createElement('tr');
                const taskMainText = t.obj || t.name || '';
                tr.innerHTML = `
                    <td class="task-td-num">${escapeHtml(t.num)}</td>
                    <td class="task-td-name">${escapeHtml(taskMainText)}</td>
                    <td class="task-td-pos">${t.pos ? escapeHtml(t.pos) : '-'}</td>
                `;
                textTasksBody.appendChild(tr);
            });
            const centerScroll = document.getElementById('center-tasks-scroll');
            if (centerScroll) setupAutoScroll(centerScroll);
        }
    }

    function updateTaskBar(playersData) {
        if (!playersData) return;
        let totalTasks = 0;
        let completedTasks = 0;

        for (const name in playersData) {
            const pData = playersData[name];
            // Count tasks for all non-impostors (crewmates, scientists, etc.)
            if (pData.role !== 'impostor' && pData.tasks) { 
                const tasksObj = pData.tasks;
                for (const key in tasksObj) {
                    const task = tasksObj[key];
                    if (task) {
                        totalTasks++;
                        if (task.completed === true || task.completed === "true") {
                            completedTasks++;
                        }
                    }
                }
            }
        }

        const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        if (taskProgressFill) {
            taskProgressFill.style.height = `${percentage}%`;
            taskProgressFill.style.width = '100%';
        }
        if (taskProgressText) taskProgressText.textContent = `${Math.round(percentage)}%`;

        const taskCountText = document.getElementById('task-count-text');
        if (taskCountText) {
            taskCountText.textContent = `${completedTasks} / ${totalTasks} completate`;
        }
    }

    async function loadSVGMap() {
        const svgContainer = document.getElementById('svg-map-container');
        if (!svgContainer) return;

        try {
            const response = await fetch('public/assets/MappaOratotorio.svg');
            if (!response.ok) throw new Error("HTTP error " + response.status);
            const svgText = await response.text();
            svgContainer.innerHTML = svgText;
            const svgEl = svgContainer.querySelector('svg');
            if (svgEl) {
                svgEl.setAttribute('width', '100%');
                svgEl.setAttribute('height', '100%');
                svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
            if (mapViewWrapper) mapViewWrapper.classList.remove('hidden');
            if (textMapContainer) textMapContainer.classList.add('hidden');
        } catch (err) {
            console.error("Errore caricamento MappaOratotorio.svg:", err);
            if (mapViewWrapper) mapViewWrapper.classList.add('hidden');
            if (textMapContainer) textMapContainer.classList.remove('hidden');
        }
    }

    async function renderMapConfig(config) {
        if (!config) return;
        
        const enableMap = config.enableMap !== false;
        const enableTasks = config.enableTasks !== false;
        const mapType = config.mapType || (config.mapMode === 'text' ? 'vector' : 'photo');

        renderTasks(config.tasks, enableTasks);

        if (!enableMap) {
            if (mapViewWrapper) mapViewWrapper.classList.add('hidden');
            if (textMapContainer) textMapContainer.classList.add('hidden');
            return;
        }

        if (mapType === 'vector') {
            await loadSVGMap();
        } else {
            // Check if user uploaded a custom map image in Firebase
            const imgSnapshot = await get(ref(db, `images/${roomCode}`));
            const svgContainer = document.getElementById('svg-map-container');

            // Default to vector SVG map of Oratorio
            // Only use custom uploaded photo if it exists and is a custom uploaded image
            if (imgSnapshot.exists() && imgSnapshot.val() && !imgSnapshot.val().includes('mappa.jpg') && imgSnapshot.val().length > 100000) {
                const imgSrc = imgSnapshot.val();
                if (svgContainer) {
                    svgContainer.innerHTML = `<img id="map-image" src="${imgSrc}" alt="Mappa Stanza" class="map-img">`;
                }
                if (mapViewWrapper) mapViewWrapper.classList.remove('hidden');
                if (textMapContainer) textMapContainer.classList.add('hidden');
            } else {
                await loadSVGMap();
            }
        }
    }

    function clearTimerFlashing() {
        if (globalTimer) {
            globalTimer.classList.remove('timer-flash-red');
            const headerCard = globalTimer.closest('.center-header-card');
            if (headerCard) headerCard.classList.remove('card-flash-red');
        }
    }

    function updateTimerUI(endTime, isPaused, remaining) {
        clearInterval(timerInterval);
        
        if (isPaused) {
            clearTimerFlashing();
            if (globalTimer) {
                if (remaining <= 0) {
                    globalTimer.textContent = "00:00";
                    globalTimer.style.color = "#ff4b4b";
                } else {
                    globalTimer.textContent = "⏸️ PAUSA (" + formatTime(remaining) + ")";
                    globalTimer.style.color = "#ff9800";
                }
            }
            return;
        }

        currentTimerEndTime = endTime;
        const headerCard = globalTimer ? globalTimer.closest('.center-header-card') : null;

        const updateTick = () => {
            const now = Date.now();
            const rem = currentTimerEndTime - now;
            
            if (rem <= 0) {
                clearTimerFlashing();
                if (globalTimer) {
                    globalTimer.textContent = "00:00";
                    globalTimer.style.color = "#ff4b4b";
                }
                clearInterval(timerInterval);
            } else {
                if (globalTimer) globalTimer.textContent = formatTime(rem);

                // Lampeggia di rosso quando mancano 30 secondi o meno
                if (rem <= 30000) {
                    if (globalTimer) globalTimer.classList.add('timer-flash-red');
                    if (headerCard) headerCard.classList.add('card-flash-red');
                } else {
                    clearTimerFlashing();
                    if (globalTimer) globalTimer.style.color = "white";
                }
            }
        };

        updateTick();
        timerInterval = setInterval(updateTick, 500);
    }

    let isDeadRevealActive = false;

    function showDeadRevealOverlay(playersData, votesData, maxPlayers) {
        const overlayDeadReveal = document.getElementById('overlay-dead-reveal');
        const deadCardsContainer = document.getElementById('dead-reveal-cards-container');
        const meetingAudio = document.getElementById('meeting-audio');

        if (!overlayDeadReveal || !deadCardsContainer) return;
        
        const deadHiddenPlayers = [];
        if (playersData) {
            for (const pName in playersData) {
                if (playersData[pName].status === 'killed_hidden') {
                    deadHiddenPlayers.push(pName);
                }
            }
        }

        deadCardsContainer.innerHTML = '';

        if (meetingAudio) {
            meetingAudio.currentTime = 0;
            meetingAudio.volume = 1.0;
            meetingAudio.play().catch(e => console.log("Meeting audio autoplay blocked", e));
        }

        if (deadHiddenPlayers.length > 0) {
            deadHiddenPlayers.forEach(pName => {
                const card = document.createElement('div');
                card.className = 'dead-reveal-card';
                card.innerHTML = `
                    <div class="dead-slash-line"></div>
                    <div class="dead-reveal-avatar">👨‍🚀</div>
                    <div class="dead-reveal-info">
                        <span class="dead-reveal-name">${escapeHtml(pName)}</span>
                    </div>
                    <div class="dead-stamp">❌ DEFUNTO</div>
                `;
                deadCardsContainer.appendChild(card);
            });

            overlayDeadReveal.classList.remove('hidden');
            isDeadRevealActive = true;

            // Trigger strike-through animation & stamp drop
            setTimeout(() => {
                const cards = deadCardsContainer.querySelectorAll('.dead-reveal-card');
                cards.forEach(c => c.classList.add('slashed'));
            }, 350);

            // Update Firebase status from killed_hidden to killed_revealed
            const dbUpdates = {};
            deadHiddenPlayers.forEach(name => {
                dbUpdates[`rooms/${roomCode}/players/${name}/status`] = 'killed_revealed';
            });
            update(ref(db), dbUpdates).catch(err => console.error("Firebase update status error:", err));

            // Hide overlay after 4.5s
            setTimeout(() => {
                overlayDeadReveal.classList.add('hidden');
                isDeadRevealActive = false;
                renderPlayers(playersData, votesData, maxPlayers);
            }, 4500);
        } else {
            const noDeadDiv = document.createElement('div');
            noDeadDiv.className = 'no-dead-card';
            noDeadDiv.innerHTML = `<span>💚 Nessun giocatore è stato ucciso in questo round!</span>`;
            deadCardsContainer.appendChild(noDeadDiv);

            overlayDeadReveal.classList.remove('hidden');
            isDeadRevealActive = true;

            setTimeout(() => {
                overlayDeadReveal.classList.add('hidden');
                isDeadRevealActive = false;
                renderPlayers(playersData, votesData, maxPlayers);
            }, 2500);
        }
    }

    // Init QR Code with simplified error correction level
    let qrInitialized = false;

    // Initial render
    renderPlayers(null, null, null);

    const roomRef = ref(db, `rooms/${roomCode}`);
    ensureAuth().then(() => {
        onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // 24-hour expiration check
            if (data.createdAt && (Date.now() - data.createdAt > 24 * 60 * 60 * 1000)) {
                alert("La stanza visualizzata è scaduta (durata massima: 24h).");
                window.location.href = "/";
                return;
            }

            if (!qrInitialized && typeof QRCode !== 'undefined') {
                qrInitialized = true;
                const qrContainer = document.getElementById("qrcode");
                if (qrContainer) {
                    qrContainer.innerHTML = '';
                    const joinUrl = `${window.location.origin}/?room=${roomCode}`;
                    new QRCode(qrContainer, {
                        text: joinUrl,
                        width: 150,
                        height: 150,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.L // Simplified low matrix density
                    });
                }
            }
            
            if (data.config) {
                renderMapConfig(data.config);
            }

            if (data.state) {
                const status = data.state.game_status;
                const players = data.players || {};
                const votes = data.votes || {};
                const maxPlayers = data.config ? data.config.maxPlayers : null;

                // Real-time taskbar update on any room change
                updateTaskBar(players);

                const qrCodeBox = document.getElementById('qr-code-container');
                const roomCodeDisplay = document.getElementById('room-code-display');
                const leftTasksBox = document.getElementById('left-tasks-container');
                const taskbar = document.getElementById('taskbar-container');
                const globalTimer = document.getElementById('global-timer');

                // Toggle visibility based on game state (waiting vs active game)
                const isWaiting = (status === 'waiting');

                if (roomCodeDisplay) {
                    if (isWaiting) roomCodeDisplay.classList.remove('hidden');
                    else roomCodeDisplay.classList.add('hidden');
                }
                if (qrCodeBox) {
                    if (isWaiting) qrCodeBox.classList.remove('hidden');
                    else qrCodeBox.classList.add('hidden');
                }
                if (leftTasksBox) {
                    if (isWaiting) leftTasksBox.classList.remove('hidden');
                    else leftTasksBox.classList.add('hidden');
                }
                if (taskbar) {
                    if (isWaiting) taskbar.classList.add('hidden');
                    else taskbar.classList.remove('hidden');
                }
                if (globalTimer) {
                    if (isWaiting) globalTimer.classList.add('hidden');
                    else globalTimer.classList.remove('hidden');
                }

                const overlayDeadReveal = document.getElementById('overlay-dead-reveal');
                if (status !== 'discussion' && overlayDeadReveal && !isDeadRevealActive) {
                    overlayDeadReveal.classList.add('hidden');
                }

                if (status === 'waiting') {
                    if(overlayMeeting) overlayMeeting.classList.add('hidden');
                    if(overlayEjected) overlayEjected.classList.add('hidden');
                    
                    const mainDashboard = document.getElementById('main-dashboard-layout');
                    if (mainDashboard) mainDashboard.classList.remove('hidden');
                    
                    clearInterval(timerInterval);
                    renderPlayers(players, votes, maxPlayers);
                } 
                else if (status === 'playing') {
                    if(overlayMeeting) overlayMeeting.classList.add('hidden');
                    
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

                    renderPlayers(players, votes, maxPlayers);
                    updateTimerUI(data.state.timer, data.state.timer_paused, data.state.timer_remaining);
                }
                else if (status === 'emergency') {
                    clearTimerFlashing();
                    if(overlayMeeting) overlayMeeting.classList.remove('hidden');
                    if(overlayText) {
                        overlayText.textContent = "RIUNIONE D'EMERGENZA";
                        overlayText.style.color = "var(--accent-red)";
                    }
                    clearInterval(timerInterval);
                    if (globalTimer) globalTimer.textContent = "EMERGENZA";
                    
                    if (previousStatus !== 'emergency' && sirenAudio) {
                        sirenAudio.volume = 1.0;
                        sirenAudio.play().catch(e => console.log("Siren autoplay blocked", e));
                    }
                }
                else if (status === 'discussion') {
                    clearTimerFlashing();
                    if(overlayMeeting) overlayMeeting.classList.add('hidden'); 
                    if (globalTimer) {
                        globalTimer.textContent = "DISCUSSIONE";
                        globalTimer.style.color = "#ffeb3b";
                    }
                    clearInterval(timerInterval);

                    if (previousStatus !== 'discussion' && !isDeadRevealActive) {
                        showDeadRevealOverlay(players, votes, maxPlayers);
                    } else if (!isDeadRevealActive) {
                        renderPlayers(players, votes, maxPlayers);
                    }
                    // Stop siren if it was playing during emergency
                    if (sirenAudio) {
                        sirenAudio.pause();
                        sirenAudio.currentTime = 0;
                    }
                }
                else if (status === 'voting') {
                    if(overlayMeeting) overlayMeeting.classList.add('hidden');
                    const headerCard = globalTimer ? globalTimer.closest('.center-header-card') : null;
                    clearInterval(timerInterval);
                    
                    if (!data.state.voting_endtime || data.state.voting_endtime === 0) {
                        if (globalTimer) {
                            clearTimerFlashing();
                            globalTimer.textContent = `VOTAZIONE LIBERA`;
                            globalTimer.style.color = "var(--accent-red)";
                        }
                    } else {
                        timerInterval = setInterval(() => {
                            const remaining = Math.max(0, data.state.voting_endtime - Date.now());
                            const sec = Math.ceil(remaining / 1000);
                            if (globalTimer) {
                                globalTimer.textContent = `VOTAZIONE: ${sec}s`;
                                
                                // Lampeggia di rosso negli ultimi 15 secondi di votazione
                                if (remaining <= 15000 && remaining > 0) {
                                    globalTimer.classList.add('timer-flash-red');
                                    if (headerCard) headerCard.classList.add('card-flash-red');
                                } else {
                                    clearTimerFlashing();
                                    globalTimer.style.color = "var(--accent-red)";
                                }
                            }
                            if(remaining <= 0) {
                                clearTimerFlashing();
                                clearInterval(timerInterval);
                            }
                        }, 100);
                    }
                    renderPlayers(players, votes, maxPlayers);
                }
                else if (status === 'impostors_win') {
                    clearTimerFlashing();
                    if(overlayMeeting) overlayMeeting.classList.remove('hidden');
                    if(overlayText) {
                        overlayText.textContent = "VITTORIA IMPOSTORI";
                        overlayText.style.color = "var(--accent-red)";
                    }
                    clearInterval(timerInterval);
                    if (globalTimer) globalTimer.textContent = "GAME OVER";
                }
                else if (status === 'crewmates_win') {
                    clearTimerFlashing();
                    if(overlayMeeting) overlayMeeting.classList.remove('hidden');
                    if(overlayText) {
                        overlayText.textContent = "VITTORIA CREWMATE";
                        overlayText.style.color = "var(--accent-cyan)";
                    }
                    clearInterval(timerInterval);
                    if (globalTimer) globalTimer.textContent = "GAME OVER";
                }

                previousStatus = status;
            }
        }
    });
    });
}

