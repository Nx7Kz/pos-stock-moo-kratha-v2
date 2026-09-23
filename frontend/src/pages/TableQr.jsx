import { useState, useEffect } from 'react';
import { api, auth } from '../lib/api';
import { TopBar } from '../components/Layout';
import { useToast, Spinner, QrImage } from '../components/ui';
import { isLocalHost, defaultBase, lanUrl, resetCustomerBase, customerUrl } from '../lib/customerUrl';

export default function TableQr() {
  const toast = useToast();
  const isOwner = auth.user?.role === 'OWNER';

  const [tables, setTables] = useState([]);
  const [shopName, setShopName] = useState('');
  const [lan, setLan] = useState([]);
  const [saved, setSaved] = useState(null);
  const [base, setBase] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/tables'), api.get('/tables/qr-info'), api.get('/settings')])
      .then(([t, q, s]) => {
        setTables(t.data);
        setLan(q.data.lan_addresses);
        setSaved(q.data.customer_base_url);
        setBase(defaultBase(q.data.customer_base_url, q.data.lan_addresses));
        setShopName(s.data.shop_name || '');
      })
      .catch((e) => toast(e.message, 'err'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanBase = base.trim().replace(/\/+$/, '');
  const urlOf = (t) => customerUrl(cleanBase, t.table_no);

  async function saveBase() {
    setBusy(true);
    try {
      await api.patch('/settings', { customer_base_url: cleanBase });
      setSaved(cleanBase);
      resetCustomerBase();
      toast('บันทึกที่อยู่เว็บสำหรับ QR แล้ว', 'ok');
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <><TopBar title="QR Code ประจำโต๊ะ" /><Spinner /></>;

  return (
    <>
      <TopBar title="QR Code ประจำโต๊ะ" sub="QR ติดโต๊ะถาวร · ลูกค้าสแกนแล้วกรอกรหัส 4 หลักที่ได้ตอนเปิดโต๊ะ">
        <button className="btn btn-primary" onClick={() => window.print()} disabled={!cleanBase}>
          พิมพ์ QR ทุกโต๊ะ
        </button>
      </TopBar>

      <div className="content stack">
        <div className="card no-print">
          <div className="card-body stack-sm">
            <div className="field">
              <label>ที่อยู่เว็บที่ลูกค้าจะเปิด (มือถือต้องเข้าถึงที่อยู่นี้ได้)</label>
              <div className="row">
                <input className="input grow" value={base} onChange={(e) => setBase(e.target.value)}
                  placeholder="เช่น http://192.168.1.108:5173" />
                {isOwner && (
                  <button className="btn" onClick={saveBase} disabled={busy || !cleanBase || cleanBase === saved}>
                    บันทึก
                  </button>
                )}
              </div>
            </div>

            {lan.length > 0 && (
              <div className="row wrap small">
                <span className="muted">IP ของเครื่องนี้:</span>
                {lan.map((ip) => {
                  const u = lanUrl(ip);
                  return <button key={ip} className="btn btn-sm" onClick={() => setBase(u)}>{u}</button>;
                })}
              </div>
            )}

            {isLocalHost(cleanBase) ? (
              <div className="alert alert-danger">
                <span>⚠</span>
                <div>มือถือลูกค้าเปิด <strong>localhost</strong> ไม่ได้ — เลือก IP ของเครื่องด้านบน หรือใส่ชื่อโดเมนของร้าน</div>
              </div>
            ) : (
              <div className="alert alert-info">
                <span>ℹ</span>
                <div>
                  ลองสแกน QR ด้วยมือถือที่ต่อ WiFi เดียวกับร้านก่อนพิมพ์จริง
                  ถ้า IP ของเครื่องเปลี่ยน (เช่น รีสตาร์ทเราเตอร์) ต้องพิมพ์ QR ใหม่
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="qr-sheet">
          {tables.map((t) => (
            <div key={t.id} className="qr-card" title={urlOf(t)}>
              <div className="qr-card-shop">{shopName}</div>
              <div className="qr-card-table">โต๊ะ {t.table_no}</div>
              <QrImage payload={urlOf(t)} size={180} />
              <div className="qr-card-hint">สแกนแล้วกรอกรหัสโต๊ะจากพนักงาน</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
