// App bootstrap
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import { cleanupStaleLocalStorage } from "./lib/localStorage-utils";

// Clear stale PWA caches / service workers to avoid blank-screen regressions after redeploys.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => void 0);
    });
  });
}

if ("caches" in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key.startsWith("workbox-") || key.startsWith("vite-pwa")) {
        caches.delete(key).catch(() => void 0);
      }
    });
  });
}

// Clean up stale localStorage entries on app startup
cleanupStaleLocalStorage();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </ThemeProvider>
);
