import { db, auth } from './firebase-config.js';
import { ref, set, get, child, remove } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { escapeHtml } from './game-logic.js';

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
const btnAnonLogin = document.getElementById('btn-anon-login');

// Join inputs
const joinCode = document.getElementById('join-code');
const joinName = document.getElementById('join-name');
const btnJoinRoom = document.getElementById('btn-join-room');

// Templates Grid
const templatesGrid = document.getElementById('templates-grid');

// Settings / Create Inputs
const createTemplateName = document.getElementById('create-template-name');
const createImpostors = document.getElementById('create-impostors');
const createKillCooldown = document.getElementById('create-kill-cooldown');
const createMaxMeetings = document.getElementById('create-max-meetings');
const createScientist = document.getElementById('create-scientist');
const createDiscussionDuration = document.getElementById('create-discussion-duration');
const createVotingDuration = document.getElementById('create-voting-duration');
const btnAddRoundTime = document.getElementById('btn-add-round-time');
const roundTimesContainer = document.getElementById('round-times-container');
const createMaxPlayers = document.getElementById('create-max-players');

// Map & Task DOM elements
const createEnableMap = document.getElementById('create-enable-map');
const mapOptionsWrapper = document.getElementById('map-options-wrapper');
const createMapType = document.getElementById('create-map-type');

const createEnableTasks = document.getElementById('create-enable-tasks');
const taskOptionsWrapper = document.getElementById('task-options-wrapper');
const createTaskType = document.getElementById('create-task-type'); // may be null (removed)

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

// All room names from the vector SVG map for the location dropdown
const MAP_VECTOR_LOCATIONS = [
    'Salone', 'Teatro', 'Palco', 'Canestro', 'Atrio', 'Mensa', 'Cucina',
    'Regia', 'Sala Musica', 'Sala Animatori', 'Sala Materiali', 'Sala Gialla',
    'Sala Verde', 'Sala Viola', 'Sala Chiusa',
    'Corridoio Salone', 'Corridoio Bagni',
    'Strada Laterale', 'Strada Retro', 'Retro Cucina', 'Rampa Strada',
    'Rampa Palco SX', 'Rampa Palco DX',
    'Ingresso Sotto Chiesa', 'Collegamento Suore',
    'Locale Tecnico', 'Ripostiglio Palco', 'Ripostiglio Bagno', 'Caldaia',
    'Bagno Disabili', 'Antibagno M', 'Antibagno F',
    'WC Maschi 1', 'WC Maschi 2', 'WC Maschi 3',
    'WC Femmine 1', 'WC Femmine 2', 'WC Femmine 3',
    'WC Teatro 1', 'WC Teatro 2', 'WC Teatro 3'
];

const defaultBaseTasks = [
    { num: '1', name: 'Canestri', obj: '3 canestri da tiro libero', pos: 'Canestro' },
    { num: '2', name: 'Trova l\'oggetto', obj: 'Trova 10 oggetti nella scatola di acqua sporca', pos: 'Atrio' },
    { num: '3', name: 'Rebus', obj: 'Risolvi 2 fogli di rebus', pos: 'Atrio' },
    { num: '4', name: 'Puzzle', obj: 'Componi un puzzle', pos: 'Atrio' },
    { num: '5', name: 'Pulisci il bagno', obj: '1 minuto per pulire tutto il bagno dalla tempera', pos: 'Bagno Disabili' },
    { num: '6', name: 'Matematica', obj: 'Risolvi 10 operazioni in 1.5 min', pos: 'Sala Materiali' },
    { num: '7', name: 'Limbo', obj: 'Supera 3 livelli', pos: 'Sala Materiali' },
    { num: '8', name: 'Avanti un altro', obj: 'Rispondi a 15 domande', pos: 'Salone' },
    { num: '9', name: 'Centra il bicchiere', obj: 'Fai centro con i pennarelli nel bicchiere in 1.5 min', pos: 'Salone' },
    { num: '10', name: 'Percorso bendato', obj: 'Un compagno dà le indicazioni al giocatore bendato', pos: 'Strada Laterale' },
    { num: '11', name: 'Riempi il bicchiere', obj: 'Con uno shottino pieno corri a riempire un bicchiere grande', pos: 'Strada Laterale' },
    { num: '12', name: 'Ricorda la sequenza', obj: 'Ripeti la sequenza 1 volta', pos: 'Sala Gialla' },
    { num: '13', name: 'Attacca le orecchie', obj: '1 minuto per attaccare bendati le orecchie al bianconiglio', pos: 'Sala Gialla' },
    { num: '14', name: 'Twister', obj: 'Resisti 1.5 min cambiando posizione', pos: 'Sala Gialla' },
    { num: '15', name: 'Dinosauro', obj: 'Pesca bigliettino col punteggio e gioca fino al target', pos: 'Regia' },
    { num: '16', name: 'Whisper challenge', obj: 'Indovina 5 frasi', pos: 'Corridoio Salone' },
    { num: '17', name: 'Cruciverba', obj: 'Risolvi un cruciverba', pos: 'Sala Verde' }
];

