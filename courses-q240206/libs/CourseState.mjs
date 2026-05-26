export class CourseState {
    #courses = [];

    setCourses(courses) { this.#courses = structuredClone(courses); }
    getCourses()        { return this.#courses; }
    getCourse(nom)      { return this.#courses.find(c => c.nom === nom); }

    applyResult(courseNom, vagueId, resultat) {
        const coureur = this.getCourse(courseNom)
            ?.vagues.find(v => v.vid === vagueId)
            ?.coureurs.find(c => c.dossard === resultat.dossard);
        if (!coureur) return;

        if (resultat.abandon) {
            coureur.abandon = true;
            delete coureur.temps;
        } else {
            coureur.temps   = resultat.temps;
            coureur.abandon = false;
        }
    }
}