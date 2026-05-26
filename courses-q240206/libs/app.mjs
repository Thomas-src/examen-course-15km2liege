import { Storage } from './storage.mjs';
import { Classement } from './classement.mjs';

const API_COURSES = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/courses.php';
const API_TEMPS   = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/temps.php';

class App {
    constructor() {
        this.storage    = new Storage();
        this.classement = new Classement();
        this.courses    = [];
        this._listenersInit = false;
    }

    async initializeApp() {
        this.showLoading();

        const localCourses = this.storage.loadCourses?.();

        if (localCourses) {
            this.courses = localCourses;
            this.render();
            this.hideLoading();
        }

        try {
            const courses = await this.fetchCourses();
            this.courses = courses;
            this.storage.saveCourses(courses);
            this.render();
            this.hideLoading();
            console.log("Courses chargées et sauvegardées localement.");
        } catch (error) {
            console.error("Erreur lors du chargement des courses :", error);
            if (!localCourses) {
                document.querySelector('#loading-title').textContent =
                    "Impossible de charger les courses.";
            }
        }

        if (!this._listenersInit) {
            this.initNavigation();
            this.initVagueButtons();
            this.initReset();
            this.initSearch();
            this._listenersInit = true;
        }
    }

    async fetchCourses() {
        const response = await fetch(API_COURSES, {
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        return await response.json();
    }

    showLoading() {
        const overlay = document.querySelector('#loading-overlay');
        const title   = document.querySelector('#loading-title');
        title.textContent = "Chargement des courses…";
        overlay.hidden = false;
    }

    hideLoading() {
        document.querySelector('#loading-overlay').hidden = true;
    }

    // ─────────────────────────────────────────────────────────
    // Navigation
    // ─────────────────────────────────────────────────────────

    initNavigation() {
        document.querySelectorAll('[data-screen]').forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                const screen = link.dataset.screen;

                document.querySelectorAll('main.screen').forEach(main => {
                    main.hidden = true;
                    main.classList.remove('screen--active');
                });

                const target = document.querySelector(`#screen-${screen}`);
                target.hidden = false;
                target.classList.add('screen--active');

                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('nav-link--active'));
                const navLink = document.querySelector(`.nav-link[data-screen="${screen}"]`);
                if (navLink) navLink.classList.add('nav-link--active');
            });
        });
    }

    // ─────────────────────────────────────────────────────────
    // Rendu
    // ─────────────────────────────────────────────────────────

    render() {
        this.updateHomeCards();
        this.renderClassements();
    }

    updateHomeCards() {
        this.courses.forEach(course => {
            const card = document.querySelector(`.course-card[data-course="${course.nom}"]`);
            if (!card) return;

            const coureurs    = course.vagues.flatMap(v => v.coureurs);
            const total       = coureurs.length;
            const avecResultat = coureurs.filter(c => c.temps || c.abandon).length;
            const pourcentage = total === 0 ? 0 : Math.round((avecResultat / total) * 100);

            card.querySelector('.progress-bar__fill').style.width = `${pourcentage}%`;
            card.querySelector('.progress-label').textContent =
                `${avecResultat} / ${total} coureurs avec résultat`;
        });
    }

    // ─────────────────────────────────────────────────────────
    // US3 : Classements
    // ─────────────────────────────────────────────────────────

    renderClassements() {
        this.courses.forEach(course => {
            this.renderClassementIndividuel(course);
            this.renderClassementEquipes(course);
            this.renderMessagesClôture(course);
        });
    }

    renderClassementIndividuel(course) {
        const tbody = document.getElementById(`tbody-${course.nom}`);
        if (!tbody) return;

        const coureurs = course.vagues.flatMap(v => v.coureurs);

        const finish  = coureurs.filter(c => this.classement.statutCoureur(c) === 'finish')
            .sort((a, b) => this.classement.tempsEnSecondes(a.temps) - this.classement.tempsEnSecondes(b.temps));
        const enCours = coureurs.filter(c => this.classement.statutCoureur(c) === 'en-cours');
        const abandon = coureurs.filter(c => this.classement.statutCoureur(c) === 'abandon');

        const ordonnes = [...finish, ...enCours, ...abandon];

        // Rangs par catégorie (Finish uniquement)
        const rangParCategorie = {};
        finish.forEach(c => {
            rangParCategorie[c.categorie] = (rangParCategorie[c.categorie] || 0) + 1;
            c._rangCat    = rangParCategorie[c.categorie];
        });

        // Rang global : calculé sur le tableau finish, pas sur idx de ordonnes
        finish.forEach((c, i) => { c._rangGlobal = i + 1; });

        const fragment = document.createDocumentFragment();

        ordonnes.forEach(coureur => {
            const statut = this.classement.statutCoureur(coureur);
            const posGlobal  = statut === 'finish' ? coureur._rangGlobal : '—';
            const rangCat    = statut === 'finish' ? coureur._rangCat    : '—';
            const tempsAff   = statut === 'finish' ? coureur.temps       : '—';
            const statutLabel = statut === 'finish'   ? 'Finish'
                : statut === 'en-cours' ? 'En cours'
                    :                        'Abandon';

            const tr = document.createElement('tr');
            tr.className        = `coureur-row ${statut}`;
            tr.dataset.dossard  = coureur.dossard;

            tr.innerHTML = `
                <td class="coureur-pos">${posGlobal}</td>
                <td class="coureur-dossard">${coureur.dossard}</td>
                <td class="coureur-nom">${coureur.nom ?? ''}</td>
                <td class="coureur-equipe">${coureur.club ?? ''}</td>
                <td class="coureur-controle ${statut}">${statutLabel}</td>
                <td class="coureur-temps">${tempsAff}</td>
                <td class="coureur-rang-cat">${rangCat}</td>
                <td class="coureur-categorie">${coureur.categorie ?? ''}</td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        this.updateSearchCount(course.nom, ordonnes.length);
    }

    renderClassementEquipes(course) {
        const tbody = document.getElementById(`tbody-equipes-${course.nom}`);
        if (!tbody) return;

        const coureurs       = course.vagues.flatMap(v => v.coureurs);
        const equipesValides = this.classement.calculerClassementEquipes(coureurs);

        const fragment = document.createDocumentFragment();

        equipesValides.forEach((equipe, idx) => {
            const nomsCoureursFinish = equipe.membres
                .sort((a, b) => this.classement.tempsEnSecondes(a.temps) - this.classement.tempsEnSecondes(b.temps))
                .map(c => c.nom ?? '')
                .join(', ');

            const tr = document.createElement('tr');
            tr.className   = 'equipe-row';
            tr.dataset.club = equipe.club;

            tr.innerHTML = `
                <td class="equipe-rang">${idx + 1}</td>
                <td class="equipe-club">${equipe.club}</td>
                <td class="equipe-coureurs">${nomsCoureursFinish}</td>
                <td class="equipe-score">${equipe.scoreMoyen}</td>
            `;
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }

    renderMessagesClôture(course) {
        const conteneur = document.getElementById(`clotures-${course.nom}`);
        if (!conteneur) return;

        const coureurs = course.vagues.flatMap(v => v.coureurs);
        const total    = coureurs.length;
        if (total === 0) return;

        const termines = coureurs.filter(c => c.temps || c.abandon);

        // Clôture de course
        if (termines.length === total) {
            const msgId = `cloture-course-${course.nom}`;
            if (!conteneur.querySelector(`[data-msg="${msgId}"]`)) {
                const nbFinish  = coureurs.filter(c => c.temps && !c.abandon).length;
                const nbAbandon = coureurs.filter(c => c.abandon).length;

                const article = document.createElement('article');
                article.className    = 'cloture-msg cloture-msg--course';
                article.dataset.msg  = msgId;
                article.innerHTML    = `🏁 Course <strong>${course.nom}</strong> terminée — <strong>${nbFinish}</strong> coureur${nbFinish > 1 ? 's' : ''} classé${nbFinish > 1 ? 's' : ''}, <strong>${nbAbandon}</strong> abandon${nbAbandon > 1 ? 's' : ''}`;
                conteneur.appendChild(article);
            }
        }

        // Clôture par équipe
        const clubs = {};
        coureurs.forEach(c => {
            const club = c.club ?? 'Sans club';
            if (!clubs[club]) clubs[club] = [];
            clubs[club].push(c);
        });

        Object.entries(clubs).forEach(([club, membres]) => {
            const tousTermines = membres.every(c => c.temps || c.abandon);
            if (!tousTermines) return;

            const finish = membres.filter(c => c.temps && !c.abandon);
            if (finish.length < 2) return;

            if (conteneur.querySelector(`[data-club="${club}"]`)) return; // doublon

            const totalSec   = finish.reduce((acc, c) => acc + this.classement.tempsEnSecondes(c.temps), 0);
            const moyenneSec = Math.round(totalSec / finish.length);

            const article = document.createElement('article');
            article.className    = 'cloture-msg cloture-msg--equipe';
            article.dataset.club = club;
            article.dataset.msg  = `cloture-equipe-${course.nom}-${club}`;
            article.innerHTML    = `🏆 Classement équipe <strong>${club}</strong> définitif pour le ${course.nom} — Score moyen : <strong>${this.classement.secondesEnTemps(moyenneSec)}</strong>`;
            conteneur.appendChild(article);
        });
    }

    // ─────────────────────────────────────────────────────────
    // Recherche
    // ─────────────────────────────────────────────────────────

    initSearch() {
        ['7km', '15km'].forEach(nom => {
            const input = document.getElementById(`search-${nom}`);
            if (!input) return;
            input.addEventListener('input', () => {
                this.applyFilter(nom, input.value.trim().toLowerCase());
            });
        });
    }

    applyFilter(courseNom, query) {
        const tbody = document.getElementById(`tbody-${courseNom}`);
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr.coureur-row');
        let visible = 0;
        const total = rows.length;

        rows.forEach(row => {
            if (!query) { row.hidden = false; visible++; return; }

            const nom       = (row.querySelector('.coureur-nom')?.textContent       ?? '').toLowerCase();
            const equipe    = (row.querySelector('.coureur-equipe')?.textContent    ?? '').toLowerCase();
            const categorie = (row.querySelector('.coureur-categorie')?.textContent ?? '').toLowerCase();

            const match = nom.includes(query) || equipe.includes(query) || categorie.includes(query);
            row.hidden = !match;
            if (match) visible++;
        });

        this.updateSearchCount(courseNom, total, query ? visible : null);
    }

    updateSearchCount(courseNom, total, filtered = null) {
        const screen = document.getElementById(`screen-${courseNom}`);
        if (!screen) return;
        const span = screen.querySelector('.search-count');
        if (!span) return;
        span.textContent = filtered !== null
            ? `${filtered} / ${total} coureurs`
            : `${total} coureurs`;
    }

    // ─────────────────────────────────────────────────────────
    // Vagues
    // ─────────────────────────────────────────────────────────

    initVagueButtons() {
        document.querySelectorAll('.btn--vague').forEach(button => {
            button.addEventListener('click', () => {
                this.lancerVague(button.dataset.course, Number(button.dataset.vague));
            });
        });
        this.updateVagueButtons();
    }

    async lancerVague(courseNom, vagueId) {
        const course = this.courses.find(c => c.nom === courseNom);
        if (!course) return;
        const vague = course.vagues.find(v => v.vid === vagueId);
        if (!vague) return;

        const button = document.querySelector(
            `.btn--vague[data-course="${courseNom}"][data-vague="${vagueId}"]`
        );
        button.classList.remove('btn--vague-active');
        button.classList.add('running');
        button.disabled = true;

        this.activateNextVague(courseNom, vagueId);

        const promises = vague.coureurs.map(coureur =>
            this.fetchTemps(coureur.dossard)
                .then(resultat => {
                    this.applyResult(courseNom, vagueId, resultat);
                    this.storage.saveCourses(this.courses);
                    this.render();
                })
                .catch(error => console.error(`Erreur dossard ${coureur.dossard}`, error))
        );

        await Promise.all(promises);

        button.classList.remove('running');
        button.classList.add('done');
        button.disabled = true;

        this.storage.saveCourses(this.courses);
        this.render();
    }

    async fetchTemps(dossard) {
        const response = await fetch(`${API_TEMPS}?dossard=${dossard}`);
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        return await response.json();
    }

    applyResult(courseNom, vagueId, resultat) {
        const course  = this.courses.find(c => c.nom === courseNom);
        const vague   = course.vagues.find(v => v.vid === vagueId);
        const coureur = vague.coureurs.find(c => c.dossard === resultat.dossard);
        if (!coureur) return;

        if (resultat.abandon) {
            coureur.abandon = true;
            delete coureur.temps;
        } else {
            coureur.temps   = resultat.temps;
            coureur.abandon = false;
        }
    }

    activateNextVague(courseNom, vagueId) {
        const course    = this.courses.find(c => c.nom === courseNom);
        const index     = course.vagues.findIndex(v => v.vid === vagueId);
        const nextVague = course.vagues[index + 1];
        if (!nextVague) return;

        const nextButton = document.querySelector(
            `.btn--vague[data-course="${courseNom}"][data-vague="${nextVague.vid}"]`
        );
        if (!nextButton || nextButton.classList.contains('done')) return;

        nextButton.disabled = false;
        nextButton.classList.add('btn--vague-active');
    }

    updateVagueButtons() {
        this.courses.forEach(course => {
            course.vagues.forEach((vague, index) => {
                const button = document.querySelector(
                    `.btn--vague[data-course="${course.nom}"][data-vague="${vague.vid}"]`
                );
                if (!button) return;

                const total    = vague.coureurs.length;
                const termines = vague.coureurs.filter(c => c.temps || c.abandon).length;

                button.classList.remove('btn--vague-active', 'running', 'done');

                if (termines === total && total > 0) {
                    button.classList.add('done');
                    button.disabled = true;
                } else if (index === 0 || this.previousVagueStarted(course, index)) {
                    button.classList.add('btn--vague-active');
                    button.disabled = false;
                } else {
                    button.disabled = true;
                }
            });
        });
    }

    previousVagueStarted(course, index) {
        const previous = course.vagues[index - 1];
        if (!previous) return true;
        return previous.coureurs.some(c => c.temps || c.abandon);
    }

    // ─────────────────────────────────────────────────────────
    // Reset
    // ─────────────────────────────────────────────────────────

    initReset() {
        const btn = document.querySelector('.btn--reset');
        if (!btn) return;
        btn.addEventListener('click', () => this.reset());
    }

    reset() {
        this.storage.clearAll();
        this.courses = [];
        this.clearTableaux();
        this.resetVagueButtons();
        this.showLoading();

        this.fetchCourses()
            .then(courses => {
                this.courses = courses;
                this.storage.saveCourses(courses);
                this.render();
                this.hideLoading();
            })
            .catch(() => {
                document.querySelector('#loading-title').textContent =
                    "Impossible de charger les courses.";
            });
    }

    clearTableaux() {
        document.querySelectorAll(
            '#tbody-7km, #tbody-15km, #tbody-equipes-7km, #tbody-equipes-15km, #clotures-7km, #clotures-15km'
        ).forEach(el => { el.innerHTML = ''; });

        document.querySelectorAll('.progress-bar__fill').forEach(bar => { bar.style.width = '0%'; });
        document.querySelectorAll('.progress-label').forEach(label => { label.textContent = '0 / 0 coureurs avec résultat'; });
        document.querySelectorAll('.search-count').forEach(el => { el.textContent = ''; });
    }

    resetVagueButtons() {
        document.querySelectorAll('.btn--vague').forEach(btn => {
            const courseNom           = btn.dataset.course;
            const boutonsDeCetteCourse = document.querySelectorAll(`.btn--vague[data-course="${courseNom}"]`);
            const estPremier          = boutonsDeCetteCourse[0] === btn;

            btn.classList.remove('done', 'running', 'btn--vague-active');
            if (estPremier) {
                btn.classList.add('btn--vague-active');
                btn.disabled = false;
            } else {
                btn.disabled = true;
            }
        });
    }
}

window.addEventListener('load', () => {
    const app = new App();
    app.initializeApp();
});
