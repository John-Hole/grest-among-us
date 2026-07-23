import { db, auth } from './firebase-config.js';
import { ref, set, get, child, remove } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

// DOM Elements - Sections
const homeSection = document.getElementById('section-home');
const authSection = document.getElementById('section-auth');
const joinSection = document.getElementById('section-join');
const createSection = document.getElementById('section-create');
const templatesSection = document.getElementById('section-templates');
const authModal = document.getElementById('modal-auth-prompt');

// DOM Elements - Navigation & Auth
const authStatus = document.getElementById('nav-auth-status');
const btnLogout = document.getElementById('nav-btn-logout');
const btnShowAuth = document.getElementById('btn-show-auth');
const btnGoCreate = document.getElementById('btn-go-create');
const btnGoJoin = document.getElementById('btn-go-join');
const btnGoSchermo = document.getElementById('btn-go-schermo');
const btnPromptLogin = document.getElementById('btn-prompt-login');
const btnPromptGuest = document.getElementById('btn-prompt-guest');
const btnAuthBack = document.getElementById('btn-auth-back');
const btnTplBack = document.getElementById('btn-tpl-back');
const btnJoinBack = document.getElementById('btn-join-back');
const btnCreateBack = document.getElementById('btn-create-back');
const btnCreateCancelBottom = document.getElementById('btn-create-cancel-bottom');

// Auth inputs
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');

// Join inputs
const joinCode = document.getElementById('join-code');
const joinName = document.getElementById('join-name');
const btnJoinRoom = document.getElementById('btn-join-room');

// Templates Grid
const templatesGrid = document.getElementById('templates-grid');

// Settings / Create Inputs
const createTemplateName = document.getElementById('create-template-name');
const createImpostors = document.getElementById('create-impostors');
const createScientist = document.getElementById('create-scientist');
const createKillCooldown = document.getElementById('create-kill-cooldown');
const createMaxMeetings = document.getElementById('create-max-meetings');
const createMeetingDuration = document.getElementById('create-meeting-duration');
const createVideoIntro = document.getElementById('create-video-intro');
const createMaxPlayers = document.getElementById('create-max-players');
const createUnlimitedPlayers = document.getElementById('create-unlimited-players');
const mapRadios = document.getElementsByName('map-mode');
const mapPhotoConfig = document.getElementById('map-photo-config');
const mapTextConfig = document.getElementById('map-text-config');
const mapImageUpload = document.getElementById('map-image-upload');
const mapCanvas = document.getElementById('map-canvas');
const uploadStatus = document.getElementById('upload-status');
const textTasksContainer = document.getElementById('text-tasks-container');
const btnAddTextTask = document.getElementById('btn-add-text-task');
const btnSaveStartRoom = document.getElementById('btn-save-start-room');
const btnSaveTemplateOnly = document.getElementById('btn-save-template-only');
const createTemplateSubtitle = document.getElementById('create-template-subtitle');

let currentUser = null;
let currentBase64Image = null;
let userTemplates = {};

// Default Templates
const baseTemplate = {
    name: "Standard Realmong",
    impostorCount: 3,
    killCooldown: 120,
    maxMeetings: 1,
    meetingDuration: 120,
    scientistEnabled: true,
    videoIntro: true,
    maxPlayers: 'unlimited',
    mapMode: 'photo',
    mapImage: null
};

const emptyTemplate = {
    name: "Vuoto",
    impostorCount: 1,
    killCooldown: 120,
    maxMeetings: 1,
    meetingDuration: 120,
    scientistEnabled: false,
    videoIntro: true,
    maxPlayers: 15,
    mapMode: 'photo',
    mapImage: null
};

// Handle Unlimited Checkbox
createUnlimitedPlayers.addEventListener('change', (e) => {
    createMaxPlayers.disabled = e.target.checked;
});

// Auto-fill join code from URL if present
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
    joinCode.value = roomParam;
    showSection('join');
}

// --- NAVIGATION LOGIC ---
function hideAllSections() {
    homeSection.classList.add('hidden');
    authSection.classList.add('hidden');
    joinSection.classList.add('hidden');
    createSection.classList.add('hidden');
    templatesSection.classList.add('hidden');
    authModal.classList.add('hidden');
}

