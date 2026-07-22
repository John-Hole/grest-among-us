import { db } from './firebase-config.js';
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { formatTime, TASKS_LIST } from './game-logic.js';

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
    
    // Attempt to go fullscreen automatically
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    }

    const headerEl = document.getElementById('header-room-code');
    if (headerEl) headerEl.textContent = roomCode;
    
    const lobbyCodeDisplay = document.getElementById('waiting-room-code');
    if (lobbyCodeDisplay) lobbyCodeDisplay.textContent = roomCode;
    
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
                    <span class="player-name">${playerName}</span>
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
    function renderTasks(configTasks) {
        const leftTaskList = document.getElementById('left-tasks-list');
        const textTasksBody = document.getElementById('text-tasks-body');
        
        if (leftTaskList) leftTaskList.innerHTML = '';
        if (textTasksBody) textTasksBody.innerHTML = '';

        let tasksArray = [];

        if (configTasks && Array.isArray(configTasks) && configTasks.length > 0) {
            tasksArray = configTasks;
        } else {
            // Default fallback to TASKS_LIST from game-logic.js
            tasksArray = TASKS_LIST.map((tStr, idx) => {
                const match = tStr.match(/^(\d+)\.\s*([^:]+)(?::\s*(.+))?$/);
                if (match) {
                    return {
                        num: match[1],
                        name: match[2].trim(),
                        obj: match[3] ? match[3].trim() : "",
                        pos: "Navicella"
                    };
                }
                return { num: idx + 1, name: tStr, obj: "", pos: "Navicella" };
            });
        }

        // Left tasks list (cards)
        if (leftTaskList) {
            tasksArray.forEach(t => {
                const li = document.createElement('li');
                li.className = 'teatro-task-item';
                li.innerHTML = `
                    <span class="task-num">#${t.num}</span>
                    <div class="task-info">
                        <div class="task-title">${t.name}</div>
                        ${t.obj ? `<div class="task-desc">${t.obj}</div>` : ''}
                        ${t.pos ? `<div class="task-location">📍 ${t.pos}</div>` : ''}
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
                tr.innerHTML = `
                    <td class="task-td-num">${t.num}</td>
                    <td class="task-td-name">${t.name}</td>
                    <td class="task-td-obj">${t.obj || '-'}</td>
                    <td class="task-td-pos">${t.pos || '-'}</td>
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
            if (pData.role !== 'impostor' && pData.role !== 'scientist' && pData.tasks) { 
                const tasksKeys = Object.keys(pData.tasks);
                totalTasks += tasksKeys.length;
                tasksKeys.forEach(key => {
                    if (pData.tasks[key].completed) completedTasks++;
                });
            }
        }

        const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        if (taskProgressFill) taskProgressFill.style.width = `${percentage}%`;
        if (taskProgressText) taskProgressText.textContent = `${Math.round(percentage)}%`;
    }

    async function renderMapConfig(config) {
        if (!config) return;
        
        renderTasks(config.tasks);

        if (config.mapMode === 'text') {
            if (mapViewWrapper) mapViewWrapper.classList.add('hidden');
            if (textMapContainer) textMapContainer.classList.remove('hidden');
        } else {
            // Photo mode: try loading map image
            const imgSnapshot = await get(ref(db, `images/${roomCode}`));
            let imgSrc = "public/assets/mappa.jpg";
            if (imgSnapshot.exists() && imgSnapshot.val()) {
                imgSrc = imgSnapshot.val();
            }
            
            mapImage.onload = () => {
                if (mapViewWrapper) mapViewWrapper.classList.remove('hidden');
                if (textMapContainer) textMapContainer.classList.add('hidden');
            };
            
            mapImage.onerror = () => {
                console.log("Mappa non caricata o non presente: mostra task nello spazio centrale.");
                if (mapViewWrapper) mapViewWrapper.classList.add('hidden');
                if (textMapContainer) textMapContainer.classList.remove('hidden');
            };

            mapImage.src = imgSrc;
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

    // Init QR Code with simplified error correction level
    let qrInitialized = false;

    // Initial render
    renderPlayers(null, null, null);

    const roomRef = ref(db, `rooms/${roomCode}`);
    onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            if (!qrInitialized && typeof QRCode !== 'undefined') {
                qrInitialized = true;
                const qrContainer = document.getElementById("qrcode");
                if (qrContainer) {
                    qrContainer.innerHTML = '';
                    const joinUrl = `${window.location.origin}${window.location.pathname.replace('teatro.html', 'index.html')}?room=${roomCode}`;
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

                if (status === 'waiting') {
                    if(overlayMeeting) overlayMeeting.classList.add('hidden');
                    if(overlayEjected) overlayEjected.classList.add('hidden');
                    
                    const mainDashboard = document.getElementById('main-dashboard-layout');
                    if (mainDashboard) mainDashboard.classList.remove('hidden');
                    
                    const taskbar = document.getElementById('taskbar-container');
                    if (taskbar) taskbar.classList.add('hidden');

                    const globalTimer = document.getElementById('global-timer');
                    if (globalTimer) globalTimer.classList.add('hidden');
                    
                    clearInterval(timerInterval);
                    
                    renderPlayers(players, votes, maxPlayers);
                } 
                else if (status === 'playing') {
                    if(overlayMeeting) overlayMeeting.classList.add('hidden');
                    
                    const mainDashboard = document.getElementById('main-dashboard-layout');
                    if (mainDashboard) mainDashboard.classList.remove('hidden');
                    
                    const taskbar = document.getElementById('taskbar-container');
                    if (taskbar) taskbar.classList.remove('hidden');

                    const globalTimer = document.getElementById('global-timer');
                    if (globalTimer) globalTimer.classList.remove('hidden');
                    
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
                    if (globalTimer) globalTimer.textContent = "EMERGENZA";
                    
                    if (previousStatus !== 'emergency' && sirenAudio) {
                        sirenAudio.volume = 1.0;
                        sirenAudio.play().catch(e => console.log("Siren autoplay blocked", e));
                    }
                }
                else if (status === 'discussion') {
                    if(overlayMeeting) overlayMeeting.classList.add('hidden'); 
                    if (globalTimer) {
                        globalTimer.textContent = "DISCUSSIONE";
                        globalTimer.style.color = "#ffeb3b";
                    }
                    clearInterval(timerInterval);
                    renderPlayers(players, votes, maxPlayers);
                }
                else if (status === 'voting') {
                    if(overlayMeeting) overlayMeeting.classList.add('hidden');
                    if (globalTimer) globalTimer.style.color = "var(--accent-red)";
                    clearInterval(timerInterval);
                    timerInterval = setInterval(() => {
                        const remaining = Math.max(0, data.state.voting_endtime - Date.now());
                        const sec = Math.ceil(remaining / 1000);
                        if (globalTimer) globalTimer.textContent = `VOTAZIONE: ${sec}s`;
                        if(remaining <= 0) clearInterval(timerInterval);
                    }, 100);
                    renderPlayers(players, votes, maxPlayers);
                }
                else if (status === 'impostors_win') {
                    if(overlayMeeting) overlayMeeting.classList.remove('hidden');
                    if(overlayText) {
                        overlayText.textContent = "VITTORIA IMPOSTORI";
                        overlayText.style.color = "var(--accent-red)";
                    }
                    clearInterval(timerInterval);
                    if (globalTimer) globalTimer.textContent = "GAME OVER";
                }
                else if (status === 'crewmates_win') {
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
}

