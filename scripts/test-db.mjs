/**
 * Uji koneksi MySQL sederhana (Acceptance Criteria Skill 1).
 * Jalankan:  npm run db:test
 * (script memuat variabel dari `.env` via flag `--env-file` di package.json)
 */
import mysql from "mysql2/promise";

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

console.log(
  `→ Mencoba koneksi ke mysql://${config.user}@${config.host}:${config.port}/${config.database}`
);

try {
  const conn = await mysql.createConnection(config);
  const [rows] = await conn.query("SELECT 1 + 1 AS result, NOW() AS server_time");
  console.log("✅ Koneksi MySQL berhasil.");
  console.log("   Test query (1 + 1):", rows[0].result);
  console.log("   Waktu server      :", rows[0].server_time);

  // Info tambahan: cek apakah tabel schema sudah ada.
  const [tables] = await conn.query("SHOW TABLES");
  const names = tables.map((t) => Object.values(t)[0]);
  const expected = [
    "products",
    "product_variants",
    "orders",
    "order_items",
    "admin_users",
  ];
  const missing = expected.filter((t) => !names.includes(t));
  if (missing.length === 0) {
    console.log("   Tabel schema      : lengkap ✅");
  } else {
    console.log(
      `   Tabel schema      : belum ada [${missing.join(", ")}] → jalankan "npm run db:schema"`
    );
  }

  await conn.end();
  process.exit(0);
} catch (err) {
  console.error("❌ Gagal koneksi ke MySQL.");
  console.error("   ", err.code ?? "", err.message);
  console.error(
    "   Pastikan server MySQL berjalan dan kredensial di `.env` benar (salin dari `.env.example`)."
  );
  process.exit(1);
}
