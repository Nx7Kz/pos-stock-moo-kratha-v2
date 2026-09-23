import { api } from './api';

export const isLocalHost = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

const withPort = (host) => `${location.protocol}//${host}${location.port ? `:${location.port}` : ''}`;

/** ที่อยู่ตั้งต้น: ค่าที่บันทึกไว้ > ที่อยู่ที่เปิดอยู่ (ถ้าไม่ใช่ localhost) > IP ของเครื่องในวง LAN */
export function defaultBase(saved, lan) {
  if (saved) return saved;
  if (!isLocalHost(location.origin)) return location.origin;
  if (lan.length) return withPort(lan[0]);
  return location.origin;
}

export const lanUrl = withPort;

let cached = null;

/** ที่อยู่เว็บที่มือถือลูกค้าเปิดได้ ใช้สร้าง QR (จำไว้หลังเรียกครั้งแรก) */
export async function getCustomerBase() {
  if (!cached) {
    cached = api.get('/tables/qr-info')
      .then((r) => defaultBase(r.data.customer_base_url, r.data.lan_addresses).replace(/\/+$/, ''))
      .catch((e) => { cached = null; throw e; });
  }
  return cached;
}

/** ลืมค่าที่จำไว้ เมื่อเจ้าของร้านบันทึกที่อยู่ใหม่ */
export const resetCustomerBase = () => { cached = null; };

/** ลิงก์หน้าสั่งอาหารของโต๊ะ ถ้าใส่รหัสมาด้วย ลูกค้าสแกนแล้วเข้าได้เลยไม่ต้องกรอก */
export const customerUrl = (base, tableNo, code) =>
  `${base}/customer/${encodeURIComponent(tableNo)}${code ? `?code=${encodeURIComponent(code)}` : ''}`;
