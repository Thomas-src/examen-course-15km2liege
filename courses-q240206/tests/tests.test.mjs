import { describe, it, expect, beforeEach } from 'vitest';
import { Classement } from '../libs/classement.mjs';

const coureur = (dossard, club, temps = undefined, abandon = false) => ({
    dossard,
    nom: `Coureur ${dossard}`,
    club,
    ...(temps   ? { temps }   : {}),
    ...(abandon ? { abandon } : {}),
});

let cl;
beforeEach(() => { cl = new Classement(); });

// ── tempsEnSecondes ───────────────────────────────────────────
describe('tempsEnSecondes', () => {
    it('convertit "00:00:00" en 0',        () => expect(cl.tempsEnSecondes('00:00:00')).toBe(0));
    it('convertit "00:42:17" correctement',() => expect(cl.tempsEnSecondes('00:42:17')).toBe(2537));
    it('convertit "01:00:00" en 3600',     () => expect(cl.tempsEnSecondes('01:00:00')).toBe(3600));
    it('retourne Infinity si null',        () => expect(cl.tempsEnSecondes(null)).toBe(Infinity));
    it('retourne Infinity si undefined',   () => expect(cl.tempsEnSecondes(undefined)).toBe(Infinity));
});

// ── secondesEnTemps ───────────────────────────────────────────
describe('secondesEnTemps', () => {
    it('convertit 0 en "00:00:00"',   () => expect(cl.secondesEnTemps(0)).toBe('00:00:00'));
    it('convertit 2537 en "00:42:17"',() => expect(cl.secondesEnTemps(2537)).toBe('00:42:17'));
    it('convertit 3600 en "01:00:00"',() => expect(cl.secondesEnTemps(3600)).toBe('01:00:00'));
    it('padde à 2 digits',            () => expect(cl.secondesEnTemps(61)).toBe('00:01:01'));
});

// ── calculerClassementEquipes ─────────────────────────────────
describe('calculerClassementEquipes', () => {

    it('calcule le score correct pour exactement 2 coureurs Finish', () => {
        // (1680 + 1920) / 2 = 1800s = "00:30:00"
        const classement = cl.calculerClassementEquipes([
            coureur(1, 'ROBA', '00:28:00'),
            coureur(2, 'ROBA', '00:32:00'),
        ]);
        expect(classement).toHaveLength(1);
        expect(classement[0].moyenneSec).toBe(1800);
        expect(classement[0].scoreMoyen).toBe('00:30:00');
    });

    it('calcule la moyenne sur TOUS les coureurs Finish quand > 2', () => {
        // (1800 + 2400 + 3000) / 3 = 2400s = "00:40:00"
        const classement = cl.calculerClassementEquipes([
            coureur(1, 'BATT', '00:30:00'),
            coureur(2, 'BATT', '00:40:00'),
            coureur(3, 'BATT', '00:50:00'),
        ]);
        expect(classement).toHaveLength(1);
        expect(classement[0].moyenneSec).toBe(2400);
        expect(classement[0].membres).toHaveLength(3);
    });

    it("n'affiche pas une équipe avec un seul coureur Finish", () => {
        const classement = cl.calculerClassementEquipes([
            coureur(1, 'HERVE SPORTIF', '00:45:00'),
        ]);
        expect(classement).toHaveLength(0);
    });

    it('ignore les coureurs en abandon dans le calcul du score', () => {
        // (1800 + 3000) / 2 = 2400s — l'abandon est ignoré
        const classement = cl.calculerClassementEquipes([
            coureur(1, 'JOGGING CLUB', '00:30:00'),
            coureur(2, 'JOGGING CLUB', '00:50:00'),
            coureur(3, 'JOGGING CLUB', undefined, true),
        ]);
        expect(classement).toHaveLength(1);
        expect(classement[0].moyenneSec).toBe(2400);
        expect(classement[0].membres).toHaveLength(2);
    });

    it('ignore les coureurs encore en cours', () => {
        const classement = cl.calculerClassementEquipes([
            coureur(1, 'OUFTEAM', '00:35:00'),
            coureur(2, 'OUFTEAM', '00:45:00'),
            coureur(3, 'OUFTEAM'),
        ]);
        expect(classement).toHaveLength(1);
        expect(classement[0].membres).toHaveLength(2);
    });

    it('trie les équipes par score croissant', () => {
        const classement = cl.calculerClassementEquipes([
            coureur(1, 'LENTS',   '01:00:00'),
            coureur(2, 'LENTS',   '01:10:00'),
            coureur(3, 'RAPIDES', '00:30:00'),
            coureur(4, 'RAPIDES', '00:40:00'),
        ]);
        expect(classement[0].club).toBe('RAPIDES');
        expect(classement[1].club).toBe('LENTS');
    });

    it('calcule indépendamment plusieurs clubs', () => {
        const classement = cl.calculerClassementEquipes([
            coureur(1, 'ROBA', '00:30:00'),
            coureur(2, 'ROBA', '00:30:00'),
            coureur(3, 'BATT', '00:40:00'),
            coureur(4, 'BATT', '00:40:00'),
        ]);
        expect(classement).toHaveLength(2);
        expect(classement.find(e => e.club === 'ROBA')?.scoreMoyen).toBe('00:30:00');
        expect(classement.find(e => e.club === 'BATT')?.scoreMoyen).toBe('00:40:00');
    });
});
