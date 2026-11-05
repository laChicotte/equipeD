/** Sans directive « use client » : ce texte est aussi lu par le layout racine, côté serveur. */
export const DATA_SAVER_STORAGE_KEY = 'tc-data-saver';

/** Script exécuté avant l'affichage : masque les photos décoratives dès le premier rendu. */
export const dataSaverBootScript = `try{var p=localStorage.getItem('${DATA_SAVER_STORAGE_KEY}'),c=navigator.connection;if(p==='on'||(p!=='off'&&c&&(c.saveData||/2g/.test(c.effectiveType||''))))document.documentElement.dataset.saver=''}catch(e){}`;
