import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast, Spinner, Empty, Modal } from '../../components/ui';
import { baht } from '../../lib/format';
import { setCode, clearCode, publicOpts, sessionProblem } from './session';
import CodeGate from './CodeGate';

export default function CustomerMenu() {
  const { tableNo } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [table, setTable] = useState(null);
  const [cat, setCat] = useState('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [problem, setProblem] = useState(null);   // รหัสผิด / ยังไม่มีรหัส / โต๊ะยังไม่เปิด

  /** สถานะโต๊ะ + ยอดสะสม (อัปเดตหลังสั่งอาหาร) */
  /** error เรื่องรหัสโต๊ะ -> เปลี่ยนไปหน้ากรอกรหัส, error อื่นแสดงเป็น toast */
  function handleError(e) {
    const p = sessionProblem(e);
    if (!p) return toast(e.message, 'err');
    if (p.reason === 'CODE_INVALID' || p.reason === 'TABLE_NOT_OPEN') clearCode(tableNo);
    setProblem(p);
    setConfirmOpen(false);
  }

  /** ตรวจรหัสโต๊ะ + ยอดสะสม (อัปเดตหลังสั่งอาหาร) */
  async function loadTable() {
    try {
      const t = await api.get(`/public/tables/${tableNo}`, publicOpts(tableNo));
      setTable(t.data);
      setProblem(null);
    } catch (e) {
      handleError(e);
    }
  }

  async function load() {
    try {
      const m = await api.get('/public/menu', { noAuth: true });
      setMenu(m.data);
      setCategories(m.categories);
      await loadTable();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // สแกน QR จากใบเปิดโต๊ะ -> ลิงก์มีรหัสมาด้วย จำไว้แล้วลบออกจากแถบที่อยู่
    const code = params.get('code');
    if (code) {
      setCode(tableNo, code);
      setParams({}, { replace: true });
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNo]);

  async function enterCode(code) {
    setCode(tableNo, code);
    await loadTable();
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter((m) => (cat === 'ALL' || m.category_code === cat) && (!q || m.name_th.toLowerCase().includes(q)));
  }, [menu, cat, search]);

  const lines = Object.entries(cart)
    .map(([id, q]) => ({ item: menu.find((m) => m.id === Number(id)), qty: q }))
    .filter((l) => l.item);
  const total = lines.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = (m) => setCart((c) => ({ ...c, [m.id]: (c[m.id] || 0) + 1 }));
  const setQty = (id, q) =>
    setCart((c) => {
      const n = { ...c };
      if (q <= 0) delete n[id]; else n[id] = q;
      return n;
    });

  async function submit() {
    if (!lines.length) return;
    setBusy(true);
    try {
      const r = await api.post(`/public/tables/${tableNo}/order`,
        { items: lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty })) },
        publicOpts(tableNo));
      // สั่งแล้วอยู่หน้าเมนูต่อ สั่งเพิ่มได้เรื่อย ๆ ไปจ่ายเงินที่เคาน์เตอร์ตอนกลับ
      toast(`ส่งออเดอร์เข้าครัวแล้ว (${r.round_no > 1 ? `รอบที่ ${r.round_no}` : 'รอบแรก'})`, 'ok');
      setCart({});
      setConfirmOpen(false);
      loadTable();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="กำลังโหลดเมนู…" />;
  if (problem) return <CodeGate tableNo={tableNo} problem={problem} onSubmit={enterCode} onRetry={loadTable} />;

  const isBilling = table?.status === 'BILLING';

  return (
    <>
      <div className="cust-top">
        <div className="cust-top-inner">
          <div className="brand-dot">ย</div>
          <div className="grow">
            <div className="bold">ร้านย่างให้หมูกระทะ บ้านน้องโฟค</div>
            <div className="tiny faint">
              โต๊ะ {tableNo}
              {table?.order_no && ` · ยอดสะสม ${baht(table.current_total)} ฿`}
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => nav(`/customer/${tableNo}/bill`)}>รายการที่สั่ง</button>
        </div>
      </div>

      <div className="cust-shell">
        <div className="content stack">
          {isBilling ? (
            <div className="alert alert-warn">
              <span>🧾</span>
              <div>เช็คบิลแล้ว — กรุณาแจ้ง <strong>โต๊ะ {tableNo}</strong> และชำระเงินที่เคาน์เตอร์ หากต้องการสั่งเพิ่มกรุณาแจ้งพนักงาน</div>
            </div>
          ) : (
            <div className="alert alert-info">
              <span>ℹ</span>
              <div>สั่งได้เลย ยังไม่ต้องจ่าย — สั่งเพิ่มได้ตลอด แล้วค่อย<strong>ชำระเงินที่เคาน์เตอร์</strong>ตอนกลับ</div>
            </div>
          )}

          <input className="input" placeholder="ค้นหาเมนู…" value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="cat-tabs">
            <button className={`cat-tab${cat === 'ALL' ? ' active' : ''}`} onClick={() => setCat('ALL')}>ทั้งหมด</button>
            {categories.map((c) => (
              <button key={c.id} className={`cat-tab${cat === c.code ? ' active' : ''}`} onClick={() => setCat(c.code)}>
                {c.name_th}
              </button>
            ))}
          </div>

          {!shown.length ? <Empty icon="🔍">ไม่พบเมนูที่ค้นหา</Empty> : (
            <div className="menu-grid">
              {shown.map((m) => {
                const inCart = cart[m.id] || 0;
                return (
                  <div key={m.id} className="menu-card" style={m.sold_out ? { opacity: .5 } : undefined}>
                    <div className="menu-name">{m.name_th}</div>
                    {m.description && <div className="menu-desc">{m.description}</div>}
                    <div className="menu-foot">
                      <span className="menu-price">{baht(m.price)}</span>
                      {m.sold_out ? (
                        <span className="pill pill-danger">หมด</span>
                      ) : inCart > 0 ? (
                        <div className="qty-box">
                          <button className="qty-btn" onClick={() => setQty(m.id, inCart - 1)}>−</button>
                          <span className="qty-num">{inCart}</span>
                          <button className="qty-btn" onClick={() => setQty(m.id, inCart + 1)}>+</button>
                        </div>
                      ) : (
                        <button className="btn btn-sm btn-accent" onClick={() => add(m)} disabled={isBilling}>เพิ่ม</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {count > 0 && (
        <div className="cust-cart">
          <div className="cust-cart-inner">
            <div className="grow">
              <div className="bold">ตะกร้า {count} รายการ</div>
              <div className="tiny faint">ตรวจสอบก่อนส่งเข้าครัว</div>
            </div>
            <div className="bold" style={{ fontSize: 19 }}>{baht(total)} ฿</div>
            <button className="btn btn-accent btn-lg" onClick={() => setConfirmOpen(true)} disabled={isBilling}>
              ดูตะกร้า
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <Modal
          title={`ยืนยันสั่งอาหาร · โต๊ะ ${tableNo}`}
          onClose={() => !busy && setConfirmOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmOpen(false)} disabled={busy}>เลือกเพิ่ม</button>
              <button className="btn btn-accent" onClick={submit} disabled={busy || !lines.length}>
                {busy ? 'กำลังส่ง…' : `ยืนยันสั่ง ${baht(total)} ฿`}
              </button>
            </>
          }
        >
          <div className="stack-sm">
            {lines.map((l) => (
              <div key={l.item.id} className="row">
                <div className="grow">
                  <div className="bold small">{l.item.name_th}</div>
                  <div className="tiny faint">{baht(l.item.price)} × {l.qty}</div>
                </div>
                <div className="qty-box">
                  <button className="qty-btn" onClick={() => setQty(l.item.id, l.qty - 1)} disabled={busy}>−</button>
                  <span className="qty-num">{l.qty}</span>
                  <button className="qty-btn" onClick={() => setQty(l.item.id, l.qty + 1)} disabled={busy}>+</button>
                </div>
              </div>
            ))}
            {!lines.length && <div className="muted small">ตะกร้าว่าง</div>}
            <div className="tiny faint mt">ยังไม่ต้องชำระตอนนี้ ยอดจะรวมไว้ในบิลของโต๊ะ ชำระที่เคาน์เตอร์ตอนกลับ</div>
          </div>
        </Modal>
      )}
    </>
  );
}