// Default Templates
const baseTemplate = {
    name: "Standard Realmong",
    impostorCount: 3,
    killCooldown: 120,
    maxMeetings: 1,
    discussionDuration: 0,
    votingDuration: 60,
    meetingDuration: 60,
    roundTimes: [10 * 60000, 7 * 60000, 5 * 60000],
    scientistEnabled: true,
    maxPlayers: 'unlimited',
    enableMap: true,
    mapType: 'vector',
    enableTasks: true,
    taskType: 'custom',
    mapMode: 'vector',
    mapImage: null,
    tasks: defaultBaseTasks
};

const emptyTemplate = {
    name: "Vuoto",
    impostorCount: 1,
    killCooldown: 120,
    maxMeetings: 1,
    discussionDuration: 0,
    votingDuration: 60,
    meetingDuration: 60,
    roundTimes: [10 * 60000, 7 * 60000, 5 * 60000],
    scientistEnabled: false,
    maxPlayers: 15,
    enableMap: true,
    mapType: 'vector',
    enableTasks: true,
    taskType: 'custom',
    mapMode: 'vector',
    mapImage: null,
    tasks: []
};



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
    window.scrollTo(0, 0);
}

btnShowAuth?.addEventListener('click', () => {
    if (currentUser) {
        showSection('templates');
    } else {
        showSection('auth');
    }
});
btnGoJoin.addEventListener('click', () => {
    const savedName = localStorage.getItem('lastNickname');
    if (savedName) joinName.value = savedName;
    showSection('join');
});
btnGoSchermo?.addEventListener('click', () => {
    window.location.href = 'schermo';
});
btnAuthBack.addEventListener('click', () => showSection('home'));
btnTplBack.addEventListener('click', () => showSection('home'));
btnJoinBack.addEventListener('click', () => showSection('home'));
btnCreateBack?.addEventListener('click', () => { currentEditId = null; showSection('templates'); });
btnCreateCancelBottom?.addEventListener('click', () => { currentEditId = null; showSection('templates'); });

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

btnPromptGuest.addEventListener('click', async () => {
    authModal.classList.add('hidden');
    try {
        await signInAnonymously(auth);
        showSection('templates');
    } catch (e) {
        console.error('Guest login failed:', e);
        showSection('templates');
    }
});


// --- AUTH LOGIC ---
onAuthStateChanged(auth, (user) => {
    // Render base templates synchronously before any network request
    renderBaseTemplates();

    const authStatusEl = document.getElementById('nav-auth-status');
    const btnLogoutEl = document.getElementById('nav-btn-logout');
    const btnShowAuthEl = document.getElementById('btn-show-auth');
    const navUserInfoEl = document.getElementById('nav-user-info');
    const navUserNameEl = document.getElementById('nav-user-name');

    if (user) {
        currentUser = user;
        const displayName = user.isAnonymous ? 'Ospite' : (user.displayName || user.email || 'Utente');
        const displayEmail = user.isAnonymous ? 'Account Ospite' : (user.email || user.displayName || 'Utente');
        
        const navUserEmailEl = document.getElementById('nav-user-email');
        if (navUserEmailEl) navUserEmailEl.textContent = displayEmail;
        if (authStatusEl) authStatusEl.textContent = `Loggato come: ${displayName}`;
        if (btnLogoutEl) btnLogoutEl.classList.remove('hidden');
        if (btnShowAuthEl) btnShowAuthEl.style.display = 'none';
        if (navUserInfoEl) navUserInfoEl.style.display = 'flex';
        if (navUserNameEl) navUserNameEl.textContent = `👤 ${displayName}`;

        loadUserTemplates(user.uid);
        
        if (!authSection.classList.contains('hidden') || urlParams.get('go') === 'account') {
            showSection('templates');
        }
    } else {
        currentUser = null;
        if (authStatusEl) authStatusEl.textContent = "Non loggato";
        if (btnLogoutEl) btnLogoutEl.classList.add('hidden');
        if (btnShowAuthEl) btnShowAuthEl.style.display = 'inline-block';
        if (navUserInfoEl) navUserInfoEl.style.display = 'none';
        userTemplates = {};
        
        if (urlParams.get('go') === 'account') {
            authModal.classList.remove('hidden');
        }
    }
});

