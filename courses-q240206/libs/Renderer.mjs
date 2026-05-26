import { Classement } from './classement.mjs';

export class Renderer {
    /** @param {Classement} classement */
    constructor(classement) {
        this.classement = classement;
    }

    // ─────────────────────────────────────────────────────────
    // Point d'entrée
    // ─────────────────────────────────────────────────────────

    render(courses) {
        this.#updateHomeCards(courses);
        this.#renderClassements(courses);
    }

    // ─────────────────────────────────────────────────────────
    // Loading overlay
    // ─────────────────────────────────────────────────────────

    showLoading() {
        const overlay = document.querySelector('#loading-overlay');
        const title   = document.querySelector('#loading-title');
        title.textContent = 'Chargement des courses…';
        overlay.hidden = false;
    }

    hideLoading() {
        document.querySelector('#loading-overlay').hidden = true;
    }

    setLoadingError(message = 'Impossible de charger les courses.') {
        document.querySelector('#loading-title').textContent = message;
    }

    // ─────────────────────────────────────────────────────────
    // Cartes d'accueil
    // ─────────────────────────────────────────────────────────

    #updateHomeCards(courses) {
        courses.forEach(course => {
            const card = document.querySelector(`.course-card[data-course="${course.nom}"]`);
            if (!card) return;

            const coureurs     = course.vagues.flatMap(v => v.coureurs);
            const total        = coureurs.length;
            const avecResultat = coureurs.filter(c => c.temps || c.abandon).length;
            const pourcentage  = total === 0 ? 0 : Math.round((avecResultat / total) * 100);

            card.querySelector('.progress-bar__fill').style.width = `${pourcentage}%`;
            card.querySelector('.progress-label').textContent     = `${avecResultat} / ${total} arrivés`;
        });
    }

    // ─────────────────────────────────────────────────────────
    // Classements
    // ─────────────────────────────────────────────────────────

    #renderClassements(courses) {
        courses.forEach(course => {
            this.#renderClassementIndividuel(course);
            this.#renderClassementEquipes(course);
            this.#renderMessagesClôture(course);
        });
    }

    #renderClassementIndividuel(course) {
        const tbody = document.getElementById(`tbody-${course.nom}`);
        if (!tbody) return;

        const coureurs = course.vagues.flatMap(v => v.coureurs);

        const finish  = coureurs
            .filter(c => this.classement.statutCoureur(c) === 'finish')
            .sort((a, b) => this.classement.tempsEnSecondes(a.temps) - this.classement.tempsEnSecondes(b.temps));
        const enCours = coureurs.filter(c => this.classement.statutCoureur(c) === 'en-cours');
        const abandon = coureurs.filter(c => this.classement.statutCoureur(c) === 'abandon');

        const ordonnes = [...finish, ...enCours, ...abandon];

        // Rangs globaux et par catégorie (Finish uniquement)
        const rangParCategorie = {};
        finish.forEach((c, i) => {
            rangParCategorie[c.categorie] = (rangParCategorie[c.categorie] || 0) + 1;
            c._rangCat    = rangParCategorie[c.categorie];
            c._rangGlobal = i + 1;
        });

        const fragment = document.createDocumentFragment();

        ordonnes.forEach(coureur => {
            const statut      = this.classement.statutCoureur(coureur);
            const posGlobal   = statut === 'finish' ? coureur._rangGlobal : '—';
            const rangCat     = statut === 'finish' ? coureur._rangCat    : '—';
            const tempsAff    = statut === 'finish' ? coureur.temps       : '—';
            const statutLabel = statut === 'finish'   ? 'Finish'
                              : statut === 'en-cours' ? 'En cours'
                              : 'Abandon';

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

    #renderClassementEquipes(course) {
        const tbody = document.getElementById(`tbody-equipes-${course.nom}`);
        if (!tbody) return;

        const coureurs      = course.vagues.flatMap(v => v.coureurs);
        const equipesValides = this.classement.calculerClassementEquipes(coureurs);

        const fragment = document.createDocumentFragment();

        equipesValides.forEach((equipe, idx) => {
            const nomsCoureursFinish = equipe.membres
                .sort((a, b) => this.classement.tempsEnSecondes(a.temps) - this.classement.tempsEnSecondes(b.temps))
                .map(c => c.nom ?? '')
                .join(', ');

            const tr = document.createElement('tr');
            tr.className    = 'equipe-row';
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

   #renderMessagesClôture(course) {
    const conteneur = document.getElementById(`clotures-${course.nom}`);
    if (!conteneur) return;

    const coureurs = course.vagues.flatMap(v => v.coureurs);
    const total    = coureurs.length;
    if (total === 0) return;

    // Vider et reconstruire à chaque render
    conteneur.innerHTML = '';

    const termines = coureurs.filter(c => c.temps || c.abandon);

    // ── Clôture de course ──────────────────────────────
    if (termines.length === total) {
        const nbFinish  = coureurs.filter(c => c.temps && !c.abandon).length;
        const nbAbandon = coureurs.filter(c => c.abandon).length;

        const article = document.createElement('article');
        article.className = 'cloture-msg cloture-msg--course';
        article.innerHTML = `🏁 Course <strong>${course.nom}</strong> terminée — `
            + `<strong>${nbFinish}</strong> coureur${nbFinish > 1 ? 's' : ''} `
            + `classé${nbFinish > 1 ? 's' : ''}, `
            + `<strong>${nbAbandon}</strong> abandon${nbAbandon > 1 ? 's' : ''}`;
        conteneur.appendChild(article);
    }

    // ── Clôture par équipe ─────────────────────────────
    const clubs = {};
    coureurs.forEach(c => {
        const club = c.club ?? 'Sans club';
        if (!clubs[club]) clubs[club] = [];
        clubs[club].push(c);
    });

    Object.entries(clubs).forEach(([club, membres]) => {
        if (!membres.every(c => c.temps || c.abandon)) return;

        const equipesTerminees = this.classement.calculerClassementEquipes(membres);
        if (equipesTerminees.length === 0) return;

        const { scoreMoyen } = equipesTerminees[0];

        const article = document.createElement('article');
        article.className    = 'cloture-msg cloture-msg--equipe';
        article.dataset.club = club;
        article.innerHTML    = `🏆 Classement équipe <strong>${club}</strong> définitif `
            + `pour le ${course.nom} — Score moyen : <strong>${scoreMoyen}</strong>`;
        conteneur.appendChild(article);
    });
}

    // ─────────────────────────────────────────────────────────
    // Recherche
    // ─────────────────────────────────────────────────────────

    applyFilter(courseNom, query) {
        const tbody = document.getElementById(`tbody-${courseNom}`);
        if (!tbody) return;

        const rows  = tbody.querySelectorAll('tr.coureur-row');
        let visible = 0;
        const total = rows.length;

        rows.forEach(row => {
            if (!query) { row.hidden = false; visible++; return; }

            const nom      = (row.querySelector('.coureur-nom')?.textContent      ?? '').toLowerCase();
            const equipe   = (row.querySelector('.coureur-equipe')?.textContent   ?? '').toLowerCase();
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
    // Boutons de vague
    // ─────────────────────────────────────────────────────────

    /**
     * Met à jour l'état visuel de tous les boutons de vague
     * selon l'état courant des courses.
     * @param {Array} courses
     */
    updateVagueButtons(courses) {
        courses.forEach(course => {
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
                } else if (index === 0 || this.#previousVagueStarted(course, index)) {
                    button.classList.add('btn--vague-active');
                    button.disabled = false;
                } else {
                    button.disabled = true;
                }
            });
        });
    }

    /**
     * Passe le bouton d'une vague en état "running" (en cours de fetch).
     * @param {string} courseNom
     * @param {number} vagueId
     */
    setVagueRunning(courseNom, vagueId) {
        const button = this.#vagueButton(courseNom, vagueId);
        if (!button) return;
        button.classList.remove('btn--vague-active');
        button.classList.add('running');
        button.disabled = true;
    }

    /**
     * Passe le bouton d'une vague en état "done" (terminé).
     * @param {string} courseNom
     * @param {number} vagueId
     */
    setVagueDone(courseNom, vagueId) {
        const button = this.#vagueButton(courseNom, vagueId);
        if (!button) return;
        button.classList.remove('running');
        button.classList.add('done');
        button.disabled = true;
    }

    /**
     * Active le bouton de la vague suivante.
     * @param {string} courseNom
     * @param {number} nextVagueId
     */
    activateVague(courseNom, nextVagueId) {
        const button = this.#vagueButton(courseNom, nextVagueId);
        if (!button || button.classList.contains('done')) return;
        button.disabled = false;
        button.classList.add('btn--vague-active');
    }

    /**
     * Remet tous les boutons à leur état initial (avant toute course).
     */
    resetVagueButtons() {
        document.querySelectorAll('.btn--vague').forEach(btn => {
            const courseNom            = btn.dataset.course;
            const boutonsDeCetteCourse = document.querySelectorAll(`.btn--vague[data-course="${courseNom}"]`);
            const estPremier           = boutonsDeCetteCourse[0] === btn;

            btn.classList.remove('done', 'running', 'btn--vague-active');
            if (estPremier) {
                btn.classList.add('btn--vague-active');
                btn.disabled = false;
            } else {
                btn.disabled = true;
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    // Reset des tableaux
    // ─────────────────────────────────────────────────────────

    clearTableaux() {
        document.querySelectorAll(
            '#tbody-7km, #tbody-15km, #tbody-equipes-7km, #tbody-equipes-15km, #clotures-7km, #clotures-15km'
        ).forEach(el => { el.innerHTML = ''; });

        document.querySelectorAll('.progress-bar__fill').forEach(bar => { bar.style.width = '0%'; });
        document.querySelectorAll('.progress-label').forEach(label => { label.textContent = '0 / 0 coureurs avec résultat'; });
        document.querySelectorAll('.search-count').forEach(el => { el.textContent = ''; });
    }

    // ─────────────────────────────────────────────────────────
    // Helpers privés
    // ─────────────────────────────────────────────────────────

    #vagueButton(courseNom, vagueId) {
        return document.querySelector(
            `.btn--vague[data-course="${courseNom}"][data-vague="${vagueId}"]`
        );
    }

    #previousVagueStarted(course, index) {
        const previous = course.vagues[index - 1];
        if (!previous) return true;
        return previous.coureurs.some(c => c.temps || c.abandon);
    }
}
