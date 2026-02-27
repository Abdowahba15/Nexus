const CACHE_NAME = 'nexus-games-v1';
const STATIC_CACHE = 'nexus-static-v1';
const DYNAMIC_CACHE = 'nexus-dynamic-v1';

// الملفات التي يتم تخزينها مؤقتاً بشكل دائم
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png'
];

// الملفات المراد تخزينها مؤقتاً مع استراتيجية Network First
const API_CACHE_PATTERNS = [
    /\/api\//,
    /\/images\//
];

// التثبيت - تخزين الملفات الثابتة
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// التفعيل - حذف الكاشات القديمة
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// استراتيجيات Fetching
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // استراتيجية: Cache First للملفات الثابتة (الصور، الأيقونات)
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request));
    }
    // استراتيجية: Network First للـ API
    else if (isApiRequest(url)) {
        event.respondWith(networkFirst(request));
    }
    // استراتيجية: Stale While Revalidate للصفحات
    else {
        event.respondWith(staleWhileRevalidate(request));
    }
});

// التحقق من نوع الملف
function isStaticAsset(url) {
    const staticExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

function isApiRequest(url) {
    return API_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

// استراتيجية Cache First
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // إرجاع الصورة المخبأة + تحديثها في الخلفية
        updateCache(request);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        return new Response('Image not available', { status: 404 });
    }
}

// استراتيجية Network First
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('Offline', { status: 503 });
    }
}

// استراتيجية Stale While Revalidate
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, networkResponse.clone());
            });
        }
        return networkResponse;
    }).catch(() => cachedResponse);
    
    return cachedResponse || fetchPromise;
}

// تحديث الكاش في الخلفية
async function updateCache(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse);
        }
    } catch (error) {
        // لا شيء، نستمر في استخدام النسخة المخبأة
    }
}

// معالجة الرسائل من الصفحة
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.action === 'clearCache') {
        caches.delete(DYNAMIC_CACHE).then(() => {
            console.log('[Service Worker] Cache cleared');
        });
    }
});