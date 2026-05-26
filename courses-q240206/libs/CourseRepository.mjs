export class CourseRepository {
    constructor(fetcher, storage) {
        this.fetcher = fetcher;   // fakeFetchCourses ou fetch réel
        this.storage = storage;
    }

    /** Lit les courses depuis le cache local. Retourne null si absent. */
    loadLocal() {
        return this.storage.loadCourses();
    }

    /** Récupère les courses depuis l'API et les sauvegarde localement. */
    async fetchRemote() {
        const response = await this.fetcher();
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const courses = await response.json();
        this.storage.saveCourses(courses);
        return courses;
    }

    save(courses) { this.storage.saveCourses(courses); }
    clear()       { this.storage.clearAll(); }
}
