-- ===========================================================================
-- Skill 28: index untuk pembersihan catatan rate limit basi.
-- Sweep `DELETE ... WHERE ts < ?` (lib/rate-limit.ts) tidak bisa memakai index
-- (bucket, ts) dari 0001 karena kolom pertamanya `bucket`, sehingga memindai
-- seluruh tabel — dengan banyak IP penyerang, rows read bisa menghabiskan kuota
-- harian D1 Free. Index ini membuat sweep hanya membaca baris yang basi.
-- (Catatan: komentar di 0001 yang menyebut rate limit "masih in-memory" sudah
-- usang — sejak Skill 28 rate limit memakai tabel ini.)
-- ===========================================================================
CREATE INDEX idx_login_failures_ts ON login_failures (ts);
