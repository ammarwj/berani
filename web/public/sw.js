// File ini statis di public/, tidak pernah disentuh pipeline Next — jadi tidak ada
// hash build di dalamnya. Versinya datang dari query string saat registrasi
// (components/RegisterSW.tsx mendaftarkan "/sw.js?v=<build id>"), lalu dibaca balik
// dari self.location di sini. Tanpa ini nama cache-nya konstan: HTML lama yang
// menunjuk chunk hash mati akan disajikan selamanya setelah deploy.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `berani-${VERSION}`;
const PRECACHE = ["/", "/manifest.json", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // claim() harus di dalam waitUntil dan setelah penghapusan selesai — kalau tidak,
  // klien bisa diambil alih selagi cache versi lama masih dihapus.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("berani-") && k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Hanya same-origin. Respons API membawa Authorization dan berisi data satu
  // siswa; Cache Storage tidak ikut dibersihkan clearSession() (lib/api.ts), jadi
  // menyimpannya berarti memutar ulang data itu untuk pengguna berikutnya di
  // perangkat yang sama. Ini sekaligus menghindari cache.put pada respons opaque
  // (Google Fonts), yang dilempar sebagai error.
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // offline.html hanya masuk akal untuk navigasi. Menyajikannya sebagai
          // pengganti script atau gambar yang gagal justru memunculkan error parse
          // yang membingungkan.
          if (req.mode === "navigate") return caches.match("/offline.html");
          return Response.error();
        })
      )
  );
});
