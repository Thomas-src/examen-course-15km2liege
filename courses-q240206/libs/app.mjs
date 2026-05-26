import { Storage } from './storage.mjs';
import { Classement } from './classement.mjs';
import { Renderer } from './renderer.mjs';
import { fakeFetch, fakeFetchCourses } from './fake.mjs';

class App {
    #API_COURSES = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/courses.php';
    #API_TEMPS   = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/temps.php';

    constructor() {
        this.storage    = new Storage();
        this.classement = new Classement();
        this.renderer   = new Renderer(this.classement);
        this.courses    = [];
        this._listenersInit = false;
    }

    // ─────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────

    async initializeApp() {
        this.renderer.showLoading();

        const localCourses = this.storage.loadCourses?.();

        if (localCourses) {
            this.courses = localCourses;
            this.renderer.render(this.courses);
            this.renderer.hideLoading();
        }

        try {
            const courses = await this.fetchCourses();
            this.courses  = courses;
            this.storage.saveCourses(courses);
            this.renderer.render(this.courses);
            this.renderer.hideLoading();
            console.log('Courses chargées et sauvegardées localement.');
        } catch (error) {
            console.error('Erreur lors du chargement des courses :', error);
            if (!localCourses) {
                this.renderer.setLoadingError();
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
        const response = await fakeFetchCourses();
        // const response = await fetch(this.#API_COURSES);
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        return await response.json();
    }

    async fetchTemps(dossard) {
        const response = await fakeFetch(dossard);
        // const response = await fetch(`${this.#API_TEMPS}?dossard=${dossard}`);
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        return await response.json();
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
    // Modèle — mutation des données
    // ─────────────────────────────────────────────────────────

    applyResult(courseNom, vagueId, resultat) {
        const course  = this.courses.find(c => c.nom === courseNom);
        const vague   = course?.vagues.find(v => v.vid === vagueId);
        const coureur = vague?.coureurs.find(c => c.dossard === resultat.dossard);
        if (!coureur) return;

        if (resultat.abandon) {
            coureur.abandon = true;
            delete coureur.temps;
        } else {
            coureur.temps   = resultat.temps;
            coureur.abandon = false;
        }
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
        this.renderer.updateVagueButtons(this.courses);
    }

    async lancerVague(courseNom, vagueId) {
        const course = this.courses.find(c => c.nom === courseNom);
        if (!course) return;
        const vague = course.vagues.find(v => v.vid === vagueId);
        if (!vague) return;

        this.renderer.setVagueRunning(courseNom, vagueId);

        // Active la vague suivante immédiatement
        const index     = course.vagues.findIndex(v => v.vid === vagueId);
        const nextVague = course.vagues[index + 1];
        if (nextVague) this.renderer.activateVague(courseNom, nextVague.vid);

        const promises = vague.coureurs.map(coureur =>
            this.fetchTemps(coureur.dossard)
                .then(resultat => {
                    this.applyResult(courseNom, vagueId, resultat);
                    this.storage.saveCourses(this.courses);
                    this.renderer.render(this.courses);
                })
                .catch(error => console.error(`Erreur dossard ${coureur.dossard}`, error))
        );

        await Promise.all(promises);

        this.renderer.setVagueDone(courseNom, vagueId);
        this.storage.saveCourses(this.courses);
        this.renderer.render(this.courses);
    }

    // ─────────────────────────────────────────────────────────
    // Recherche
    // ─────────────────────────────────────────────────────────

    initSearch() {
        ['7km', '15km'].forEach(nom => {
            const input = document.getElementById(`search-${nom}`);
            if (!input) return;
            input.addEventListener('input', () => {
                this.renderer.applyFilter(nom, input.value.trim().toLowerCase());
            });
        });
    }

    // ─────────────────────────────────────────────────────────
    // Reset
    // ─────────────────────────────────────────────────────────

    initReset() {
        const btn = document.querySelector('#btn-reset');
        if (!btn) return;
        btn.addEventListener('click', () => this.reset());
    }

    reset() {
        this.storage.clearAll();
        this.courses = [];
        this.renderer.clearTableaux();
        this.renderer.resetVagueButtons();
        this.renderer.showLoading();

        this.fetchCourses()
            .then(courses => {
                this.courses = courses;
                this.storage.saveCourses(courses);
                this.renderer.render(this.courses);
                this.renderer.hideLoading();
            })
            .catch(() => {
                this.renderer.setLoadingError();
                setTimeout(() => this.renderer.hideLoading(), 3000);
            });
    }
}

window.addEventListener('load', () => {
    const app = new App();
    app.initializeApp();
});
