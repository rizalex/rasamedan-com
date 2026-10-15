import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Konfigurasi default: tanpa cache inkremental/ISR, karena semua halaman data
// memakai `force-dynamic` (baca DB per request).
export default defineCloudflareConfig();
