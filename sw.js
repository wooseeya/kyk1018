// HomeFlow OS 서비스 워커 — 인터넷이 끊겨도 앱이 열리도록 파일을 폰에 저장(캐시)
// 앱(index.html)을 수정해서 다시 올릴 때는 아래 버전 숫자를 하나 올려주세요.
const VERSION = 'homeflow-v1';

// 앱 기본 파일 (설치 시 미리 저장)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// 외부 라이브러리 (Tailwind · 아이콘 · 글꼴) — 처음 쓸 때 저장해 두고 오프라인에서도 사용
const CDN_HOSTS = ['cdn.tailwindcss.com', 'unpkg.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) 앱 화면(HTML): 인터넷 되면 최신 버전, 안 되면 저장된 버전
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2) 같은 사이트 파일 · 외부 라이브러리: 저장된 것 먼저 쓰고, 뒤에서 최신으로 갱신
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin || CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(VERSION).then(cache =>
        cache.match(req).then(cached => {
          const network = fetch(req)
            .then(res => {
              if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
  // 그 외(유튜브 등 외부 링크)는 그대로 인터넷으로
});
