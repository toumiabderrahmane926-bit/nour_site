// =====================================================
//  الحافظ (Al-Hafiz)
//  Prières, Coran, Duas, Tasbih et Sadaqa Jariya
//
//  APIs gratuites utilisées (sans clé) :
//   - Aladhan       : horaires de prière
//   - AlQuran Cloud : texte du Coran, traductions et audio
// =====================================================

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Petit utilitaire pour créer un élément avec du texte (plus sûr que innerHTML)
function creer(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// Lecture/écriture sécurisées du localStorage
function lire(cle, defaut) {
  try {
    const v = localStorage.getItem(cle);
    return v === null ? defaut : v;
  } catch (e) { return defaut; }
}
function ecrire(cle, valeur) {
  try { localStorage.setItem(cle, valeur); } catch (e) { /* pas grave */ }
}

// ---------- Gestion des onglets ----------
function activerOnglet(id) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.target === id));
  $$('.section').forEach((s) => s.classList.toggle('active', s.id === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.tab').forEach((btn) => {
  btn.addEventListener('click', () => activerOnglet(btn.dataset.target));
});


// =====================================================
//  1. HORAIRES DE PRIÈRE + NOTIFICATION
// =====================================================
const PRIERES = [
  { cle: 'Fajr',    nom: 'Fajr',            ar: 'الفجر',   priere: true },
  { cle: 'Sunrise', nom: 'Lever du soleil', ar: 'الشروق',  priere: false },
  { cle: 'Dhuhr',   nom: 'Dhuhr',           ar: 'الظهر',   priere: true },
  { cle: 'Asr',     nom: 'Asr',             ar: 'العصر',   priere: true },
  { cle: 'Maghrib', nom: 'Maghrib',         ar: 'المغرب',  priere: true },
  { cle: 'Isha',    nom: 'Isha',            ar: 'العشاء',  priere: true },
];

let horaires = {};           // { Fajr: Date, Dhuhr: Date, ... }
let dejaNotifie = new Set(); // pour ne déclencher qu'une fois par prière

function dateDuJour() {
  const d = new Date();
  const jj = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${jj}-${mm}-${d.getFullYear()}`;
}

// Transforme "05:12 (WAT)" en objet Date d'aujourd'hui
function heureVersDate(texte) {
  const [h, m] = texte.slice(0, 5).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

async function chargerHoraires(lieu) {
  const methode = $('#methode').value;
  let url;

  if (lieu.lat !== undefined) {
    url = `https://api.aladhan.com/v1/timings/${dateDuJour()}?latitude=${lieu.lat}&longitude=${lieu.lon}&method=${methode}`;
  } else {
    url = `https://api.aladhan.com/v1/timingsByCity/${dateDuJour()}?city=${encodeURIComponent(lieu.ville)}&country=${encodeURIComponent(lieu.pays)}&method=${methode}`;
  }

  try {
    const rep = await fetch(url);
    const json = await rep.json();
    if (json.code !== 200) throw new Error('Lieu introuvable');

    const t = json.data.timings;
    horaires = {};
    PRIERES.forEach((p) => (horaires[p.cle] = heureVersDate(t[p.cle])));

    // Date hijri
    const h = json.data.date.hijri;
    $('#date-hijri').textContent = `${h.day} ${h.month.en} ${h.year} H`;

    $('#lieu').textContent = lieu.ville
      ? `📍 ${lieu.ville}, ${lieu.pays}`
      : `📍 Ma position`;

    ecrire('hafiz-lieu', JSON.stringify(lieu));
    dejaNotifie.clear();
    afficherPrieres();
    tick();
  } catch (e) {
    alert("Impossible de récupérer les horaires. Vérifie la ville/le pays ou ta connexion.");
    console.error(e);
  }
}

function afficherPrieres() {
  const conteneur = $('#liste-prieres');
  conteneur.innerHTML = '';
  PRIERES.forEach((p) => {
    const d = horaires[p.cle];
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const div = creer('div', 'priere-carte');
    div.id = 'carte-' + p.cle;
    div.appendChild(creer('div', 'ar', p.ar));
    div.appendChild(creer('div', 'nom', p.nom));
    div.appendChild(creer('div', 'heure', heure));
    conteneur.appendChild(div);
  });
}

