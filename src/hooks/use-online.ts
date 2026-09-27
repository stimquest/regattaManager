"use client";

import * as React from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Connexion réseau de l'appareil ; `true` côté serveur pour ne rien afficher par défaut. */
export function useOnline() {
  return React.useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
