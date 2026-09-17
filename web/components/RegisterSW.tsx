"use client";

import { useEffect } from "react";

// public/sw.js tidak pernah melewati bundler, jadi tidak punya hash build sendiri.
// File ini dikompilasi, jadi build id bisa dititipkan lewat query string: ia
// mengubah byte URL service worker (browser me-reinstall SW saat URL-nya berubah)
// sekaligus menjadi nama cache di dalam sw.js.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`).catch(() => {});
    }
  }, []);
  return null;
}