function showSection(sectionName) {
    hideAllSections();
    if (sectionName === 'home') homeSection.classList.remove('hidden');
    if (sectionName === 'auth') authSection.classList.remove('hidden');
    if (sectionName === 'join') joinSection.classList.remove('hidden');
    if (sectionName === 'create') createSection.classList.remove('hidden');
    if (sectionName === 'templates') templatesSection.classList.remove('hidden');
}

btnShowAuth.addEventListener('click', () => showSection('auth'));
btnGoJoin.addEventListener('click', () => {
    const savedName = localStorage.getItem('lastNickname');
    if (savedName) joinName.value = savedName;
    showSection('join');
});
btnGoSchermo?.addEventListener('click', () => {
    window.location.href = 'schermo.html';
});
btnAuthBack.addEventListener('click', () => showSection('home'));
btnTplBack.addEventListener('click', () => showSection('home'));
btnJoinBack.addEventListener('click', () => showSection('home'));
btnCreateBack.addEventListener('click', () => showSection('templates'));
btnCreateCancelBottom?.addEventListener('click', () => showSection('templates'));

btnGoCreate.addEventListener('click', () => {
    if (currentUser) {
        showSection('templates');
    } else {
        authModal.classList.remove('hidden');
    }
});

btnPromptLogin.addEventListener('click', () => {
    authModal.classList.add('hidden');
    showSection('auth');
});

btnPromptGuest.addEventListener('click', () => {
    authModal.classList.add('hidden');
    showSection('templates');
});


// --- AUTH LOGIC ---
onAuthStateChanged(auth, (user) => {
    // Render base templates synchronously before any network request
    renderBaseTemplates();

    if (user) {
        currentUser = user;
        authStatus.textContent = `Loggato come: ${user.email}`;
        btnLogout.classList.remove('hidden');
        btnShowAuth.classList.add('hidden');
        loadUserTemplates(user.uid);
        
        if (urlParams.get('go') === 'account') {
            showSection('templates');
        }
    } else {
        currentUser = null;
        authStatus.textContent = "Non loggato";
        btnLogout.classList.add('hidden');
        btnShowAuth.classList.remove('hidden');
        userTemplates = {};
        
        if (urlParams.get('go') === 'account') {
            authModal.classList.remove('hidden');
        }
    }
});

btnLogin.addEventListener('click', async () => {
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        showSection('home');
    } catch (error) {
        alert("Errore login: " + error.message);
    }
});

btnRegister.addEventListener('click', async () => {
    try {
        await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        showSection('home');
    } catch (error) {
        alert("Errore registrazione: " + error.message);
    }
});

btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    showSection('home');
});


// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.template-menu-dropdown').forEach(d => d.classList.add('hidden'));
});

// --- TEMPLATES LOGIC ---
function renderAllTemplates() {
    templatesGrid.innerHTML = '';

    // 1. Render Base Template ("Standard Realmong") FIRST
    createTemplateCard('base', baseTemplate, false);

    // 2. Render User Custom Templates SECOND
    if (userTemplates) {
        for (const key in userTemplates) {
            createTemplateCard(key, userTemplates[key], true);
        }
    }

    // 3. Render "+ CREA NUOVO" Button LAST
    const createBtn = document.createElement('div');
    createBtn.style = `border: 2px dashed var(--accent-cyan); border-radius: 12px; padding: 1.5rem; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--accent-cyan); font-weight: bold; flex-direction: column; min-height: 120px; transition: all 0.2s; background: rgba(0, 229, 255, 0.03);`;
    createBtn.onmouseover = () => {
        createBtn.style.background = 'rgba(0, 229, 255, 0.1)';
        createBtn.style.borderColor = '#33eaff';
        createBtn.style.transform = 'translateY(-2px)';
    };
    createBtn.onmouseout = () => {
        createBtn.style.background = 'rgba(0, 229, 255, 0.03)';
        createBtn.style.borderColor = 'var(--accent-cyan)';
        createBtn.style.transform = 'none';
    };
    createBtn.innerHTML = `<span style="font-size: 2.5rem; line-height: 1; margin-bottom: 0.3rem;">+</span><span style="font-size: 0.85rem; letter-spacing: 0.5px;">CREA NUOVO</span>`;
    createBtn.onclick = () => openCreateSettings(null, null);
    templatesGrid.appendChild(createBtn);
}

