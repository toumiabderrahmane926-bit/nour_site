# الحافظ (Al-Hafiz)

Site web en HTML / CSS / JavaScript pur. Aucune compilation ni installation nécessaire.

## Pages
- **Prières** : horaires, compte à rebours et notification à l'heure de chaque prière (API Aladhan)
- **Coran** : 114 sourates, 10 lecteurs au choix, traduction française et/ou anglaise (API AlQuran Cloud)
- **Duas** : invocations du quotidien avec translittération et traduction
- **Tasbih** : compteur de dhikr
- **Sadaqa Jariya** : chacun dédie ses bonnes actions au nom de son choix (liste enregistrée sur l'appareil)

## Notifications de prière
Dans l'onglet Prières, clique sur « Activer les notifications » et autorise-les dans le navigateur.
Garde l'onglet du site ouvert pour recevoir le rappel à l'heure.

## Notifications
Clique sur « Activer les notifications » dans l'onglet Prières. À l'heure de chaque prière, une notification s'affiche (par exemple « صلاة المغرب »). Garde le site ouvert dans un onglet. Le site doit être en ligne en HTTPS (GitHub Pages) pour que ça marche bien sur téléphone.

## Lancer le site
Double-clic sur `index.html`, ou avec un serveur local :

    npx serve .
    # ou
    python3 -m http.server 8000

## Mettre en ligne
Dépose les fichiers (index.html, style.css, script.js) sur GitHub Pages, Netlify ou Vercel.
