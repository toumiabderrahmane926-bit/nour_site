// =====================================================
//  Nour - Prières, Coran, Duas et Tasbih
//  APIs utilisées (gratuites, sans clé) :
//   - Aladhan  : horaires de prière
//   - AlQuran Cloud : texte du Coran + audio
// =====================================================

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---------- Gestion des onglets ----------
$$('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach((b) => b.classList.remove('active'));
    $$('.section').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    $('#' + btn.dataset.target).classList.add('active');
  });
});


// =====================================================
//  1. HORAIRES DE PRIÈRE
// =====================================================
const PRIERES = [
  { cle: 'Fajr',    nom: 'Fajr',            ar: 'الفجر',   priere: true },
  { cle: 'Sunrise', nom: 'Lever du soleil', ar: 'الشروق',  priere: false },
  { cle: 'Dhuhr',   nom: 'Dhuhr',           ar: 'الظهر',   priere: true },
  { cle: 'Asr',     nom: 'Asr',             ar: 'العصر', priere: true },
  { cle: 'Maghrib', nom: 'Maghrib',         ar: 'المغرب',  priere: true },
  { cle: 'Isha',    nom: 'Isha',            ar: 'العشاء',  priere: true },
];

let horaires = {};          // { Fajr: Date, Dhuhr: Date, ... }
let dejaNotifie = new Set(); // pour ne notifier qu'une fois par prière

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

    localStorage.setItem('nour-lieu', JSON.stringify(lieu));
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
    const div = document.createElement('div');
    div.className = 'priere-carte';
    div.id = 'carte-' + p.cle;
    div.innerHTML = `
      <div class="ar">${p.ar}</div>
      <div class="nom">${p.nom}</div>
      <div class="heure">${heure}</div>`;
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

function notifier(p) {
  bip();
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`C'est l'heure de ${p.nom}`, { body: 'Il est temps de prier 🕌' });
  }
}

// Boutons
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
  alert(rep === 'granted' ? 'Rappels activés ✅ (garde cet onglet ouvert)' : 'Rappels refusés.');
});

$('#methode').addEventListener('change', () => {
  const sauve = localStorage.getItem('nour-lieu');
  if (sauve) chargerHoraires(JSON.parse(sauve));
});

setInterval(tick, 1000);

// Au démarrage : on recharge le dernier lieu sauvegardé
(function initPriere() {
  const sauve = localStorage.getItem('nour-lieu');
  if (sauve) {
    const lieu = JSON.parse(sauve);
    if (lieu.ville) { $('#ville').value = lieu.ville; $('#pays').value = lieu.pays; }
    chargerHoraires(lieu);
  } else {
    $('#prochaine-nom').textContent = 'Choisis ton lieu ↓';
  }
})();


// =====================================================
//  2. CORAN
// =====================================================
const API_CORAN = 'https://api.alquran.cloud/v1';
let toutesSourates = [];

async function chargerSourates() {
  try {
    const rep = await fetch(`${API_CORAN}/surah`);
    const json = await rep.json();
    toutesSourates = json.data;
    afficherSourates(toutesSourates);
  } catch (e) {
    $('#liste-sourates').innerHTML = '<p>Erreur de chargement. Vérifie ta connexion.</p>';
  }
}

function afficherSourates(liste) {
  const conteneur = $('#liste-sourates');
  conteneur.innerHTML = '';
  liste.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'sourate-item';
    div.innerHTML = `
      <div class="num">${s.number}</div>
      <div class="ar">${s.name}</div>
      <div class="fr">${s.englishName} · ${s.numberOfAyahs} versets</div>`;
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

async function ouvrirSourate(s) {
  $('#vue-liste').classList.add('cache');
  $('#vue-lecture').classList.remove('cache');
  $('#titre-sourate').textContent = s.name;
  $('#versets').innerHTML = '<p class="centre">Chargement...</p>';

  // Audio (récitation de Mishary Alafasy)
  $('#lecteur').src = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${s.number}.mp3`;

  try {
    // On demande le texte arabe ET la traduction française en une seule requête
    const rep = await fetch(`${API_CORAN}/surah/${s.number}/editions/quran-uthmani,fr.hamidullah`);
    const json = await rep.json();
    const arabe = json.data[0].ayahs;
    const francais = json.data[1].ayahs;

    const conteneur = $('#versets');
    conteneur.innerHTML = '';
    arabe.forEach((v, i) => {
      const div = document.createElement('div');
      div.className = 'verset';
      div.innerHTML = `
        <p class="arabe"><span class="numero">${v.numberInSurah}</span>${v.text}</p>
        <p class="traduction">${francais[i].text}</p>`;
      conteneur.appendChild(div);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    $('#versets').innerHTML = '<p>Erreur de chargement de la sourate.</p>';
  }
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
    const div = document.createElement('div');
    div.className = 'dua';
    div.innerHTML = `
      <h4>${d.titre}</h4>
      <p class="arabe">${d.ar}</p>
      <p class="translit">${d.translit}</p>
      <p>${d.fr}</p>
      <button class="btn-copier secondaire">Copier</button>`;
    div.querySelector('.btn-copier').addEventListener('click', (e) => {
      navigator.clipboard.writeText(`${d.ar}\n${d.translit}\n${d.fr}`);
      e.target.textContent = 'Copié ✅';
      setTimeout(() => (e.target.textContent = 'Copier'), 1500);
    });
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
  { nom: 'SubhanAllah',      ar: 'سُبْحَانَ اللَّهِ' },
  { nom: 'Alhamdulillah',    ar: 'الْحَمْدُ لِلَّهِ' },
  { nom: 'Allahu Akbar',     ar: 'اللَّهُ أَكْبَرُ' },
  { nom: 'Astaghfirullah',   ar: 'أَسْتَغْفِرُ اللَّهَ' },
  { nom: 'La ilaha illa Allah', ar: 'لَا إِلَهَ إِلَّا اللَّهُ' },
];

let compteur = 0;
let totalJour = Number(localStorage.getItem('nour-total-' + new Date().toDateString())) || 0;

DHIKRS.forEach((d, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = d.nom;
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
  localStorage.setItem('nour-total-' + new Date().toDateString(), totalJour);
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

majDhikr();
majCompteur();
