(function() {
    const isMaster = window.location.pathname.includes('master');
    const isGiocatore = window.location.pathname.includes('giocatore');
    const isSchermo = window.location.pathname.includes('schermo');
    const isScienziato = window.location.pathname.includes('scienziato');
    const isIndex = !isMaster && !isGiocatore && !isSchermo && !isScienziato;
    
    let cachedUser = null;
    try {
        const rawCache = localStorage.getItem('realmong_user_cache');
        if (rawCache) {
            const parsed = JSON.parse(rawCache);
            if (parsed && parsed.expiresAt && Date.now() > parsed.expiresAt) {
                localStorage.removeItem('realmong_user_cache');
            } else {
                cachedUser = parsed;
            }
        }
    } catch (e) {}

    const isUserLoggedIn = !!(cachedUser && cachedUser.uid);
    const userEmailText = isUserLoggedIn ? (cachedUser.email || cachedUser.displayName || 'Utente') : '';
    const authStatusText = isUserLoggedIn ? `Loggato come: ${cachedUser.displayName || 'Utente'}` : 'Non loggato';
    const logoutBtnClass = isUserLoggedIn ? 'btn btn-danger' : 'btn btn-danger hidden';

    let rightSideHTML = '';
    if (isIndex) {
        rightSideHTML = `
            <div id="nav-user-info" class="nav-user-dropdown-container" style="display: ${isUserLoggedIn ? 'flex' : 'none'};">
                <button id="nav-btn-logout-top" class="nav-user-email-btn" title="Clicca per uscire dall'account">
                    <span class="user-email-default">
                        <span class="user-email-icon">📧</span>
                        <span id="nav-user-email" class="user-email-text">${userEmailText}</span>
                    </span>
                    <span class="user-email-hover">
                        <span class="logout-icon">🚪</span>
                        <span class="logout-text">ESCI</span>
                    </span>
                </button>
            </div>
            <button id="btn-show-auth" class="btn btn-sm btn-nav-auth" style="display: ${isUserLoggedIn ? 'none' : 'inline-block'};"><span class="auth-text-desktop">ACCEDI / REGISTRATI</span><span class="auth-text-mobile">ACCEDI<br>REGISTRATI</span></button>
        `;
    } else if (isMaster || isGiocatore || isSchermo || isScienziato) {
        rightSideHTML = `<button onclick="if(confirm('Vuoi uscire dalla schermata generale?')) window.location.href='/'" class="btn btn-danger btn-sm" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 50px;">ESCI</button>`;
    }

    const navHTML = `
        <div class="top-navbar ${isSchermo ? 'autohide' : ''}">
            <button id="hamburger-btn" class="hamburger-btn" aria-label="Menu navigazione">
                <span class="hamburger-icon">☰</span>
            </button>
            <div class="navbar-title glitch-text">REALMONG US</div>
            <div class="navbar-right">
                ${rightSideHTML}
            </div>
        </div>
        <div id="side-nav-overlay" class="side-nav-overlay"></div>
        <div id="side-nav" class="side-nav">
            <div class="side-nav-header">
                <div class="side-nav-brand">
                    <span class="side-nav-title glitch-text">REALMONG US</span>
                </div>
                <button id="side-nav-close" class="side-nav-close" aria-label="Chiudi menu">✕</button>
            </div>
            
            <div class="side-nav-links">
                <a href="#" id="nav-home" class="side-nav-link ${isIndex ? 'active' : ''}">
                    <span class="nav-icon">🏠</span>
                    <span class="nav-text">Homepage</span>
                </a>
                <a href="#" id="nav-schermo" class="side-nav-link ${isSchermo ? 'active' : ''}">
                    <span class="nav-icon">📺</span>
                    <span class="nav-text">Schermata generale</span>
                </a>
                <a href="#" id="nav-account" class="side-nav-link">
                    <span class="nav-icon">⚙️</span>
                    <span class="nav-text">Account (Template)</span>
                </a>
            </div>

            <div class="side-nav-footer">
                ${isUserLoggedIn ? `
                    <div class="side-nav-user-label" style="font-size: 0.65rem; color: #64748b; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 0.3rem;">ACCOUNT COLLEGATO</div>
                    <button id="nav-btn-logout-side" class="nav-user-email-btn" title="Clicca per uscire dall'account">
                        <span class="user-email-default">
                            <span class="user-email-icon">📧</span>
                            <span class="user-email-text">${userEmailText}</span>
                        </span>
                        <span class="user-email-hover">
                            <span class="logout-icon">🚪</span>
                            <span class="logout-text">ESCI DALL'ACCOUNT</span>
                        </span>
                    </button>
                ` : `
                    <button id="btn-side-auth" class="btn btn-primary" style="width: 100%; border-radius: 50px; font-weight: 800; padding: 0.75rem; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; border: none;">
                        ACCEDI / REGISTRATI
                    </button>
                `}
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    if (isSchermo) {
        document.body.style.paddingTop = '0px';
    }

    const hamburgerBtn = document.getElementById('hamburger-btn');
    const sideNav = document.getElementById('side-nav');
    const sideNavOverlay = document.getElementById('side-nav-overlay');
    const sideNavClose = document.getElementById('side-nav-close');
    const navHome = document.getElementById('nav-home');
    const navSchermo = document.getElementById('nav-schermo');
    const navAccount = document.getElementById('nav-account');

    function openNav() {
        sideNav.classList.add('open');
        sideNavOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeNav() {
        sideNav.classList.remove('open');
        sideNavOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function toggleNav() {
        if (sideNav.classList.contains('open')) {
            closeNav();
        } else {
            openNav();
        }
    }

    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNav();
    });

    if (sideNavClose) {
        sideNavClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closeNav();
        });
    }

    if (sideNavOverlay) {
        sideNavOverlay.addEventListener('click', () => {
            closeNav();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sideNav.classList.contains('open')) {
            closeNav();
        }
    });

    function performLogout() {
        try {
            localStorage.removeItem('realmong_user_cache');
            localStorage.removeItem('playerSession');
            sessionStorage.removeItem('playerSession');
        } catch(e) {}
        if (window.authService) {
            window.authService.logout().then(() => window.location.href = '/').catch(() => window.location.href = '/');
        } else {
            window.location.href = '/';
        }
    }

    document.querySelectorAll('#nav-btn-logout-top, #nav-btn-logout-side, #nav-btn-logout').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Vuoi davvero effettuare il logout dall'account?")) {
                performLogout();
            }
        });
    });

    const btnSideAuth = document.getElementById('btn-side-auth');
    if (btnSideAuth) {
        btnSideAuth.addEventListener('click', () => {
            closeNav();
            if (typeof window.showSection === 'function') {
                window.showSection('auth');
            } else {
                window.location.href = '/?go=auth';
            }
        });
    }

    const inGame = isMaster || isGiocatore || isScienziato || (isSchermo && new URLSearchParams(window.location.search).get('room'));

    function handleNavigate(targetUrl) {
        closeNav();
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
        handleNavigate('/');
    });
    
    if (navSchermo) {
        navSchermo.addEventListener('click', (e) => {
            e.preventDefault();
            handleNavigate('schermo');
        });
    }

    navAccount.addEventListener('click', (e) => {
        e.preventDefault();
        handleNavigate('/?go=account');
    });
})();
