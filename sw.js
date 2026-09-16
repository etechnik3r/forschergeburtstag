/* Service Worker für den Forscher-Geburtstag.
   Zweck: Die App installierbar machen (PWA) und offline nutzbar halten,
   ABER: Wenn online, immer den AKTUELLEN Stand laden – kein hängenbleiben
   auf einer alten Version.

   Strategie:
   - Seiten-Aufrufe (die HTML-Seite selbst): NETWORK-FIRST.
       Erst aus dem Netz laden (aktuellster Stand), Cache nur als
       Offline-Reserve. So sieht man nach jedem Neuladen sofort die
       neueste Version.
   - Bilder, Videos, Manifest, Icons: STALE-WHILE-REVALIDATE.
       Sofort aus dem Cache anzeigen (schnell/offline) UND im Hintergrund
       eine frische Kopie holen, die beim nächsten Mal genutzt wird. */

const CACHE = "forscher-v14";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon.png",
  "./elektro_start_1.png",
  "./elektro_start_2.png",
  "./elektro_start_3.png",
  "./elektro_start_4.png",
  "./elektro_start_5.png",
  "./elektro_start_6.png"
];

self.addEventListener("install", (e) => {
  // Neue Version sofort übernehmen, nicht auf das Schließen aller Tabs warten.
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Erlaubt der Seite, ein sofortiges Update anzustoßen.
self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

function isHtmlRequest(req) {
  return req.mode === "navigate" ||
         (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // nur eigene Dateien

  // Seite selbst -> NETWORK-FIRST (immer aktuellster Stand, wenn online).
  // cache:"no-store" umgeht den Browser-HTTP-Cache, damit wirklich die
  // neueste Datei vom Server geholt wird (nicht eine 10-Min-alte Kopie).
  if (isHtmlRequest(req)) {
    e.respondWith(
      fetch(req.url, { cache: "no-store" })
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // Alles andere (Bilder, Videos, …) -> STALE-WHILE-REVALIDATE.
  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
