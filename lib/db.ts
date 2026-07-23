import mysql from "mysql2/promise";

/**
 * Koneksi MySQL terpusat memakai connection pool (`mysql2/promise`).
 * Kredensial diambil dari environment variables (lihat `.env.example`).
 *
 * mysql2 dipilih karena pure-JS (tanpa native binary), aman di-deploy di
 * cPanel shared hosting (lihat AGENTS.md bagian 2).
 *
 * SELALU gunakan parameterized query (tanda `?`) untuk mencegah SQL injection.
 * Contoh:  const rows = await query("SELECT * FROM products WHERE id = ?", [id]);
 */

declare global {
  // Cache pool antar hot-reload di development agar tidak membuat koneksi baru
  // setiap perubahan file.
  // eslint-disable-next-line no-var
  var __rasaMedanPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4_general_ci",
    // Rupiah disimpan sebagai integer; pastikan angka besar tetap Number.
    dateStrings: false,
  });
}

export const pool: mysql.Pool =
  global.__rasaMedanPool ?? (global.__rasaMedanPool = createPool());

/**
 * Helper query dengan tipe generik untuk hasil SELECT.
 * @returns array baris hasil query.
 */
export async function query<T = mysql.RowDataPacket[]>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export default pool;
