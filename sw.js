const CACHE_VERSION = 'workbench-v72';

self.addEventListener('install', e => {
  self.skipWaiting();
  // 清理旧缓存
  caches.keys().then(names => {
    names.forEach(name => {
      if (name !== CACHE_VERSION) caches.delete(name);
    });
  });
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll([
      './',
      './index.html',
      './manifest.json'
    ]).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names => {
      return Promise.all(names.map(name => {
        if (name !== CACHE_VERSION) return caches.delete(name);
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API 请求：直接走网络，不缓存
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 图标和manifest：网络优先，不缓存（确保每次拿到最新）
  if (url.pathname.match(/\.(png|jpg|svg|ico)$/) || url.pathname.includes('manifest')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  
  // HTML：网络优先，失败时用缓存
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  
  // 其他资源：缓存优先
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
