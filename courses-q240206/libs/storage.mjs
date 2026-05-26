
const STORAGE_KEYS = {
  COURSES: 'liege15km_courses',
  RESULTATS: 'liege15km_resultats',
  VAGUES_ETAT: 'liege15km_vagues_etat',
};

export class Storage {
  constructor() {
    this.STORAGE_KEYS = STORAGE_KEYS;
  }

  /** Sauvegarde les données courses (structure complète de l'API) */
  saveCourses(courses) {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  }

  /** Lit les courses depuis le localStorage */
  loadCourses() {
    const raw = localStorage.getItem(STORAGE_KEYS.COURSES);
    return raw ? JSON.parse(raw) : null;
  }



  /** Supprime toutes les données locales */
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  }
};