// Trouve la prochaine prière (on ignore le lever du soleil)
function prochainePriere() {
  const maintenant = new Date();
  for (const p of PRIERES.filter((p) => p.priere)) {
    if (horaires[p.cle] > maintenant) return { ...p, date: horaires[p.cle] };
  }
  // Après Isha -> Fajr de demain
  const demain = new Date(horaires.Fajr);
  demain.setDate(demain.getDate() + 1);
  return { ...PRIERES[0], date: demain };
}

function tick() {
  if (!horaires.Fajr) return;

  const suivante = prochainePriere();
  const reste = suivante.date - new Date();

  const h = Math.floor(reste / 3600000);
  const m = Math.floor((reste % 3600000) / 60000);
  const s = Math.floor((reste % 60000) / 1000);
  const deux = (n) => String(n).padStart(2, '0');

  $('#prochaine-nom').textContent = `${suivante.nom} · ${suivante.ar}`;
  $('#compte-a-rebours').textContent = `${deux(h)}:${deux(m)}:${deux(s)}`;

  $$('.priere-carte').forEach((c) => c.classList.remove('suivante'));
  const carte = $('#carte-' + suivante.cle);
  if (carte) carte.classList.add('suivante');

  // Rappel quand l'heure arrive
  const maintenant = new Date();
  PRIERES.filter((p) => p.priere).forEach((p) => {
    const diff = maintenant - horaires[p.cle];
    if (diff >= 0 && diff < 60000 && !dejaNotifie.has(p.cle)) {
      dejaNotifie.add(p.cle);
      notifier(p);
    }
  });
}

// ---------- Son (utilisé par le tasbih quand l'objectif est atteint) ----------
function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.5, 1].forEach((delai) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + delai);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delai + 0.4);
      osc.start(ctx.currentTime + delai);
      osc.stop(ctx.currentTime + delai + 0.4);
    });
  } catch (e) { /* pas grave */ }
}

// ---------- Notification à l'heure de la prière ----------
const NOMS_AR = {
  Fajr: 'صلاة الفجر',
  Dhuhr: 'صلاة الظهر',
  Asr: 'صلاة العصر',
  Maghrib: 'صلاة المغرب',
  Isha: 'صلاة العشاء',
};

// Service worker : nécessaire pour que les notifications marchent sur téléphone
let swPret = null;
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  swPret = navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).catch(() => null);
}

async function afficherNotification(titre, corps) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const options = { body: corps, icon: 'logo.png', badge: 'logo.png', lang: 'ar', dir: 'rtl', tag: 'hafiz-priere' };
  try {
    const reg = swPret ? await swPret : null;
    if (reg) { await reg.showNotification(titre, options); return true; }
  } catch (e) { /* on essaie la méthode classique */ }
  try { new Notification(titre, options); return true; } catch (e) { return false; }
}

function notifier(p) {
  afficherNotification(NOMS_AR[p.cle] || p.ar, 'حان وقت الصلاة 🕌');
}

// Boutons du lieu
$('#btn-chercher').addEventListener('click', () => {
  const ville = $('#ville').value.trim();
  const pays = $('#pays').value.trim();
  if (!ville || !pays) return alert('Entre une ville et un pays.');
  chargerHoraires({ ville, pays });
});

