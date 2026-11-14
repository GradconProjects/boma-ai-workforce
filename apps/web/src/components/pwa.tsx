"use client";

import { useEffect } from "react";

/** Registers the service worker so the app can be installed and opened offline. */
export function Pwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

/** Forget this device's copies of owner pages and chat (used on the sign-in page). */
export function ForgetDevice() {
  useEffect(() => {
    try {
      localStorage.removeItem("boma-chat-history-v1");
      localStorage.removeItem("boma-chat-outbox-v1");
    } catch {
      /* ignore */
    }
    navigator.serviceWorker?.controller?.postMessage("clear");
  }, []);
  return null;
}
