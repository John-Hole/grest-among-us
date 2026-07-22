// JS module for Mappa Oratorio preview

document.addEventListener('DOMContentLoaded', () => {
    initDemoQRCode();
    initDemoTasks();
    initDemoPlayers();
    loadAndInitSVGMap();
});

// 1. QR Code initialization
function initDemoQRCode() {
    const qrContainer = document.getElementById('qrcode');
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: window.location.origin + "/giocatore.html?room=ORATORIO",
            width: 140,
            height: 140,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }
}

// 2. Demo Tasks List
const DEMO_TASKS = [
    { title: "Pulire la Cassa", room: "Salone", icon: "🧹", status: "completed" },
    { title: "Sistemare Cavi Audio", room: "Regia", icon: "🔌", status: "pending" },
    { title: "Accendere il Proiettore", room: "Teatro", icon: "🎬", status: "pending" },
    { title: "Lavare i Piatti", room: "Cucina", icon: "🍽️", status: "completed" },
    { title: "Controllo Caldaia", room: "Caldaia", icon: "🔥", status: "pending" },
    { title: "Riordinare Strumenti", room: "Musica", icon: "🎸", status: "completed" },
    { title: "Contare i Palloni", room: "Sala Materiali", icon: "⚽", status: "pending" },
    { title: "Pulizia Tavoli", room: "Mensa (Ex Biblioteca)", icon: "🧹", status: "completed" },
    { title: "Verifica Luci", room: "Palco", icon: "💡", status: "pending" }
];

function initDemoTasks() {
    const listEl = document.getElementById('left-tasks-list');
    if (!listEl) return;
    
    listEl.innerHTML = DEMO_TASKS.map(t => `
        <li class="schermo-task-item ${t.status}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin-bottom: 6px; background: rgba(30, 41, 59, 0.6); border-radius: 8px; border-left: 4px solid ${t.status === 'completed' ? '#00e676' : '#ffab00'};">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.1rem;">${t.icon}</span>
                <div>
                    <div style="font-weight: bold; font-size: 0.85rem; color: #fff;">${t.title}</div>
                    <div style="font-size: 0.75rem; color: var(--accent-cyan, #00f2fe);">${t.room}</div>
                </div>
            </div>
            <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: ${t.status === 'completed' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 171, 0, 0.2)'}; color: ${t.status === 'completed' ? '#00e676' : '#ffab00'};">
                ${t.status === 'completed' ? 'Fatto' : 'In Corso'}
            </span>
        </li>
    `).join('');
}

// 3. Demo Players Grid
const DEMO_PLAYERS = [
    { name: "Marco", color: "#ef4444", status: "alive" },
    { name: "Giulia", color: "#06b6d4", status: "alive" },
    { name: "Luca", color: "#eab308", status: "alive" },
    { name: "Sofia", color: "#22c55e", status: "alive" },
    { name: "Andrea", color: "#ec4899", status: "alive" },
    { name: "Elena", color: "#f97316", status: "alive" },
    { name: "Matteo", color: "#8b5cf6", status: "dead" },
    { name: "Chiara", color: "#64748b", status: "alive" }
];

function initDemoPlayers() {
    const container = document.getElementById('players-list-container');
    if (!container) return;
    
    container.innerHTML = DEMO_PLAYERS.map(p => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(30, 41, 59, 0.7); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); ${p.status === 'dead' ? 'opacity: 0.5;' : ''}">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${p.color}; border: 2px solid #fff; box-shadow: 0 0 8px ${p.color}; flex-shrink: 0;"></div>
            <div style="flex: 1; font-weight: bold; font-size: 0.85rem; color: #fff; text-decoration: ${p.status === 'dead' ? 'line-through' : 'none'};">
                ${p.name}
            </div>
            <span style="font-size: 0.7rem; color: ${p.status === 'alive' ? '#00e676' : '#ef4444'};">
                ${p.status === 'alive' ? 'Vivo' : 'Eliminato'}
            </span>
        </div>
    `).join('');
}

// 4. Load SVG Map & Enable Hover Border Highlight
let currentScale = 1;

async function loadAndInitSVGMap() {
    const mapContainer = document.getElementById('svg-map-container');
    if (!mapContainer) return;

    try {
        const response = await fetch('public/assets/MappaOratotorio.svg');
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const svgText = await response.text();
        
        mapContainer.innerHTML = svgText;
        
        const svgEl = mapContainer.querySelector('svg');
        if (svgEl) {
            svgEl.setAttribute('width', '100%');
            svgEl.setAttribute('height', '100%');
            svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            
            attachSVGInteractivity(svgEl);
            setupZoomControls(svgEl);
        }
    } catch (err) {
        console.error("Errore nel caricamento del file SVG:", err);
        mapContainer.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Impossibile caricare il file SVG public/assets/MappaOratotorio.svg<br>Dettagli: ${err.message}</div>`;
    }
}

function attachSVGInteractivity(svgEl) {
    const tooltip = document.getElementById('room-tooltip');
    const roomPaths = svgEl.querySelectorAll('path[id]');

    roomPaths.forEach(path => {
        const roomId = path.getAttribute('id') || '';
        if (!roomId) return;

        path.addEventListener('mouseenter', (e) => {
            if (tooltip) {
                tooltip.textContent = `📍 ${roomId}`;
                tooltip.style.display = 'block';
            }
        });

        path.addEventListener('mousemove', (e) => {
            if (tooltip) {
                tooltip.style.left = e.clientX + 'px';
                tooltip.style.top = e.clientY + 'px';
            }
        });

        path.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.style.display = 'none';
        });
    });
}

// 5. Zoom & Label Controls
function setupZoomControls(svgEl) {
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    const btnToggleLabels = document.getElementById('btn-toggle-labels');

    function applyZoom() {
        svgEl.style.transform = `scale(${currentScale})`;
    }

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            currentScale = Math.min(3, currentScale + 0.25);
            applyZoom();
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            currentScale = Math.max(0.5, currentScale - 0.25);
            applyZoom();
        });
    }

    if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
            currentScale = 1;
            applyZoom();
        });
    }

    // Toggle Labels Layer
    let labelsVisible = true;
    if (btnToggleLabels) {
        btnToggleLabels.addEventListener('click', () => {
            labelsVisible = !labelsVisible;
            btnToggleLabels.classList.toggle('active', labelsVisible);
            const labelsLayer = svgEl.querySelector('g[inkscape\\:label="Etichette"]') || svgEl.querySelector('#layer1');
            if (labelsLayer) {
                labelsLayer.style.display = labelsVisible ? 'inline' : 'none';
            }
        });
    }
}