$('#btn-geo').addEventListener('click', () => {
  if (!navigator.geolocation) return alert("La géolocalisation n'est pas supportée.");
  navigator.geolocation.getCurrentPosition(
    (pos) => chargerHoraires({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => alert("Impossible d'obtenir ta position. Entre ta ville à la main.")
  );
});

$('#btn-notif').addEventListener('click', async () => {
  if (!('Notification' in window)) return alert('Notifications non supportées.');
  const rep = await Notification.requestPermission();
  if (rep === 'granted') {
    afficherNotification('صلاة المغرب', 'حان وقت الصلاة 🕌');
    alert('Notifications activées ✅ (garde cet onglet ouvert)');
  } else {
    alert('Notifications refusées. Autorise-les dans les réglages du navigateur pour ce site.');
  }
});

$('#methode').addEventListener('change', () => {
  const sauve = lire('hafiz-lieu', null);
  if (sauve) chargerHoraires(JSON.parse(sauve));
});

setInterval(tick, 1000);

// Au démarrage : on recharge le dernier lieu sauvegardé
(function initPriere() {
  const sauve = lire('hafiz-lieu', null);
  if (sauve) {
    const lieu = JSON.parse(sauve);
    if (lieu.ville) { $('#ville').value = lieu.ville; $('#pays').value = lieu.pays; }
    chargerHoraires(lieu);
  } else {
    $('#prochaine-nom').textContent = 'Choisis ton lieu ↓';
  }
})();


// =====================================================
//  2. CORAN (lecteurs + traductions français / anglais)
// =====================================================
const API_CORAN = 'https://api.alquran.cloud/v1';

// [identifiant, nom du lecteur]
const LECTEURS = [
  ['ar.alafasy',              'Mishary Alafasy'],
  ['ar.abdulbasitmurattal',   'Abdul Basit (Murattal)'],
  ['ar.abdurrahmaansudais',   'Abdurrahmaan As-Sudais'],
  ['ar.husary',               'Mahmoud Khalil Al-Husary'],
  ['ar.minshawi',             'Mohamed Siddiq Al-Minshawi'],
  ['ar.mahermuaiqly',         'Maher Al-Muaiqly'],
  ['ar.saoodshuraym',         'Saood Ash-Shuraym'],
  ['ar.hudhaify',             'Ali Al-Hudhaify'],
  ['ar.shaatree',             'Abu Bakr Ash-Shaatree'],
  ['ar.ahmedajamy',           'Ahmed Al-Ajamy'],
];

// Débits essayés dans l'ordre (tous les lecteurs n'ont pas le même)
const DEBITS = [128, 192, 64, 48, 40, 32];

let toutesSourates = [];
let sourateCourante = null;
let essaiAudio = 0;

LECTEURS.forEach(([id, nom]) => {
  const opt = creer('option', '', nom);
  opt.value = id;
  $('#lecteur-choix').appendChild(opt);
});
$('#lecteur-choix').value = lire('hafiz-lecteur', 'ar.alafasy');
$('#traduction-choix').value = lire('hafiz-traduction', 'fr');

async function chargerSourates() {
  try {
    const rep = await fetch(`${API_CORAN}/surah`);
    const json = await rep.json();
    toutesSourates = json.data;
    afficherSourates(toutesSourates);
  } catch (e) {
    $('#liste-sourates').textContent = 'Erreur de chargement. Vérifie ta connexion.';
  }
}

function afficherSourates(liste) {
  const conteneur = $('#liste-sourates');
  conteneur.innerHTML = '';
  liste.forEach((s) => {
    const div = creer('div', 'sourate-item');
    div.appendChild(creer('div', 'num', s.number));
    div.appendChild(creer('div', 'ar', s.name));
    div.appendChild(creer('div', 'fr', `${s.englishName} · ${s.numberOfAyahs} versets`));
    div.addEventListener('click', () => ouvrirSourate(s));
    conteneur.appendChild(div);
  });
}

$('#recherche-sourate').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const filtre = toutesSourates.filter(
    (s) =>
      s.englishName.toLowerCase().includes(q) ||
      s.name.includes(q) ||
      String(s.number) === q
  );
  afficherSourates(filtre);
});

// ----- Audio -----
function urlAudio(numero, lecteur, debit) {
  return `https://cdn.islamic.network/quran/audio-surah/${debit}/${lecteur}/${numero}.mp3`;
}

function chargerAudio() {
  essaiAudio = 0;
  $('#msg-audio').textContent = '';
  $('#lecteur').src = urlAudio(sourateCourante.number, $('#lecteur-choix').value, DEBITS[0]);
}

// Si le fichier n'existe pas avec ce débit, on essaie le suivant
$('#lecteur').addEventListener('error', () => {
  if (!sourateCourante) return;
  essaiAudio++;
  if (essaiAudio < DEBITS.length) {
    $('#lecteur').src = urlAudio(sourateCourante.number, $('#lecteur-choix').value, DEBITS[essaiAudio]);
  } else {
    $('#msg-audio').textContent = "Audio indisponible pour ce lecteur. Essaie un autre lecteur ou vérifie ta connexion.";
  }
});

$('#lecteur-choix').addEventListener('change', (e) => {
  ecrire('hafiz-lecteur', e.target.value);
  if (sourateCourante) chargerAudio();
});

// ----- Texte et traductions -----
// Retire les voyelles et signes pour comparer du texte arabe
function nettoyerArabe(t) {
  return t.replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا');
}

