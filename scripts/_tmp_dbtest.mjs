import mysql from "mysql2/promise";

for (const host of ["localhost", "127.0.0.1", "::1"]) {
  try {
    const c = await mysql.createConnection({ host, port: 3306, user: "root", password: "", database: "toko_medan", connectTimeout: 4000 });
    const [r] = await c.query("SELECT COUNT(*) AS n FROM admin_users");
    console.log(`OK   host=${host}  admin_users=${r[0].n}`);
    await c.end();
  } catch (e) {
    console.log(`FAIL host=${host}  ${e.code || ""} ${e.message}`);
  }
}
