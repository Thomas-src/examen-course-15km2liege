export class CourseRepository {
    constructor(fetcher, storage) {
        this.fetcher  = fetcher;   // fakeFetchCourses ou fetch réel
        this.storage  = storage;
    }

    async load() {
        const local = this.storage.loadCourses();
        try {
            const courses = await this.fetcher();
            this.storage.saveCourses(courses);
            return { courses, source: 'remote' };
        } catch {
            if (local) return { courses: local, source: 'cache' };
            throw new Error('Aucune donnée disponible');
        }
    }

    save(courses) { this.storage.saveCourses(courses); }
    clear()       { this.storage.clearAll(); }
}