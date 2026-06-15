// Service worker minimal : permet l'installation en PWA sur iPhone ("Ajouter à l'écran d'accueil").
// Pas de cache offline volontaire ici : les scores doivent toujours être à jour.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', () => {});
