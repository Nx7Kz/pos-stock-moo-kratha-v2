import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { TopBar } from '../components/Layout';
import { useToast, Spinner, QrImage } from '../components/ui';
import { baht, qty as fmtQty, dateTime } from '../lib/format';

/**
 * ใบแจ้งรายการ (ก่อนชำระเงิน) — พิมพ์ให้ลูกค้าตรวจรายการที่สั่งทั้งหมด
 * ท้ายบิลมี QR พร้อมเพย์ที่ใส่ยอดที่ต้องจ่ายไว้แล้ว ลูกค้าสแกนจ่ายได้ทันที
 */
export default function BillPrint() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [bill, setBill] = useState(null);
  const [qr, setQr] = useState(null);
  const [printedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    Promise.all([api.get(`/payments/receipt/${id}`), api.get(`/payments/qr/${id}`)])
      .then(([b, q]) => { setBill(b.data); setQr(q.data); })
      .catch((e) => toast(e.message, 'err'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!bill || !qr) return <><TopBar title="พิมพ์บิล" /><Spinner /></>;

  const paidBefore = bill.payments.reduce((s, p) => s + p.amount, 0);
  const isPaid = bill.status === 'PAID';
  const showQr = !isPaid && bill.status !== 'VOID' && Number(qr.amount) > 0;

  return (
    <>
      <TopBar title="พิมพ์บิล" sub={`${bill.order_no} · โต๊ะ ${bill.table_no}`}>
        <button className="btn" onClick={() => nav(-1)}>กลับ</button>
        <button className="btn btn-primary" onClick={() => window.print()}>พิมพ์ / บันทึกเป็น PDF</button>
      </TopBar>

      <div className="content">
        <div className="receipt">
          <div className="receipt-center">
            <div style={{ fontWeight: 700, fontSize: 14 }}>{bill.shop.name}</div>
            <div>{bill.shop.branch}</div>
            <div className="tiny">โทร. {bill.shop.phone}</div>
            <div className="bill-title">ใบแจ้งรายการอาหาร</div>
            <div className="tiny faint">(ไม่ใช่ใบเสร็จรับเงิน)</div>
          </div>

          <hr />

          <div className="receipt-row"><span>เลขที่บิล</span><span>{bill.order_no}</span></div>
          <div className="receipt-row"><span>โต๊ะ</span><span className="bold">{bill.table_no} · {bill.guest_count} ท่าน</span></div>
          <div className="receipt-row"><span>เปิดโต๊ะ</span><span>{dateTime(bill.opened_at)}</span></div>
          <div className="receipt-row"><span>พิมพ์เมื่อ</span><span>{dateTime(printedAt)}</span></div>

          <hr />

          {bill.items.map((it) => (
            <div key={it.id} style={{ padding: '3px 0' }}>
              <div className="receipt-item">
                <span>{it.name_th}</span>
                <span className="num">{baht(it.line_total)}</span>
              </div>
              <div className="tiny faint">{fmtQty(it.qty)} × {baht(it.unit_price)}</div>
            </div>
          ))}
          <div className="tiny faint" style={{ marginTop: 4 }}>รวม {bill.items.length} รายการ</div>

          <hr />

          <div className="receipt-row"><span>ยอดรวม</span><span className="num">{baht(bill.subtotal)}</span></div>
          {Number(bill.discount) > 0 && (
            <div className="receipt-row"><span>ส่วนลด</span><span className="num">−{baht(bill.discount)}</span></div>
          )}
          {Number(bill.service_charge) > 0 && (
            <div className="receipt-row"><span>ค่าบริการ</span><span className="num">{baht(bill.service_charge)}</span></div>
          )}
          {Number(bill.vat_amount) > 0 && (
            <div className="receipt-row">
              <span>ภาษีมูลค่าเพิ่ม {bill.vat_rate}%{bill.vat_included ? ' (รวมในราคา)' : ''}</span>
              <span className="num">{baht(bill.vat_amount)}</span>
            </div>
          )}

          <hr />
          <div className="receipt-row big"><span>ยอดสุทธิ</span><span className="num">{baht(bill.grand_total)}</span></div>
          {!isPaid && paidBefore > 0 && (
            <>
              <div className="receipt-row"><span>รับชำระแล้ว</span><span className="num">−{baht(paidBefore)}</span></div>
              <div className="receipt-row big"><span>คงเหลือที่ต้องชำระ</span><span className="num">{baht(qr.amount)}</span></div>
            </>
          )}
          <hr />

          {showQr && (
            <div className="bill-qr">
              <div className="bold">สแกนจ่ายด้วยแอปธนาคาร</div>
              <QrImage payload={qr.qr_payload} size={170} />
              <div className="bill-qr-amount">{baht(qr.amount)} บาท</div>
              <div className="tiny">พร้อมเพย์ · รับเงินได้จากทุกธนาคาร</div>
              <div className="tiny faint">ยอดเงินใส่ไว้ใน QR แล้ว — ตรวจชื่อบัญชีก่อนกดยืนยัน</div>
              <div className="tiny faint">โอนแล้วกรุณาแสดงสลิปที่เคาน์เตอร์</div>
            </div>
          )}
          {isPaid && <div className="receipt-center bold">ชำระเงินเรียบร้อยแล้ว</div>}

          <hr />
          <div className="receipt-center tiny">
            <div>ขอบคุณที่ใช้บริการ</div>
            <div>แล้วพบกันใหม่นะครับ/ค่ะ</div>
          </div>
        </div>
      </div>
    </>
  );
}
