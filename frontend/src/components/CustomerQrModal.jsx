import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getCustomerBase, customerUrl, isLocalHost } from '../lib/customerUrl';
import { dateTime } from '../lib/format';
import { Modal, QrImage, useToast } from './ui';

/**
 * QR สั่งอาหารของบิลที่เปิดอยู่ พร้อมรหัสโต๊ะ 4 หลัก
 * พิมพ์เป็นใบเล็ก ๆ วางที่โต๊ะ หรือให้ลูกค้าสแกนจากจอได้เลย
 */
export default function CustomerQrModal({ order, onClose, onChanged, extraActions }) {
  const toast = useToast();
  const [base, setBase] = useState('');
  const [shopName, setShopName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCustomerBase().then(setBase).catch((e) => toast(e.message, 'err'));
    api.get('/settings').then((r) => setShopName(r.data.shop_name || '')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const code = order.access_code;
  // QR ไม่ฝังรหัส ลูกค้าต้องพิมพ์รหัส 4 หลักจากใบนี้เอง (กันคนถ่ายรูป QR ไปสั่งทีหลัง)
  const url = base && code ? customerUrl(base, order.table_no) : '';

  async function regenerate() {
    if (code && !confirm(`เปลี่ยนรหัสโต๊ะ ${order.table_no}?\nลูกค้าที่ใช้รหัสเดิมจะสั่งอาหารไม่ได้ ต้องสแกน QR ใหม่`)) return;
    setBusy(true);
    try {
      const r = await api.post(`/orders/${order.id}/access-code`);
      toast(r.message, 'ok');
      onChanged?.(r.data);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  /** พิมพ์เฉพาะใบ QR ไม่เอาหน้าจอส่วนอื่นติดไปด้วย */
  function printSlip() {
    document.body.classList.add('print-slip');
    const done = () => {
      document.body.classList.remove('print-slip');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }

  return (
    <Modal
      title={`QR สั่งอาหาร · โต๊ะ ${order.table_no}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={regenerate} disabled={busy}>{code ? 'เปลี่ยนรหัส' : 'สร้างรหัส'}</button>
          <span className="grow" />
          {extraActions}
          <button className="btn btn-primary" onClick={printSlip} disabled={!url}>พิมพ์ใบ QR</button>
        </>
      }
    >
      {!code ? (
        <div className="alert alert-warn">
          <span>⚠</span>
          <div>บิลนี้ยังไม่มีรหัสโต๊ะ กด <strong>สร้างรหัส</strong> เพื่อให้ลูกค้าสแกนสั่งอาหารเองได้</div>
        </div>
      ) : (
        <div className="stack">
          <div className="qr-slip">
            {shopName && <div className="qr-card-shop">{shopName}</div>}
            <div className="qr-card-table">โต๊ะ {order.table_no}</div>
            {url ? <QrImage payload={url} size={200} /> : <div className="empty">กำลังสร้าง QR…</div>}
            <div className="qr-slip-code-label">รหัสโต๊ะ</div>
            <div className="qr-slip-code">{code}</div>
            <div className="qr-card-hint">สแกนแล้วกรอกรหัสโต๊ะ · ชำระเงินที่เคาน์เตอร์</div>
            <div className="tiny faint">{order.order_no} · {dateTime(order.opened_at)}</div>
          </div>

          {base && isLocalHost(base) && (
            <div className="alert alert-danger no-print">
              <span>⚠</span>
              <div>QR ชี้ไปที่ localhost มือถือลูกค้าจะเปิดไม่ได้ — ตั้งที่อยู่เว็บที่หน้า <strong>QR Code ประจำโต๊ะ</strong></div>
            </div>
          )}
          <div className="tiny faint center no-print">
            ลูกค้าสแกน QR แล้วกรอกรหัสนี้ · ใช้ได้จนกว่าจะปิดบิล
          </div>
        </div>
      )}
    </Modal>
  );
}
