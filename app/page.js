'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const fmt = (n) => "Rp " + Math.round(Number(n)||0).toLocaleString("id-ID");
const fmtShort = (n) => {
  const v = Math.round(Number(n)||0);
  if (v >= 1_000_000_000) return "Rp "+(v/1_000_000_000).toFixed(1)+"M";
  if (v >= 1_000_000) return "Rp "+(v/1_000_000).toFixed(1)+"jt";
  if (v >= 1_000) return "Rp "+(v/1_000).toFixed(0)+"rb";
  return "Rp "+v;
};

const calc = (e) => {
  const omset=Number(e.omset)||0, spend=Number(e.spend)||0;
  const order=Number(e.order_count)||0, margin=Number(e.margin)||0;
  const ctr=Number(e.ctr)||0, cr=Number(e.cr)||0;
  const profit=omset*margin/100;
  const netProfit=profit-spend;
  const roi=spend>0?Math.round(profit/spend*100):0;
  const roas=spend>0?omset/spend:0;
  const aov=order>0?Math.round(omset/order):0;
  let status,statusColor,statusBg;
  if(netProfit<0){status="RUGI";statusColor="#E84040";statusBg="#E8404015";}
  else if(roi<150||(ctr>0&&ctr<1)||(cr>0&&cr<0.5)){status="WARNING";statusColor="#F5A623";statusBg="#F5A62315";}
  else{status="UNTUNG";statusColor="#0FA968";statusBg="#0FA96815";}
  let diagnosa="";
  if(netProfit<0){
    if(ctr>0&&ctr<1) diagnosa="CTR rendah → ganti creative iklan";
    else if(cr>0&&cr<0.5) diagnosa="CR rendah → evaluasi halaman & harga";
    else diagnosa="Margin tipis → evaluasi HPP atau stop ads";
  } else if(roi<150){
    if(ctr>0&&ctr<1) diagnosa="CTR rendah → refresh creative";
    else if(cr>0&&cr<0.5) diagnosa="CR rendah → perbaiki product page";
    else diagnosa="Optimasi bid → turunkan spend bertahap";
  } else if(roi>=300) diagnosa="Performa excellent → scale budget";
  else diagnosa="Performa baik → pertahankan";
  return {profit,netProfit,roi,roas,aov,status,statusColor,statusBg,diagnosa};
};

const PERIODS=["Mingguan","Bulanan","Quarterly"];
const WEEKS=["Minggu 1","Minggu 2","Minggu 3","Minggu 4"];
const MONTHS=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
const QUARTERS=["Q1","Q2","Q3","Q4"];
const PLATFORMS=["TikTok","Shopee"];
const now=new Date();
const EMPTY={platform:"TikTok",sku:"",omset:"",spend:"",order_count:"",margin:"",ctr:"",cr:"",week:"Minggu 1",month:MONTHS[now.getMonth()],quarter:"Q2"};

const toPayload = (e) => ({
  platform: e.platform,
  sku: e.sku,
  omset: e.omset === "" || e.omset == null ? null : Number(e.omset),
  spend: e.spend === "" || e.spend == null ? null : Number(e.spend),
  order_count: e.order_count === "" || e.order_count == null ? null : Number(e.order_count),
  margin: e.margin === "" || e.margin == null ? null : Number(e.margin),
  ctr: e.ctr === "" || e.ctr == null ? null : Number(e.ctr),
  cr: e.cr === "" || e.cr == null ? null : Number(e.cr),
  week: e.week,
  month: e.month,
  quarter: e.quarter,
});

