/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPF_PUBLIC_ENVIRONMENT?: string;
  readonly VITE_MAPF_CORE_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