function renderBaseTemplates() {
    renderAllTemplates();
}

async function loadUserTemplates(uid) {
    const dbRef = ref(db);
    try {
        const snapshot = await get(child(dbRef, `users/${uid}/templates`));
        if (snapshot.exists()) {
            userTemplates = snapshot.val();
        } else {
            userTemplates = {};
        }
        renderAllTemplates();
    } catch (error) {
        console.error("Error loading templates:", error);
        renderAllTemplates();
    }
}

function createTemplateCard(id, data, isCustom) {
    const card = document.createElement('div');
    card.style = `background: var(--card-bg); border-radius: 12px; padding: 1.2rem; position: relative; border: 2px solid #333; transition: all 0.2s; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between;`;
    card.onmouseover = () => card.style.borderColor = 'var(--accent-cyan)';
    card.onmouseout = () => card.style.borderColor = '#333';
    card.onclick = () => startRoomWithConfig(data);

    // Header Flex Row (Title + 3 Dots Menu Button)
    const headerRow = document.createElement('div');
    headerRow.style = `display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.8rem;`;

    const title = document.createElement('h3');
    title.textContent = data.name || (id === 'base' ? 'Standard Realmong' : id);
    title.style = `margin: 0; font-size: 1.1rem; font-weight: 700; color: white; word-break: break-word; flex: 1;`;
    headerRow.appendChild(title);

    // 3-dots Menu Container
    const menuContainer = document.createElement('div');
    menuContainer.style = `position: relative;`;

    const menuBtn = document.createElement('button');
    menuBtn.innerHTML = '&#8942;'; // 3 vertical dots
    menuBtn.className = 'template-menu-btn';
    menuBtn.title = 'Opzioni template';
    
    const menuDrop = document.createElement('div');
    menuDrop.className = 'template-menu-dropdown hidden';
    
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Modifica';
    editBtn.className = 'template-menu-item';
    editBtn.onclick = (e) => { 
        e.stopPropagation(); 
        menuDrop.classList.add('hidden');
        openCreateSettings(id, data, false, !isCustom); 
    };
    
    const dupeBtn = document.createElement('button');
    dupeBtn.textContent = 'Duplica';
    dupeBtn.className = 'template-menu-item';
    dupeBtn.onclick = (e) => { 
        e.stopPropagation(); 
        menuDrop.classList.add('hidden');
        openCreateSettings(id, data, true, false); 
    };
    
    menuDrop.appendChild(editBtn);
    menuDrop.appendChild(dupeBtn);

    if (isCustom) {
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Elimina';
        delBtn.className = 'template-menu-item template-menu-item-danger';
        delBtn.onclick = async (e) => { 
            e.stopPropagation(); 
            menuDrop.classList.add('hidden');
            if(confirm(`Sicuro di voler eliminare il template "${data.name || id}"?`)) {
                await remove(ref(db, `users/${currentUser.uid}/templates/${id}`));
                delete userTemplates[id];
                renderAllTemplates();
            }
        };
        menuDrop.appendChild(delBtn);
    }

    menuBtn.onclick = (e) => {
        e.stopPropagation();
        const wasHidden = menuDrop.classList.contains('hidden');
        document.querySelectorAll('.template-menu-dropdown').forEach(d => d.classList.add('hidden'));
        if (wasHidden) {
            menuDrop.classList.remove('hidden');
        }
    };

    menuContainer.appendChild(menuBtn);
    menuContainer.appendChild(menuDrop);
    headerRow.appendChild(menuContainer);
    card.appendChild(headerRow);

    const details = document.createElement('div');
    details.style.fontSize = '0.8rem';
    details.style.color = '#aaa';
    details.innerHTML = `
        <p style="margin: 0.25rem 0;">Impostori: <strong style="color: white;">${data.impostorCount}</strong></p>
        <p style="margin: 0.25rem 0;">Limite: <strong style="color: white;">${data.maxPlayers === 'unlimited' ? '∞' : data.maxPlayers}</strong></p>
        <p style="margin: 0.25rem 0;">Mappa: <strong style="color: white;">${data.mapMode === 'text' ? 'Testuale' : 'Visiva'}</strong></p>
    `;
    card.appendChild(details);

    templatesGrid.appendChild(card);
}

