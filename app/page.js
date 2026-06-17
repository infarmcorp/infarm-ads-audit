'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const fmt = (n) => "Rp " + Math.round(Number(n)||0).toLocaleString("id-ID");
const fmtShort = (n) => {
  const v = Math.round(Number(n)||0);
  const neg = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return neg+"Rp "+(a/1_000_000_000).toFixed(1)+"M";
  if (a >= 1_000_000) return neg+"Rp "+(a/1_000_000).toFixed(1)+"jt";
  if (a >= 1_000) return neg+"Rp "+(a/1_000).toFixed(0)+"rb";
  return neg+"Rp "+a;
};
const fmtDate = (d) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};

const calc = (e) => {
  const omset=Number(e.omset)||0, spend=Number(e.spend)||0;
  const order=Number(e.order_count)||0, margin=Number(e.margin)||0;
  const ctr=Number(e.ctr)||0, cr=Number(e.cr)||0;
  const target=Number(e.target_roas)||0;
  const profit=omset*margin/100;
  const netProfit=profit-spend;
  const roi=spend>0?Math.round(profit/spend*100):0;
  const roas=spend>0?omset/spend:0;
  const aov=order>0?Math.round(omset/order):0;
  const beRoas=margin>0?100/margin:0;
  let status,statusColor,statusBg,diagnosa;
  if(netProfit<0){
    status="RUGI";statusColor="#DC2626";statusBg="#FEF2F2";
    if(ctr>0&&ctr<1) diagnosa="Di bawah BEP — CTR rendah, ganti creative";
    else if(cr>0&&cr<0.5) diagnosa="Di bawah BEP — CR rendah, evaluasi halaman & harga";
    else diagnosa="Di bawah BEP — margin tipis, evaluasi HPP / stop ads";
  } else if(target>0 && roas<target){
    status="WARNING";statusColor="#B45309";statusBg="#FFFBEB";
    diagnosa=`Di atas BEP, belum capai target ${target.toFixed(1)}x — optimasi untuk naik`;
  } else if(target>0 && roas>=target){
    status="UNTUNG";statusColor="#15803D";statusBg="#F0FDF4";
    diagnosa="Capai target ROAS → pertahankan / scale";
  } else if(roi<150){
    status="WARNING";statusColor="#B45309";statusBg="#FFFBEB";
    diagnosa="Untung tipis — optimasi bid / turunkan spend bertahap";
  } else {
    status="UNTUNG";statusColor="#15803D";statusBg="#F0FDF4";
    diagnosa=roi>=300?"Performa excellent → scale budget":"Performa baik → pertahankan";
  }
  return {profit,netProfit,roi,roas,aov,beRoas,target,status,statusColor,statusBg,diagnosa};
};

const PLATFORMS=["TikTok","Shopee"];
const EMPTY={platform:"TikTok",sku:"",omset:"",spend:"",order_count:"",margin:"",ctr:"",cr:"",target_roas:"",tanggal:todayStr};

const toPayload = (e) => ({
  platform: e.platform, sku: e.sku,
  omset: e.omset === "" || e.omset == null ? null : Number(e.omset),
  spend: e.spend === "" || e.spend == null ? null : Number(e.spend),
  order_count: e.order_count === "" || e.order_count == null ? null : Number(e.order_count),
  margin: e.margin === "" || e.margin == null ? null : Number(e.margin),
  ctr: e.ctr === "" || e.ctr == null ? null : Number(e.ctr),
  cr: e.cr === "" || e.cr == null ? null : Number(e.cr),
  target_roas: e.target_roas === "" || e.target_roas == null ? null : Number(e.target_roas),
  tanggal: e.tanggal || null,
});

function Icon({ name, color = "#0F172A", size = 16 }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const p = {
    bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
    wallet: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /><path d="M16 14h.01" /></>,
    trend: <><path d="M22 7 13.5 15.5l-5-5L2 17" /><path d="M16 7h6v6" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
    alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  };
  return <svg {...c}>{p[name]}</svg>;
}

