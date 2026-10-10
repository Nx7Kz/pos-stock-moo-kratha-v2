/**
 * c8 เขียนที่อยู่ไฟล์ใน coverage/lcov.info เทียบกับโฟลเดอร์ backend (และใช้ \ บน Windows)
 * แต่ SonarQube อ่านเทียบกับโฟลเดอร์บนสุดของโปรเจกต์ -> แปลงเป็น backend/src/...
 */
import fs from 'node:fs';

const file = new URL('../coverage/lcov.info', import.meta.url);
const text = fs.readFileSync(file, 'utf8')
  .replaceAll(/^SF:(?!backend\/)(.*)$/gm, (_, p) => 'SF:backend/' + p.replaceAll('\\', '/'));
fs.writeFileSync(file, text);
console.log('  coverage/lcov.info พร้อมให้ SonarQube อ่านแล้ว');