// --- CREATE SETTINGS LOGIC ---
let currentEditId = null;

function setFormDisabled(disabled) {
    createTemplateName.disabled = disabled;
    createImpostors.disabled = disabled;
    createKillCooldown.disabled = disabled;
    createMaxMeetings.disabled = disabled;
    createMeetingDuration.disabled = disabled;
    createScientist.disabled = disabled;
    createVideoIntro.disabled = disabled;
    createUnlimitedPlayers.disabled = disabled;
    createMaxPlayers.disabled = disabled || createUnlimitedPlayers.checked;
    Array.from(mapRadios).forEach(r => r.disabled = disabled);
    mapImageUpload.disabled = disabled;
    btnAddTextTask.disabled = disabled;
    textTasksContainer.querySelectorAll('input, button').forEach(el => el.disabled = disabled);
}

function openCreateSettings(id, data, isDuplicate = false, isBase = false) {
    const isBaseTemplate = (isBase || id === 'base') && !isDuplicate;
    currentEditId = (isDuplicate || isBaseTemplate) ? null : id;

    if (data) {
        if (isBaseTemplate) {
            createTemplateSubtitle.textContent = "Visualizzazione dei settaggi del Template Base (Predefinito).";
            btnSaveTemplateOnly.classList.add('hidden');
            btnSaveStartRoom.classList.add('hidden');
            btnCreateCancelBottom.textContent = "INDIETRO";
            setFormDisabled(true);
        } else {
            if (isDuplicate) {
                createTemplateSubtitle.textContent = `Stai duplicando "${data.name || 'Template'}". Le modifiche verranno salvate come un nuovo template.`;
            } else {
                createTemplateSubtitle.textContent = `Stai modificando il tuo template "${data.name || 'Template'}".`;
            }
            btnSaveTemplateOnly.classList.remove('hidden');
            btnSaveStartRoom.classList.remove('hidden');
            btnCreateCancelBottom.textContent = "INDIETRO / ANNULLA";
            setFormDisabled(false);
        }

        createTemplateName.value = (data.name || "") + (isDuplicate ? " (Copia)" : "");
        createImpostors.value = data.impostorCount || 1;
        createKillCooldown.value = data.killCooldown || 120;
        createMaxMeetings.value = data.maxMeetings !== undefined ? data.maxMeetings : 1;
        createMeetingDuration.value = data.meetingDuration || 120;
        createVideoIntro.checked = data.videoIntro !== undefined ? data.videoIntro : true;
        createScientist.checked = !!data.scientistEnabled;
        
        if (data.maxPlayers === 'unlimited') {
            createUnlimitedPlayers.checked = true;
            createMaxPlayers.disabled = true;
        } else {
            createUnlimitedPlayers.checked = false;
            createMaxPlayers.disabled = isBaseTemplate ? true : false;
            createMaxPlayers.value = data.maxPlayers || 15;
        }

        if (data.mapMode === 'text') {
            mapRadios[1].checked = true;
            currentBase64Image = null;
            uploadStatus.textContent = '';
            textTasksContainer.innerHTML = '';
            if (data.tasks) {
                data.tasks.forEach(task => addTextTask(task));
            }
        } else {
            mapRadios[0].checked = true;
            currentBase64Image = data.mapImage || null;
            uploadStatus.textContent = currentBase64Image ? "Immagine caricata dal template." : "";
        }
    } else {
        createTemplateSubtitle.textContent = "Crea un nuovo template personalizzato con le tue impostazioni preferite.";
        btnSaveTemplateOnly.classList.remove('hidden');
        btnSaveStartRoom.classList.remove('hidden');
        btnCreateCancelBottom.textContent = "INDIETRO / ANNULLA";
        setFormDisabled(false);

        createTemplateName.value = "";
        createImpostors.value = 1;
        createKillCooldown.value = 120;
        createMaxMeetings.value = 1;
        createMeetingDuration.value = 120;
        createVideoIntro.checked = true;
        createScientist.checked = false;
        createUnlimitedPlayers.checked = false;
        createMaxPlayers.disabled = false;
        createMaxPlayers.value = 15;
        mapRadios[0].checked = true;
        currentBase64Image = null;
        uploadStatus.textContent = '';
        textTasksContainer.innerHTML = '';
    }
    
    toggleMapMode();
    showSection('create');
}