// --- INLINE AUTH ERROR UI HELPERS & PASSWORD TOGGLE ---
const authErrorMsg = document.getElementById('auth-error-msg');
const authErrorText = document.getElementById('auth-error-text');
const btnTogglePassword = document.getElementById('btn-toggle-password');

if (btnTogglePassword && passwordInput) {
    btnTogglePassword.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        btnTogglePassword.textContent = isPassword ? '🙈' : '👁️';
    });
}

function showAuthError(message, targetField = null) {
    if (authErrorText && authErrorMsg) {
        authErrorText.textContent = message;
        authErrorMsg.classList.remove('hidden');
    }
    
    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');

    if (targetField === 'email') {
        emailInput.classList.add('input-error');
        emailInput.focus();
    } else if (targetField === 'password') {
        passwordInput.classList.add('input-error');
        passwordInput.focus();
    } else if (targetField === 'both') {
        emailInput.classList.add('input-error');
        passwordInput.classList.add('input-error');
        if (!emailInput.value) emailInput.focus();
        else passwordInput.focus();
    }
}

function clearAuthError() {
    if (authErrorMsg) authErrorMsg.classList.add('hidden');
    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');
}

emailInput.addEventListener('input', clearAuthError);
passwordInput.addEventListener('input', clearAuthError);

btnLogin.addEventListener('click', async () => {
    clearAuthError();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email && !password) {
        return showAuthError("Inserisci email e password per accedere.", "both");
    }
    if (!email) {
        return showAuthError("Inserisci il tuo indirizzo email.", "email");
    }
    if (!password) {
        return showAuthError("Inserisci la password.", "password");
    }

    try {
        // Tenta prima l'accesso
        await signInWithEmailAndPassword(auth, email, password);
        clearAuthError();
        showSection('home');
    } catch (loginError) {
        console.log("Login error:", loginError.code, loginError.message);

        // Se l'account non esiste, prova la registrazione automatica
        if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                clearAuthError();
                showSection('home');
                return;
            } catch (regError) {
                console.log("Reg error:", regError.code, regError.message);
                if (regError.code === 'auth/email-already-in-use') {
                    showAuthError("Password errata per questa email.", "password");
                } else if (regError.code === 'auth/weak-password') {
                    showAuthError("La password deve contenere almeno 6 caratteri.", "password");
                } else if (regError.code === 'auth/invalid-email') {
                    showAuthError("Indirizzo email non valido.", "email");
                } else {
                    showAuthError("Password errata per questa email.", "password");
                }
                return;
            }
        }

        // Altri errori di login
        if (loginError.code === 'auth/wrong-password') {
            showAuthError("Password errata per questa email.", "password");
        } else if (loginError.code === 'auth/invalid-email') {
            showAuthError("Indirizzo email non valido.", "email");
        } else {
            showAuthError(loginError.message || "Credenziali non valide.", "both");
        }
    }
});

btnAnonLogin.addEventListener('click', async () => {
    try {
        await signInAnonymously(auth);
        clearAuthError();
        showSection('templates');
    } catch (error) {
        showAuthError("Errore accesso Ospite: " + error.message);
    }
});

const handleLogout = async () => {
    try {
        await signOut(auth);
        showSection('home');
    } catch (e) {
        console.error("Logout error:", e);
    }
};

document.getElementById('nav-btn-logout-top')?.addEventListener('click', handleLogout);
btnLogout?.addEventListener('click', handleLogout);


// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.template-menu-dropdown').forEach(d => d.classList.add('hidden'));
});

