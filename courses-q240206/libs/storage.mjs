
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

  /** Sauvegarde un résultat individuel */
  saveResultat(dossard, data) {
    const resultats = this.loadResultats();
    resultats[dossard] = data;
    localStorage.setItem(STORAGE_KEYS.RESULTATS, JSON.stringify(resultats));
  }

  /** Charge tous les résultats */
  loadResultats() {
    const raw = localStorage.getItem(STORAGE_KEYS.RESULTATS);
    return raw ? JSON.parse(raw) : {};
  }

  /** Sauvegarde l'état d'une vague */
  saveVagueEtat(vid, etat) {
    const etats = this.loadVaguesEtat();
    etats[vid] = etat;
    localStorage.setItem(STORAGE_KEYS.VAGUES_ETAT, JSON.stringify(etats));
  }

  /** Charge l'état de toutes les vagues */
  loadVaguesEtat() {
    const raw = localStorage.getItem(STORAGE_KEYS.VAGUES_ETAT);
    return raw ? JSON.parse(raw) : {};
  }

  /** Supprime toutes les données locales */
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  }
};