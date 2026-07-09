import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let supabaseCachePattern: RegExp | null = null;

  if (env.VITE_SUPABASE_URL) {
    try {
      const supabaseOrigin = new URL(env.VITE_SUPABASE_URL).origin;
      supabaseCachePattern = new RegExp(
        `^${escapeRegExp(supabaseOrigin)}/(rest/v1/|functions/v1/)`,
        "i"
      );
    } catch {
      throw new Error("[vite.config] Invalid VITE_SUPABASE_URL");
    }
  } else if (mode === "production") {
    throw new Error("[vite.config] VITE_SUPABASE_URL must be set for production builds");
  }

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: env.VITE_SUPABASE_URL
        ? {
            "/functions/v1": {
              target: env.VITE_SUPABASE_URL,
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      VitePWA({
        devOptions: {
          enabled: false,
        },
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "icons/*.png"],
        manifest: {
          name: "AI Legal Armenia",
          short_name: "AI Legal",
          description: "AI-powered legal analysis platform for Armenia",
          theme_color: "#1e3a5f",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "/icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: supabaseCachePattern
            ? [
                {
                  urlPattern: supabaseCachePattern,
                  handler: "NetworkFirst",
                  options: {
                    cacheName: "supabase-api-cache",
                    networkTimeoutSeconds: 5,
                    expiration: {
                      maxEntries: 50,
                      maxAgeSeconds: 60 * 60,
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
              ]
            : [],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              const after = id.split("node_modules/")[1];
              if (!after) return "vendor";
              const parts = after.split("/");
              const pkg = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];

              if (pkg.includes("jspdf") || pkg.includes("html2canvas")) { return "pdf-render"; } if (pkg.includes("docx") || pkg.includes("pdf-parse") || pkg.includes("file-saver")) {
                return "pdf-office";
              }
              if (pkg.includes("recharts")) return "charts";
              if (pkg.includes("react-big-calendar") || pkg.includes("react-day-picker") || pkg.includes("date-fns")) {
                return "calendar-date";
              }
              if (pkg.includes("framer-motion")) return "animation";
              if (pkg.includes("@tiptap") || pkg.includes("lucide-react") || pkg.includes("prosemirror")) {
                return "editor-icons";
              }
              if (pkg.includes("react") || pkg.includes("react-router-dom") || pkg.includes("react-dom")) {
                return "react-vendor";
              }
              if (pkg.includes("@radix-ui") || pkg.includes("cmdk") || pkg.includes("vaul")) {
                return "ui-vendor";
              }
              if (pkg.includes("@supabase")) return "supabase";
              if (pkg.includes("react-markdown") || pkg.includes("remark") || pkg.includes("rehype") || pkg.includes("micromark")) {
                return "markdown";
              }

              return `vendor-${pkg.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
            }
          },
        },
      },
    },
  };
});