// Dans cette édition, le 1er verset de chaque sourate (sauf Al-Fatiha) commence par la Basmala.
// On la sépare pour l'afficher à part.
function separerBasmala(texte, numeroSourate, numeroVerset) {
  if (numeroVerset !== 1 || numeroSourate === 1 || numeroSourate === 9) return { basmala: false, texte };
  if (!nettoyerArabe(texte).startsWith('بسم الله الرحمن الرحيم')) return { basmala: false, texte };
  return { basmala: true, texte: texte.split(' ').slice(4).join(' ') };
}

async function chargerTexte() {
  const s = sourateCourante;
  const choix = $('#traduction-choix').value;
  const editions = ['quran-uthmani'];
  if (choix.includes('fr')) editions.push('fr.hamidullah');
  if (choix.includes('en')) editions.push('en.sahih');

  const conteneur = $('#versets');
  conteneur.textContent = 'Chargement...';

  try {
    const rep = await fetch(`${API_CORAN}/surah/${s.number}/editions/${editions.join(',')}`);
    const json = await rep.json();
    const trouve = (id) => json.data.find((e) => e.edition.identifier === id);

    const arabe = trouve('quran-uthmani').ayahs;
    const traductions = [];
    if (trouve('fr.hamidullah')) traductions.push({ etiquette: 'FR', ayahs: trouve('fr.hamidullah').ayahs });
    if (trouve('en.sahih'))      traductions.push({ etiquette: 'EN', ayahs: trouve('en.sahih').ayahs });

    conteneur.innerHTML = '';
    arabe.forEach((v, i) => {
      const { basmala, texte } = separerBasmala(v.text, s.number, v.numberInSurah);
      if (basmala) conteneur.appendChild(creer('p', 'bismillah', 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'));

      const div = creer('div', 'verset');
      const p = creer('p', 'arabe', texte + ' ');
      p.appendChild(creer('span', 'numero', v.numberInSurah));
      div.appendChild(p);

      traductions.forEach((t) => {
        const tr = creer('p', 'traduction');
        tr.appendChild(creer('span', 'tag', t.etiquette));
        tr.appendChild(document.createTextNode(t.ayahs[i].text));
        div.appendChild(tr);
      });
      conteneur.appendChild(div);
    });
  } catch (e) {
    conteneur.textContent = 'Erreur de chargement de la sourate.';
  }
}

$('#traduction-choix').addEventListener('change', (e) => {
  ecrire('hafiz-traduction', e.target.value);
  if (sourateCourante) chargerTexte();
});

function ouvrirSourate(s) {
  sourateCourante = s;
  $('#vue-liste').classList.add('cache');
  $('#vue-lecture').classList.remove('cache');
  $('#titre-sourate').textContent = s.name;
  chargerAudio();
  chargerTexte();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('#btn-retour').addEventListener('click', () => {
  $('#lecteur').pause();
  $('#vue-lecture').classList.add('cache');
  $('#vue-liste').classList.remove('cache');
});

chargerSourates();


// =====================================================
//  3. DUAS
// =====================================================
const DUAS = [
  {
    titre: 'Au réveil',
    ar: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    translit: "Alhamdu lillahi lladhi ahyana ba'da ma amatana wa ilayhi n-nushur",
    fr: "Louange à Allah qui nous a rendu la vie après nous avoir fait mourir, et c'est vers Lui la résurrection.",
  },
  {
    titre: 'Avant de dormir',
    ar: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    translit: 'Bismika Allahumma amutu wa ahya',
    fr: "C'est en Ton nom, ô Allah, que je meurs et que je vis.",
  },
  {
    titre: 'Avant de manger',
    ar: 'بِسْمِ اللَّهِ',
    translit: 'Bismillah',
    fr: "Au nom d'Allah.",
  },
  {
    titre: 'Après avoir mangé',
    ar: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ',
    translit: "Alhamdu lillahi lladhi at'amana wa saqana wa ja'alana muslimin",
    fr: "Louange à Allah qui nous a nourris, nous a donné à boire et a fait de nous des musulmans.",
  },
  {
    titre: 'En sortant de la maison',
    ar: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    translit: "Bismillah, tawakkaltu 'ala Llah, wa la hawla wa la quwwata illa billah",
    fr: "Au nom d'Allah, je m'en remets à Allah. Il n'y a de force ni de puissance qu'en Allah.",
  },
  {
    titre: 'Après les ablutions (wudu)',
    ar: 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    translit: "Ashhadu an la ilaha illa Llahu wahdahu la sharika lah, wa ashhadu anna Muhammadan 'abduhu wa rasuluh",
    fr: "J'atteste qu'il n'y a de divinité qu'Allah, Seul, sans associé, et j'atteste que Muhammad est Son serviteur et Son messager.",
  },
  {
    titre: 'En entrant à la mosquée',
    ar: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    translit: 'Allahumma ftah li abwaba rahmatik',
    fr: "Ô Allah, ouvre-moi les portes de Ta miséricorde.",
  },
  {
    titre: 'En sortant de la mosquée',
    ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
    translit: 'Allahumma inni as-aluka min fadlik',
    fr: "Ô Allah, je Te demande de Ta grâce.",
  },
  {
    titre: 'Pour le voyage',
    ar: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ',
    translit: "Subhana lladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila Rabbina lamunqalibun",
    fr: "Gloire à Celui qui nous a soumis tout cela alors que nous n'étions pas capables de le dominer. Et c'est vers notre Seigneur que nous retournerons.",
  },
  {
    titre: "Demander le bien ici-bas et dans l'au-delà",
    ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    translit: "Rabbana atina fi d-dunya hasanatan wa fi l-akhirati hasanatan wa qina 'adhaban-nar",
    fr: "Notre Seigneur, accorde-nous une belle part ici-bas et une belle part dans l'au-delà, et protège-nous du châtiment du Feu. (Coran 2:201)",
  },
  {
    titre: 'Demander plus de savoir',
    ar: 'رَبِّ زِدْنِي عِلْمًا',
    translit: "Rabbi zidni 'ilma",
    fr: "Mon Seigneur, augmente mes connaissances. (Coran 20:114)",
  },
  {
    titre: 'Dua de Yunus (en cas de détresse)',
    ar: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    translit: 'La ilaha illa Anta subhanaka inni kuntu mina z-zalimin',
    fr: "Pas de divinité à part Toi ! Gloire à Toi ! J'ai été au nombre des injustes. (Coran 21:87)",
  },
];

function afficherDuas(liste) {
  const conteneur = $('#liste-duas');
  conteneur.innerHTML = '';
  liste.forEach((d) => {
    const div = creer('div', 'dua');
    div.appendChild(creer('h4', '', d.titre));
    div.appendChild(creer('p', 'arabe', d.ar));
    div.appendChild(creer('p', 'translit', d.translit));
    div.appendChild(creer('p', '', d.fr));

    const btn = creer('button', 'btn-copier secondaire', 'Copier');
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(`${d.ar}\n${d.translit}\n${d.fr}`);
      btn.textContent = 'Copié ✅';
      setTimeout(() => (btn.textContent = 'Copier'), 1500);
    });
    div.appendChild(btn);
    conteneur.appendChild(div);
  });
}

$('#recherche-dua').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  afficherDuas(DUAS.filter((d) => (d.titre + d.fr + d.translit).toLowerCase().includes(q)));
});

