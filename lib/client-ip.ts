/**
 * Sumber IP klien terpercaya (Skill 21.2 no. 4).
 *
 * - `cf-connecting-ip`: diisi & ditimpa edge Cloudflare (workers.dev & custom
 *   domain), sehingga klien tidak bisa memalsukannya — TETAPI hanya bila request
 *   memang lewat Cloudflare. Di production header ini dipercaya hanya bila
 *   TRUST_CF_CONNECTING_IP=1 (diset di `vars` wrangler.jsonc). Tanpa flag
 *   (mis. `next start` yang terbuka langsung ke internet) klien bisa mengisinya
 *   sendiri untuk menghindari rate limit → diabaikan.
 * - Hanya di development: `x-real-ip`, lalu entri PALING KANAN `x-forwarded-for`
 *   (ditambahkan proxy lokal). Di production XFF tidak pernah dipercaya: entri
 *   kirinya bisa diisi bebas oleh klien untuk menghindari rate limit.
 */

const IP_CHARS = /^[0-9a-fA-F:.]{2,45}$/;

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return IP_CHARS.test(v) ? v : null;
}

/** IP klien, atau null bila tidak diketahui (jangan diganti nilai palsu). */
export function getClientIp(req: Request): string | null {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev || process.env.TRUST_CF_CONNECTING_IP === "1") {
    const cf = clean(req.headers.get("cf-connecting-ip"));
    if (cf) return cf;
  }
  if (isDev) {
    const real = clean(req.headers.get("x-real-ip"));
    if (real) return real;
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",");
      return clean(parts[parts.length - 1]);
    }
  }
  return null;
}

/** Perluas IPv6 ("2001:db8::1") ke 8 hextet; null bila tidak valid. */
function expandIpv6(ip: string): string[] | null {
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  return [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
}

let warnedNoIp = false;

/**
 * Kunci rate limit dari IP. IPv6 dipotong ke prefix /64 (satu pelanggan
 * biasanya memegang satu /64 utuh — tanpa ini mereka bisa berganti alamat untuk
 * menghindari limit). Tanpa IP: satu ember bersama "noip" (lebih ketat, bukan
 * lebih longgar).
 */
export function rateLimitKeyFromIp(ip: string | null): string {
  if (!ip) {
    if (process.env.NODE_ENV === "production" && !warnedNoIp) {
      warnedNoIp = true;
      console.warn("[client-ip] Header cf-connecting-ip tidak ada; rate limit memakai ember bersama.");
    }
    return "noip";
  }
  // IPv4-mapped IPv6 ("::ffff:1.2.3.4") → pakai IPv4-nya, bukan ember /64 bersama.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) return mapped[1];
  if (ip.includes(":")) {
    const parts = expandIpv6(ip.toLowerCase());
    if (parts) return parts.slice(0, 4).map((p) => p.padStart(4, "0")).join(":") + "::/64";
  }
  return ip;
}
