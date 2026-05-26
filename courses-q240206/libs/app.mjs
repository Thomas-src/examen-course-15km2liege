import { Storage }            from './storage.mjs';
import { Classement }         from './classement.mjs';
import { Renderer }           from './Renderer.mjs';
import { fakeFetch, fakeFetchCourses } from './fake.mjs';
import { CourseRepository }   from './CourseRepository.mjs';
import { CourseState }        from './CourseState.mjs';

class App {
    #API_COURSES = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/courses.php';
    #API_TEMPS   = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/temps.php';

    /** AbortController actif pour les fetches de temps en cours. */
    #abortController = null;

    constructor() {
        const storage       = new Storage();
        this.repo           = new CourseRepository(fakeFetchCourses, storage);
        this.state          = new CourseState();
        this.renderer       = new Renderer(new Classement());
        this._listenersInit = false;
    }

    // ─────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────

    async initializeApp() {
        this.renderer.showLoading();

        // US1 — affichage immédiat depuis le cache si disponible
        const localCourses = this.repo.loadLocal();
        if (localCourses) {
            this.state.setCourses(localCourses);
            this.renderer.render(this.state.getCourses());
            this.renderer.hideLoading();
        }

        // US1 — chargement remote en arrière-plan, puis mise à jour
        try {
            const courses = await this.repo.fetchRemote();
            this.state.setCourses(courses);
            this.renderer.render(this.state.getCourses());
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

    async fetchTemps(dossard, signal) {
        const response = await fakeFetch(dossard, signal);
        // const response = await fetch(`${this.#API_TEMPS}?dossard=${dossard}`, { signal });
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
    // Vagues
    // ─────────────────────────────────────────────────────────

    initVagueButtons() {
        document.querySelectorAll('.btn--vague').forEach(button => {
            button.addEventListener('click', () => {
                this.lancerVague(button.dataset.course, Number(button.dataset.vague));
            });
        });
        this.renderer.updateVagueButtons(this.state.getCourses());
    }

    async lancerVague(courseNom, vagueId) {
        const course = this.state.getCourse(courseNom);
        if (!course) return;
        const vague = course.vagues.find(v => v.vid === vagueId);
        if (!vague) return;

        // Crée un AbortController pour cette vague (ou réutilise celui en cours)
        if (!this.#abortController || this.#abortController.signal.aborted) {
            this.#abortController = new AbortController();
        }
        const { signal } = this.#abortController;

        this.renderer.setVagueRunning(courseNom, vagueId);

        // Active la vague suivante immédiatement (sans attendre les résultats)
        const index     = course.vagues.findIndex(v => v.vid === vagueId);
        const nextVague = course.vagues[index + 1];
        if (nextVague) this.renderer.activateVague(courseNom, nextVague.vid);

        const promises = vague.coureurs.map(coureur =>
            this.fetchTemps(coureur.dossard, signal)
                .then(resultat => {
                    if (signal.aborted) return; // reset survenu entre-temps
                    this.state.applyResult(courseNom, vagueId, resultat);
                    this.repo.save(this.state.getCourses());
                    this.renderer.render(this.state.getCourses());
                })
                .catch(error => {
                    if (error.name === 'AbortError') return; // annulation volontaire
                    console.error(`Erreur dossard ${coureur.dossard}`, error);
                })
        );

        await Promise.all(promises);

        if (signal.aborted) return; // ne pas finaliser si reset déclenché pendant l'attente

        this.renderer.setVagueDone(courseNom, vagueId);
        this.repo.save(this.state.getCourses());
        this.renderer.render(this.state.getCourses());
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
    // Reset — US4
    // ─────────────────────────────────────────────────────────

    initReset() {
        const btn = document.querySelector('#btn-reset');
        if (!btn) return;
        btn.addEventListener('click', () => this.reset());
    }

    reset() {
        // 1. Annuler tous les fetches de temps en cours
        if (this.#abortController) {
            this.#abortController.abort();
            this.#abortController = null;
        }

        // 2. Supprimer les données locales et vider l'état
        this.repo.clear();
        this.state.setCourses([]);

        // 3. Réinitialiser l'affichage
        this.renderer.clearTableaux();
        this.renderer.resetVagueButtons();
        this.renderer.showLoading();

        // 4. Recharger les courses depuis l'API (US1)
        this.repo.fetchRemote()
            .then(courses => {
                this.state.setCourses(courses);
                this.renderer.render(this.state.getCourses());
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
