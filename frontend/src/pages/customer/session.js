/**
 * จำรหัสโต๊ะ 4 หลักไว้ในเครื่องลูกค้า เพื่อไม่ต้องกรอกใหม่ทุกหน้า
 * ถ้าอ่าน/เขียนที่เก็บไม่ได้ (โหมดส่วนตัว) ลูกค้าแค่ต้องกรอกรหัสใหม่ ไม่ทำให้หน้าพัง
 */
const key = (tableNo) => `table_code:${tableNo}`;

export function getCode(tableNo) {
  try { return localStorage.getItem(key(tableNo)) || ''; } catch { return ''; }
}

export function setCode(tableNo, code) {
  try { localStorage.setItem(key(tableNo), code); } catch { /* ไม่เป็นไร */ }
}

export function clearCode(tableNo) {
  try { localStorage.removeItem(key(tableNo)); } catch { /* ไม่เป็นไร */ }
}

/** ตัวเลือกสำหรับเรียก API ฝั่งลูกค้า: ไม่ใช้ token พนักงาน แต่แนบรหัสโต๊ะไปแทน */
export const publicOpts = (tableNo) => ({ noAuth: true, headers: { 'X-Table-Code': getCode(tableNo) } });

/** error ที่เกี่ยวกับรหัสโต๊ะ / โต๊ะยังไม่เปิด -> คืน { reason, message } ให้หน้าเว็บแสดงหน้ากรอกรหัส */
export function sessionProblem(err) {
  const reason = err?.details?.reason;
  return reason ? { reason, message: err.message } : null;
}
