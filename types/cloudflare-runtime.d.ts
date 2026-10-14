/**
 * Deklarasi minimal tipe runtime Cloudflare yang dipakai aplikasi (Skill 24).
 *
 * Sengaja TIDAK memakai runtime types lengkap dari `wrangler types`: tipe itu
 * menimpa tipe DOM global (mis. `Response.json()` menjadi `unknown`) sehingga
 * komponen client gagal type-check. `cloudflare-env.d.ts` dibangkitkan dengan
 * `--include-runtime=false` (npm run cf:typegen) dan bergantung pada file ini.
 *
 * Subset API D1: https://developers.cloudflare.com/d1/worker-api/
 */

interface D1Meta {
  duration: number;
  changes: number;
  last_row_id: number;
  changed_db: boolean;
  rows_read: number;
  rows_written: number;
}

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: true;
  meta: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
