export const PLAYERS_LIST = [
    "Paolo", "Sebastian", "Gioele", "Serena", "Chloe", 
    "Margherita", "Ludovica", "Leonardo (Toniol)", "Christ", 
    "Leonardo Caprai", "Diego", "Alessandro", "Cardoni", 
    "Pio", "Nicolas", "Eleonora", "Luca"
];

export const IMPOSTORS_LIST = ["Ludovica", "Paolo", "Cardoni"];
export const SCIENTIST_LIST = ["Diego"];

export const TASKS_LIST = [
    "1. Canestri: 3 canestri da tiro libero (canestro oratorio)",
    "2. Trova l'oggetto: trova 10 oggetti dentro la scatola piena di acqua sporca (panchine rosse)",
    "3. Rebus: risolvi 2 fogli di rebus (atrio)",
    "4. Puzzle: componi un puzzle (atrio)",
    "5. Pulisci il bagno: 1 minuto per pulire tutto il bagno dalla tempera con la spugnetta (bagno donne)",
    "6. Matematica: risolvi 10 operazioni in 1 minuto e mezzo (ex biblioteca)",
    "7. Limbo: supera 3 livelli (ex biblioteca)",
    "8. Avanti un'altro: rispondi a 15 domande (salone)",
    "9. C'entra il bicchiere: fai c'entro con i pennarelli nel bicchiere in un minuto e mezzo (salone)",
    "10. Percorso bendato: l'animatore dà le indicazioni al bambino per fare il percorso (strada di fianco oratorio)",
    "11. Riempi il bicchiere: con un bicchiere da shottino pieno corri per riempire un bicchiere grande, avanti e dietro fino a quando non sarà pieno (strada di fianco oratorio)",
    "12. Ricorda la sequenza: ripeti la sequenza 1 volta (teatro)",
    "13. Attacca le orecchie al bianconiglio: 1 minuto per attaccare bendati le orecchie al bianconiglio con 3 tentativi, al terzo possono essere guidati a voce dall'animatore (teatro)",
    "14. Twister: resisti un minuto e mezzo cambiando posizione (teatro)",
    "15. Dinosauro: pesca un bigliettino dove c'è scritto il punteggio da raggiungere e poi giocare fino a quando non ci arriva (regia)",
    "16. Whisper challenge: indovina 5 frasi (corridoio catechismo)",
    "17. Cruciverba: risolvi un cruciverba (stanza verde catechismo)"
];

export const ROUND_TIMES = [
    10 * 60 * 1000, // Round 1: 10 mins
    7 * 60 * 1000,  // Round 2: 7 mins
    5 * 60 * 1000   // Round 3+: 5 mins
];

// Utility function to get 8 random tasks
export function getRandomTasks() {
    const shuffled = [...TASKS_LIST].sort(() => 0.5 - Math.random());
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
