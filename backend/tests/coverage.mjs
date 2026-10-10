/**
 * วัด coverage ของ backend จากชุดทดสอบ API:  npm run test:coverage
 *
 *   1. สร้างฐานข้อมูลทดสอบแยก (pos_stock_test) — ไม่แตะฐานข้อมูลร้าน
 *   2. เปิด backend ในโปรเซสนี้ (พอร์ต 4001) ภายใต้ c8 ซึ่งจดว่าโค้ดบรรทัดไหนถูกเรียก
 *   3. รันชุดทดสอบ API (api.test.mjs) ยิงเข้า backend ตัวนี้
 *   4. ปิด backend แล้วลบฐานข้อมูลทดสอบ -> ได้ coverage/lcov.info ให้ SonarQube อ่าน
 *
 * ต้องเปิด Docker (คอนเทนเนอร์ฐานข้อมูล pos_stock_db) ไว้ก่อน
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DB = 'pos_stock_test';
const PORT = 4001;
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTAINER = process.env.DB_CONTAINER || 'pos_stock_db';
const DB_USER = process.env.PGUSER || 'pos_admin';

if (process.env.PGDATABASE === TEST_DB) throw new Error('ฐานข้อมูลร้านตั้งชื่อซ้ำกับฐานข้อมูลทดสอบ');

/** รันคำสั่งแล้วรอจบ คืนรหัสจบ */
function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: BACKEND_DIR, stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('error', reject);
    p.on('close', resolve);
  });
}

async function psql(sql) {
  const code = await run('docker', ['exec', CONTAINER, 'psql', '-q', '-U', DB_USER, '-d', 'postgres', '-c', sql]);
  if (code !== 0) throw new Error(`คำสั่งฐานข้อมูลไม่สำเร็จ: ${sql}`);
}

const dropTestDb = () => psql(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);

let exitCode = 1;
try {
  console.log(`\n[1/3] สร้างฐานข้อมูลทดสอบ ${TEST_DB} ...`);
  await dropTestDb();
  await psql(`CREATE DATABASE ${TEST_DB}`);
  if (await run('node', ['scripts/migrate.js'], { PGDATABASE: TEST_DB }) !== 0) throw new Error('สร้างตารางในฐานข้อมูลทดสอบไม่สำเร็จ');

  console.log(`[2/3] เปิด backend (พอร์ต ${PORT}) ...`);
  // dotenv ไม่ทับค่าที่ตั้งไว้แล้ว -> backend ใช้ฐานข้อมูลทดสอบ
  process.env.PGDATABASE = TEST_DB;
  process.env.PORT = String(PORT);
  const { pool } = await import('../src/db.js');
  await import('../src/server.js');

  console.log('[3/3] รันชุดทดสอบ API ...');
  exitCode = await run('node', ['tests/api.test.mjs'], { API_BASE: `http://localhost:${PORT}/api` });
  await pool.end();
} catch (err) {
  console.error('\n  วัด coverage ไม่สำเร็จ:', err.message);
} finally {
  await dropTestDb().catch((e) => console.error('  ลบฐานข้อมูลทดสอบไม่สำเร็จ:', e.message));
}
// ออกด้วย process.exit เพื่อให้ c8 เขียนผล coverage ทันที (ไม่ต้องรอ server ปิดเอง)
process.exit(exitCode);