// --- IMAGE COMPRESSION LOGIC ---
mapImageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadStatus.textContent = "Compressione in corso...";
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            mapCanvas.width = width;
            mapCanvas.height = height;
            const ctx = mapCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            currentBase64Image = mapCanvas.toDataURL('image/jpeg', 0.6);
            uploadStatus.textContent = "Immagine pronta e compressa!";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- TEXT TASKS LOGIC ---
Array.from(mapRadios).forEach(r => r.addEventListener('change', toggleMapMode));

function toggleMapMode() {
    if (mapRadios[0].checked) {
        mapPhotoConfig.classList.remove('hidden');
        mapTextConfig.classList.add('hidden');
    } else {
        mapPhotoConfig.classList.add('hidden');
        mapTextConfig.classList.remove('hidden');
    }
}

function addTextTask(taskData = { num: '', name: '', obj: '', pos: '' }) {
    const div = document.createElement('div');
    div.className = 'task-row';
    div.innerHTML = `
        <input type="text" placeholder="N°" value="${taskData.num}" style="width: 15%;">
        <input type="text" placeholder="Nome Task" value="${taskData.name}" style="width: 35%;">
        <input type="text" placeholder="Obiettivo" value="${taskData.obj}" style="width: 30%;">
        <input type="text" placeholder="Posizione" value="${taskData.pos}" style="width: 20%;">
        <button class="btn btn-danger" style="padding: 0.5rem;">X</button>
    `;
    div.querySelector('.btn-danger').onclick = () => div.remove();
    textTasksContainer.appendChild(div);
}

btnAddTextTask.addEventListener('click', () => addTextTask());

