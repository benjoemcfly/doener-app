self.addEventListener('message', (e) => {
  const data = e.data || {};
  if (data.type === 'VIBRATE') {
    self.registration.showNotification('Abholbereit!', {
      body: data.body || 'Deine Bestellung ist ready.',
      vibrate: data.pattern || [400, 80, 400, 120, 600],
      requireInteraction: false,
      silent: false,   // Ton je nach Systemprofil
      badge: '/favicon.ico',
      icon: '/favicon.ico'
    });
  }
});
