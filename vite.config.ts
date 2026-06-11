import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env variables, regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");

  // Map Supabase environment variables from Vercel integration to Vite prefixes at build time
  const supabaseUrl = process.env.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl) {
    process.env.VITE_SUPABASE_URL = supabaseUrl;
  }
  if (supabaseAnonKey) {
    process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey;
  }

  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG || env.SENTRY_ORG || "teamfair";
  const sentryProject = process.env.SENTRY_PROJECT || env.SENTRY_PROJECT || "sentry-teamfair";
  const sentryUrl = process.env.SENTRY_URL || env.SENTRY_URL || "https://de.sentry.io/";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api/student-agent": {
          target: "http://127.0.0.1:8010",
          changeOrigin: true,
          rewrite: pathStr => pathStr.replace(/^\/api\/student-agent/, "") || "/",
        },
      },
    },
    build: {
      sourcemap: true,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      sentryAuthToken && sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        url: sentryUrl,
        sourcemaps: {
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
