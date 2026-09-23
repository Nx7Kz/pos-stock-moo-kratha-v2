import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast, Spinner, Empty } from '../../components/ui';
import { baht, qty as fmtQty, timeOnly } from '../../lib/format';
import { setCode, clearCode, publicOpts, sessionProblem } from './session';
import CodeGate from './CodeGate';

/**
 * รายการที่สั่งของโต๊ะ — ลูกค้าไม่ต้องจ่ายผ่านมือถือ
 * กดเช็คบิลเมื่อทานเสร็จ แล้วไปชำระเงินที่เคาน์เตอร์
 */
export default function CustomerBill() {
  const { tableNo } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  const [bill, setBill] = useState(null);
  const [paid, setPaid] = useState(false);     // บิลที่เคยเห็นหายไป = พนักงานรับชำระแล้ว
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const seenOrder = useRef(null);

  async function load() {
    try {
      const r = await api.get(`/public/tables/${tableNo}/bill`, publicOpts(tableNo));
      seenOrder.current = r.data.order_no;
      setBill(r.data);
      setProblem(null);
    } catch (e) {
      const p = sessionProblem(e);
      if (!p) return toast(e.message, 'err');
      if (p.reason === 'CODE_INVALID' || p.reason === 'TABLE_NOT_OPEN') clearCode(tableNo);
      setBill(null);
      // บิลที่เคยเห็นปิดไปแล้ว = พนักงานรับชำระที่เคาน์เตอร์เรียบร้อย
      if (seenOrder.current && p.reason === 'TABLE_NOT_OPEN') setPaid(true);
      else setProblem(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);   // อัปเดตยอด และรู้ว่าชำระที่เคาน์เตอร์เสร็จแล้ว
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNo]);

  async function callBill() {
    if (!confirm('ต้องการเช็คบิลตอนนี้ใช่ไหม?\nหลังเช็คบิลจะสั่งอาหารเพิ่มเองไม่ได้')) return;
    setBusy(true);
    try {
      await api.post(`/public/tables/${tableNo}/bill`, null, publicOpts(tableNo));
      toast('เช็คบิลแล้ว กรุณาชำระเงินที่เคาน์เตอร์', 'ok');
      await load();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="กำลังโหลดรายการ…" />;
  if (problem && !paid) {
    return (
      <CodeGate tableNo={tableNo} problem={problem} onRetry={load}
        onSubmit={async (code) => { setCode(tableNo, code); await load(); }} />
    );
  }

  const isBilling = bill?.status === 'BILLING';

  return (
    <>
      <div className="cust-top">
        <div className="cust-top-inner">
          <button className="btn btn-sm" onClick={() => nav(`/customer/${tableNo}`)}>‹ เมนู</button>
          <div className="grow center">
            <div className="bold">รายการที่สั่ง</div>
            <div className="tiny faint">โต๊ะ {tableNo}</div>
          </div>
          <span style={{ width: 58 }} />
        </div>
      </div>

      <div className="cust-shell">
        <div className="content">
          {paid && !bill ? (
            <Empty icon="✅">
              ชำระเงินเรียบร้อยแล้ว
              <div className="small" style={{ marginTop: 6 }}>ขอบคุณที่ใช้บริการ แล้วพบกันใหม่นะครับ/ค่ะ</div>
            </Empty>
          ) : !bill ? (
            <Empty icon="🥢">
              ยังไม่มีรายการสั่งอาหาร
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-accent" onClick={() => nav(`/customer/${tableNo}`)}>เลือกเมนู</button>
              </div>
            </Empty>
          ) : (
            <div className="pay-grid">
              <div className="card">
                <div className="card-head">
                  <h2>รายการอาหารของโต๊ะนี้</h2>
                  <span className="sub">{bill.guest_count} ท่าน · เปิดโต๊ะ {timeOnly(bill.opened_at)} น.</span>
                </div>

                <div className="card-body flush">
                  {groupByRound(bill.items).map(([round, items]) => (
                    <div key={round}>
                      <div className="nav-label" style={{ padding: '10px 16px 4px' }}>
                        {round === 1 ? 'รอบแรก' : `สั่งเพิ่มรอบที่ ${round}`}
                      </div>
                      {items.map((it) => (
                        <div key={it.id} className="line">
                          <div className="line-main">
                            <div className="line-name">{it.name_th}</div>
                            <div className="line-meta">
                              {baht(it.unit_price)} × {fmtQty(it.qty)}
                              {it.note && ` · ${it.note}`}
                            </div>
                          </div>
                          <div className="line-amt">{baht(it.line_total)}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="card-body" style={{ borderTop: '1px solid var(--line)' }}>
                  <div className="sum-row"><span>ยอดรวม</span><span>{baht(bill.subtotal)}</span></div>
                  {Number(bill.discount) > 0 && <div className="sum-row"><span>ส่วนลด</span><span>−{baht(bill.discount)}</span></div>}
                  {Number(bill.service_charge) > 0 && <div className="sum-row"><span>ค่าบริการ</span><span>{baht(bill.service_charge)}</span></div>}
                  {Number(bill.vat_amount) > 0 && <div className="sum-row"><span>ภาษีมูลค่าเพิ่ม</span><span>{baht(bill.vat_amount)}</span></div>}
                  <div className="sum-row total"><span>ยอดสุทธิ</span><span>{baht(bill.grand_total)} ฿</span></div>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h2>ชำระเงินที่เคาน์เตอร์</h2></div>
                <div className="card-body stack">
                  <div className="center">
                    <div className="small muted">แจ้งพนักงานที่เคาน์เตอร์ว่า</div>
                    <div className="bold" style={{ fontSize: 34, color: 'var(--accent)' }}>โต๊ะ {bill.table_no}</div>
                    <div className="small muted">ยอดที่ต้องชำระ</div>
                    <div className="bold" style={{ fontSize: 24 }}>{baht(bill.grand_total)} บาท</div>
                  </div>

                  {isBilling ? (
                    <div className="alert alert-warn">
                      <span>✓</span>
                      <div>เช็คบิลแล้ว — เดินไปชำระเงินที่เคาน์เตอร์ได้เลย (เงินสด · โอน · สแกน QR)</div>
                    </div>
                  ) : (
                    <>
                      <div className="alert alert-info">
                        <span>ℹ</span>
                        <div>ยังไม่ต้องจ่ายตอนนี้ ทานให้อิ่มแล้วกด <strong>เช็คบิล</strong> จากนั้นไปชำระที่เคาน์เตอร์ รับเงินสด · โอน · สแกน QR</div>
                      </div>
                      <button className="btn btn-accent btn-block btn-lg" onClick={callBill} disabled={busy}>
                        {busy ? 'กำลังเช็คบิล…' : 'เช็คบิล'}
                      </button>
                      <button className="btn btn-block" onClick={() => nav(`/customer/${tableNo}`)}>
                        สั่งอาหารเพิ่ม
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function groupByRound(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.round_no)) map.set(it.round_no, []);
    map.get(it.round_no).push(it);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}