// --- CREATE & JOIN ROOM ---
function getRoomConfigFromUI() {
    const mode = mapRadios[0].checked ? 'photo' : 'text';
    const tasks = [];
    if (mode === 'text') {
        const rows = textTasksContainer.querySelectorAll('.task-row');
        rows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            tasks.push({
                num: inputs[0].value,
                name: inputs[1].value,
                obj: inputs[2].value,
                pos: inputs[3].value
            });
        });
    }
    
    let maxPlayers = createUnlimitedPlayers.checked ? 'unlimited' : parseInt(createMaxPlayers.value) || 15;

    return {
        name: createTemplateName.value.trim() || "Template Custom",
        impostorCount: parseInt(createImpostors.value) || 1,
        killCooldown: parseInt(createKillCooldown.value) || 120,
        maxMeetings: parseInt(createMaxMeetings.value) || 1,
        meetingDuration: parseInt(createMeetingDuration.value) || 120,
        roundTimes: [10 * 60000, 7 * 60000, 5 * 60000],
        videoIntro: createVideoIntro.checked,
        scientistEnabled: createScientist.checked,
        mapMode: mode,
        mapImage: mode === 'photo' ? currentBase64Image : null,
        tasks: mode === 'text' ? tasks : null,
        maxPlayers: maxPlayers
    };
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for(let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function saveTemplateToFirebase(config) {
    if (!currentUser) {
        alert("Per salvare un template devi prima accedere col tuo account.");
        authModal.classList.remove('hidden');
        return false;
    }

    const templateId = currentEditId || Date.now().toString();
    try {
        await set(ref(db, `users/${currentUser.uid}/templates/${templateId}`), config);
        renderBaseTemplates();
        await loadUserTemplates(currentUser.uid);
        return true;
    } catch(e) {
        console.error("Errore salvataggio:", e);
        alert("Errore durante il salvataggio: " + e.message);
        return false;
    }
}

btnSaveTemplateOnly.addEventListener('click', async () => {
    const config = getRoomConfigFromUI();
    if (config.mapMode === 'photo' && !config.mapImage) {
        if (!confirm("Non hai caricato nessuna immagine mappa. Continuare comunque?")) return;
    }

    if (!config.name) {
        return alert("Inserisci un Nome Template per salvarlo.");
    }

    const saved = await saveTemplateToFirebase(config);
    if (saved) {
        alert("Template salvato con successo!");
        showSection('templates');
    }
});

btnSaveStartRoom.addEventListener('click', async () => {
    const config = getRoomConfigFromUI();
    if (config.mapMode === 'photo' && !config.mapImage) {
        if (!confirm("Non hai caricato nessuna immagine mappa. Continuare comunque?")) return;
    }

    if (!config.name) {
        return alert("Inserisci un Nome Template per salvarlo.");
    }

    // Save template if user is logged in
    if (currentUser) {
        await saveTemplateToFirebase(config);
    }

    // Start Room
    startRoomWithConfig(config);
});

async function startRoomWithConfig(config) {
    const imageToSave = config.mapImage;
    const roomConfig = { ...config };
    delete roomConfig.mapImage; // Separiamo l'immagine dal nodo principale
    delete roomConfig.name; // Non serve nella stanza

    const roomCode = generateRoomCode();
    
    const roomData = {
        config: roomConfig,
        state: {
            game_status: 'waiting',
            round: 1,
            timer: 0,
            timer_paused: false,
            timer_remaining: 0,
            last_ejected: null
        },
        players: {}
    };

    try {
        await set(ref(db, `rooms/${roomCode}`), roomData);
        if (imageToSave) {
            await set(ref(db, `images/${roomCode}`), imageToSave);
        }
        window.location.href = `master.html?room=${roomCode}`;
    } catch (error) {
        alert("Errore creazione stanza: " + error.message);
    }
}

btnJoinRoom.addEventListener('click', async () => {
    const code = joinCode.value.trim().toUpperCase();
    const name = joinName.value.trim();

    if (!code || !name) {
        return alert("Inserisci sia il codice stanza che il nome giocatore.");
    }

    localStorage.setItem('lastNickname', name);

    const dbRef = ref(db);
    try {
        const snapshot = await get(child(dbRef, `rooms/${code}`));
        if (!snapshot.exists()) {
            return alert("Stanza non trovata!");
        }

        const roomData = snapshot.val();
        if (roomData.kickedPlayers) {
            const isKicked = Object.keys(roomData.kickedPlayers).some(
                p => p.toLowerCase() === name.toLowerCase()
            );
            if (isKicked) {
                return alert(`Sei stato espulso da questa stanza! Non puoi accedere finché il Master non ti riammette.`);
            }
        }

        if (roomData.state && roomData.state.game_status !== 'waiting') {
            return alert("Impossibile accedere: partita già in corso!");
        }

        if (roomData.players) {
            const isDuplicate = Object.keys(roomData.players).some(
                p => p.toLowerCase() === name.toLowerCase()
            );
            if (isDuplicate) {
                return alert(`Il nome "${name}" è già in uso in questa stanza! Per favore scegli un altro nome.`);
            }
        }
        
        const currentPlayersCount = roomData.players ? Object.keys(roomData.players).length : 0;
        const maxLimit = roomData.config.maxPlayers;
        
        if (maxLimit !== 'unlimited' && currentPlayersCount >= maxLimit) {
            return alert("Impossibile accedere: la stanza è al completo!");
        }

        await set(ref(db, `rooms/${code}/players/${name}`), {
            status: 'alive',
            role: 'crewmate',
            meetings_called: 0
        });

        window.location.href = `giocatore.html?room=${code}&player=${encodeURIComponent(name)}`;
    } catch (error) {
        alert("Errore di connessione: " + error.message);
    }
});