afficherDuas(DUAS);


// =====================================================
//  4. TASBIH
// =====================================================
const DHIKRS = [
  { nom: 'SubhanAllah',         ar: 'سُبْحَانَ اللَّهِ' },
  { nom: 'Alhamdulillah',       ar: 'الْحَمْدُ لِلَّهِ' },
  { nom: 'Allahu Akbar',        ar: 'اللَّهُ أَكْبَرُ' },
  { nom: 'Astaghfirullah',      ar: 'أَسْتَغْفِرُ اللَّهَ' },
  { nom: 'La ilaha illa Allah', ar: 'لَا إِلَهَ إِلَّا اللَّهُ' },
];

const cleTotalJour = 'hafiz-total-' + new Date().toDateString();
let compteur = 0;
let totalJour = Number(lire(cleTotalJour, '0')) || 0;

DHIKRS.forEach((d, i) => {
  const opt = creer('option', '', d.nom);
  opt.value = i;
  $('#dhikr').appendChild(opt);
});

function majDhikr() {
  $('#dhikr-ar').textContent = DHIKRS[$('#dhikr').value].ar;
}

function majCompteur() {
  $('#compteur').textContent = compteur;
  $('#total-jour').textContent = totalJour;
}

$('#btn-compter').addEventListener('click', () => {
  compteur++;
  totalJour++;
  ecrire(cleTotalJour, totalJour);
  majCompteur();

  const objectif = Number($('#objectif').value);
  if (objectif && compteur === objectif) {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    bip();
    alert(`Objectif de ${objectif} atteint, macha Allah ! 🤍`);
    compteur = 0;
    majCompteur();
  }
});

