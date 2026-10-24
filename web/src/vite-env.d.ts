/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASIS_APP_VERSION?: string;
  readonly VITE_BASIS_GITHUB_REPO?: string;
}

declare module "*.css" {}
