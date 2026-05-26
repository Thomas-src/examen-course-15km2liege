export class Classement {

    /**
     * Convertit "HH:MM:SS" en secondes.
     * @param {string} temps
     * @returns {number}
     */
    tempsEnSecondes(temps) {
        if (!temps) return Infinity;
        const [h, m, s] = temps.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    }

    /**
     * Convertit un nombre de secondes en "HH:MM:SS".
     * @param {number} secondes
     * @returns {string}
     */
    secondesEnTemps(secondes) {
        const h = Math.floor(secondes / 3600);
        const m = Math.floor((secondes % 3600) / 60);
        const s = secondes % 60;
        return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }

    /**
     * Retourne le statut d'un coureur : 'finish', 'abandon' ou 'en-cours'.
     * @param {{ temps?: string, abandon?: boolean }} coureur
     * @returns {'finish'|'abandon'|'en-cours'}
     */
    statutCoureur(coureur) {
        if (coureur.abandon) return 'abandon';
        if (coureur.temps)   return 'finish';
        return 'en-cours';
    }

    /**
     * Calcule le classement par équipe pour une course.
     *
     * Règles :
     *  - Seuls les coureurs Finish (temps présent, pas abandon) sont pris en compte.
     *  - Une équipe doit avoir au moins 2 coureurs Finish pour apparaître.
     *  - Le score est la moyenne des temps en secondes, arrondie à l'entier le plus proche.
     *
     * @param {Array<{ dossard: number, nom: string, club: string, temps?: string, abandon?: boolean }>} coureurs
     * @returns {Array<{ club: string, membres: object[], moyenneSec: number, scoreMoyen: string }>}
     */
    calculerClassementEquipes(coureurs) {
        const finish = coureurs.filter(c => this.statutCoureur(c) === 'finish');

        const clubs = {};
        finish.forEach(c => {
            const club = c.club ?? 'Sans club';
            if (!clubs[club]) clubs[club] = [];
            clubs[club].push(c);
        });

        return Object.entries(clubs)
            .filter(([, membres]) => membres.length >= 2)
            .map(([club, membres]) => {
                const totalSec   = membres.reduce((acc, c) => acc + this.tempsEnSecondes(c.temps), 0);
                const moyenneSec = Math.round(totalSec / membres.length);
                return {
                    club,
                    membres,
                    moyenneSec,
                    scoreMoyen: this.secondesEnTemps(moyenneSec),
                };
            })
            .sort((a, b) => a.moyenneSec - b.moyenneSec);
    }
}