// --- TEMPLATES LOGIC ---
function renderAllTemplates() {
    templatesGrid.innerHTML = '';

    // 1. Render Base Template ("Standard Realmong") FIRST
    createTemplateCard('base', baseTemplate, false);

    // 2. Render User Custom Templates SECOND (Only if logged in with a real account)
    if (currentUser && !currentUser.isAnonymous && userTemplates) {
        for (const key in userTemplates) {
            createTemplateCard(key, userTemplates[key], true);
        }
    }

    // 3. Render "+ CREA NUOVO" Button LAST (Only if logged in with a real account)
    if (currentUser && !currentUser.isAnonymous) {
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
    menuBtn.style = `appearance: none; -webkit-appearance: none; background: transparent; border: none; outline: none; box-shadow: none; color: #8a99ad; cursor: pointer; padding: 0; margin: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px;`;
    menuBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;
    menuBtn.className = 'template-menu-btn';
    menuBtn.title = 'Opzioni template';
    
    const menuDrop = document.createElement('div');
    menuDrop.className = 'template-menu-dropdown hidden';
    menuDrop.onclick = (e) => e.stopPropagation();
    
    const editBtn = document.createElement('button');
    editBtn.textContent = id === 'base' ? 'Visualizza' : 'Modifica';
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

    const isMapActive = data.enableMap !== false;
    const mapTypeStr = data.mapType || (data.mapMode === 'text' ? 'vector' : 'photo');
    const mapLabel = !isMapActive ? 'Disabilitata' : (mapTypeStr === 'vector' ? 'Vettoriale' : 'Visiva');

    const isTasksActive = data.enableTasks !== false;
    const taskTypeStr = data.taskType || (data.mapMode === 'text' || (data.tasks && data.tasks.length > 0) ? 'custom' : 'default');
    const taskLabel = !isTasksActive ? 'Disabilitate' : (taskTypeStr === 'custom' ? 'Personalizzate' : 'Predefinite');

    const discText = data.discussionDuration > 0 ? `${data.discussionDuration}s` : 'Libera';
    const votVal = data.votingDuration !== undefined ? data.votingDuration : (data.meetingDuration !== undefined ? data.meetingDuration : 60);
    const votText = votVal === 0 ? 'Libera' : `${votVal}s`;

    const details = document.createElement('div');
    details.style.fontSize = '0.8rem';
    details.style.color = '#aaa';
    details.innerHTML = `
        <p style="margin: 0.25rem 0;">Impostori: <strong style="color: white;">${data.impostorCount}</strong> | Limite: <strong style="color: white;">${data.maxPlayers === 'unlimited' ? '∞' : data.maxPlayers}</strong></p>
        <p style="margin: 0.25rem 0;">Discussione: <strong style="color: white;">${discText}</strong> | Votazione: <strong style="color: white;">${votText}</strong></p>
        <p style="margin: 0.25rem 0;">Mappa: <strong style="color: white;">${mapLabel}</strong> | Task: <strong style="color: white;">${taskLabel}</strong></p>
    `;
    card.appendChild(details);

    templatesGrid.appendChild(card);
}

// --- CREATE SETTINGS LOGIC ---
let currentEditId = null;

let currentFormDisabled = false;

function setFormDisabled(disabled) {
    currentFormDisabled = disabled;
    createTemplateName.disabled = disabled;
    createImpostors.disabled = disabled;
    createKillCooldown.disabled = disabled;
    createMaxMeetings.disabled = disabled;
    if (createDiscussionDuration) createDiscussionDuration.disabled = disabled;
    if (createVotingDuration) createVotingDuration.disabled = disabled;
    if (btnAddRoundTime) {
        btnAddRoundTime.disabled = disabled;
        if (disabled) btnAddRoundTime.classList.add('hidden');
        else btnAddRoundTime.classList.remove('hidden');
    }
    document.querySelectorAll('.round-time-input, .btn-remove-round').forEach(el => {
        el.disabled = disabled;
        if (el.classList.contains('btn-remove-round') && disabled) {
            el.classList.add('hidden');
        }
    });
    createScientist.disabled = disabled;
    createMaxPlayers.disabled = disabled;

    createEnableMap.disabled = disabled;
    createMapType.disabled = disabled;
    mapImageUpload.disabled = disabled;

    createEnableTasks.disabled = disabled;
    if (createTaskType) createTaskType.disabled = disabled;
    if (btnAddTextTask) {
        btnAddTextTask.disabled = disabled;
        if (disabled) btnAddTextTask.classList.add('hidden');
        else btnAddTextTask.classList.remove('hidden');
    }
    textTasksContainer.querySelectorAll('input, select, button').forEach(el => {
        el.disabled = disabled;
        if (el.tagName === 'BUTTON' && disabled) el.classList.add('hidden');
    });
}

function openCreateSettings(id, data, isDuplicate = false, isBase = false) {
    const isBaseTemplate = (isBase || id === 'base') && !isDuplicate;
    currentEditId = (isDuplicate || isBaseTemplate) ? null : id;

    if (data) {
        if (isBaseTemplate) {
            if (createTemplateSubtitle) createTemplateSubtitle.textContent = "Stai visualizzando i parametri del Template Standard Realmong.";
            btnSaveTemplateOnly.classList.add('hidden');
            btnSaveStartRoom.classList.remove('hidden');
            btnSaveStartRoom.textContent = "AVVIA STANZA CON QUESTI SETTAGGI";
            btnCreateCancelBottom.textContent = "INDIETRO / ANNULLA";
        } else {
            if (isDuplicate) {
                if (createTemplateSubtitle) createTemplateSubtitle.textContent = `Stai duplicando "${data.name || 'Template'}". Le modifiche verranno salvate come un nuovo template.`;
            } else {
                if (createTemplateSubtitle) createTemplateSubtitle.textContent = `Stai modificando il tuo template "${data.name || 'Template'}".`;
            }
            btnSaveTemplateOnly.classList.remove('hidden');
            btnSaveStartRoom.classList.remove('hidden');
            btnSaveTemplateOnly.textContent = "SALVA TEMPLATE";
            btnSaveStartRoom.textContent = "SALVA E AVVIA STANZA";
            btnCreateCancelBottom.textContent = "INDIETRO / ANNULLA";
        }

        createTemplateName.value = (data.name || "") + (isDuplicate ? " (Copia)" : "");
        createImpostors.value = data.impostorCount || 1;
        createKillCooldown.value = data.killCooldown || 120;
        createMaxMeetings.value = data.maxMeetings !== undefined ? data.maxMeetings : 1;
        if (createDiscussionDuration) createDiscussionDuration.value = data.discussionDuration !== undefined ? data.discussionDuration : 0;
        if (createVotingDuration) createVotingDuration.value = data.votingDuration || data.meetingDuration || 60;
        createScientist.checked = !!data.scientistEnabled;
        
        if (data.maxPlayers === 'unlimited' || !data.maxPlayers) {
            createMaxPlayers.value = '';
        } else {
            createMaxPlayers.value = data.maxPlayers;
        }

        // Render round times
        if (data.roundTimes && Array.isArray(data.roundTimes) && data.roundTimes.length > 0) {
            const minsArr = data.roundTimes.map(ms => Math.max(1, Math.round(ms / 60000)));
            renderRoundTimesUI(minsArr);
        } else {
            renderRoundTimesUI([10, 7, 5]);
        }

        // Config Mappa
        const enableMapVal = data.enableMap !== undefined ? data.enableMap : true;
        createEnableMap.checked = enableMapVal;
        createMapType.value = data.mapType || (data.mapMode === 'text' ? 'vector' : 'photo');
        currentBase64Image = data.mapImage || null;
        uploadStatus.textContent = currentBase64Image ? "Immagine caricata dal template." : "";

        // Config Task
        const enableTasksVal = data.enableTasks !== undefined ? data.enableTasks : true;
        createEnableTasks.checked = enableTasksVal;
        if (createTaskType) createTaskType.value = 'custom';

        textTasksContainer.innerHTML = '';
        const tasksArray = Array.isArray(data.tasks) ? data.tasks : (data.tasks && typeof data.tasks === 'object' ? Object.values(data.tasks) : []);
        tasksArray.forEach(task => addTextTask(task));

        setFormDisabled(isBaseTemplate);
    } else {
        if (createTemplateSubtitle) createTemplateSubtitle.textContent = "Crea un nuovo template personalizzato con le tue impostazioni preferite.";
        btnSaveTemplateOnly.classList.remove('hidden');
        btnSaveStartRoom.classList.remove('hidden');
        btnSaveTemplateOnly.textContent = "SALVA TEMPLATE";
        btnSaveStartRoom.textContent = "SALVA E AVVIA STANZA";
        btnCreateCancelBottom.textContent = "INDIETRO / ANNULLA";

        createTemplateName.value = "";
        createImpostors.value = 1;
        createKillCooldown.value = 120;
        createMaxMeetings.value = 1;
        if (createDiscussionDuration) createDiscussionDuration.value = 0;
        if (createVotingDuration) createVotingDuration.value = 60;
        createScientist.checked = false;
        createMaxPlayers.value = '';
        renderRoundTimesUI([10, 7, 5]);

        createEnableMap.checked = true;
        createMapType.value = 'photo';
        createEnableTasks.checked = true;
        if (createTaskType) createTaskType.value = 'custom';
        currentBase64Image = null;
        uploadStatus.textContent = '';
        textTasksContainer.innerHTML = '';

        setFormDisabled(false);
    }
    
    toggleMapAndTaskUI();
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
            updateMapPreview();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- MAP & TASK TOGGLE LOGIC ---
createEnableMap.addEventListener('change', toggleMapAndTaskUI);
createMapType.addEventListener('change', toggleMapAndTaskUI);
createEnableTasks.addEventListener('change', toggleMapAndTaskUI);
if (createTaskType) createTaskType.addEventListener('change', toggleMapAndTaskUI);

let cachedVectorSVG = null;

async function updateMapPreview() {
    const previewContainer = document.getElementById('map-preview-container');
    const previewContent = document.getElementById('map-preview-content');
    if (!previewContainer || !previewContent) return;

    if (!createEnableMap.checked) {
        previewContainer.classList.add('hidden');
        return;
    }
    previewContainer.classList.remove('hidden');

    if (createMapType.value === 'vector') {
        if (cachedVectorSVG) {
            previewContent.innerHTML = cachedVectorSVG;
            formatPreviewSVG(previewContent);
        } else {
            previewContent.innerHTML = `<span style="font-size: 0.78rem; color: #94a3b8;">Caricamento anteprima vettoriale...</span>`;
            try {
                const res = await fetch('public/assets/MappaOratotorio.svg');
                if (res.ok) {
                    cachedVectorSVG = await res.text();
                    previewContent.innerHTML = cachedVectorSVG;
                    formatPreviewSVG(previewContent);
                } else {
                    previewContent.innerHTML = `<span style="font-size: 0.8rem; color: #38bdf8; font-weight: 700;">🗺️ Mappa Vettoriale Oratorio</span>`;
                }
            } catch (err) {
                previewContent.innerHTML = `<span style="font-size: 0.8rem; color: #38bdf8; font-weight: 700;">🗺️ Mappa Vettoriale Oratorio</span>`;
            }
        }
    } else {
        if (currentBase64Image) {
            previewContent.innerHTML = `<img src="${currentBase64Image}" alt="Anteprima Mappa" style="max-height: 180px; max-width: 100%; border-radius: 8px; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">`;
        } else {
            previewContent.innerHTML = `<div style="color: #64748b; font-size: 0.78rem; padding: 1rem 0;">📷 Nessuna foto caricata.<br>Seleziona un file immagine sopra per vedere l'anteprima.</div>`;
        }
    }
}

function formatPreviewSVG(container) {
    const svgEl = container.querySelector('svg');
    if (svgEl) {
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '180px');
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgEl.style.maxHeight = '180px';
    }
}

function toggleMapAndTaskUI() {
    // MAP
    if (createEnableMap.checked) {
        mapOptionsWrapper.classList.remove('hidden');
        if (createMapType.value === 'photo') {
            mapPhotoConfig.classList.remove('hidden');
        } else {
            mapPhotoConfig.classList.add('hidden');
        }
    } else {
        mapOptionsWrapper.classList.add('hidden');
        mapPhotoConfig.classList.add('hidden');
    }

    updateMapPreview();

    // TASKS
    if (createEnableTasks.checked) {
        taskOptionsWrapper.classList.remove('hidden');
        mapTextConfig.classList.remove('hidden');
    } else {
        taskOptionsWrapper.classList.add('hidden');
        mapTextConfig.classList.add('hidden');
    }
}

// --- DYNAMIC ROUND TIMES UI ---
let currentRoundTimes = [10, 7, 5];

function renderRoundTimesUI(timesArr = [10, 7, 5]) {
    if (!roundTimesContainer) return;
    roundTimesContainer.innerHTML = '';
    currentRoundTimes = timesArr;

    timesArr.forEach((mins, idx) => {
        const isLast = idx === timesArr.length - 1;
        const div = document.createElement('div');
        div.className = 'round-time-row';
        
        const labelText = isLast && idx > 0 ? `Round ${idx + 1}+ (ripete ∞)` : `Round ${idx + 1}`;
        const pillBg = isLast ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)';
        const pillBorder = isLast ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.12)';
        const pillColor = isLast ? '#38bdf8' : '#e2e8f0';
        
        const showRemove = timesArr.length > 1 && !currentFormDisabled;

        div.innerHTML = `
            <div style="width: 155px; flex-shrink: 0; display: flex; align-items: center;">
                <span style="background: ${pillBg}; border: 1px solid ${pillBorder}; color: ${pillColor}; padding: 0.25rem 0.65rem; border-radius: 50px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.3px; display: inline-block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                    ${labelText}
                </span>
            </div>
            <input type="number" class="round-time-input" value="${mins}" min="1" max="120" style="flex: 1;" ${currentFormDisabled ? 'disabled' : ''}>
            <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 700; flex-shrink: 0;">min</span>
            ${showRemove ? `<button type="button" class="btn btn-danger btn-remove-round" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; min-height: 32px; border-radius: 8px; font-weight: 800; flex-shrink: 0;" title="Rimuovi round">✕</button>` : ''}
        `;

        if (showRemove) {
            const removeBtn = div.querySelector('.btn-remove-round');
            if (removeBtn) {
                removeBtn.onclick = () => {
                    if (currentFormDisabled) return;
                    const inputs = roundTimesContainer.querySelectorAll('.round-time-input');
                    const updated = [];
                    inputs.forEach(inp => updated.push(parseInt(inp.value) || 1));
                    updated.splice(idx, 1);
                    renderRoundTimesUI(updated);
                };
            }
        }

        const inputEl = div.querySelector('.round-time-input');
        if (inputEl) {
            const updateVal = (e) => {
                const val = parseInt(e.target.value) || 1;
                currentRoundTimes[idx] = val;
            };
            inputEl.oninput = updateVal;
            inputEl.onchange = updateVal;
        }

        roundTimesContainer.appendChild(div);
    });
}

if (btnAddRoundTime) {
    btnAddRoundTime.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentFormDisabled) return;
        const inputs = roundTimesContainer.querySelectorAll('.round-time-input');
        const updatedTimes = [];
        inputs.forEach(input => {
            const v = parseInt(input.value) || 1;
            updatedTimes.push(v);
        });
        const lastVal = updatedTimes.length > 0 ? updatedTimes[updatedTimes.length - 1] : 5;
        updatedTimes.push(lastVal);
        renderRoundTimesUI(updatedTimes);
    });
}

function buildLocationOptions(selectedPos) {
    let opts = '<option value="">📍 Seleziona luogo...</option>';
    let found = false;
    MAP_VECTOR_LOCATIONS.forEach(loc => {
        const sel = (loc === selectedPos) ? 'selected' : '';
        if (sel) found = true;
        opts += `<option value="${escapeHtml(loc)}" ${sel}>${escapeHtml(loc)}</option>`;
    });
    // If existing pos doesn't match any SVG room, add it as custom
    if (selectedPos && !found) {
        opts += `<option value="${escapeHtml(selectedPos)}" selected>${escapeHtml(selectedPos)}</option>`;
    }
    return opts;
}

function addTextTask(taskData = { num: '', name: '', obj: '', pos: '' }) {
    if (typeof taskData === 'string') {
        taskData = { num: '', name: taskData, obj: '', pos: '' };
    }
    const name = taskData?.name ?? '';
    const obj = taskData?.obj ?? '';
    const pos = taskData?.pos ?? '';

    // Build display text: prefer obj (detailed), fallback to name
    const taskText = obj || name;

    const taskCount = textTasksContainer.querySelectorAll('.task-row-compact').length + 1;
    const div = document.createElement('div');
    div.className = 'task-row-compact';

    div.innerHTML = `
        <span class="task-row-num">${taskCount}</span>
        <input type="text" class="task-input" placeholder="Es. Fai 3 canestri" value="${taskText.replace(/"/g, '&quot;')}" ${currentFormDisabled ? 'disabled' : ''}>
        <select class="task-location-select" ${currentFormDisabled ? 'disabled' : ''}>
            ${buildLocationOptions(pos)}
        </select>
        <button type="button" class="btn-remove-task-compact" title="Rimuovi" ${currentFormDisabled ? 'style="display:none;"' : ''}>✕</button>
    `;

    const removeBtn = div.querySelector('.btn-remove-task-compact');
    if (removeBtn) {
        removeBtn.onclick = () => {
            div.remove();
            renumberTasks();
        };
    }

    textTasksContainer.appendChild(div);
}

function renumberTasks() {
    textTasksContainer.querySelectorAll('.task-row-compact').forEach((row, i) => {
        const numSpan = row.querySelector('.task-row-num');
        if (numSpan) numSpan.textContent = i + 1;
    });
}

if (btnAddTextTask) {
    btnAddTextTask.addEventListener('click', () => {
        addTextTask();
        // Scroll to bottom of container
        textTasksContainer.scrollTop = textTasksContainer.scrollHeight;
    });
}

// --- CREATE & JOIN ROOM ---
function getRoomConfigFromUI() {
    const enableMap = createEnableMap.checked;
    const mapType = createMapType.value;
    
    const enableTasks = createEnableTasks.checked;
    const taskType = 'custom';

    const tasks = [];
    if (enableTasks) {
        const rows = textTasksContainer.querySelectorAll('.task-row-compact');
        rows.forEach((row, idx) => {
            const taskInput = row.querySelector('.task-input');
            const locSelect = row.querySelector('.task-location-select');
            const taskText = taskInput ? taskInput.value.trim() : '';
            const taskPos = locSelect ? locSelect.value : '';
            if (taskText) {
                tasks.push({
                    num: String(idx + 1),
                    name: taskText,
                    obj: taskText,
                    pos: taskPos
                });
            }
        });
    }

    const discDuration = parseInt(createDiscussionDuration ? createDiscussionDuration.value : 0) || 0;
    const votValRaw = createVotingDuration ? createVotingDuration.value.trim() : '60';
    const votDuration = (votValRaw === '' || isNaN(parseInt(votValRaw))) ? 60 : Math.max(0, parseInt(votValRaw));

    const roundInputs = document.querySelectorAll('.round-time-input');
    const roundTimesMins = [];
    roundInputs.forEach(input => {
        const val = parseInt(input.value) || 1;
        roundTimesMins.push(val);
    });
    if (roundTimesMins.length === 0) roundTimesMins.push(5);
    const roundTimesMs = roundTimesMins.map(m => m * 60000);

    const maxVal = createMaxPlayers.value.trim();
    let maxPlayers = (maxVal === '' || isNaN(parseInt(maxVal)) || parseInt(maxVal) <= 0) ? 'unlimited' : parseInt(maxVal);

    // Legacy mapMode compatibility
    const mapMode = !enableMap ? 'disabled' : (mapType === 'vector' ? 'vector' : 'photo');

    return {
        name: createTemplateName.value.trim() || "Template Custom",
        impostorCount: parseInt(createImpostors.value) || 1,
        killCooldown: parseInt(createKillCooldown.value) || 120,
        maxMeetings: parseInt(createMaxMeetings.value) || 1,
        discussionDuration: discDuration,
        votingDuration: votDuration,
        meetingDuration: votDuration,
        roundTimes: roundTimesMs,
        scientistEnabled: createScientist.checked,
        enableMap: enableMap,
        mapType: mapType,
        enableTasks: enableTasks,
        taskType: taskType,
        mapMode: mapMode,
        mapImage: (enableMap && mapType === 'photo') ? currentBase64Image : null,
        tasks: enableTasks ? tasks : null,
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
        userTemplates[templateId] = config;
        renderBaseTemplates();
        await loadUserTemplates(currentUser.uid);
        currentEditId = null;
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
    if (!auth.currentUser) {
        try {
            console.log("[Room] No user, signing in anonymously...");
            await signInAnonymously(auth);
            console.log("[Room] Sign-in successful, uid:", auth.currentUser?.uid);
        } catch (e) {
            console.error("[Room] Auto sign-in failed:", e);
        }
    } else {
        console.log("[Room] Already authenticated as:", auth.currentUser.uid);
    }

    const imageToSave = config.mapImage;
    const roomConfig = { ...config };
    delete roomConfig.mapImage;
    delete roomConfig.name;

    const roomCode = generateRoomCode();
    
    const uid = auth.currentUser ? auth.currentUser.uid : 'unknown';
    console.log("[Room] Creating room with creatorId:", uid, "roomCode:", roomCode);

    const roomData = {
        creatorId: uid,
        createdAt: Date.now(),
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
        console.log("[Room] Room created successfully!");
        if (imageToSave) {
            await set(ref(db, `rooms/${roomCode}/mapImage`), imageToSave);
        }
        window.location.href = `master?room=${roomCode}`;
    } catch (error) {
        console.error("[Room] Write error:", error);
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

        // 24-hour expiration check
        const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
        if (roomData.createdAt && (Date.now() - roomData.createdAt > ROOM_MAX_AGE_MS)) {
            try {
                await remove(ref(db, `rooms/${code}`));
                await remove(ref(db, `images/${code}`));
            } catch (e) {
                console.warn("Could not delete expired room:", e);
            }
            return alert("Questa stanza è scaduta (superati 1 giorno di durata) ed è stata eliminata.");
        }

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

        window.location.href = `giocatore?room=${code}&player=${encodeURIComponent(name)}`;
    } catch (error) {
        alert("Errore di connessione: " + error.message);
    }
});
