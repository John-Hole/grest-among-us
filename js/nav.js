(function() {
    const isMaster = window.location.pathname.includes('master.html');
    const isGiocatore = window.location.pathname.includes('giocatore.html');
    const isSchermo = window.location.pathname.includes('schermo.html');
    const isIndex = !isMaster && !isGiocatore && !isSchermo;
    
    let rightSideHTML = '';
    if (isIndex) {
        rightSideHTML = `<button id="btn-show-auth" class="btn btn-sm" style="background: #3f51b5; padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 50px;">ACCEDI / REGISTRATI</button>`;
    } else if (isMaster || isGiocatore || isSchermo) {
        rightSideHTML = `<button onclick="if(confirm('Vuoi uscire dalla schermata generale?')) window.location.href='index.html'" class="btn btn-danger btn-sm" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 50px;">ESCI</button>`;
    }

    const navHTML = `
        <div class="top-navbar ${isSchermo ? 'autohide' : ''}">
            <div id="hamburger-btn" class="hamburger-btn">☰</div>
            <div class="navbar-title glitch-text" style="font-size: 1.2rem; margin: 0; text-shadow: 1px 1px var(--accent-red), -1px -1px var(--accent-blue);">REALMONG US</div>
            <div class="navbar-right">
                ${rightSideHTML}
            </div>
        </div>
        <div id="side-nav" class="side-nav">
            <a href="#" id="nav-home">Homepage</a>
            <a href="#" id="nav-schermo">Schermata generale</a>
            <a href="#" id="nav-account">Account (Template)</a>
            <div style="flex-grow: 1;"></div>
            <div id="nav-auth-status" style="font-size: 0.8rem; color: #ccc; margin-bottom: 10px;">Non loggato</div>
            <button id="nav-btn-logout" class="btn btn-danger hidden" style="padding: 10px; font-size: 0.8rem; border-radius: 50px;">LOGOUT ACCOUNT</button>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    if (isSchermo) {
        document.body.style.paddingTop = '0px';
    }

    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sideNav = document.getElementById('side-nav');
    const navHome = document.getElementById('nav-home');
    const navSchermo = document.getElementById('nav-schermo');
    const navAccount = document.getElementById('nav-account');

    function toggleNav() {
        sideNav.classList.toggle('open');
    }

    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNav();
    });

    document.addEventListener('click', (e) => {
        if (sideNav.classList.contains('open') && !sideNav.contains(e.target)) {
            toggleNav();
        }
    });

    const inGame = isMaster || isGiocatore || (isSchermo && new URLSearchParams(window.location.search).get('room'));

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
    
    if (navSchermo) {
        navSchermo.addEventListener('click', (e) => {
            e.preventDefault();
            handleNavigate('schermo.html');
        });
    }

    navAccount.addEventListener('click', (e) => {
        e.preventDefault();
        handleNavigate('index.html?go=account');
    });
})();
