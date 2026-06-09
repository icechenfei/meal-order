const CACHE_NAME = 'meal-order-v6';
const BASE = '/meal-order';
const STATIC_ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/admin.html',
  BASE + '/login.html',
  BASE + '/css/style.css',
  BASE + '/js/auth.js',
  BASE + '/js/common.js',
  BASE + '/js/app.js',
  BASE + '/js/admin.js'
];

// 安装：缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求策略：网络优先，失败回退缓存
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase') || url.hostname.includes('jsdelivr') || url.hostname.includes('github')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
