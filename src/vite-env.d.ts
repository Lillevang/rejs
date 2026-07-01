/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the url-shortener service (e.g. "https://s.jlvang.dev").
   * Optional: when unset, share links stay long and self-contained and the
   * shortener integration is disabled. Inlined at build time by Vite.
   */
  readonly VITE_SHORTENER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
