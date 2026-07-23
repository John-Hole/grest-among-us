// Liste giocatori rimosse (gestite dinamicamente dal Realtime Database)
export const TASKS_LIST = [
    "1. 3 canestri da tiro libero | Canestro",
    "2. Trova 10 oggetti dentro la scatola piena di acqua sporca | Atrio",
    "3. Risolvi 2 fogli di rebus | Atrio",
    "4. Componi un puzzle | Atrio",
    "5. 1 minuto per pulire tutto il bagno dalla tempera con la spugnetta | Bagno Disabili",
    "6. Risolvi 10 operazioni in 1 minuto e mezzo | Sala Materiali",
    "7. Supera 3 livelli di limbo | Sala Materiali",
    "8. Rispondi a 15 domande | Salone",
    "9. Fai centro con i pennarelli nel bicchiere in 1.5 min | Salone",
    "10. Un compagno dà le indicazioni al giocatore bendato | Strada Laterale",
    "11. Con uno shottino pieno corri a riempire un bicchiere grande | Strada Laterale",
    "12. Ripeti la sequenza 1 volta | Sala Gialla",
    "13. 1 minuto per attaccare bendati le orecchie al bianconiglio | Sala Gialla",
    "14. Resisti 1.5 min cambiando posizione | Sala Gialla",
    "15. Pesca bigliettino col punteggio e gioca fino al target | Regia",
    "16. Indovina 5 frasi | Corridoio Salone",
    "17. Risolvi un cruciverba | Sala Verde"
];

export const ROUND_TIMES = [
    10 * 60 * 1000, // Round 1: 10 mins
    7 * 60 * 1000,  // Round 2: 7 mins
    5 * 60 * 1000   // Round 3+: 5 mins
];

// Utility function to get 8 random tasks
export function getRandomTasks(customList = null) {
    const sourceList = customList && customList.length > 0 ? customList : TASKS_LIST;
    const shuffled = [...sourceList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 8);
}

// Format time from ms to MM:SS
export function formatTime(ms) {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Escape HTML utility function to prevent XSS
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