const tipStyle = { background: "#fff", border: "1px solid #EAECF0", borderRadius: 10, boxShadow: "0 8px 24px rgba(16,24,40,.12)", fontSize: 12, padding: "8px 10px" };

export default function Dashboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [viewPlatform, setViewPlatform] = useState("Semua");
  const [filter, setFilter] = useState("Semua");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkPlatform, setBulkPlatform] = useState("TikTok");
  const [bulkDate, setBulkDate] = useState(todayStr);
  const [fileName, setFileName] = useState("");
  const [saved, setSaved] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true); setErrorMsg("");
      const { data, error } = await supabase.from('ads_entries').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (err) { setErrorMsg("Gagal ambil data: " + err.message); }
    finally { setLoading(false); }
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
      await fetchData(); setForm(EMPTY); setMode(null); setEditId(null); flash();
    } catch (err) { setErrorMsg("Gagal simpan: " + err.message); }
  };

  const startEdit = (e) => { setForm({ ...EMPTY, ...e, tanggal: e.tanggal || todayStr }); setEditId(e.id); setMode("single"); };

  const del = async (id) => {
    try {
      const { error } = await supabase.from('ads_entries').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) { setErrorMsg("Gagal hapus: " + err.message); }
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
        platform: bulkPlatform, sku: String(r[0] ?? "").trim(),
        omset: r[1] ?? "", spend: r[2] ?? "", order_count: r[3] ?? "",
        margin: r[4] ?? "", ctr: r[5] ?? "", cr: r[6] ?? "", target_roas: r[7] ?? "",
        tanggal: bulkDate,
      })).filter(e => e.sku && Number.isFinite(Number(e.omset)));
      if (parsed.length === 0) { setErrorMsg("Tidak ada baris valid. Cek urutan kolom: SKU | Omset | Spend | Order | Margin | CTR | CR | TargetROAS(opsional)"); return; }
      setBulkPreview(parsed);
    } catch (err) { setErrorMsg("Gagal baca file Excel: " + err.message); }
  };

  const confirmBulk = async () => {
    try {
      setErrorMsg("");
      const { error } = await supabase.from('ads_entries').insert(bulkPreview.map(toPayload));
      if (error) throw error;
      await fetchData(); setBulkPreview([]); setFileName(""); setMode(null); flash();
    } catch (err) { setErrorMsg("Gagal import: " + err.message); }
  };

  const setThisMonth = () => {
    const y = now.getFullYear(), m = now.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    setDateFrom(`${y}-${pad(m + 1)}-01`);
    setDateTo(`${y}-${pad(m + 1)}-${pad(lastDay)}`);
  };

  const inRange = (e) => {
    if (!dateFrom && !dateTo) return true;
    if (!e.tanggal) return false;
    if (dateFrom && e.tanggal < dateFrom) return false;
    if (dateTo && e.tanggal > dateTo) return false;
    return true;
  };

  const byTime = entries.filter(inRange);
  const byPlat = viewPlatform === "Semua" ? byTime : byTime.filter(e => e.platform === viewPlatform);
  const filtered = filter === "Semua" ? byPlat : byPlat.filter(e => calc(e).status === filter);

  const columns = [
    { label: "Platform", align: "left", key: "platform", val: e => e.platform },
    { label: "SKU", align: "left", key: "sku", val: e => e.sku },
    { label: "Omset", align: "right", key: "omset", val: e => Number(e.omset) || 0 },
    { label: "Profit", align: "right", key: "profit", val: e => calc(e).profit },
    { label: "Spend Ads", align: "right", key: "spend", val: e => Number(e.spend) || 0 },
    { label: "Net Profit", align: "right", key: "net", val: e => calc(e).netProfit },
    { label: "BEP ROAS", align: "right", key: "bep", val: e => calc(e).beRoas },
    { label: "Actual ROAS", align: "right", key: "roas", val: e => calc(e).roas },
    { label: "Target ROAS", align: "right", key: "target", val: e => Number(e.target_roas) || 0 },
    { label: "Status", align: "left", key: "status", val: e => ({ RUGI: 0, WARNING: 1, UNTUNG: 2 }[calc(e).status]) },
    { label: "Diagnosa", align: "left", key: null },
    { label: "", align: "left", key: null },
  ];

  let displayed = [...filtered];
  if (sortKey) {
    const col = columns.find(c => c.key === sortKey);
    displayed.sort((a, b) => {
      const va = col.val(a), vb = col.val(b);
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }
  const toggleSort = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const totOmset = byPlat.reduce((s, e) => s + (Number(e.omset) || 0), 0);
  const totSpend = byPlat.reduce((s, e) => s + (Number(e.spend) || 0), 0);
  const totProfit = byPlat.reduce((s, e) => s + calc(e).profit, 0);
  const totNet = byPlat.reduce((s, e) => s + calc(e).netProfit, 0);
  const avgRoas = totSpend > 0 ? totOmset / totSpend : 0;
  const rugiCount = byPlat.filter(e => calc(e).status === "RUGI").length;
  const warnCount = byPlat.filter(e => calc(e).status === "WARNING").length;
  const untungCount = byPlat.length - rugiCount - warnCount;

  const statusData = [
    { name: "Untung", value: untungCount, color: "#16A34A" },
    { name: "Warning", value: warnCount, color: "#F59E0B" },
    { name: "Rugi", value: rugiCount, color: "#EF4444" },
  ].filter(d => d.value > 0);
  const totalSku = untungCount + warnCount + rugiCount;

  const bySku = {};
  byPlat.forEach(e => {
    const cc = calc(e);
    if (!bySku[e.sku]) bySku[e.sku] = { name: e.sku, net: 0 };
    bySku[e.sku].net += cc.netProfit;
  });
  const netData = Object.values(bySku).sort((a, b) => b.net - a.net).slice(0, 10);

  const ink = "#0F172A", slate = "#475569", muted = "#94A3B8", bd = "#EAECF0";
  const tabBtn = (active, color) => ({
    padding: "6px 13px", borderRadius: "8px",
    border: `1px solid ${active ? color : "#E5E9EF"}`,
    background: active ? color + "14" : "#fff",
    color: active ? color : slate, cursor: "pointer",
    fontSize: 12, fontWeight: active ? 600 : 500,
  });
  const card = { background: "#fff", border: `1px solid ${bd}`, borderRadius: "16px", padding: "1.2rem 1.3rem", boxShadow: "0 1px 2px rgba(16,24,40,.05)" };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 11px", fontSize: 13, borderRadius: "8px", border: "1px solid #DDE3EA", background: "#fff", color: ink, fontFamily: "inherit" };
  const lbl = { fontSize: 11, color: slate, fontWeight: 600, marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" };

  const previewCalc = form.omset && form.spend && form.margin ? calc(form) : null;

  const metricCards = [
    { label: "Total Omset", value: fmtShort(totOmset), tint: "#6366F1", icon: "bag" },
    { label: "Total Spend", value: fmtShort(totSpend), tint: "#F59E0B", icon: "wallet" },
    { label: "Net Profit", value: fmtShort(totNet), tint: totNet >= 0 ? "#16A34A" : "#DC2626", colorVal: totNet >= 0 ? "#16A34A" : "#DC2626", icon: "trend" },
    { label: "Avg ROAS", value: avgRoas.toFixed(1) + "x", tint: "#8B5CF6", icon: "target" },
    { label: "SKU Rugi", value: rugiCount, sub: `${warnCount} warning`, tint: "#EF4444", colorVal: rugiCount > 0 ? "#DC2626" : ink, icon: "alert" },
  ];

  const chartHead = (t) => (<div style={{ fontSize: 13, fontWeight: 700, color: ink, marginBottom: 12, letterSpacing: "-0.2px" }}>{t}</div>);

  return (
    <div className="iaa" style={{ minHeight: "100vh", background: "linear-gradient(180deg,#F7F9FC,#F3F6FA)", color: ink, position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .iaa{font-family:'Inter',system-ui,-apple-system,sans-serif;}
        .iaa *{box-sizing:border-box;}
        .iaa-num{font-variant-numeric:tabular-nums;}
        .iaa-card{transition:box-shadow .18s ease,transform .18s ease;}
        .iaa-card:hover{box-shadow:0 10px 28px rgba(16,24,40,.10);transform:translateY(-2px);}
        .iaa-row{transition:background .12s ease;}
        .iaa-row:hover{background:#F8FAFC;}
        .iaa-btn{transition:filter .12s ease,border-color .12s ease;}
        .iaa-btn:hover{filter:brightness(.98);}
        .iaa-fade{animation:iaaFade .45s ease both;}
        @keyframes iaaFade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
        .iaa ::-webkit-scrollbar{height:9px;width:9px;}
        .iaa ::-webkit-scrollbar-thumb{background:#D6DBE3;border-radius:5px;}
        .iaa ::-webkit-scrollbar-track{background:transparent;}
      `}</style>

      <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -170, left: -130, width: 440, height: 440, borderRadius: "50%", background: "radial-gradient(circle,#FCD34D55,transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", top: -130, right: -110, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,#16A34A2E,transparent 70%)", filter: "blur(50px)" }} />
        <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMin slice" style={{ position: "absolute", inset: 0 }}>
          <g fill="#2F7D32">
            <g style={{ opacity: .07, filter: "blur(7px)" }}><path transform="translate(180,70) rotate(28) scale(3.2)" d="M0,0 C22,-14 30,-46 0,-66 C-30,-46 -22,-14 0,0 Z" /></g>
            <g style={{ opacity: .06, filter: "blur(8px)" }}><path transform="translate(90,250) rotate(-12) scale(3.8)" d="M0,0 C22,-14 30,-46 0,-66 C-30,-46 -22,-14 0,0 Z" /></g>
            <g style={{ opacity: .05, filter: "blur(9px)" }}><path transform="translate(1300,120) rotate(195) scale(3.4)" d="M0,0 C22,-14 30,-46 0,-66 C-30,-46 -22,-14 0,0 Z" /></g>
            <g style={{ opacity: .05, filter: "blur(10px)" }}><path transform="translate(1360,380) rotate(150) scale(4)" d="M0,0 C22,-14 30,-46 0,-66 C-30,-46 -22,-14 0,0 Z" /></g>
            <g style={{ opacity: .045, filter: "blur(9px)" }}><path transform="translate(640,30) rotate(65) scale(2.6)" d="M0,0 C22,-14 30,-46 0,-66 C-30,-46 -22,-14 0,0 Z" /></g>
          </g>
        </svg>
      </div>

      <div style={{ maxWidth: "1480px", margin: "0 auto", padding: "1.75rem 1.5rem 3rem", position: "relative", zIndex: 1 }}>

        <div className="iaa-fade" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/infarm-logo.png" alt="Infarm.id" style={{ height: 54, width: "auto", display: "block" }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: muted, textTransform: "uppercase" }}>Ads Audit</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: ink, lineHeight: 1.15, letterSpacing: "-0.4px" }}>Dashboard Audit Iklan</div>
            </div>
          </div>
          {saved && <span style={{ fontSize: 12, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "6px 14px", borderRadius: 8, fontWeight: 600 }}>✓ Tersimpan</span>}
        </div>

        {errorMsg && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "11px 15px", marginBottom: 14, fontSize: 13, color: "#DC2626" }}>{errorMsg}</div>
        )}

        <div className="iaa-fade" style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 5, background: "#fff", padding: 4, borderRadius: 10, border: `1px solid ${bd}`, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
            {["Semua", "TikTok", "Shopee"].map(p => (
              <button key={p} className="iaa-btn" onClick={() => setViewPlatform(p)} style={tabBtn(viewPlatform === p, p === "TikTok" ? "#E84040" : p === "Shopee" ? "#EF7F00" : "#16A34A")}>{p}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, background: "#fff", padding: "6px 10px", borderRadius: 10, border: `1px solid ${bd}`, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
            <span style={{ fontSize: 11, color: muted, fontWeight: 700, letterSpacing: 0.5 }}>RENTANG</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, width: "auto", padding: "5px 8px", fontSize: 12 }} />
            <span style={{ color: muted }}>→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp, width: "auto", padding: "5px 8px", fontSize: 12 }} />
            <button className="iaa-btn" onClick={setThisMonth} style={tabBtn(false, "#6366F1")}>Bulan Ini</button>
            {(dateFrom || dateTo) && <button className="iaa-btn" onClick={() => { setDateFrom(""); setDateTo(""); }} style={tabBtn(false, slate)}>Reset</button>}
          </div>
        </div>

        <div className="iaa-fade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
          {metricCards.map((c, i) => (
            <div key={i} className="iaa-card" style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.label}</span>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: c.tint + "16", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={c.icon} color={c.tint} size={17} />
                </span>
              </div>
              <div className="iaa-num" style={{ fontSize: 25, fontWeight: 700, color: c.colorVal || ink, letterSpacing: "-0.6px" }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{c.sub}</div>}
            </div>
          ))}
        </div>

        {byPlat.length > 0 && (
          <div className="iaa-fade" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 18 }}>
            <div className="iaa-card" style={card}>
              {chartHead("Distribusi Status SKU")}
              <div style={{ position: "relative" }}>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={3} cornerRadius={6} stroke="none">
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div className="iaa-num" style={{ fontSize: 30, fontWeight: 700, color: ink, letterSpacing: "-1px" }}>{totalSku}</div>
                  <div style={{ fontSize: 11, color: muted, fontWeight: 500 }}>Total SKU</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                {statusData.map((d, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: slate, fontWeight: 500 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color }} />{d.name} <span className="iaa-num" style={{ color: muted }}>({d.value})</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="iaa-card" style={card}>
              {chartHead("Net Profit per SKU (Top 10)")}
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={netData} layout="vertical" margin={{ left: 6, right: 22, top: 2, bottom: 2 }}>
                  <defs>
                    <linearGradient id="bgGreen" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#34D399" /><stop offset="100%" stopColor="#10B981" /></linearGradient>
                    <linearGradient id="bgRed" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FCA5A5" /><stop offset="100%" stopColor="#EF4444" /></linearGradient>
                  </defs>
                  <CartesianGrid horizontal={false} stroke="#EEF1F5" />
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: slate }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tipStyle} cursor={{ fill: "#F1F5F9" }} formatter={(v) => fmt(v)} />
                  <Bar dataKey="net" radius={[0, 6, 6, 0]} barSize={16}>
                    {netData.map((d, i) => <Cell key={i} fill={d.net >= 0 ? "url(#bgGreen)" : "url(#bgRed)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="iaa-fade" style={{ display: "flex", gap: 8, justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Semua", "RUGI", "WARNING", "UNTUNG"].map(f => (
              <button key={f} className="iaa-btn" onClick={() => setFilter(f)} style={tabBtn(filter === f, f === "RUGI" ? "#DC2626" : f === "WARNING" ? "#B45309" : f === "UNTUNG" ? "#15803D" : slate)}>
                {f}{f !== "Semua" && ` (${byPlat.filter(e => calc(e).status === f).length})`}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="iaa-btn" onClick={() => { setMode(mode === "bulk" ? null : "bulk"); setBulkPreview([]); setFileName(""); }} style={{ ...tabBtn(mode === "bulk", "#16A34A"), padding: "8px 16px" }}>📁 Upload Excel</button>
            <button className="iaa-btn" onClick={() => { setMode(mode === "single" ? null : "single"); setEditId(null); setForm(EMPTY); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: ink, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Tambah SKU</button>
          </div>
        </div>

        {mode === "bulk" && (
          <div className="iaa-card" style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: ink, marginBottom: 14 }}>Upload Data dari File Excel</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <span style={lbl}>Platform</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {PLATFORMS.map(p => (<button key={p} className="iaa-btn" onClick={() => setBulkPlatform(p)} style={tabBtn(bulkPlatform === p, p === "TikTok" ? "#E84040" : "#EF7F00")}>{p}</button>))}
                </div>
              </div>
              <div>
                <span style={lbl}>Tanggal data</span>
                <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} style={{ ...inp, width: "auto" }} />
              </div>
            </div>
            <div style={{ padding: "9px 13px", background: "#F8FAFC", borderRadius: 8, fontSize: 11, color: slate, marginBottom: 12 }}>
              Urutan kolom di Excel → <strong>SKU | Omset | Spend | Order | Margin% | CTR% | CR% | TargetROAS</strong> <span style={{ color: muted }}>(TargetROAS opsional)</span>
            </div>
            <label className="iaa-btn" style={{ display: "block", textAlign: "center", padding: "28px 16px", background: "#16A34A0A", border: "2px dashed #16A34A", borderRadius: 12, cursor: "pointer", fontSize: 14, color: "#16A34A", fontWeight: 600, marginBottom: 14 }}>
              📁 Klik untuk pilih File Excel
              <div style={{ fontSize: 11, color: muted, fontWeight: 400, marginTop: 4 }}>format: .xlsx, .xls, atau .csv</div>
              {fileName && <div style={{ fontSize: 12, color: "#16A34A", fontWeight: 600, marginTop: 8 }}>✓ {fileName}</div>}
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => { handleExcelFile(e.target.files[0]); e.target.value = ""; }} />
            </label>
            {bulkPreview.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: ink, marginBottom: 8 }}>{bulkPreview.length} SKU terbaca ({fmtDate(bulkDate)}) — cek dulu:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                  {bulkPreview.slice(0, 8).map((e, i) => {
                    const c = calc(e);
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, minWidth: 100 }}>{e.sku}</span>
                        <span className="iaa-num" style={{ color: slate }}>Omset {fmtShort(e.omset)}</span>
                        <span className="iaa-num" style={{ color: slate }}>Spend {fmtShort(e.spend)}</span>
                        <span className="iaa-num" style={{ color: c.netProfit >= 0 ? "#16A34A" : "#DC2626" }}>Net {fmtShort(c.netProfit)}</span>
                        <span style={{ marginLeft: "auto", color: c.statusColor, background: c.statusBg, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                      </div>
                    );
                  })}
                  {bulkPreview.length > 8 && <div style={{ fontSize: 11, color: muted, padding: "2px 4px" }}>+{bulkPreview.length - 8} SKU lainnya...</div>}
                </div>
                <button className="iaa-btn" onClick={confirmBulk} style={{ padding: "10px 22px", background: "#16A34A", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#fff", fontWeight: 600 }}>✓ Konfirmasi & Simpan {bulkPreview.length} SKU</button>
              </div>
            )}
          </div>
        )}

        {mode === "single" && (
          <div className="iaa-card" style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: ink, marginBottom: 14 }}>{editId !== null ? "Edit SKU" : "Tambah SKU"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <span style={lbl}>Platform</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {PLATFORMS.map(p => (<button key={p} className="iaa-btn" onClick={() => setForm(f => ({ ...f, platform: p }))} style={tabBtn(form.platform === p, p === "TikTok" ? "#E84040" : "#EF7F00")}>{p}</button>))}
                  </div>
                </div>
                <div>
                  <span style={lbl}>Tanggal</span>
                  <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} style={{ ...inp, width: "auto" }} />
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
                { key: "target_roas", label: "Target ROAS (x)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <span style={lbl}>{label}</span>
                  <input type="number" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                </div>
              ))}
            </div>
            {previewCalc && (
              <div className="iaa-num" style={{ padding: "11px 15px", background: "#F8FAFC", borderRadius: 8, display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12, alignItems: "center" }}>
                <span>Profit: <strong>{fmtShort(previewCalc.profit)}</strong></span>
                <span>Net: <strong style={{ color: previewCalc.netProfit >= 0 ? "#16A34A" : "#DC2626" }}>{fmtShort(previewCalc.netProfit)}</strong></span>
                <span>BEP: <strong>{previewCalc.beRoas > 0 ? previewCalc.beRoas.toFixed(1) + "x" : "—"}</strong></span>
                <span>Actual: <strong>{previewCalc.roas.toFixed(1)}x</strong></span>
                <span>Target: <strong>{previewCalc.target > 0 ? previewCalc.target.toFixed(1) + "x" : "—"}</strong></span>
                <span>Status: <strong style={{ color: previewCalc.statusColor }}>{previewCalc.status}</strong></span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="iaa-btn" onClick={submitSingle} style={{ padding: "9px 22px", background: "#16A34A", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 600 }}>{editId !== null ? "Simpan" : "Tambah"}</button>
              <button className="iaa-btn" onClick={() => { setMode(null); setEditId(null); }} style={{ padding: "9px 16px", background: "#fff", border: "1px solid #DDE3EA", borderRadius: 8, cursor: "pointer", fontSize: 12, color: slate }}>Batal</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ ...card, textAlign: "center", padding: "2.5rem", color: muted }}>Loading...</div>
        ) : displayed.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "3rem 1rem" }}>
            <div style={{ fontSize: 13, color: muted }}>Belum ada data untuk filter ini</div>
          </div>
        ) : (
          <div className="iaa-fade" style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="iaa-num" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#FBFCFD", borderBottom: `1px solid ${bd}` }}>
                    {columns.map((col, i) => (
                      <th key={i} onClick={() => toggleSort(col.key)} style={{ padding: "13px 14px", textAlign: col.align, fontSize: 10, color: sortKey === col.key ? "#16A34A" : muted, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: "0.4px", cursor: col.key ? "pointer" : "default", userSelect: "none" }}>
                        {col.label}{col.key && sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(e => {
                    const c = calc(e);
                    return (
                      <tr key={e.id} className="iaa-row" style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, fontWeight: 600, background: e.platform === "TikTok" ? "#FEF2F2" : "#FFF7ED", color: e.platform === "TikTok" ? "#E84040" : "#EF7F00" }}>{e.platform}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: ink }}>{e.sku}</div>
                          {e.tanggal && <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{fmtDate(e.tanggal)}</div>}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: ink }}>{fmtShort(e.omset)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: ink }}>{fmtShort(c.profit)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: "#B45309" }}>{fmtShort(e.spend)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: c.netProfit >= 0 ? "#16A34A" : "#DC2626", fontWeight: 700 }}>{fmtShort(c.netProfit)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: slate }}>{c.beRoas > 0 ? c.beRoas.toFixed(1) + "x" : "—"}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: c.statusColor, fontWeight: 700 }}>{c.roas.toFixed(1)}x</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: c.target > 0 ? "#6366F1" : "#CBD5E1", fontWeight: 600 }}>{c.target > 0 ? c.target.toFixed(1) + "x" : "—"}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, fontWeight: 700, color: c.statusColor, background: c.statusBg }}>{c.status}</span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 11, color: slate, minWidth: 180, fontVariantNumeric: "normal" }}>{c.diagnosa}</td>
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <button className="iaa-btn" onClick={() => startEdit(e)} style={{ background: "none", border: "none", cursor: "pointer", color: slate, fontSize: 14, marginRight: 8 }}>✎</button>
                          <button className="iaa-btn" onClick={() => del(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 14 }}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="iaa-num" style={{ padding: "12px 16px", borderTop: `1px solid ${bd}`, display: "flex", gap: 18, background: "#FBFCFD", flexWrap: "wrap", fontSize: 11 }}>
              <span style={{ color: slate }}>Omset: <strong style={{ color: ink }}>{fmt(totOmset)}</strong></span>
              <span style={{ color: slate }}>Profit: <strong style={{ color: ink }}>{fmt(totProfit)}</strong></span>
              <span style={{ color: slate }}>Spend: <strong style={{ color: "#B45309" }}>{fmt(totSpend)}</strong></span>
              <span style={{ color: slate }}>Net: <strong style={{ color: totNet >= 0 ? "#16A34A" : "#DC2626" }}>{fmt(totNet)}</strong></span>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: muted }}>Infarm Ads Audit · Powered by Supabase</div>
      </div>
    </div>
  );
}
