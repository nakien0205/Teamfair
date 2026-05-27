/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Base URL of the Python student agent (no trailing slash). Production: your hosted agent; dev: leave unset to use Vite proxy. */
  readonly VITE_STUDENT_AGENT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
