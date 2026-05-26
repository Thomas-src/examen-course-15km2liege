const API_COURSES = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/courses.php';
const API_TEMPS = 'https://panoramix.cg.helmo.be/~p150107/js2/liege15km/temps.php';

import { Storage } from './storage.mjs';

class App {
    constructor() {
        this.storage = new Storage();
        this.courses = [];
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

        this.initNavigation();
    }

    async fetchCourses() {
        const response = await fetch(API_COURSES, {
            headers: {
                'Accept': 'application/json',
            },
        });
        console.log("Réponse brute des courses :", response);

        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        return await response.json();
    }

    showLoading() {
        const overlay = document.querySelector('#loading-overlay');
        const title = document.querySelector('#loading-title');

        title.textContent = "Chargement des courses…";
        overlay.hidden = false;
    }

    hideLoading() {
        document.querySelector('#loading-overlay').hidden = true;
    }

    initNavigation() {
        const links = document.querySelectorAll('[data-screen]');

        links.forEach(link => {
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

                document.querySelectorAll('.nav-link').forEach(l => {
                    l.classList.remove('nav-link--active');
                });

                const navLink = document.querySelector(`.nav-link[data-screen="${screen}"]`);
                if (navLink) {
                    navLink.classList.add('nav-link--active');
                }
            });
        });
    }

    render() {
        this.updateHomeCards();
    }

    updateHomeCards() {
        this.courses.forEach(course => {
            const card = document.querySelector(
                `.course-card[data-course="${course.nom}"]`
            );

            if (!card) return;

            const coureurs = course.vagues.flatMap(vague => vague.coureurs);
            const total = coureurs.length;

            const avecResultat = coureurs.filter(coureur => coureur.temps).length;

            const pourcentage = total === 0
                ? 0
                : Math.round((avecResultat / total) * 100);

            card.querySelector('.progress-bar__fill').style.width = `${pourcentage}%`;
            card.querySelector('.progress-label').textContent =
                `${avecResultat} / ${total} coureurs avec résultat`;
        });
    }
    initVagueButtons() {
        const buttons = document.querySelectorAll('.btn--vague');

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const courseNom = button.dataset.course;
                const vagueId = Number(button.dataset.vague);

                this.lancerVague(courseNom, vagueId);
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
                .catch(error => {
                    console.error(`Erreur pour le dossard ${coureur.dossard}`, error);
                })
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
        console.log(`Réponse brute pour le dossard ${dossard} :`, response);
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }

        return await response.json();
    }

    applyResult(courseNom, vagueId, resultat) {
        const course = this.courses.find(c => c.nom === courseNom);
        const vague = course.vagues.find(v => v.vid === vagueId);

        const coureur = vague.coureurs.find(c => c.dossard === resultat.dossard);
        if (!coureur) return;

        if (resultat.abandon) {
            coureur.abandon = true;
            delete coureur.temps;
        } else {
            coureur.temps = resultat.temps;
            coureur.abandon = false;
        }
    }

    activateNextVague(courseNom, vagueId) {
        const course = this.courses.find(c => c.nom === courseNom);
        const index = course.vagues.findIndex(v => v.vid === vagueId);

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

                const total = vague.coureurs.length;
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
}

window.addEventListener('load', () => {
    const app = new App();
    app.initializeApp();
});