export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const workerUrl = new URL("./sw.js", document.baseURI);
    void navigator.serviceWorker.register(workerUrl, { updateViaCache: "none" }).catch((error: unknown) => {
      console.warn("PWA service worker registration failed", error);
    });
  }, { once: true });
}