$('#btn-reset').addEventListener('click', () => { compteur = 0; majCompteur(); });
$('#dhikr').addEventListener('change', () => { compteur = 0; majDhikr(); majCompteur(); });

// Envoie le dhikr en cours vers la page Sadaqa Jariya
$('#btn-dedier').addEventListener('click', () => {
  const quantite = compteur > 0 ? compteur : totalJour;
  if (quantite === 0) return alert("Compte d'abord quelques dhikr, puis dédie-les.");
  $('#sj-type').value = 'tasbih';
  $('#sj-detail').value = DHIKRS[$('#dhikr').value].nom;
  $('#sj-qte').value = quantite;
  activerOnglet('sadaqa');
  $('#sj-nom').focus();
});

majDhikr();
majCompteur();


// =====================================================
//  5. SADAQA JARIYA
//  La liste est enregistrée sur l'appareil de chaque personne.
// =====================================================
const TYPES_SJ = {
  tasbih: '📿 Tasbih / Dhikr',
  coran:  '📖 Lecture du Coran',
  dua:    '🤲 Dua',
  sadaqa: '💝 Aumône',
  autre:  '✨ Bonne action',
};

let dedicaces = [];
try { dedicaces = JSON.parse(lire('hafiz-dedicaces', '[]')) || []; } catch (e) { dedicaces = []; }

function sauverDedicaces() {
  ecrire('hafiz-dedicaces', JSON.stringify(dedicaces));
}

function afficherDedicaces() {
  const liste = $('#sj-liste');
  liste.innerHTML = '';

  const noms = new Set(dedicaces.map((d) => d.nom.toLowerCase()));
  $('#sj-total').textContent = dedicaces.length;
  $('#sj-noms').textContent = noms.size;

  if (dedicaces.length === 0) {
    liste.appendChild(creer('p', 'petit', 'Aucune dédicace pour le moment.'));
    return;
  }

  dedicaces.forEach((d) => {
    const ligne = creer('div', 'dedicace');
    const info = creer('div', 'info');

    const titre = creer('div', '');
    titre.appendChild(creer('span', 'nom-sj', d.nom));
    titre.appendChild(document.createTextNode(` · ${TYPES_SJ[d.type] || d.type} ×${d.qte}`));
    info.appendChild(titre);

    const sous = d.detail ? `${d.detail} · ${d.date}` : d.date;
    info.appendChild(creer('div', 'petit', sous));

    const supprimer = creer('button', 'btn-suppr', '✕');
    supprimer.title = 'Supprimer';
    supprimer.addEventListener('click', () => {
      dedicaces = dedicaces.filter((x) => x.id !== d.id);
      sauverDedicaces();
      afficherDedicaces();
    });

    ligne.appendChild(info);
    ligne.appendChild(supprimer);
    liste.appendChild(ligne);
  });
}

$('#btn-sj-ajouter').addEventListener('click', () => {
  const nom = $('#sj-nom').value.trim();
  const qte = Math.floor(Number($('#sj-qte').value));
  if (!nom) return alert('Entre un nom.');
  if (!qte || qte < 1) return alert('Entre une quantité valide.');

  dedicaces.unshift({
    id: Date.now(),
    nom,
    type: $('#sj-type').value,
    detail: $('#sj-detail').value.trim(),
    qte,
    date: new Date().toLocaleDateString('fr-FR'),
  });
  sauverDedicaces();
  afficherDedicaces();
  $('#sj-detail').value = '';
});

$('#btn-partager').addEventListener('click', async () => {
  const texte = "Découvre الحافظ : horaires de prière, Coran, duas et tasbih. Partager un savoir utile est une sadaqa jariya 🤍";
  const url = window.location.href;
  if (navigator.share) {
    try { await navigator.share({ title: 'الحافظ', text: texte, url }); } catch (e) { /* annulé */ }
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(texte + ' ' + url), '_blank');
  }
});

afficherDedicaces();
