document.addEventListener('DOMContentLoaded', () => {
    const navHTML = `
        <div id="hamburger-btn" class="hamburger-btn">☰</div>
        <div id="side-nav" class="side-nav">
            <button id="nav-close" class="nav-close">✖</button>
            <h2 style="font-size: 1.2rem; color: var(--accent-cyan); margin-bottom: 0;">Menu</h2>
            <hr style="border-color: #333; margin-bottom: 1rem;">
            <a href="#" id="nav-home">Homepage</a>
            <a href="#" id="nav-teatro">Maxischermo</a>
            <a href="#" id="nav-account">Account (Template)</a>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', navHTML);

    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sideNav = document.getElementById('side-nav');
    const navClose = document.getElementById('nav-close');
    const navHome = document.getElementById('nav-home');
    const navTeatro = document.getElementById('nav-teatro');
    const navAccount = document.getElementById('nav-account');

    function toggleNav() {
        sideNav.classList.toggle('open');
    }

    hamburgerBtn.addEventListener('click', toggleNav);
    navClose.addEventListener('click', toggleNav);

    const isMaster = window.location.pathname.includes('master.html');
    const isAnimatore = window.location.pathname.includes('animatore.html');
    const isTeatro = window.location.pathname.includes('teatro.html');
    const inGame = isMaster || isAnimatore || (isTeatro && new URLSearchParams(window.location.search).get('room'));

    function handleNavigate(targetUrl) {
        if (inGame) {
            if (confirm("Stai per abbandonare la partita. Vuoi continuare?")) {
                window.location.href = targetUrl;
            }
        } else {
            window.location.href = targetUrl;
        }
    }

    navHome.addEventListener('click', (e) => {
        e.preventDefault();
        handleNavigate('index.html');
    });
    
    navTeatro.addEventListener('click', (e) => {
        e.preventDefault();
        const code = prompt("Inserisci il codice stanza per il Maxischermo:");
        if (code) {
            handleNavigate(`teatro.html?room=${code.trim().toUpperCase()}`);
        }
    });

    navAccount.addEventListener('click', (e) => {
        e.preventDefault();
        handleNavigate('index.html?go=account');
    });
});
