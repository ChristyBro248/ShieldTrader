/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLET_CONNECT_PROJECT_ID?: string;
  readonly VITE_LEAD_TRADING_ADDRESS?: string;
  readonly VITE_CUSDT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}