export default function Dashboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [periodType, setPeriodType] = useState("Mingguan");
  const [periodValue, setPeriodValue] = useState("Minggu 1");
  const [viewPlatform, setViewPlatform] = useState("Semua");
  const [filter, setFilter] = useState("Semua");
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkPlatform, setBulkPlatform] = useState("TikTok");
  const [fileName, setFileName] = useState("");
  const [saved, setSaved] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const { data, error } = await supabase
        .from('ads_entries')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      setErrorMsg("Gagal ambil data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2200); };

  const submitSingle = async () => {
    if (!form.sku || !form.omset || !form.spend) return;
    try {
      setErrorMsg("");
      if (editId !== null) {
        const { error } = await supabase.from('ads_entries').update(toPayload(form)).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ads_entries').insert([toPayload(form)]);
        if (error) throw error;
      }
      await fetchData();
      setForm(EMPTY); setMode(null); setEditId(null); flash();
    } catch (err) {
      setErrorMsg("Gagal simpan: " + err.message);
    }
  };

  const startEdit = (e) => { setForm({ ...e }); setEditId(e.id); setMode("single"); };

  const del = async (id) => {
    try {
      const { error } = await supabase.from('ads_entries').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      setErrorMsg("Gagal hapus: " + err.message);
    }
  };

  const handleExcelFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    try {
      setErrorMsg("");
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      const parsed = rows.map(r => ({
        platform: bulkPlatform,
        sku: String(r[0] ?? "").trim(),
        omset: r[1] ?? "", spend: r[2] ?? "", order_count: r[3] ?? "",
        margin: r[4] ?? "", ctr: r[5] ?? "", cr: r[6] ?? "",
        week: form.week, month: form.month, quarter: form.quarter,
      })).filter(e => e.sku && Number.isFinite(Number(e.omset)));
      if (parsed.length === 0) {
        setErrorMsg("Tidak ada baris valid. Cek urutan kolom: SKU | Omset | Spend | Order | Margin | CTR | CR");
        return;
      }
      setBulkPreview(parsed);
    } catch (err) {
      setErrorMsg("Gagal baca file Excel: " + err.message);
    }
  };

  const confirmBulk = async () => {
    try {
      setErrorMsg("");
      const payload = bulkPreview.map(toPayload);
      const { error } = await supabase.from('ads_entries').insert(payload);
      if (error) throw error;
      await fetchData();
      setBulkPreview([]); setFileName(""); setMode(null); flash();
    } catch (err) {
      setErrorMsg("Gagal import: " + err.message);
    }
  };

  const pField = periodType === "Mingguan" ? "week" : periodType === "Bulanan" ? "month" : "quarter";
  const pOpts = periodType === "Mingguan" ? WEEKS : periodType === "Bulanan" ? MONTHS : QUARTERS;

  const byPeriod = entries.filter(e => e[pField] === periodValue);
  const byPlat = viewPlatform === "Semua" ? byPeriod : byPeriod.filter(e => e.platform === viewPlatform);
  const displayed = filter === "Semua" ? byPlat : byPlat.filter(e => calc(e).status === filter);

  const totOmset = byPlat.reduce((s, e) => s + (Number(e.omset) || 0), 0);
  const totSpend = byPlat.reduce((s, e) => s + (Number(e.spend) || 0), 0);
  const totProfit = byPlat.reduce((s, e) => s + calc(e).profit, 0);
  const totNet = byPlat.reduce((s, e) => s + calc(e).netProfit, 0);
  const rugiCount = byPlat.filter(e => calc(e).status === "RUGI").length;
  const warnCount = byPlat.filter(e => calc(e).status === "WARNING").length;

  const tabBtn = (active, color) => ({
    padding: "6px 14px", borderRadius: "6px",
    border: `1px solid ${active ? color : "#e5e5e5"}`,
    background: active ? color + "22" : "transparent",
    color: active ? color : "#666", cursor: "pointer",
    fontSize: 12, fontWeight: active ? 600 : 400, transition: "all .1s"
  });
  const card = { background: "#fff", border: "1px solid #e5e5e5", borderRadius: "8px", padding: "1rem 1.25rem" };
  const inp = { width: "100%", boxSizing: "border-box", padding: "7px 10px", fontSize: 13, borderRadius: "6px", border: "1px solid #ddd", background: "#fafafa", color: "#333" };
  const lbl = { fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" };

  const previewCalc = form.omset && form.spend && form.margin ? calc(form) : null;

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: "1400px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Infarm · Ads Audit</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#222" }}>Dashboard Audit Iklan</div>
        </div>
        {saved && <span style={{ fontSize: 12, color: "#0FA968", background: "#0FA96818", border: "1px solid #0FA96840", padding: "4px 12px", borderRadius: "6px" }}>✓ Tersimpan</span>}
      </div>

      {errorMsg && (
        <div style={{ background: "#E8404015", border: "1px solid #E8404040", borderRadius: 6, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#E84040" }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {["Semua", "TikTok", "Shopee"].map(p => (
          <button key={p} onClick={() => setViewPlatform(p)} style={tabBtn(viewPlatform === p, p === "TikTok" ? "#E84040" : p === "Shopee" ? "#EF7F00" : "#0FA968")}>{p}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {PERIODS.map(p => (
          <button key={p} onClick={() => { setPeriodType(p); setPeriodValue(p === "Mingguan" ? "Minggu 1" : p === "Bulanan" ? MONTHS[now.getMonth()] : "Q2"); }} style={tabBtn(periodType === p, "#0FA968")}>{p}</button>
        ))}
        <div style={{ width: "1px", height: 18, background: "#e5e5e5", margin: "0 2px" }} />
        {pOpts.map(opt => (
          <button key={opt} onClick={() => setPeriodValue(opt)} style={tabBtn(periodValue === opt, "#0FA968")}>{opt}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Total Omset", val: fmtShort(totOmset), color: "#222" },
          { label: "Total Spend", val: fmtShort(totSpend), color: "#F5A623" },
          { label: "Net Profit", val: fmtShort(totNet), color: totNet >= 0 ? "#0FA968" : "#E84040" },
          { label: "SKU Rugi", val: rugiCount, sub: `${warnCount} warning`, color: rugiCount > 0 ? "#E84040" : "#999" },
        ].map((c, i) => (
          <div key={i} style={{ ...card, padding: "0.75rem 1rem" }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: c.color }}>{c.val}</div>
            {c.sub && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Semua", "RUGI", "WARNING", "UNTUNG"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={tabBtn(filter === f, f === "RUGI" ? "#E84040" : f === "WARNING" ? "#F5A623" : "#0FA968")}>
              {f}{f !== "Semua" && ` (${byPlat.filter(e => calc(e).status === f).length})`}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { setMode(mode === "bulk" ? null : "bulk"); setBulkPreview([]); setFileName(""); }} style={tabBtn(mode === "bulk", "#0FA968")}>📁 Upload Excel</button>
          <button onClick={() => { setMode(mode === "single" ? null : "single"); setEditId(null); setForm(EMPTY); }} style={tabBtn(mode === "single", "#0FA968")}>+ Tambah SKU</button>
        </div>
      </div>

      {mode === "bulk" && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>Upload Data dari File Excel</div>
          <div style={{ marginBottom: 10 }}>
            <span style={lbl}>Platform</span>
            <div style={{ display: "flex", gap: 6 }}>
              {PLATFORMS.map(p => (<button key={p} onClick={() => setBulkPlatform(p)} style={tabBtn(bulkPlatform === p, p === "TikTok" ? "#E84040" : "#EF7F00")}>{p}</button>))}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={lbl}>Periode</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {pOpts.map(opt => (<button key={opt} onClick={() => setForm(f => ({ ...f, [pField]: opt }))} style={tabBtn(form[pField] === opt, "#0FA968")}>{opt}</button>))}
            </div>
          </div>
          <div style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 6, fontSize: 11, color: "#666", marginBottom: 10 }}>
            Urutan kolom di Excel → <strong>SKU | Omset | Spend | Order | Margin% | CTR% | CR%</strong>
          </div>
          <label style={{ display: "block", textAlign: "center", padding: "26px 16px", background: "#0FA96810", border: "2px dashed #0FA968", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "#0FA968", fontWeight: 600, marginBottom: 12 }}>
            📁 Klik untuk pilih File Excel
            <div style={{ fontSize: 11, color: "#999", fontWeight: 400, marginTop: 4 }}>format: .xlsx, .xls, atau .csv</div>
            {fileName && <div style={{ fontSize: 12, color: "#0FA968", fontWeight: 600, marginTop: 8 }}>✓ {fileName}</div>}
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
              onChange={e => { handleExcelFile(e.target.files[0]); e.target.value = ""; }} />
          </label>
          {bulkPreview.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#222", marginBottom: 8 }}>{bulkPreview.length} SKU terbaca — cek dulu sebelum simpan:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                {bulkPreview.slice(0, 8).map((e, i) => {
                  const c = calc(e);
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", background: "#fafafa", borderRadius: 6, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, minWidth: 100 }}>{e.sku}</span>
                      <span style={{ color: "#999" }}>Omset {fmtShort(e.omset)}</span>
                      <span style={{ color: "#999" }}>Spend {fmtShort(e.spend)}</span>
                      <span style={{ color: c.netProfit >= 0 ? "#0FA968" : "#E84040" }}>Net {fmtShort(c.netProfit)}</span>
                      <span style={{ marginLeft: "auto", color: c.statusColor, background: c.statusBg, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                    </div>
                  );
                })}
                {bulkPreview.length > 8 && <div style={{ fontSize: 11, color: "#999", padding: "2px 4px" }}>+{bulkPreview.length - 8} SKU lainnya siap diimport...</div>}
              </div>
              <button onClick={confirmBulk} style={{ padding: "9px 22px", background: "#0FA96820", border: "1px solid #0FA968", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#0FA968", fontWeight: 600 }}>✓ Konfirmasi & Simpan {bulkPreview.length} SKU</button>
            </div>
          )}
        </div>
      )}

      {mode === "single" && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 12 }}>{editId !== null ? "Edit SKU" : "Tambah SKU"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <span style={lbl}>Platform</span>
              <div style={{ display: "flex", gap: 6 }}>
                {PLATFORMS.map(p => (<button key={p} onClick={() => setForm(f => ({ ...f, platform: p }))} style={tabBtn(form.platform === p, p === "TikTok" ? "#E84040" : "#EF7F00")}>{p}</button>))}
              </div>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <span style={lbl}>SKU ID</span>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="NT-AKAR-100" style={inp} />
            </div>
            {[
              { key: "omset", label: "Omset (Rp)" }, { key: "spend", label: "Spend Iklan (Rp)" },
              { key: "order_count", label: "Jumlah Order" }, { key: "margin", label: "% Margin" },
              { key: "ctr", label: "CTR (%)" }, { key: "cr", label: "CR (%)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <span style={lbl}>{label}</span>
                <input type="number" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          {previewCalc && (
            <div style={{ padding: "10px 14px", background: "#fafafa", borderRadius: 6, display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10, fontSize: 12, alignItems: "center" }}>
              <span>Profit: <strong>{fmtShort(previewCalc.profit)}</strong></span>
              <span>Net: <strong style={{ color: previewCalc.netProfit >= 0 ? "#0FA968" : "#E84040" }}>{fmtShort(previewCalc.netProfit)}</strong></span>
              <span>ROI: <strong>{previewCalc.roi}%</strong></span>
              <span>Status: <strong style={{ color: previewCalc.statusColor }}>{previewCalc.status}</strong></span>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submitSingle} style={{ padding: "7px 20px", background: "#0FA96820", border: "1px solid #0FA968", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#0FA968", fontWeight: 600 }}>{editId !== null ? "Simpan" : "Tambah"}</button>
            <button onClick={() => { setMode(null); setEditId(null); }} style={{ padding: "7px 14px", background: "transparent", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#666" }}>Batal</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ ...card, textAlign: "center", padding: "2rem" }}>Loading...</div>
      ) : displayed.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ fontSize: 13, color: "#999" }}>Belum ada data untuk periode ini</div>
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                  {["Platform", "SKU", "Omset", "Profit", "Spend Ads", "Net Profit", "ROAS", "Target ROAS", "Status", "Diagnosa", ""].map((h, i) => (
                    <th key={i} style={{ padding: "10px 12px", textAlign: i <= 1 || i >= 8 ? "left" : "right", fontSize: 10, color: "#999", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(e => {
                  const c = calc(e);
                  const beRoas = Number(e.margin) > 0 ? 100 / Number(e.margin) : 0;
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600, background: e.platform === "TikTok" ? "#E8404018" : "#EF7F0018", color: e.platform === "TikTok" ? "#E84040" : "#EF7F00" }}>{e.platform}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{e.sku}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>{fmtShort(e.omset)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#222" }}>{fmtShort(c.profit)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#F5A623" }}>{fmtShort(e.spend)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: c.netProfit >= 0 ? "#0FA968" : "#E84040", fontWeight: 600 }}>{fmtShort(c.netProfit)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: c.statusColor, fontWeight: 600 }}>{c.roas.toFixed(1)}x</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "#666" }}>{beRoas > 0 ? beRoas.toFixed(1) + "x" : "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600, color: c.statusColor, background: c.statusBg }}>{c.status}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: "#666", minWidth: 160 }}>{c.diagnosa}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <button onClick={() => startEdit(e)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666", fontSize: 14, marginRight: 6 }}>✎</button>
                        <button onClick={() => del(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E84040", fontSize: 14 }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e5e5", display: "flex", gap: 16, background: "#fafafa", flexWrap: "wrap", fontSize: 11 }}>
            <span>Omset: <strong>{fmt(totOmset)}</strong></span>
            <span>Spend: <strong style={{ color: "#F5A623" }}>{fmt(totSpend)}</strong></span>
            <span>Net: <strong style={{ color: totNet >= 0 ? "#0FA968" : "#E84040" }}>{fmt(totNet)}</strong></span>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#999" }}>Infarm Ads Audit · Powered by Supabase</div>
    </div>
  );
}
