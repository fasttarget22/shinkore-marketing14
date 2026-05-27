import { useState, useEffect, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "Khalid";
const COMPANY = "Shinkore Marketing";
const ADMIN_PHONES = ["00923135443656", "00923174886655"];
const GPS_RADIUS_M = 50;

// ─── DATA INIT ────────────────────────────────────────────────────────────────
const initData = () => {
  const d = localStorage.getItem("shinkore_v2");
  if (d) return JSON.parse(d);
  return {
    users: [
      { id:"u1", name:"Khalid Orakzai", phone:"00923135443656", role:"admin", daily_rate:0, team:"", callmebot_key:"" },
      { id:"u2", name:"Ahmed Khan",     phone:"03001234567",    role:"supervisor", daily_rate:1500, team:"Team A", callmebot_key:"" },
      { id:"u3", name:"Sara Bibi",      phone:"03009876543",    role:"ba",         daily_rate:800,  team:"Team A", callmebot_key:"" },
      { id:"u4", name:"Usman Ali",      phone:"03123456789",    role:"ba",         daily_rate:800,  team:"Team B", callmebot_key:"" },
      { id:"u5", name:"Nadia Shah",     phone:"03456789012",    role:"supervisor", daily_rate:1500, team:"Team B", callmebot_key:"" },
    ],
    teams: ["Team A","Team B"],
    stalls: [
      { id:"s1", name:"Centaurus Mall Stall", city:"Islamabad", dept:"PEMRA", lat:33.7294, lng:73.0931, from_date:"2025-05-01", to_date:"2025-05-31", client:"Telenor", client_charged:50000, duty_start:"09:00" },
    ],
    allocations: [
      { id:"a1", stall_id:"s1", user_id:"u3", duty_start:"09:00", daily_rate:800, from_date:"2025-05-01", to_date:"2025-05-31", active:true },
      { id:"a2", stall_id:"s1", user_id:"u2", duty_start:"09:00", daily_rate:1500, from_date:"2025-05-01", to_date:"2025-05-31", active:true },
    ],
    attendance: [],
    client_payments: [],
    handovers: [],
    expenses: [],
    salary: [],
    callmebot: { admin1:"", admin2:"" },
    sheets_url: "",
  };
};
const save = (d) => localStorage.setItem("shinkore_v2", JSON.stringify(d));
const genId = () => Math.random().toString(36).slice(2,10);
const formatPKR = (n) => `PKR ${Number(n||0).toLocaleString()}`;
const getInitials = (n) => n ? n.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase() : "?";
const avatarClass = (role) => ({ admin:"av-gold", supervisor:"av-blue", ba:"av-green" }[role]||"av-gold");

// ─── GPS DISTANCE ─────────────────────────────────────────────────────────────
const haversine = (lat1,lon1,lat2,lon2) => {
  const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

// ─── WHATSAPP ─────────────────────────────────────────────────────────────────
const sendWA = (phone, msg) => {
  const clean = phone.replace(/[^0-9]/g,"");
  const num = clean.startsWith("0") ? "92"+clean.slice(1) : clean;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,"_blank");
};

const sendCallMeBot = async (phone, apiKey, msg) => {
  if (!apiKey) return false;
  const clean = phone.replace(/[^0-9]/g,"");
  const num = clean.startsWith("0") ? "92"+clean.slice(1) : clean;
  try {
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${num}&text=${encodeURIComponent(msg)}&apikey=${apiKey}`);
    return true;
  } catch { return false; }
};

const buildLateMsg = (staffName, role, stallName, city, team, time, date) =>
`🔴 *SHINKORE MARKETING — LATE ALERT*

👤 Staff: *${staffName}*
🏷️ Role: ${role === "ba" ? "Business Ambassador" : "Supervisor"}
👥 Team: ${team || "Unassigned"}
📍 Stall: ${stallName}, ${city}
🕐 Expected: ${time}
📅 Date: ${date}

⚠️ Status: *Not clocked in at assigned location*

— Shinkore Marketing System`;

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
:root {
  --g:#C9A84C; --gl:#E5C97A; --gd:rgba(201,168,76,0.14);
  --d1:#08090D; --d2:#0F1116; --d3:#161A22; --d4:#1C2130;
  --bo:rgba(201,168,76,0.18); --bo2:rgba(201,168,76,0.08);
  --tx:#DDD8CC; --txd:#6E6A60;
  --gr:#2ECC71; --rd:#E74C3C; --bl:#3A9BD5; --or:#F0A500;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--d1);color:var(--tx);font-family:'DM Sans',sans-serif;min-height:100vh}
.layout{display:flex;min-height:100vh}

/* SIDEBAR */
.sb{width:252px;background:var(--d2);border-right:1px solid var(--bo);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:transform .3s}
.sb-brand{padding:20px 16px;border-bottom:1px solid var(--bo);display:flex;align-items:center;gap:12px}
.sb-icon{width:42px;height:42px;background:linear-gradient(135deg,var(--g),#7A5C10);border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:17px;color:var(--d1);flex-shrink:0}
.sb-title{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:700;color:var(--g);letter-spacing:.5px}
.sb-sub{font-size:10px;color:var(--txd);letter-spacing:1.5px;text-transform:uppercase}
.sb-nav{flex:1;padding:12px 10px;overflow-y:auto}
.sec-lbl{font-size:10px;font-weight:600;color:var(--txd);letter-spacing:2px;text-transform:uppercase;padding:10px 8px 5px}
.ni{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;cursor:pointer;transition:all .18s;color:var(--txd);font-size:13.5px;font-weight:500;margin-bottom:1px;border:1px solid transparent}
.ni:hover{background:var(--d3);color:var(--tx)}
.ni.active{background:var(--gd);color:var(--g);border-color:var(--bo)}
.ni-badge{margin-left:auto;background:var(--rd);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px}
.sb-foot{padding:14px;border-top:1px solid var(--bo)}
.uchip{display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--d3);border-radius:9px;margin-bottom:8px}
.av{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:13px;flex-shrink:0}
.av-gold{background:linear-gradient(135deg,var(--g),#7A5C10);color:var(--d1)}
.av-blue{background:linear-gradient(135deg,#3A9BD5,#1a4f73);color:#fff}
.av-green{background:linear-gradient(135deg,#2ECC71,#1a6637);color:#fff}
.av-purple{background:linear-gradient(135deg,#9B59B6,#5B2C6F);color:#fff}
.uname{font-size:13px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.urole{font-size:11px;color:var(--txd);text-transform:capitalize}

/* MAIN */
.main{margin-left:252px;flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{background:var(--d2);border-bottom:1px solid var(--bo);padding:14px 24px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:50}
.tb-title{font-family:'Rajdhani',sans-serif;font-size:21px;font-weight:700}
.tb-sub{font-size:12px;color:var(--txd);margin-left:auto}
.content{padding:24px;flex:1}

/* CARDS */
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:22px}
.sc{background:var(--d2);border:1px solid var(--bo);border-radius:14px;padding:18px;position:relative;overflow:hidden;transition:border-color .2s}
.sc:hover{border-color:var(--g)}
.sc::after{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;opacity:.05}
.sc.gold::after{background:var(--g)} .sc.gr::after{background:var(--gr)} .sc.bl::after{background:var(--bl)} .sc.rd::after{background:var(--rd)}
.si{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.si.gold{background:var(--gd);color:var(--g)} .si.gr{background:rgba(46,204,113,.12);color:var(--gr)} .si.bl{background:rgba(58,155,213,.12);color:var(--bl)} .si.rd{background:rgba(231,76,60,.12);color:var(--rd)} .si.or{background:rgba(240,165,0,.12);color:var(--or)}
.sv{font-family:'Rajdhani',sans-serif;font-size:30px;font-weight:700;line-height:1}
.sl{font-size:11px;color:var(--txd);margin-top:3px;text-transform:uppercase;letter-spacing:1px}
.card{background:var(--d2);border:1px solid var(--bo);border-radius:14px;overflow:hidden;margin-bottom:18px}
.ch{padding:16px 20px;border-bottom:1px solid var(--bo);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ct{font-family:'Rajdhani',sans-serif;font-size:17px;font-weight:600;color:var(--tx)}
.cs{font-size:12px;color:var(--txd)}
.cb{padding:18px 20px}

/* FORMS */
.fg{margin-bottom:16px}
.fl{display:block;font-size:11px;font-weight:600;color:var(--txd);letter-spacing:1px;text-transform:uppercase;margin-bottom:7px}
.fi,.fsel{width:100%;background:var(--d3);border:1px solid var(--bo);border-radius:9px;padding:11px 14px;color:var(--tx);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .2s}
.fi:focus,.fsel:focus{border-color:var(--g)}
.fsel option{background:var(--d3)}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* BUTTONS */
.bp{width:100%;padding:13px;background:linear-gradient(135deg,var(--g),#7A5C10);border:none;border-radius:11px;color:var(--d1);font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:all .2s;margin-top:6px}
.bp:hover{opacity:.9;transform:translateY(-1px)}
.bs{padding:9px 16px;background:var(--d3);border:1px solid var(--bo);border-radius:9px;color:var(--tx);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:7px}
.bs:hover{border-color:var(--g);color:var(--g)}
.bg{padding:9px 16px;background:var(--gd);border:1px solid var(--g);border-radius:9px;color:var(--g);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:7px}
.bg:hover{background:var(--g);color:var(--d1)}
.bw{padding:9px 16px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.3);border-radius:9px;color:#25D366;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:7px}
.bw:hover{background:rgba(37,211,102,.2)}
.brd{padding:8px 13px;background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.28);border-radius:8px;color:var(--rd);font-size:12px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.brd:hover{background:rgba(231,76,60,.2)}
.bic{width:34px;height:34px;background:var(--d3);border:1px solid var(--bo);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;color:var(--txd)}
.bic:hover{border-color:var(--g);color:var(--g)}
.bgps{padding:16px 20px;background:linear-gradient(135deg,rgba(46,204,113,.15),rgba(46,204,113,.05));border:1px solid rgba(46,204,113,.3);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;transition:all .2s}
.bgps:hover{border-color:var(--gr)}
.bgps.clocking{background:linear-gradient(135deg,rgba(231,76,60,.15),rgba(231,76,60,.05));border-color:rgba(231,76,60,.3)}

/* MODAL */
.mo{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;backdrop-filter:blur(5px)}
.md{background:var(--d2);border:1px solid var(--bo);border-radius:18px;width:100%;max-width:500px;max-height:92vh;overflow-y:auto;position:relative}
.md::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--g),transparent);border-radius:18px 18px 0 0}
.mh{padding:22px 22px 0;display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.mt{font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700}
.mc{width:30px;height:30px;background:var(--d3);border:1px solid var(--bo);border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--txd);font-size:17px;transition:all .2s}
.mc:hover{border-color:var(--rd);color:var(--rd)}
.mb{padding:0 22px 22px}
.ma{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid var(--bo)}

/* BADGES */
.b{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;text-transform:capitalize}
.b-admin{background:rgba(201,168,76,.14);color:var(--g);border:1px solid rgba(201,168,76,.28)}
.b-supervisor{background:rgba(58,155,213,.14);color:var(--bl);border:1px solid rgba(58,155,213,.28)}
.b-ba{background:rgba(46,204,113,.12);color:var(--gr);border:1px solid rgba(46,204,113,.22)}
.b-active{background:rgba(46,204,113,.12);color:var(--gr);border:1px solid rgba(46,204,113,.22)}
.b-inactive{background:rgba(231,76,60,.12);color:var(--rd);border:1px solid rgba(231,76,60,.22)}
.b-pending{background:rgba(240,165,0,.12);color:var(--or);border:1px solid rgba(240,165,0,.22)}

/* TABLE */
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{font-size:11px;font-weight:600;color:var(--txd);letter-spacing:1.2px;text-transform:uppercase;padding:10px 14px;text-align:left;background:var(--d3);border-bottom:1px solid var(--bo)}
td{padding:12px 14px;font-size:13.5px;border-bottom:1px solid rgba(201,168,76,.06);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(201,168,76,.025)}

/* GPS PULSE */
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.15)}}
.gps-dot{width:10px;height:10px;border-radius:50%;background:var(--gr);animation:pulse 1.5s infinite}
.gps-dot.red{background:var(--rd)}
.gps-dot.orange{background:var(--or)}

/* ALLOC CARD */
.alc{background:var(--d3);border:1px solid var(--bo);border-radius:12px;padding:16px;margin-bottom:10px;transition:border-color .2s}
.alc:hover{border-color:var(--g)}
.alc-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.alc-meta{font-size:12px;color:var(--txd);margin-top:2px}
.alc-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px}
.alc-kv{}
.alc-k{font-size:10px;color:var(--txd);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.alc-v{font-size:13px;font-weight:600;color:var(--tx)}

/* STALL CARD */
.stallc{background:var(--d3);border:1px solid var(--bo);border-radius:12px;padding:16px;margin-bottom:10px;transition:border-color .2s}
.stallc:hover{border-color:var(--g)}
.stallc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}

/* ALERT / INFO */
.info{padding:12px 14px;border-radius:9px;font-size:13px;display:flex;align-items:flex-start;gap:9px;margin-bottom:14px}
.info-warn{background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.25);color:var(--or)}
.info-err{background:rgba(231,76,60,.08);border:1px solid rgba(231,76,60,.25);color:var(--rd)}
.info-ok{background:rgba(46,204,113,.08);border:1px solid rgba(46,204,113,.22);color:var(--gr)}
.info-blue{background:rgba(58,155,213,.08);border:1px solid rgba(58,155,213,.22);color:var(--bl)}

/* TOAST */
.toast{position:fixed;bottom:22px;right:22px;background:var(--d3);border:1px solid var(--g);border-radius:11px;padding:12px 18px;font-size:13.5px;z-index:999;animation:sUp .3s ease;max-width:300px}
@keyframes sUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

/* LOGIN */
.lw{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 25% 25%,rgba(201,168,76,.07) 0%,transparent 55%),radial-gradient(ellipse at 75% 75%,rgba(201,168,76,.04) 0%,transparent 55%),var(--d1);padding:20px}
.lc{background:var(--d2);border:1px solid var(--bo);border-radius:18px;padding:44px 38px;width:100%;max-width:430px;position:relative;overflow:hidden}
.lc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--g),transparent)}
.tab-sw{display:flex;background:var(--d3);border-radius:9px;padding:3px;margin-bottom:24px}
.tab-b{flex:1;padding:9px;border:none;border-radius:7px;background:transparent;color:var(--txd);font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;cursor:pointer;transition:all .2s}
.tab-b.active{background:var(--g);color:var(--d1)}
.brand{display:flex;align-items:center;gap:13px;margin-bottom:32px}
.brand-ic{width:48px;height:48px;background:linear-gradient(135deg,var(--g),#7A5C10);border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:20px;color:var(--d1)}
.brand h1{font-family:'Rajdhani',sans-serif;font-size:21px;font-weight:700;color:var(--g);letter-spacing:.5px}
.brand p{font-size:11px;color:var(--txd);letter-spacing:1.5px;text-transform:uppercase}

/* CLOCK UI */
.clock-card{background:var(--d3);border:1px solid var(--bo);border-radius:16px;padding:24px;text-align:center;margin-bottom:16px}
.clock-time{font-family:'Rajdhani',sans-serif;font-size:48px;font-weight:700;color:var(--g);line-height:1;margin-bottom:4px}
.clock-date{font-size:13px;color:var(--txd);margin-bottom:20px}
.gps-status{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;font-size:13px}

/* DIVIDER */
.div{height:1px;background:var(--bo);margin:16px 0}

/* SCROLLBAR */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--d1)}
::-webkit-scrollbar-thumb{background:var(--bo);border-radius:3px}

/* SEARCH */
.srch{position:relative}
.srch input{width:100%;background:var(--d3);border:1px solid var(--bo);border-radius:9px;padding:9px 14px 9px 36px;color:var(--tx);font-family:'DM Sans',sans-serif;font-size:13px;outline:none}
.srch input:focus{border-color:var(--g)}
.srch svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--txd)}

/* MOBILE */
.mbtn{display:none;width:36px;height:36px;background:var(--d3);border:1px solid var(--bo);border-radius:8px;align-items:center;justify-content:center;cursor:pointer;color:var(--tx)}
.ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:90}
@media(max-width:768px){
  .sb{transform:translateX(-100%)}
  .sb.open{transform:translateX(0)}
  .main{margin-left:0}
  .content{padding:14px}
  .sg{grid-template-columns:1fr 1fr}
  .frow{grid-template-columns:1fr}
  .mbtn{display:flex}
  .ov.show{display:block}
  .tb-sub{display:none}
  .alc-grid{grid-template-columns:1fr 1fr}
}
`;

// ─── ICONS ────────────────────────────────────────────────────────────────────
const I = ({n,s=18,c="currentColor"}) => {
  const m={
    dash:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    users:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    pin:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    clock:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
    money:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    cal:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    alert:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    set:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    plus:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    del:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    ok:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>,
    out:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    wa:<svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>,
    gps:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/><circle cx="12" cy="12" r="9" strokeDasharray="2 4"/></svg>,
    alloc:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
    key:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    pdf:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></svg>,
    sync:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polyline points="1,4 1,10 7,10"/><polyline points="23,20 23,14 17,14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>,
    apk:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/><polyline points="8,7 12,3 16,7"/><line x1="12" y1="3" x2="12" y2="13"/></svg>,
    map:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    user:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  };
  return m[n]||null;
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t)},[]);
  return <div className="toast">{msg}</div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({onLogin}){
  const [tab,setTab]=useState("in");
  const [f,setF]=useState({name:"",phone:"",role:"ba",daily_rate:"",pass:""});
  const [err,setErr]=useState("");
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const data=initData();

  const doIn=()=>{
    setErr("");
    const u=data.users.find(x=>x.phone===f.phone);
    if(!u) return setErr("Phone not found. Ask admin to register you.");
    if(u.role==="admin"&&f.pass!==ADMIN_PASSWORD) return setErr("Wrong admin password.");
    onLogin(u);
  };

  const doUp=()=>{
    setErr("");
    if(!f.name||!f.phone) return setErr("Name and phone required.");
    if(data.users.find(u=>u.phone===f.phone)) return setErr("Phone already registered.");
    const nu={id:genId(),name:f.name,phone:f.phone,role:f.role,daily_rate:Number(f.daily_rate)||0,team:"",callmebot_key:""};
    data.users.push(nu); save(data); onLogin(nu);
  };

  return(
    <div className="lw">
      <div className="lc">
        <div className="brand">
          <div className="brand-ic">SM</div>
          <div><h1>SHINKORE</h1><p>Marketing Operations</p></div>
        </div>
        <div className="tab-sw">
          <button className={`tab-b ${tab==="in"?"active":""}`} onClick={()=>setTab("in")}>Sign In</button>
          <button className={`tab-b ${tab==="up"?"active":""}`} onClick={()=>setTab("up")}>Sign Up</button>
        </div>
        {err&&<div className="info info-err" style={{marginBottom:14}}><I n="alert" s={15}/>{err}</div>}
        {tab==="in"?(
          <>
            <div className="fg"><label className="fl">Phone Number</label><input className="fi" placeholder="03001234567" value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
            <div className="fg"><label className="fl">Password (Admin only)</label><input className="fi" type="password" placeholder="Staff leave blank" value={f.pass} onChange={e=>set("pass",e.target.value)}/></div>
            <button className="bp" onClick={doIn}>SIGN IN →</button>
          </>
        ):(
          <>
            <div className="fg"><label className="fl">Full Name</label><input className="fi" placeholder="Your full name" value={f.name} onChange={e=>set("name",e.target.value)}/></div>
            <div className="fg"><label className="fl">Phone</label><input className="fi" placeholder="03001234567" value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
            <div className="fg"><label className="fl">Role</label>
              <select className="fsel" value={f.role} onChange={e=>set("role",e.target.value)}>
                <option value="ba">Business Ambassador (BA)</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Daily Rate (PKR)</label><input className="fi" type="number" placeholder="800" value={f.daily_rate} onChange={e=>set("daily_rate",e.target.value)}/></div>
            <button className="bp" onClick={doUp}>CREATE ACCOUNT →</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({user,page,setPage,open,onClose}){
  const isAdmin=user.role==="admin";
  const adminNav=[
    {id:"dash",icon:"dash",label:"Dashboard"},
    {id:"staff",icon:"users",label:"Staff & Teams"},
    {id:"stalls",icon:"pin",label:"Permission Stalls"},
    {id:"alloc",icon:"alloc",label:"Allocations"},
    {id:"attend",icon:"clock",label:"Attendance"},
    {id:"cash",icon:"money",label:"Cash & Finance"},
    {id:"salary",icon:"cal",label:"Salary & Slips"},
    {id:"alerts",icon:"alert",label:"Late Alerts"},
    {id:"sync",icon:"sync",label:"Google Sheets Sync"},
    {id:"apk",icon:"apk",label:"Install APK / PWA"},
    {id:"settings",icon:"set",label:"Settings / CallMeBot"},,
  ];
  const staffNav=[
    {id:"my-dash",icon:"dash",label:"My Dashboard"},
    {id:"clock-in",icon:"clock",label:"Clock In / Out"},
    {id:"my-salary",icon:"money",label:"My Salary"},
  ];
  const nav=isAdmin?adminNav:staffNav;
  return(
    <>
      <div className={`ov ${open?"show":""}`} onClick={onClose}/>
      <aside className={`sb ${open?"open":""}`}>
        <div className="sb-brand">
          <div className="sb-icon">SM</div>
          <div><div className="sb-title">SHINKORE</div><div className="sb-sub">Marketing Ops</div></div>
        </div>
        <nav className="sb-nav">
          <div className="sec-lbl">{isAdmin?"Admin Panel":"My Portal"}</div>
          {nav.map(n=>(
            <div key={n.id} className={`ni ${page===n.id?"active":""}`} onClick={()=>{setPage(n.id);onClose();}}>
              <I n={n.icon} s={17}/>{n.label}
            </div>
          ))}
        </nav>
        <div className="sb-foot">
          <div className="uchip">
            <div className={`av ${avatarClass(user.role)}`}>{getInitials(user.name)}</div>
            <div style={{flex:1,minWidth:0}}><div className="uname">{user.name}</div><div className="urole">{user.role}</div></div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDash({data}){
  const staff=data.users.filter(u=>u.role!=="admin");
  const today=new Date().toISOString().slice(0,10);
  const todayAtt=data.attendance.filter(a=>a.date===today);
  const activeAlloc=data.allocations.filter(a=>a.active);

  return(
    <div>
      <div className="sg">
        <div className="sc gold"><div className="si gold"><I n="users" s={18}/></div><div className="sv">{staff.length}</div><div className="sl">Total Staff</div></div>
        <div className="sc bl"><div className="si bl"><I n="pin" s={18}/></div><div className="sv">{data.stalls.length}</div><div className="sl">Active Stalls</div></div>
        <div className="sc gr"><div className="si gr"><I n="alloc" s={18}/></div><div className="sv">{activeAlloc.length}</div><div className="sl">Allocations</div></div>
        <div className="sc rd"><div className="si rd"><I n="clock" s={18}/></div><div className="sv">{todayAtt.length}</div><div className="sl">Checked In Today</div></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div className="card">
          <div className="ch"><I n="alloc" s={17} c="var(--g)"/><div><div className="ct">Today's Allocations</div><div className="cs">Who is where today</div></div></div>
          <div className="cb">
            {activeAlloc.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No allocations yet.</div>}
            {activeAlloc.slice(0,6).map(a=>{
              const u=data.users.find(x=>x.id===a.user_id);
              const s=data.stalls.find(x=>x.id===a.stall_id);
              if(!u||!s) return null;
              const att=todayAtt.find(x=>x.user_id===a.user_id&&x.stall_id===a.stall_id);
              return(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                  <div className={`av ${avatarClass(u.role)}`} style={{width:32,height:32,fontSize:11,borderRadius:7}}>{getInitials(u.name)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{s.name} · {s.city}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div className={`gps-dot ${att?"":"red"}`}/>
                    <span style={{fontSize:11,color:att?"var(--gr)":"var(--rd)"}}>{att?att.clock_in:"Not in"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="ch"><I n="pin" s={17} c="var(--bl)"/><div><div className="ct">Active Stalls</div><div className="cs">Running permissions</div></div></div>
          <div className="cb">
            {data.stalls.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No stalls added yet.</div>}
            {data.stalls.map(s=>{
              const assigned=data.allocations.filter(a=>a.stall_id===s.id&&a.active).length;
              return(
                <div key={s.id} style={{padding:"10px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
                      <div style={{fontSize:11,color:"var(--txd)"}}>{s.city} · {s.dept}</div>
                    </div>
                    <span className="b b-active">{assigned} staff</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── STAFF PAGE ───────────────────────────────────────────────────────────────
function StaffPage({data,setData,toast}){
  const [show,setShow]=useState(false);
  const [editing,setEditing]=useState(null);
  const [search,setSearch]=useState("");
  const [f,setF]=useState({name:"",phone:"",role:"ba",daily_rate:"",team:"",callmebot_key:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const openAdd=()=>{setEditing(null);setF({name:"",phone:"",role:"ba",daily_rate:"",team:"",callmebot_key:""});setShow(true)};
  const openEdit=(u)=>{setEditing(u);setF({name:u.name,phone:u.phone,role:u.role,daily_rate:u.daily_rate,team:u.team||"",callmebot_key:u.callmebot_key||""});setShow(true)};

  const doSave=()=>{
    if(!f.name||!f.phone) return;
    const d={...data};
    if(editing) d.users=d.users.map(u=>u.id===editing.id?{...u,...f,daily_rate:Number(f.daily_rate)}:u);
    else{
      if(d.users.find(u=>u.phone===f.phone)){toast("Phone exists!");return;}
      d.users.push({id:genId(),...f,daily_rate:Number(f.daily_rate)});
    }
    setData(d);save(d);setShow(false);toast(editing?"Updated!":"Staff added!");
  };

  const doDel=(u)=>{
    if(!confirm(`Delete ${u.name}?`)) return;
    const d={...data,users:data.users.filter(x=>x.id!==u.id)};
    setData(d);save(d);toast("Removed.");
  };

  const addTeam=()=>{
    const name=prompt("Team name:");
    if(!name) return;
    const d={...data,teams:[...data.teams,name]};
    setData(d);save(d);toast(`Team "${name}" created!`);
  };

  const list=data.users.filter(u=>u.role!=="admin"&&(u.name.toLowerCase().includes(search.toLowerCase())||u.phone.includes(search)));

  return(
    <div>
      <div className="card">
        <div className="ch">
          <I n="users" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Staff Directory</div><div className="cs">{list.length} members</div></div>
          <div className="srch" style={{maxWidth:220}}><I n="user" s={13}/><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <button className="bg" onClick={openAdd}><I n="plus" s={15}/>Add Staff</button>
          <button className="bs" onClick={addTeam}><I n="users" s={15}/>New Team</button>
        </div>
        <div className="cb" style={{padding:0}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,padding:16}}>
            {list.map(u=>(
              <div key={u.id} style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:12,padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div className={`av ${avatarClass(u.role)}`} style={{width:42,height:42,fontSize:15,borderRadius:9}}>{getInitials(u.name)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
                    <div style={{fontSize:12,color:"var(--txd)"}}>{u.phone}</div>
                  </div>
                  <span className={`b b-${u.role}`}>{u.role==="ba"?"BA":u.role}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Team</div>
                    <div style={{fontSize:12,marginTop:2}}>{u.team?<span style={{color:"var(--gl)",fontSize:12}}>{u.team}</span>:<span style={{color:"var(--txd)"}}>Unassigned</span>}</div>
                  </div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Daily Rate</div>
                    <div style={{fontFamily:"Rajdhani",fontSize:17,fontWeight:700,color:"var(--g)"}}>{formatPKR(u.daily_rate)}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:12}}>
                  <div className={`gps-dot ${u.callmebot_key?"":"red"}`} style={{width:7,height:7}}/>
                  <span style={{fontSize:11,color:u.callmebot_key?"var(--gr)":"var(--rd)"}}>{u.callmebot_key?"Auto-alert ✓":"No CallMeBot key"}</span>
                </div>
                <div style={{display:"flex",gap:8,paddingTop:12,borderTop:"1px solid var(--bo)"}}>
                  <button className="bic" onClick={()=>openEdit(u)}><I n="edit" s={14}/></button>
                  <button className="bw" onClick={()=>sendWA(u.phone,`Assalam o Alaikum ${u.name}!`)}><I n="wa" s={13}/>WA</button>
                  <button className="brd" onClick={()=>doDel(u)} style={{marginLeft:"auto"}}><I n="del" s={13}/>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">{editing?"Edit Staff":"Add Staff"}</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="frow">
                <div className="fg"><label className="fl">Full Name</label><input className="fi" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Full name"/></div>
                <div className="fg"><label className="fl">Phone</label><input className="fi" value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="03001234567"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Role</label>
                  <select className="fsel" value={f.role} onChange={e=>set("role",e.target.value)}>
                    <option value="ba">Business Ambassador (BA)</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Daily Rate (PKR)</label><input className="fi" type="number" value={f.daily_rate} onChange={e=>set("daily_rate",e.target.value)}/></div>
              </div>
              <div className="fg"><label className="fl">Assign Team</label>
                <select className="fsel" value={f.team} onChange={e=>set("team",e.target.value)}>
                  <option value="">-- Unassigned --</option>
                  {data.teams.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl">CallMeBot API Key (for auto-alerts)</label>
                <input className="fi" value={f.callmebot_key} onChange={e=>set("callmebot_key",e.target.value)} placeholder="e.g. 1234567"/>
                <div style={{fontSize:11,color:"var(--txd)",marginTop:5}}>Staff sends "I allow callmebot to send me messages" to +34 644 59 72 97 on WhatsApp → gets key back</div>
              </div>
              <div className="ma">
                <button className="bs" onClick={()=>setShow(false)}>Cancel</button>
                <button className="bg" onClick={doSave}><I n="ok" s={15}/>{editing?"Save":"Add"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STALLS PAGE ──────────────────────────────────────────────────────────────
function StallsPage({data,setData,toast}){
  const [show,setShow]=useState(false);
  const [editing,setEditing]=useState(null);
  const [f,setF]=useState({name:"",city:"",dept:"",lat:"",lng:"",from_date:"",to_date:"",client:"",client_charged:"",duty_start:"09:00"});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const getMyLoc=()=>{
    if(!navigator.geolocation) return toast("GPS not available");
    navigator.geolocation.getCurrentPosition(p=>{
      set("lat",p.coords.latitude.toFixed(6));
      set("lng",p.coords.longitude.toFixed(6));
      toast("Location captured!");
    },()=>toast("GPS denied."));
  };

  const openAdd=()=>{setEditing(null);setF({name:"",city:"",dept:"",lat:"",lng:"",from_date:"",to_date:"",client:"",client_charged:"",duty_start:"09:00"});setShow(true)};
  const openEdit=(s)=>{setEditing(s);setF({...s});setShow(true)};

  const doSave=()=>{
    if(!f.name||!f.city||!f.lat||!f.lng) return toast("Name, city and GPS required.");
    const d={...data};
    if(editing) d.stalls=d.stalls.map(s=>s.id===editing.id?{...s,...f,client_charged:Number(f.client_charged)}:s);
    else d.stalls.push({id:genId(),...f,client_charged:Number(f.client_charged)});
    setData(d);save(d);setShow(false);toast(editing?"Stall updated!":"Stall added!");
  };

  const doDel=(s)=>{
    if(!confirm(`Delete stall "${s.name}"?`)) return;
    const d={...data,stalls:data.stalls.filter(x=>x.id!==s.id)};
    setData(d);save(d);toast("Stall removed.");
  };

  return(
    <div>
      <div className="card">
        <div className="ch">
          <I n="pin" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Permission Stalls</div><div className="cs">{data.stalls.length} stalls</div></div>
          <button className="bg" onClick={openAdd}><I n="plus" s={15}/>Add Stall</button>
        </div>
        <div className="cb">
          {data.stalls.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--txd)"}}>No stalls yet. Add your first permission stall.</div>}
          {data.stalls.map(s=>{
            const assigned=data.allocations.filter(a=>a.stall_id===s.id&&a.active);
            return(
              <div className="stallc" key={s.id}>
                <div className="stallc-top">
                  <div>
                    <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--g)"}}>{s.name}</div>
                    <div style={{fontSize:12,color:"var(--txd)",marginTop:3}}>{s.city} · Dept: {s.dept}</div>
                    <div style={{fontSize:12,color:"var(--txd)"}}>{s.from_date} → {s.to_date}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="bic" onClick={()=>openEdit(s)}><I n="edit" s={14}/></button>
                    <button className="brd" onClick={()=>doDel(s)}><I n="del" s={13}/></button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:12}}>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Client</div><div style={{fontSize:13,fontWeight:600}}>{s.client||"—"}</div></div>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Charged</div><div style={{fontSize:13,fontWeight:600,color:"var(--g)"}}>{formatPKR(s.client_charged)}</div></div>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Duty Start</div><div style={{fontSize:13,fontWeight:600}}>{s.duty_start}</div></div>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>GPS</div><div style={{fontSize:12,color:"var(--bl)"}}>{Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}</div></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:"var(--txd)"}}>Assigned:</span>
                  {assigned.length===0&&<span style={{fontSize:12,color:"var(--txd)"}}>No staff yet</span>}
                  {assigned.map(a=>{
                    const u=data.users.find(x=>x.id===a.user_id);
                    return u?<span key={a.id} style={{background:"var(--gd)",border:"1px solid var(--bo)",borderRadius:20,padding:"2px 10px",fontSize:12,color:"var(--gl)"}}>{u.name}</span>:null;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">{editing?"Edit Stall":"Add Permission Stall"}</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="frow">
                <div className="fg"><label className="fl">Stall Name</label><input className="fi" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Centaurus Mall Stall"/></div>
                <div className="fg"><label className="fl">City</label><input className="fi" value={f.city} onChange={e=>set("city",e.target.value)} placeholder="Islamabad"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Department (Permission from)</label><input className="fi" value={f.dept} onChange={e=>set("dept",e.target.value)} placeholder="e.g. PEMRA, CDA"/></div>
                <div className="fg"><label className="fl">Client</label><input className="fi" value={f.client} onChange={e=>set("client",e.target.value)} placeholder="e.g. Telenor"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Permission From</label><input className="fi" type="date" value={f.from_date} onChange={e=>set("from_date",e.target.value)}/></div>
                <div className="fg"><label className="fl">Permission To</label><input className="fi" type="date" value={f.to_date} onChange={e=>set("to_date",e.target.value)}/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Client Charged (PKR)</label><input className="fi" type="number" value={f.client_charged} onChange={e=>set("client_charged",e.target.value)}/></div>
                <div className="fg"><label className="fl">Duty Start Time</label><input className="fi" type="time" value={f.duty_start} onChange={e=>set("duty_start",e.target.value)}/></div>
              </div>
              <div className="fg">
                <label className="fl">GPS Coordinates</label>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <input className="fi" placeholder="Latitude" value={f.lat} onChange={e=>set("lat",e.target.value)} style={{flex:1}}/>
                  <input className="fi" placeholder="Longitude" value={f.lng} onChange={e=>set("lng",e.target.value)} style={{flex:1}}/>
                </div>
                <button className="bg" onClick={getMyLoc} style={{width:"100%",justifyContent:"center"}}><I n="gps" s={14}/>Capture My Location</button>
                <div style={{fontSize:11,color:"var(--txd)",marginTop:5}}>Go to the stall location and press above, OR enter coordinates manually from Google Maps.</div>
              </div>
              <div className="ma">
                <button className="bs" onClick={()=>setShow(false)}>Cancel</button>
                <button className="bg" onClick={doSave}><I n="ok" s={15}/>{editing?"Save":"Add Stall"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ALLOCATIONS PAGE ─────────────────────────────────────────────────────────
function AllocPage({data,setData,toast}){
  const [show,setShow]=useState(false);
  const [f,setF]=useState({stall_id:"",user_id:"",duty_start:"09:00",daily_rate:"",from_date:"",to_date:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const nonAdmin=data.users.filter(u=>u.role!=="admin");

  const openAdd=()=>{
    setF({stall_id:data.stalls[0]?.id||"",user_id:nonAdmin[0]?.id||"",duty_start:"09:00",daily_rate:"",from_date:new Date().toISOString().slice(0,10),to_date:""});
    setShow(true);
  };

  const onStaffChange=(uid)=>{
    const u=data.users.find(x=>x.id===uid);
    set("user_id",uid);
    if(u) set("daily_rate",u.daily_rate);
  };

  const doSave=()=>{
    if(!f.stall_id||!f.user_id) return toast("Select stall and staff.");
    const d={...data};
    d.allocations.push({id:genId(),...f,daily_rate:Number(f.daily_rate),active:true});
    setData(d);save(d);setShow(false);toast("Allocation saved!");
  };

  const doDeactivate=(a)=>{
    const d={...data,allocations:data.allocations.map(x=>x.id===a.id?{...x,active:false}:x)};
    setData(d);save(d);toast("Allocation ended.");
  };

  const active=data.allocations.filter(a=>a.active);
  const ended=data.allocations.filter(a=>!a.active);

  return(
    <div>
      <div className="info info-blue"><I n="alloc" s={15}/>
        <div><strong>Flexible Allocation</strong> — Admin can assign ANY staff member to ANY stall, anywhere, any time. No team restrictions.</div>
      </div>

      <div className="card">
        <div className="ch">
          <I n="alloc" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Active Allocations</div><div className="cs">{active.length} active</div></div>
          <button className="bg" onClick={openAdd} disabled={data.stalls.length===0||nonAdmin.length===0}><I n="plus" s={15}/>Allocate Staff</button>
        </div>
        <div className="cb">
          {data.stalls.length===0&&<div className="info info-warn"><I n="alert" s={14}/>Add stalls first before allocating staff.</div>}
          {active.length===0&&data.stalls.length>0&&<div style={{color:"var(--txd)",fontSize:13}}>No active allocations. Press "Allocate Staff" to assign.</div>}
          {active.map(a=>{
            const u=data.users.find(x=>x.id===a.user_id);
            const s=data.stalls.find(x=>x.id===a.stall_id);
            if(!u||!s) return null;
            return(
              <div className="alc" key={a.id}>
                <div className="alc-top">
                  <div className={`av ${avatarClass(u.role)}`} style={{width:40,height:40,fontSize:14,borderRadius:9}}>{getInitials(u.name)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
                    <div className="alc-meta">{u.role==="ba"?"Business Ambassador":"Supervisor"} · {u.phone}</div>
                  </div>
                  <span className="b b-active">Active</span>
                </div>
                <div className="alc-grid">
                  <div className="alc-kv"><div className="alc-k">Stall</div><div className="alc-v" style={{fontSize:12}}>{s.name}</div></div>
                  <div className="alc-kv"><div className="alc-k">City</div><div className="alc-v" style={{fontSize:12}}>{s.city}</div></div>
                  <div className="alc-kv"><div className="alc-k">Duty Start</div><div className="alc-v">{a.duty_start}</div></div>
                  <div className="alc-kv"><div className="alc-k">Daily Rate</div><div className="alc-v" style={{color:"var(--g)"}}>{formatPKR(a.daily_rate)}</div></div>
                  <div className="alc-kv"><div className="alc-k">From</div><div className="alc-v" style={{fontSize:12}}>{a.from_date}</div></div>
                  <div className="alc-kv"><div className="alc-k">To</div><div className="alc-v" style={{fontSize:12}}>{a.to_date||"Open"}</div></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="bw" onClick={()=>sendWA(u.phone,`Shinkore Marketing: Aap ko *${s.name}*, ${s.city} par allocate kiya gaya hai. Duty time: ${a.duty_start}. GPS check hoga.`)}><I n="wa" s={13}/>Notify {u.name.split(" ")[0]}</button>
                  <button className="brd" onClick={()=>doDeactivate(a)} style={{marginLeft:"auto"}}><I n="del" s={13}/>End Allocation</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ended.length>0&&(
        <div className="card">
          <div className="ch"><I n="cal" s={17} c="var(--txd)"/><div className="ct" style={{color:"var(--txd)"}}>Past Allocations</div></div>
          <div className="cb">
            {ended.map(a=>{
              const u=data.users.find(x=>x.id===a.user_id);
              const s=data.stalls.find(x=>x.id===a.stall_id);
              if(!u||!s) return null;
              return(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(201,168,76,.06)",opacity:.6}}>
                  <div className={`av ${avatarClass(u.role)}`} style={{width:30,height:30,fontSize:11,borderRadius:7}}>{getInitials(u.name)}</div>
                  <div style={{flex:1}}><div style={{fontSize:13}}>{u.name}</div><div style={{fontSize:11,color:"var(--txd)"}}>{s.name} · {s.city}</div></div>
                  <span className="b b-inactive">Ended</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Allocate Staff to Stall</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="info info-blue" style={{marginBottom:16}}><I n="alloc" s={14}/>Any staff can go to any stall — no team restrictions.</div>
              <div className="fg"><label className="fl">Select Staff Member</label>
                <select className="fsel" value={f.user_id} onChange={e=>onStaffChange(e.target.value)}>
                  <option value="">-- Select staff --</option>
                  {nonAdmin.map(u=><option key={u.id} value={u.id}>{u.name} ({u.role==="ba"?"BA":"Supervisor"}) · {u.phone}</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl">Select Stall / Location</label>
                <select className="fsel" value={f.stall_id} onChange={e=>set("stall_id",e.target.value)}>
                  <option value="">-- Select stall --</option>
                  {data.stalls.map(s=><option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
                </select>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Duty Start Time</label><input className="fi" type="time" value={f.duty_start} onChange={e=>set("duty_start",e.target.value)}/></div>
                <div className="fg"><label className="fl">Daily Rate (PKR)</label><input className="fi" type="number" value={f.daily_rate} onChange={e=>set("daily_rate",e.target.value)} placeholder="Auto from profile"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">From Date</label><input className="fi" type="date" value={f.from_date} onChange={e=>set("from_date",e.target.value)}/></div>
                <div className="fg"><label className="fl">To Date</label><input className="fi" type="date" value={f.to_date} onChange={e=>set("to_date",e.target.value)}/></div>
              </div>
              <div className="ma">
                <button className="bs" onClick={()=>setShow(false)}>Cancel</button>
                <button className="bg" onClick={doSave}><I n="ok" s={15}/>Allocate</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GPS CLOCK IN/OUT (Staff) ─────────────────────────────────────────────────
function ClockPage({user,data,setData,toast}){
  const [gps,setGps]=useState(null);
  const [gpsErr,setGpsErr]=useState("");
  const [loading,setLoading]=useState(false);
  const today=new Date().toISOString().slice(0,10);
  const [time,setTime]=useState(new Date().toLocaleTimeString("en-PK"));

  useEffect(()=>{
    const t=setInterval(()=>setTime(new Date().toLocaleTimeString("en-PK")),1000);
    return ()=>clearInterval(t);
  },[]);

  const myAllocs=data.allocations.filter(a=>a.user_id===user.id&&a.active);
  const todayAtt=data.attendance.filter(a=>a.user_id===user.id&&a.date===today);

  const getGPS=()=>{
    setGpsErr(""); setLoading(true);
    navigator.geolocation.getCurrentPosition(
      p=>{ setGps({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}); setLoading(false); },
      e=>{ setGpsErr("GPS denied or unavailable. Enable location in browser."); setLoading(false); },
      {enableHighAccuracy:true,timeout:10000}
    );
  };

  const doClockIn=(alloc)=>{
    if(!gps) return toast("Capture GPS first!");
    const stall=data.stalls.find(s=>s.id===alloc.stall_id);
    if(!stall) return toast("Stall not found.");
    const dist=haversine(gps.lat,gps.lng,Number(stall.lat),Number(stall.lng));

    if(dist>GPS_RADIUS_M){
      const msg=`⚠️ SHINKORE: ${user.name} tried to clock in but is ${Math.round(dist)}m away from ${stall.name}. Required: within ${GPS_RADIUS_M}m.`;
      toast(`Too far! You are ${Math.round(dist)}m away. Must be within ${GPS_RADIUS_M}m.`);
      ADMIN_PHONES.forEach(ph=>sendWA(ph,msg));
      return;
    }

    const now=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    const rec={id:genId(),user_id:user.id,stall_id:alloc.stall_id,date:today,clock_in:now,clock_out:null,lat:gps.lat,lng:gps.lng,dist:Math.round(dist)};
    const d={...data,attendance:[...data.attendance,rec]};
    setData(d);save(d);
    toast(`Clocked in at ${stall.name} — ${now}`);

    const confMsg=`✅ *SHINKORE MARKETING*\n\n${user.name} clocked in\n📍 ${stall.name}, ${stall.city}\n🕐 ${now} | ${today}\n📏 ${Math.round(dist)}m from stall`;
    ADMIN_PHONES.forEach(ph=>sendWA(ph,confMsg));
  };

  const doClockOut=(att)=>{
    const now=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    const d={...data,attendance:data.attendance.map(a=>a.id===att.id?{...a,clock_out:now}:a)};
    setData(d);save(d);toast(`Clocked out — ${now}`);
  };

  return(
    <div>
      <div className="clock-card">
        <div className="clock-time">{time}</div>
        <div className="clock-date">{new Date().toLocaleDateString("en-PK",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
        <div className="gps-status">
          <div className={`gps-dot ${gps?"":"orange"}`}/>
          <span style={{color:gps?"var(--gr)":"var(--or)"}}>
            {gps?`GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} (±${Math.round(gps.acc)}m)`:"GPS not captured"}
          </span>
        </div>
        {gpsErr&&<div className="info info-err" style={{textAlign:"left"}}><I n="alert" s={14}/>{gpsErr}</div>}
        <button className="bg" onClick={getGPS} style={{width:"100%",justifyContent:"center",marginBottom:8}}>
          <I n="gps" s={15}/>{loading?"Getting GPS…":"Capture My GPS Location"}
        </button>
      </div>

      {myAllocs.length===0&&(
        <div className="info info-warn"><I n="alert" s={14}/>You have no active allocations. Contact admin.</div>
      )}

      {myAllocs.map(alloc=>{
        const stall=data.stalls.find(s=>s.id===alloc.stall_id);
        if(!stall) return null;
        const att=todayAtt.find(a=>a.stall_id===alloc.stall_id);
        return(
          <div className="card" key={alloc.id}>
            <div className="ch">
              <I n="pin" s={17} c="var(--g)"/>
              <div style={{flex:1}}>
                <div className="ct">{stall.name}</div>
                <div className="cs">{stall.city} · Duty: {alloc.duty_start}</div>
              </div>
              <span className={`b ${att?"b-active":"b-pending"}`}>{att?att.clock_out?"Done":"On Duty":"Not In"}</span>
            </div>
            <div className="cb">
              <div style={{fontSize:12,color:"var(--txd)",marginBottom:12}}>GPS Target: {Number(stall.lat).toFixed(5)}, {Number(stall.lng).toFixed(5)} · Within {GPS_RADIUS_M}m required</div>
              {!att?(
                <button className="bgps" onClick={()=>doClockIn(alloc)}>
                  <div><div style={{fontFamily:"Rajdhani",fontSize:17,fontWeight:700,color:"var(--gr)"}}>CLOCK IN</div><div style={{fontSize:12,color:"var(--txd)"}}>GPS will be verified</div></div>
                  <I n="ok" s={22} c="var(--gr)"/>
                </button>
              ):!att.clock_out?(
                <>
                  <div className="info info-ok"><I n="ok" s={14}/>Clocked in at {att.clock_in} · {att.dist}m from stall</div>
                  <button className="bgps clocking" onClick={()=>doClockOut(att)}>
                    <div><div style={{fontFamily:"Rajdhani",fontSize:17,fontWeight:700,color:"var(--rd)"}}>CLOCK OUT</div><div style={{fontSize:12,color:"var(--txd)"}}>Mark duty complete</div></div>
                    <I n="out" s={22} c="var(--rd)"/>
                  </button>
                </>
              ):(
                <div className="info info-ok"><I n="ok" s={14}/>Duty complete · In: {att.clock_in} → Out: {att.clock_out}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ATTENDANCE (ADMIN) ───────────────────────────────────────────────────────
function AttendancePage({data,setData,toast}){
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const dayAtt=data.attendance.filter(a=>a.date===date);

  const sendLateAlert=(u,stall)=>{
    const now=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    const alloc=data.allocations.find(a=>a.user_id===u.id&&a.stall_id===stall.id&&a.active);
    const team=u.team||"Unassigned";
    const supId=data.allocations.find(a=>a.stall_id===stall.id&&a.active&&a.user_id!==u.id&&data.users.find(x=>x.id===a.user_id&&x.role==="supervisor"));
    const sup=supId?data.users.find(x=>x.id===supId.user_id):null;
    const msg=buildLateMsg(u.name,u.role,stall.name,stall.city,team,alloc?.duty_start||"—",date);
    ADMIN_PHONES.forEach(ph=>sendWA(ph,msg));
    if(sup) sendWA(sup.phone,msg);
    sendWA(u.phone,`*Shinkore Marketing* — Aap ne ${date} ko abhi tak duty start nahi ki. Assigned location: ${stall.name}, ${stall.city}. Foran clock in karein.`);
    toast("Alert sent: Khalid" + (sup ? " + " + sup.name : "") + " + " + u.name);
  };

  const allocs=data.allocations.filter(a=>a.active);

  return(
    <div>
      <div className="card">
        <div className="ch">
          <I n="clock" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Attendance</div></div>
          <input type="date" className="fi" value={date} onChange={e=>setDate(e.target.value)} style={{width:"auto",maxWidth:160}}/>
        </div>
        <div className="cb">
          {allocs.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No allocations found.</div>}
          {allocs.map(a=>{
            const u=data.users.find(x=>x.id===a.user_id);
            const s=data.stalls.find(x=>x.id===a.stall_id);
            if(!u||!s) return null;
            const att=dayAtt.find(x=>x.user_id===a.user_id&&x.stall_id===a.stall_id);
            return(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                <div className={`av ${avatarClass(u.role)}`} style={{width:36,height:36,fontSize:13,borderRadius:8}}>{getInitials(u.name)}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{u.name} <span style={{fontSize:11,color:"var(--txd)"}}>({u.role==="ba"?"BA":"Sup"})</span></div>
                  <div style={{fontSize:12,color:"var(--txd)"}}>{s.name} · {s.city} · Duty: {a.duty_start}</div>
                </div>
                {att?(
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,color:"var(--gr)",fontWeight:600}}>In: {att.clock_in}</div>
                    {att.clock_out&&<div style={{fontSize:12,color:"var(--rd)"}}>Out: {att.clock_out}</div>}
                    <div style={{fontSize:10,color:"var(--txd)"}}>{att.dist}m from stall</div>
                  </div>
                ):(
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:12,color:"var(--rd)",fontWeight:600}}>Not In</span>
                    <button className="brd" onClick={()=>sendLateAlert(u,s)} style={{fontSize:11,padding:"5px 10px"}}>
                      <I n="wa" s={12}/>Alert
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── ALERTS PAGE ──────────────────────────────────────────────────────────────
function AlertsPage({data,toast}){
  const today=new Date().toISOString().slice(0,10);

  const sendManualLate=(u)=>{
    const now=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    const alloc=data.allocations.find(a=>a.user_id===u.id&&a.active);
    const stall=alloc?data.stalls.find(s=>s.id===alloc.stall_id):null;
    const supAlloc=stall?data.allocations.find(a=>a.stall_id===stall.id&&a.active&&a.user_id!==u.id&&data.users.find(x=>x.id===a.user_id&&x.role==="supervisor")):null;
    const sup=supAlloc?data.users.find(x=>x.id===supAlloc.user_id):null;
    const msg=buildLateMsg(u.name,u.role,stall?.name||"Assigned Location",stall?.city||"",u.team||"Unassigned",alloc?.duty_start||now,today);
    ADMIN_PHONES.forEach(ph=>sendWA(ph,msg));
    if(sup) sendWA(sup.phone,msg);
    sendWA(u.phone,`*Shinkore Marketing* — Aap ne aaj abhi tak duty start nahi ki${stall?` at ${stall.name}`:""}.`);
    toast("Alert sent to Khalid" + (sup ? " + " + sup.name : "") + " + " + u.name);
  };

  return(
    <div>
      <div className="info info-blue"><I n="alert" s={15}/>
        <div><strong>Auto-Alert System</strong> — When a staff member is late, alert goes to <strong>Khalid (both numbers) + Supervisor on same stall + Staff member</strong> — all with names and location.</div>
      </div>
      <div className="card">
        <div className="ch"><I n="alert" s={17} c="var(--rd)"/><div className="ct">Manual Late Alert</div></div>
        <div className="cb">
          {data.users.filter(u=>u.role!=="admin").map(u=>{
            const alloc=data.allocations.find(a=>a.user_id===u.id&&a.active);
            const stall=alloc?data.stalls.find(s=>s.id===alloc.stall_id):null;
            return(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                <div className={`av ${avatarClass(u.role)}`} style={{width:36,height:36,fontSize:13,borderRadius:8}}>{getInitials(u.name)}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{u.name}</div>
                  <div style={{fontSize:12,color:"var(--txd)"}}>{u.role==="ba"?"BA":"Supervisor"} · {stall?`${stall.name}, ${stall.city}`:"No active stall"}</div>
                </div>
                <button className="brd" onClick={()=>sendManualLate(u)}><I n="wa" s={13}/>Send Alert</button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="ch"><I n="wa" s={17} c="#25D366"/><div className="ct">Alert Message Preview</div></div>
        <div className="cb">
          <div style={{background:"var(--d3)",borderRadius:10,padding:14,fontFamily:"monospace",fontSize:12,color:"var(--txd)",whiteSpace:"pre-wrap",lineHeight:1.7}}>
{`🔴 SHINKORE MARKETING — LATE ALERT

👤 Staff: Ahmed Khan
🏷️ Role: Business Ambassador
👥 Team: Team A
📍 Stall: Centaurus Mall, Islamabad
🕐 Expected: 09:00
📅 Date: ${today}

⚠️ Status: Not clocked in at assigned location

— Shinkore Marketing System`}
          </div>
          <div style={{marginTop:10,fontSize:12,color:"var(--txd)"}}>Recipients: <span style={{color:"var(--g)"}}>Khalid (+92313…) · Khalid (+92317…) · Stall Supervisor · Staff Member</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({data,setData,toast}){
  const [cmb,setCmb]=useState(data.callmebot||{admin1:"",admin2:""});
  const doSave=()=>{
    const d={...data,callmebot:cmb};
    setData(d);save(d);toast("Settings saved!");
  };
  return(
    <div>
      <div className="card">
        <div className="ch"><I n="key" s={17} c="var(--g)"/><div><div className="ct">CallMeBot Auto-Alert Setup</div><div className="cs">One-time setup for automatic WhatsApp</div></div></div>
        <div className="cb">
          <div className="info info-blue" style={{marginBottom:16}}><I n="wa" s={14}/>
            <div>Each person sends this message to <strong>+34 644 59 72 97</strong> on WhatsApp once:<br/><strong style={{color:"var(--g)"}}>I allow callmebot to send me messages</strong><br/>They receive an API key — enter it in each staff profile.</div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">Khalid Phone 1 CallMeBot Key</label><input className="fi" value={cmb.admin1} onChange={e=>setCmb(p=>({...p,admin1:e.target.value}))} placeholder="API key for 00923135443656"/></div>
            <div className="fg"><label className="fl">Khalid Phone 2 CallMeBot Key</label><input className="fi" value={cmb.admin2} onChange={e=>setCmb(p=>({...p,admin2:e.target.value}))} placeholder="API key for 00923174886655"/></div>
          </div>
          <button className="bg" onClick={doSave}><I n="ok" s={15}/>Save Keys</button>
        </div>
      </div>
      <div className="card">
        <div className="ch"><I n="set" s={17} c="var(--g)"/><div className="ct">System Info</div></div>
        <div className="cb">
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {["✅ Phase 1 — Auth, Staff, Teams","✅ Phase 2 — GPS, Stalls, Allocations, Clock In/Out","✅ Phase 3 — Cash Flow, Handovers, Expenses","✅ Phase 4 — Salary, PDF Slips, WhatsApp","✅ Phase 5 — Google Sheets Sync","✅ Phase 6 — PWA + APK Build"].map(s=>(
              <div key={s} style={{fontSize:13,color:s.startsWith("✅")?"var(--gr)":"var(--txd)",padding:"8px 12px",background:"var(--d3)",borderRadius:8}}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── STAFF MY DASH ────────────────────────────────────────────────────────────
function MyDash({user,data}){
  const allocs=data.allocations.filter(a=>a.user_id===user.id&&a.active);
  const today=new Date().toISOString().slice(0,10);
  const myAtt=data.attendance.filter(a=>a.user_id===user.id);
  const daysWorked=new Set(myAtt.map(a=>a.date)).size;
  return(
    <div>
      <div className="card" style={{marginBottom:14}}>
        <div className="cb">
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div className={`av ${avatarClass(user.role)}`} style={{width:56,height:56,fontSize:20,borderRadius:12}}>{getInitials(user.name)}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Rajdhani",fontSize:21,fontWeight:700}}>{user.name}</div>
              <div style={{fontSize:13,color:"var(--txd)"}}>{user.role==="ba"?"Business Ambassador":"Supervisor"}</div>
              <div style={{fontSize:13,color:"var(--txd)"}}>{user.phone}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Daily Rate</div>
              <div style={{fontFamily:"Rajdhani",fontSize:22,color:"var(--g)"}}>{formatPKR(user.daily_rate)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="sg">
        <div className="sc gr"><div className="si gr"><I n="ok" s={16}/></div><div className="sv">{daysWorked}</div><div className="sl">Days Worked</div></div>
        <div className="sc gold"><div className="si gold"><I n="money" s={16}/></div><div className="sv">{formatPKR(daysWorked*(user.daily_rate||0))}</div><div className="sl" style={{fontSize:9}}>Earned (est.)</div></div>
      </div>
      {allocs.map(a=>{
        const s=data.stalls.find(x=>x.id===a.stall_id);
        const att=data.attendance.find(x=>x.user_id===user.id&&x.stall_id===a.stall_id&&x.date===today);
        return s?(
          <div className="card" key={a.id}>
            <div className="ch"><I n="pin" s={16} c="var(--g)"/><div><div className="ct">{s.name}</div><div className="cs">{s.city} · Duty at {a.duty_start}</div></div></div>
            <div className="cb">
              <div style={{fontSize:13,marginBottom:8}}>GPS Required: <span style={{color:"var(--bl)"}}>{Number(s.lat).toFixed(5)}, {Number(s.lng).toFixed(5)}</span></div>
              {att?<div className="info info-ok"><I n="ok" s={13}/>Today: In {att.clock_in}{att.clock_out?` → Out ${att.clock_out}`:""}</div>
                :<div className="info info-warn"><I n="alert" s={13}/>Not clocked in today — go to Clock In/Out</div>}
            </div>
          </div>
        ):null;
      })}
    </div>
  );
}

// ─── CASH & FINANCE ───────────────────────────────────────────────────────────
function CashPage({data,setData,toast}){
  const [tab,setTab]=useState("overview");

  // CLIENT PAYMENT STATE
  const [showCP,setShowCP]=useState(false);
  const [cpf,setCpf]=useState({stall_id:"",amount:"",activity:"",date:new Date().toISOString().slice(0,10),status:"received",notes:""});

  // HANDOVER STATE
  const [showHO,setShowHO]=useState(false);
  const [hof,setHof]=useState({supervisor_id:"",stall_id:"",amount_given:"",date_given:new Date().toISOString().slice(0,10),notes:""});

  // EXPENSE STATE
  const [showEX,setShowEX]=useState(false);
  const [exf,setExf]=useState({user_id:"",type:"fuel",amount:"",date:new Date().toISOString().slice(0,10),notes:"",stall_id:""});

  // RETURN BALANCE STATE
  const [showRB,setShowRB]=useState(false);
  const [rbHo,setRbHo]=useState(null);
  const [rbAmount,setRbAmount]=useState("");

  const scp=(k,v)=>setCpf(p=>({...p,[k]:v}));
  const sho=(k,v)=>setHof(p=>({...p,[k]:v}));
  const sex=(k,v)=>setExf(p=>({...p,[k]:v}));

  const supervisors=data.users.filter(u=>u.role==="supervisor");
  const nonAdmin=data.users.filter(u=>u.role!=="admin");

  // TOTALS
  const totalReceived=data.client_payments.filter(p=>p.status==="received").reduce((s,p)=>s+Number(p.amount),0);
  const totalPending=data.client_payments.filter(p=>p.status==="pending").reduce((s,p)=>s+Number(p.amount),0);
  const totalGiven=data.handovers.reduce((s,h)=>s+Number(h.amount_given),0);
  const totalReturned=data.handovers.reduce((s,h)=>s+Number(h.amount_returned||0),0);
  const totalExpenses=data.expenses.reduce((s,e)=>s+Number(e.amount),0);
  const netSavings=totalReceived-totalGiven+(totalReturned);

  // SAVE CLIENT PAYMENT
  const saveCP=()=>{
    if(!cpf.amount||!cpf.activity) return toast("Amount and activity required.");
    const d={...data,client_payments:[...data.client_payments,{id:genId(),...cpf,amount:Number(cpf.amount)}]};
    setData(d);save(d);setShowCP(false);toast("Client payment recorded!");
  };

  // SAVE HANDOVER
  const saveHO=()=>{
    if(!hof.supervisor_id||!hof.amount_given) return toast("Select supervisor and amount.");
    const sup=data.users.find(u=>u.id===hof.supervisor_id);
    const stall=data.stalls.find(s=>s.id===hof.stall_id);
    const d={...data,handovers:[...data.handovers,{id:genId(),...hof,amount_given:Number(hof.amount_given),amount_returned:null,date_returned:null}]};
    setData(d);save(d);setShowHO(false);
    if(sup) sendWA(sup.phone,`*Shinkore Marketing — Cash Handover*\n\nAap ko *${formatPKR(hof.amount_given)}* receive hua hai${stall?" for "+stall.name:""}.\nDate: ${hof.date_given}\n\nKharch ka hisab rakhen aur balance wapas karein.\n— Khalid`);
    toast("Handover saved! Supervisor notified.");
  };

  // SAVE EXPENSE
  const saveEX=()=>{
    if(!exf.user_id||!exf.amount) return toast("Select staff and amount.");
    const d={...data,expenses:[...data.expenses,{id:genId(),...exf,amount:Number(exf.amount)}]};
    setData(d);save(d);setShowEX(false);toast("Expense recorded!");
  };

  // RETURN BALANCE
  const saveRB=()=>{
    if(!rbAmount) return toast("Enter returned amount.");
    const d={...data,handovers:data.handovers.map(h=>h.id===rbHo.id?{...h,amount_returned:Number(rbAmount),date_returned:new Date().toISOString().slice(0,10)}:h)};
    setData(d);save(d);setShowRB(false);setRbHo(null);toast("Balance return recorded!");
  };

  const openRB=(ho)=>{setRbHo(ho);setRbAmount("");setShowRB(true);};

  const getStallName=(id)=>{const s=data.stalls.find(x=>x.id===id);return s?s.name:"—";};
  const getUserName=(id)=>{const u=data.users.find(x=>x.id===id);return u?u.name:"—";};

  const tabs=["overview","client","handover","expenses"];

  return(
    <div>
      {/* SUMMARY STATS */}
      <div className="sg" style={{marginBottom:18}}>
        <div className="sc gr"><div className="si gr"><I n="money" s={17}/></div><div className="sv" style={{fontSize:22}}>{formatPKR(totalReceived)}</div><div className="sl">Received from Client</div></div>
        <div className="sc gold"><div className="si gold"><I n="money" s={17}/></div><div className="sv" style={{fontSize:22}}>{formatPKR(totalPending)}</div><div className="sl">Pending from Client</div></div>
        <div className="sc bl"><div className="si bl"><I n="money" s={17}/></div><div className="sv" style={{fontSize:22}}>{formatPKR(totalGiven)}</div><div className="sl">Given to Supervisors</div></div>
        <div className="sc rd"><div className="si rd"><I n="money" s={17}/></div><div className="sv" style={{fontSize:22,color:netSavings>=0?"var(--gr)":"var(--rd)"}}>{formatPKR(netSavings)}</div><div className="sl">Net Savings</div></div>
      </div>

      {/* FLOW DIAGRAM */}
      <div className="card" style={{marginBottom:18}}>
        <div className="cb" style={{padding:"16px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:0,overflowX:"auto",paddingBottom:4}}>
            {[
              {label:"Client Pays",val:formatPKR(totalReceived),color:"var(--gr)"},
              {label:"→",val:"",color:"var(--txd)"},
              {label:"Admin Gives",val:formatPKR(totalGiven),color:"var(--g)"},
              {label:"→",val:"",color:"var(--txd)"},
              {label:"Supervisor Spends",val:formatPKR(totalExpenses),color:"var(--bl)"},
              {label:"→",val:"",color:"var(--txd)"},
              {label:"Balance Returned",val:formatPKR(totalReturned),color:"var(--or)"},
              {label:"→",val:"",color:"var(--txd)"},
              {label:"Net Savings",val:formatPKR(netSavings),color:netSavings>=0?"var(--gr)":"var(--rd)"},
            ].map((f,i)=>f.label==="→"?(
              <div key={i} style={{fontSize:20,color:"var(--txd)",padding:"0 8px",flexShrink:0}}>→</div>
            ):(
              <div key={i} style={{textAlign:"center",background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"10px 14px",flexShrink:0}}>
                <div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{f.label}</div>
                <div style={{fontFamily:"Rajdhani",fontSize:15,fontWeight:700,color:f.color}}>{f.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {tabs.map(t=>(
          <button key={t} className={tab===t?"bg":"bs"} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>
            {t==="overview"?"Overview":t==="client"?"Client Payments":t==="handover"?"Handovers":t==="expenses"?"Expenses":""}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab==="overview"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div className="card">
            <div className="ch"><I n="money" s={16} c="var(--gr)"/><div className="ct">Recent Client Payments</div></div>
            <div className="cb">
              {data.client_payments.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No payments yet.</div>}
              {data.client_payments.slice(-5).reverse().map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{p.activity}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{getStallName(p.stall_id)} · {p.date}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"Rajdhani",fontSize:15,color:p.status==="received"?"var(--gr)":"var(--or)"}}>{formatPKR(p.amount)}</div>
                    <span className={p.status==="received"?"b b-active":"b b-pending"}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="ch"><I n="users" s={16} c="var(--bl)"/><div className="ct">Supervisor Balances</div></div>
            <div className="cb">
              {supervisors.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No supervisors yet.</div>}
              {supervisors.map(sup=>{
                const given=data.handovers.filter(h=>h.supervisor_id===sup.id).reduce((s,h)=>s+Number(h.amount_given),0);
                const returned=data.handovers.filter(h=>h.supervisor_id===sup.id).reduce((s,h)=>s+Number(h.amount_returned||0),0);
                const pending=given-returned;
                return(
                  <div key={sup.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                    <div className="av av-blue" style={{width:32,height:32,fontSize:11,borderRadius:7}}>{getInitials(sup.name)}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{sup.name}</div>
                      <div style={{fontSize:11,color:"var(--txd)"}}>Given: {formatPKR(given)} · Returned: {formatPKR(returned)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"Rajdhani",fontSize:14,color:pending>0?"var(--or)":"var(--gr)"}}>{formatPKR(pending)}</div>
                      <div style={{fontSize:10,color:"var(--txd)"}}>pending</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CLIENT PAYMENTS TAB ── */}
      {tab==="client"&&(
        <div className="card">
          <div className="ch">
            <I n="money" s={17} c="var(--gr)"/>
            <div style={{flex:1}}><div className="ct">Client Payments</div><div className="cs">Money received or pending from clients</div></div>
            <button className="bg" onClick={()=>setShowCP(true)}><I n="plus" s={15}/>Add Payment</button>
          </div>
          <div className="cb" style={{padding:0}}>
            <div className="tw">
              <table>
                <thead><tr><th>Activity</th><th>Stall</th><th>Amount</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead>
                <tbody>
                  {data.client_payments.length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:"var(--txd)",padding:30}}>No client payments recorded yet.</td></tr>}
                  {data.client_payments.map(p=>(
                    <tr key={p.id}>
                      <td style={{fontWeight:600}}>{p.activity}</td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{getStallName(p.stall_id)}</td>
                      <td><span style={{fontFamily:"Rajdhani",fontSize:15,color:p.status==="received"?"var(--gr)":"var(--or)"}}>{formatPKR(p.amount)}</span></td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{p.date}</td>
                      <td><span className={p.status==="received"?"b b-active":"b b-pending"}>{p.status}</span></td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{p.notes||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── HANDOVER TAB ── */}
      {tab==="handover"&&(
        <div>
          <div className="card">
            <div className="ch">
              <I n="money" s={17} c="var(--g)"/>
              <div style={{flex:1}}><div className="ct">Cash Handovers</div><div className="cs">Admin → Supervisor → Balance returned</div></div>
              <button className="bg" onClick={()=>setShowHO(true)}><I n="plus" s={15}/>Give Cash</button>
            </div>
            <div className="cb">
              {data.handovers.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No handovers yet.</div>}
              {data.handovers.map(h=>{
                const sup=data.users.find(u=>u.id===h.supervisor_id);
                const stall=data.stalls.find(s=>s.id===h.stall_id);
                const balance=Number(h.amount_given)-(Number(h.amount_returned)||0);
                return(
                  <div key={h.id} style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:12,padding:16,marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                      <div className="av av-blue" style={{width:38,height:38,fontSize:13,borderRadius:9}}>{getInitials(sup?.name||"?")}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:14}}>{sup?.name||"Unknown"}</div>
                        <div style={{fontSize:12,color:"var(--txd)"}}>{stall?.name||"General"} · {h.date_given}</div>
                      </div>
                      <span className={h.amount_returned!=null?"b b-active":"b b-pending"}>{h.amount_returned!=null?"Settled":"Pending Return"}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
                      <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Given</div><div style={{fontFamily:"Rajdhani",fontSize:17,color:"var(--g)"}}>{formatPKR(h.amount_given)}</div></div>
                      <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Returned</div><div style={{fontFamily:"Rajdhani",fontSize:17,color:"var(--gr)"}}>{h.amount_returned!=null?formatPKR(h.amount_returned):"—"}</div></div>
                      <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Balance</div><div style={{fontFamily:"Rajdhani",fontSize:17,color:balance>0?"var(--or)":"var(--gr)"}}>{formatPKR(balance)}</div></div>
                    </div>
                    {h.notes&&<div style={{fontSize:12,color:"var(--txd)",marginBottom:10}}>Note: {h.notes}</div>}
                    <div style={{display:"flex",gap:8}}>
                      {h.amount_returned==null&&(
                        <button className="bg" onClick={()=>openRB(h)}><I n="money" s={14}/>Record Return</button>
                      )}
                      {sup&&<button className="bw" onClick={()=>sendWA(sup.phone,`*Shinkore Marketing*\nHandover reminder: Aap ke paas ${formatPKR(balance)} balance pending hai. Wapas karna hai.\n— Khalid`)}><I n="wa" s={13}/>Remind</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {tab==="expenses"&&(
        <div className="card">
          <div className="ch">
            <I n="money" s={17} c="var(--rd)"/>
            <div style={{flex:1}}><div className="ct">Expenses</div><div className="cs">Fuel, transport, other costs</div></div>
            <button className="bg" onClick={()=>setShowEX(true)}><I n="plus" s={15}/>Add Expense</button>
          </div>
          <div className="cb" style={{padding:0}}>
            <div className="tw">
              <table>
                <thead><tr><th>Staff</th><th>Type</th><th>Amount</th><th>Stall</th><th>Date</th><th>Notes</th></tr></thead>
                <tbody>
                  {data.expenses.length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:"var(--txd)",padding:30}}>No expenses recorded yet.</td></tr>}
                  {data.expenses.map(e=>(
                    <tr key={e.id}>
                      <td style={{fontWeight:600}}>{getUserName(e.user_id)}</td>
                      <td><span style={{background:"rgba(231,76,60,.1)",color:"var(--rd)",border:"1px solid rgba(231,76,60,.25)",borderRadius:20,padding:"2px 9px",fontSize:11,textTransform:"capitalize"}}>{e.type}</span></td>
                      <td><span style={{fontFamily:"Rajdhani",fontSize:15,color:"var(--rd)"}}>{formatPKR(e.amount)}</span></td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{getStallName(e.stall_id)}</td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{e.date}</td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{e.notes||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CLIENT PAYMENT ── */}
      {showCP&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowCP(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Record Client Payment</div><div className="mc" onClick={()=>setShowCP(false)}>×</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Activity / Description</label><input className="fi" value={cpf.activity} onChange={e=>scp("activity",e.target.value)} placeholder="e.g. SIM Sales — May 2025"/></div>
              <div className="fg"><label className="fl">Stall</label>
                <select className="fsel" value={cpf.stall_id} onChange={e=>scp("stall_id",e.target.value)}>
                  <option value="">-- Select stall (optional) --</option>
                  {data.stalls.map(s=><option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
                </select>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Amount (PKR)</label><input className="fi" type="number" value={cpf.amount} onChange={e=>scp("amount",e.target.value)} placeholder="50000"/></div>
                <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={cpf.date} onChange={e=>scp("date",e.target.value)}/></div>
              </div>
              <div className="fg"><label className="fl">Status</label>
                <select className="fsel" value={cpf.status} onChange={e=>scp("status",e.target.value)}>
                  <option value="received">Received ✓</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="fg"><label className="fl">Notes</label><input className="fi" value={cpf.notes} onChange={e=>scp("notes",e.target.value)} placeholder="Optional notes"/></div>
              <div className="ma"><button className="bs" onClick={()=>setShowCP(false)}>Cancel</button><button className="bg" onClick={saveCP}><I n="ok" s={15}/>Save</button></div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HANDOVER ── */}
      {showHO&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowHO(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Give Cash to Supervisor</div><div className="mc" onClick={()=>setShowHO(false)}>×</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Supervisor</label>
                <select className="fsel" value={hof.supervisor_id} onChange={e=>sho("supervisor_id",e.target.value)}>
                  <option value="">-- Select supervisor --</option>
                  {supervisors.map(s=><option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl">For Stall (optional)</label>
                <select className="fsel" value={hof.stall_id} onChange={e=>sho("stall_id",e.target.value)}>
                  <option value="">-- General / No stall --</option>
                  {data.stalls.map(s=><option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
                </select>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Amount Given (PKR)</label><input className="fi" type="number" value={hof.amount_given} onChange={e=>sho("amount_given",e.target.value)} placeholder="30000"/></div>
                <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={hof.date_given} onChange={e=>sho("date_given",e.target.value)}/></div>
              </div>
              <div className="fg"><label className="fl">Notes (BA salaries, stall expenses, etc.)</label><input className="fi" value={hof.notes} onChange={e=>sho("notes",e.target.value)} placeholder="e.g. For 10 days BA salaries + fuel"/></div>
              <div className="ma"><button className="bs" onClick={()=>setShowHO(false)}>Cancel</button><button className="bg" onClick={saveHO}><I n="ok" s={15}/>Save & Notify</button></div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EXPENSE ── */}
      {showEX&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowEX(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Record Expense</div><div className="mc" onClick={()=>setShowEX(false)}>×</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Staff Member</label>
                <select className="fsel" value={exf.user_id} onChange={e=>sex("user_id",e.target.value)}>
                  <option value="">-- Select staff --</option>
                  {nonAdmin.map(u=><option key={u.id} value={u.id}>{u.name} ({u.role==="ba"?"BA":"Supervisor"})</option>)}
                </select>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Type</label>
                  <select className="fsel" value={exf.type} onChange={e=>sex("type",e.target.value)}>
                    <option value="fuel">Fuel</option>
                    <option value="transport">Transport</option>
                    <option value="food">Food / Meals</option>
                    <option value="stall">Stall Setup</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Amount (PKR)</label><input className="fi" type="number" value={exf.amount} onChange={e=>sex("amount",e.target.value)} placeholder="1500"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Stall</label>
                  <select className="fsel" value={exf.stall_id} onChange={e=>sex("stall_id",e.target.value)}>
                    <option value="">-- Optional --</option>
                    {data.stalls.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={exf.date} onChange={e=>sex("date",e.target.value)}/></div>
              </div>
              <div className="fg"><label className="fl">Notes</label><input className="fi" value={exf.notes} onChange={e=>sex("notes",e.target.value)} placeholder="e.g. Petrol Islamabad to Rawalpindi"/></div>
              <div className="ma"><button className="bs" onClick={()=>setShowEX(false)}>Cancel</button><button className="bg" onClick={saveEX}><I n="ok" s={15}/>Save</button></div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RETURN BALANCE ── */}
      {showRB&&rbHo&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowRB(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Record Balance Return</div><div className="mc" onClick={()=>setShowRB(false)}>×</div></div>
            <div className="mb">
              <div className="info info-blue" style={{marginBottom:14}}><I n="money" s={14}/>
                <div>Given: <strong>{formatPKR(rbHo.amount_given)}</strong> to {getUserName(rbHo.supervisor_id)}</div>
              </div>
              <div className="fg"><label className="fl">Amount Returned by Supervisor (PKR)</label><input className="fi" type="number" value={rbAmount} onChange={e=>setRbAmount(e.target.value)} placeholder="e.g. 5000"/></div>
              {rbAmount&&<div style={{padding:"10px 14px",background:"var(--d3)",borderRadius:9,fontSize:13,marginTop:8}}>
                Net spent: <strong style={{color:"var(--rd)"}}>{formatPKR(Number(rbHo.amount_given)-Number(rbAmount))}</strong>
                &nbsp;· Savings back: <strong style={{color:"var(--gr)"}}>{formatPKR(rbAmount)}</strong>
              </div>}
              <div className="ma"><button className="bs" onClick={()=>setShowRB(false)}>Cancel</button><button className="bg" onClick={saveRB}><I n="ok" s={15}/>Confirm Return</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PDF SLIP GENERATOR ───────────────────────────────────────────────────────
const generateSlipHTML = (user, rec, stalls, allocations) => {
  const alloc = allocations.find(a => a.user_id === user.id && a.active);
  const stall = alloc ? stalls.find(s => s.id === alloc.stall_id) : null;
  const today = new Date().toLocaleDateString("en-PK", {year:"numeric",month:"long",day:"numeric"});
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a1a1a;padding:40px;max-width:680px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #C9A84C}
  .co-name{font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:#C9A84C;letter-spacing:1px}
  .co-sub{font-size:12px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
  .slip-title{font-family:'Rajdhani',sans-serif;font-size:22px;color:#333;text-align:right}
  .slip-no{font-size:12px;color:#888;text-align:right;margin-top:4px}
  .staff-box{background:#f9f6ef;border:1px solid #e8d9b0;border-radius:10px;padding:20px;margin-bottom:24px;display:flex;justify-content:space-between}
  .staff-name{font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700}
  .staff-role{color:#888;font-size:13px;margin-top:3px;text-transform:capitalize}
  .staff-phone{font-size:13px;color:#555;margin-top:4px}
  .period-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px}
  .period-val{font-family:'Rajdhani',sans-serif;font-size:16px;color:#333;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#C9A84C;color:#fff;font-size:12px;letter-spacing:1px;text-transform:uppercase;padding:10px 14px;text-align:left;font-family:'DM Sans',sans-serif;font-weight:600}
  td{padding:12px 14px;border-bottom:1px solid #f0e8d0;font-size:14px}
  tr:last-child td{border-bottom:none}
  .total-box{background:#1a1a1a;color:#fff;border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
  .total-label{font-size:13px;color:#aaa;text-transform:uppercase;letter-spacing:1px}
  .total-val{font-family:'Rajdhani',sans-serif;font-size:30px;font-weight:700;color:#C9A84C}
  .status-box{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600}
  .status-paid{background:#e8f9f0;color:#1a8a4a;border:1px solid #a3d9b8}
  .status-pending{background:#fff8e8;color:#b87800;border:1px solid #e8d080}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e0d0b0;display:flex;justify-content:space-between;font-size:12px;color:#aaa}
  .sig-line{border-top:1px solid #999;width:160px;padding-top:6px;text-align:center;font-size:12px;color:#555;margin-top:40px}
  @media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div><div class="co-name">SHINKORE MARKETING</div><div class="co-sub">Marketing Operations</div></div>
  <div><div class="slip-title">SALARY SLIP</div><div class="slip-no">Ref: SLR-${rec.id.slice(0,6).toUpperCase()} · ${today}</div></div>
</div>
<div class="staff-box">
  <div>
    <div class="staff-name">${user.name}</div>
    <div class="staff-role">${user.role === "ba" ? "Business Ambassador" : "Supervisor"}</div>
    <div class="staff-phone">${user.phone}</div>
    ${stall ? `<div style="font-size:12px;color:#888;margin-top:4px">📍 ${stall.name}, ${stall.city}</div>` : ""}
  </div>
  <div style="text-align:right">
    <div class="period-label">Pay Period</div>
    <div class="period-val">${rec.month}</div>
    <div style="margin-top:10px"><span class="status-box ${rec.status==="paid"?"status-paid":"status-pending"}">${rec.status === "paid" ? "✓ PAID" : "⏳ PENDING"}</span></div>
  </div>
</div>
<table>
  <thead><tr><th>Description</th><th>Days</th><th>Rate/Day</th><th>Amount</th></tr></thead>
  <tbody>
    <tr><td>Basic Salary</td><td>${rec.days_worked}</td><td>PKR ${Number(rec.daily_rate).toLocaleString()}</td><td><strong>PKR ${(rec.days_worked * rec.daily_rate).toLocaleString()}</strong></td></tr>
    ${rec.bonus ? `<tr><td>Bonus / Incentive</td><td>—</td><td>—</td><td><strong>PKR ${Number(rec.bonus).toLocaleString()}</strong></td></tr>` : ""}
    ${rec.deductions ? `<tr><td>Deductions</td><td>—</td><td>—</td><td style="color:#c0392b"><strong>- PKR ${Number(rec.deductions).toLocaleString()}</strong></td></tr>` : ""}
  </tbody>
</table>
<div class="total-box">
  <div><div class="total-label">Net Payable</div></div>
  <div class="total-val">PKR ${Number(rec.total).toLocaleString()}</div>
</div>
${rec.notes ? `<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px 14px;font-size:13px;color:#555;margin-bottom:16px"><strong>Notes:</strong> ${rec.notes}</div>` : ""}
<div style="display:flex;justify-content:space-between;margin-top:20px">
  <div class="sig-line">Authorized Signature<br><small>Khalid Orakzai — Admin</small></div>
  <div class="sig-line">Employee Signature<br><small>${user.name}</small></div>
</div>
<div class="footer"><span>Shinkore Marketing · ${today}</span><span>This is a computer-generated slip</span></div>
</body></html>`;
};

const generateBillHTML = (stall, payments, today) => {
  const total = payments.reduce((s,p)=>s+Number(p.amount),0);
  const received = payments.filter(p=>p.status==="received").reduce((s,p)=>s+Number(p.amount),0);
  const pending = payments.filter(p=>p.status==="pending").reduce((s,p)=>s+Number(p.amount),0);
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',sans-serif;background:#fff;color:#1a1a1a;padding:40px;max-width:680px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #C9A84C}
  .co-name{font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:#C9A84C;letter-spacing:1px}
  .co-sub{font-size:12px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#C9A84C;color:#fff;font-size:12px;letter-spacing:1px;text-transform:uppercase;padding:10px 14px;text-align:left}
  td{padding:12px 14px;border-bottom:1px solid #f0e8d0;font-size:14px}
  .total-box{background:#1a1a1a;color:#fff;border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}
  .total-val{font-family:'Rajdhani',sans-serif;font-size:28px;color:#C9A84C}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e0d0b0;font-size:12px;color:#aaa;text-align:center}
</style></head><body>
<div class="header">
  <div><div class="co-name">SHINKORE MARKETING</div><div class="co-sub">Client Billing Statement</div></div>
  <div style="text-align:right"><div style="font-family:'Rajdhani',sans-serif;font-size:20px">BILLING SLIP</div><div style="font-size:12px;color:#888">Date: ${today}</div></div>
</div>
<div style="background:#f9f6ef;border:1px solid #e8d9b0;border-radius:10px;padding:16px 20px;margin-bottom:24px">
  <div style="font-family:'Rajdhani',sans-serif;font-size:20px">${stall.name}</div>
  <div style="font-size:13px;color:#888;margin-top:3px">${stall.city} · Dept: ${stall.dept} · Client: ${stall.client||"—"}</div>
  <div style="font-size:12px;color:#888;margin-top:3px">${stall.from_date} to ${stall.to_date}</div>
</div>
<table>
  <thead><tr><th>Activity</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
  <tbody>
    ${payments.map(p=>`<tr><td>${p.activity}</td><td>${p.date}</td><td>PKR ${Number(p.amount).toLocaleString()}</td><td><span style="color:${p.status==="received"?"#1a8a4a":"#b87800"};font-weight:600">${p.status==="received"?"✓ Received":"⏳ Pending"}</span></td></tr>`).join("")}
  </tbody>
</table>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
  <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Total</div><div style="font-family:'Rajdhani',sans-serif;font-size:20px">PKR ${total.toLocaleString()}</div></div>
  <div style="background:#e8f9f0;border:1px solid #a3d9b8;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Received</div><div style="font-family:'Rajdhani',sans-serif;font-size:20px;color:#1a8a4a">PKR ${received.toLocaleString()}</div></div>
  <div style="background:#fff8e8;border:1px solid #e8d080;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Pending</div><div style="font-family:'Rajdhani',sans-serif;font-size:20px;color:#b87800">PKR ${pending.toLocaleString()}</div></div>
</div>
<div class="footer">Shinkore Marketing · Generated ${today}</div>
</body></html>`;
};

const openPrint = (html) => {
  const w = window.open("","_blank","width=750,height=900");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),600);
};

// ─── SALARY PAGE ──────────────────────────────────────────────────────────────
function SalaryPage({data,setData,toast}){
  const [tab,setTab]=useState("salary");
  const [showAdd,setShowAdd]=useState(false);
  const [selUser,setSelUser]=useState("");
  const [f,setF]=useState({user_id:"",month:"",days_worked:"",daily_rate:"",bonus:"",deductions:"",notes:"",status:"pending"});
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));
  const today=new Date().toLocaleDateString("en-PK",{year:"numeric",month:"long",day:"numeric"});
  const nonAdmin=data.users.filter(u=>u.role!=="admin");

  const openAdd=(u)=>{
    const now=new Date();
    const mon=now.toLocaleDateString("en-PK",{month:"long",year:"numeric"});
    const att=data.attendance.filter(a=>a.user_id===u.id);
    const days=new Set(att.map(a=>a.date)).size;
    setF({user_id:u.id,month:mon,days_worked:days||0,daily_rate:u.daily_rate||0,bonus:"",deductions:"",notes:"",status:"pending"});
    setShowAdd(true);
  };

  const calcTotal=(form)=>{
    const base=(Number(form.days_worked)||0)*(Number(form.daily_rate)||0);
    return base+(Number(form.bonus)||0)-(Number(form.deductions)||0);
  };

  const doSave=()=>{
    if(!f.user_id||!f.month) return toast("Select staff and month.");
    const rec={id:genId(),...f,days_worked:Number(f.days_worked),daily_rate:Number(f.daily_rate),bonus:Number(f.bonus)||0,deductions:Number(f.deductions)||0,total:calcTotal(f),created:new Date().toISOString().slice(0,10)};
    const d={...data,salary:[...data.salary,rec]};
    setData(d);save(d);setShowAdd(false);toast("Salary record saved!");
  };

  const togglePaid=(rec)=>{
    const ns=rec.status==="paid"?"pending":"paid";
    const d={...data,salary:data.salary.map(s=>s.id===rec.id?{...s,status:ns}:s)};
    setData(d);save(d);
    if(ns==="paid"){
      const u=data.users.find(x=>x.id===rec.user_id);
      if(u) sendWA(u.phone,`*Shinkore Marketing — Salary Paid* ✅\n\nDear ${u.name},\n\nAap ki ${rec.month} ki salary *${formatPKR(rec.total)}* receive ho gayi hai.\n\nDin: ${rec.days_worked} · Rate: ${formatPKR(rec.daily_rate)}/din\n\nShukriya! — Khalid Orakzai`);
    }
    toast(ns==="paid"?"Marked paid — WhatsApp sent!":"Marked pending.");
  };

  const doSlip=(rec)=>{
    const u=data.users.find(x=>x.id===rec.user_id);
    if(!u) return;
    const html=generateSlipHTML(u,rec,data.stalls,data.allocations);
    openPrint(html);
  };

  const shareSlipWA=(rec)=>{
    const u=data.users.find(x=>x.id===rec.user_id);
    if(!u) return;
    const msg=`*SHINKORE MARKETING — Salary Slip*\n\n👤 Name: ${u.name}\n🏷️ Role: ${u.role==="ba"?"Business Ambassador":"Supervisor"}\n📅 Month: ${rec.month}\n📆 Days Worked: ${rec.days_worked}\n💵 Rate/Day: ${formatPKR(rec.daily_rate)}\n${rec.bonus?`🎁 Bonus: ${formatPKR(rec.bonus)}\n`:""}${rec.deductions?`➖ Deductions: ${formatPKR(rec.deductions)}\n`:""}\n💰 *Net Salary: ${formatPKR(rec.total)}*\nStatus: ${rec.status==="paid"?"✅ PAID":"⏳ PENDING"}\n\n— Shinkore Marketing`;
    sendWA(u.phone,msg);
  };

  const doBill=(stall)=>{
    const payments=data.client_payments.filter(p=>p.stall_id===stall.id);
    if(payments.length===0) return toast("No payments recorded for this stall.");
    const html=generateBillHTML(stall,payments,today);
    openPrint(html);
  };

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button className={tab==="salary"?"bg":"bs"} onClick={()=>setTab("salary")}><I n="cal" s={15}/>Salary Records</button>
        <button className={tab==="billing"?"bg":"bs"} onClick={()=>setTab("billing")}><I n="money" s={15}/>Client Billing</button>
      </div>

      {/* ── SALARY TAB ── */}
      {tab==="salary"&&(
        <div>
          {/* QUICK GENERATE */}
          <div className="card" style={{marginBottom:16}}>
            <div className="ch"><I n="users" s={17} c="var(--g)"/><div><div className="ct">Generate Salary</div><div className="cs">Select a staff member to create salary record</div></div></div>
            <div className="cb">
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:12}}>
                {nonAdmin.map(u=>{
                  const att=data.attendance.filter(a=>a.user_id===u.id);
                  const days=new Set(att.map(a=>a.date)).size;
                  const existing=data.salary.filter(s=>s.user_id===u.id);
                  return(
                    <div key={u.id} style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:11,padding:14,display:"flex",alignItems:"center",gap:12}}>
                      <div className={`av ${avatarClass(u.role)}`} style={{width:38,height:38,fontSize:13,borderRadius:9}}>{getInitials(u.name)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13}}>{u.name}</div>
                        <div style={{fontSize:11,color:"var(--txd)"}}>{days} days worked · {formatPKR(u.daily_rate)}/day</div>
                      </div>
                      <button className="bg" onClick={()=>openAdd(u)} style={{padding:"7px 12px",fontSize:12}}><I n="plus" s={13}/>Add</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SALARY RECORDS */}
          <div className="card">
            <div className="ch"><I n="cal" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">All Salary Records</div><div className="cs">{data.salary.length} records</div></div></div>
            <div className="cb" style={{padding:0}}>
              {data.salary.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)",fontSize:13}}>No salary records yet. Generate from above.</div>}
              {data.salary.slice().reverse().map(rec=>{
                const u=data.users.find(x=>x.id===rec.user_id);
                if(!u) return null;
                return(
                  <div key={rec.id} style={{padding:"16px 20px",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                      <div className={`av ${avatarClass(u.role)}`} style={{width:38,height:38,fontSize:13,borderRadius:9}}>{getInitials(u.name)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:14}}>{u.name} <span style={{fontSize:11,color:"var(--txd)"}}>· {rec.month}</span></div>
                        <div style={{fontSize:12,color:"var(--txd)"}}>{rec.days_worked} days × {formatPKR(rec.daily_rate)}/day{rec.bonus?` + bonus ${formatPKR(rec.bonus)}`:""}{rec.deductions?` − ${formatPKR(rec.deductions)}`:""}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--g)"}}>{formatPKR(rec.total)}</div>
                        <span className={rec.status==="paid"?"b b-active":"b b-pending"}>{rec.status}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <button className={rec.status==="paid"?"brd":"bg"} onClick={()=>togglePaid(rec)} style={{fontSize:12}}>
                        <I n="ok" s={13}/>{rec.status==="paid"?"Mark Pending":"Mark Paid + Notify"}
                      </button>
                      <button className="bs" onClick={()=>doSlip(rec)} style={{fontSize:12}}><I n="pdf" s={13}/>Print Slip</button>
                      <button className="bw" onClick={()=>shareSlipWA(rec)} style={{fontSize:12}}><I n="wa" s={13}/>WhatsApp</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── BILLING TAB ── */}
      {tab==="billing"&&(
        <div className="card">
          <div className="ch"><I n="money" s={17} c="var(--g)"/><div><div className="ct">Client Billing Slips</div><div className="cs">Generate billing PDF per stall</div></div></div>
          <div className="cb">
            {data.stalls.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No stalls added yet.</div>}
            {data.stalls.map(stall=>{
              const payments=data.client_payments.filter(p=>p.stall_id===stall.id);
              const total=payments.reduce((s,p)=>s+Number(p.amount),0);
              const received=payments.filter(p=>p.status==="received").reduce((s,p)=>s+Number(p.amount),0);
              const pending=payments.filter(p=>p.status==="pending").reduce((s,p)=>s+Number(p.amount),0);
              return(
                <div key={stall.id} style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:12,padding:16,marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
                    <div>
                      <div style={{fontFamily:"Rajdhani",fontSize:17,fontWeight:700,color:"var(--g)"}}>{stall.name}</div>
                      <div style={{fontSize:12,color:"var(--txd)"}}>{stall.city} · {stall.client||"No client"} · {payments.length} payments</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--g)"}}>{formatPKR(total)}</div>
                      <div style={{fontSize:11,color:"var(--txd)"}}>Rec: {formatPKR(received)} · Pend: {formatPKR(pending)}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="bs" onClick={()=>doBill(stall)} style={{fontSize:12}}><I n="pdf" s={13}/>Print Bill</button>
                    <button className="bw" onClick={()=>{
                      const msg=`*Shinkore Marketing — Billing Summary*\n\n📍 ${stall.name}, ${stall.city}\n👤 Client: ${stall.client||"—"}\n\n💵 Total: ${formatPKR(total)}\n✅ Received: ${formatPKR(received)}\n⏳ Pending: ${formatPKR(pending)}\n\n— Khalid Orakzai, Shinkore Marketing\n00923135443656`;
                      ADMIN_PHONES.forEach(ph=>sendWA(ph,msg));
                    }} style={{fontSize:12}}><I n="wa" s={13}/>Share</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: ADD SALARY ── */}
      {showAdd&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Create Salary Record</div><div className="mc" onClick={()=>setShowAdd(false)}>×</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Staff Member</label>
                <select className="fsel" value={f.user_id} onChange={e=>{sf("user_id",e.target.value);const u=data.users.find(x=>x.id===e.target.value);if(u)sf("daily_rate",u.daily_rate);}}>
                  <option value="">-- Select --</option>
                  {nonAdmin.map(u=><option key={u.id} value={u.id}>{u.name} ({u.role==="ba"?"BA":"Supervisor"})</option>)}
                </select>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Month</label><input className="fi" value={f.month} onChange={e=>sf("month",e.target.value)} placeholder="e.g. May 2025"/></div>
                <div className="fg"><label className="fl">Days Worked</label><input className="fi" type="number" value={f.days_worked} onChange={e=>sf("days_worked",e.target.value)}/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Rate/Day (PKR)</label><input className="fi" type="number" value={f.daily_rate} onChange={e=>sf("daily_rate",e.target.value)}/></div>
                <div className="fg"><label className="fl">Bonus (PKR)</label><input className="fi" type="number" value={f.bonus} onChange={e=>sf("bonus",e.target.value)} placeholder="0"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Deductions (PKR)</label><input className="fi" type="number" value={f.deductions} onChange={e=>sf("deductions",e.target.value)} placeholder="0"/></div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fsel" value={f.status} onChange={e=>sf("status",e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="fg"><label className="fl">Notes</label><input className="fi" value={f.notes} onChange={e=>sf("notes",e.target.value)} placeholder="Optional"/></div>
              {f.days_worked&&f.daily_rate&&(
                <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginTop:4}}>
                  <div style={{fontSize:12,color:"var(--txd)",marginBottom:4}}>Calculation Preview</div>
                  <div style={{fontFamily:"Rajdhani",fontSize:22,color:"var(--g)"}}>{formatPKR(calcTotal(f))}</div>
                  <div style={{fontSize:12,color:"var(--txd)"}}>{f.days_worked} × {formatPKR(f.daily_rate)}{f.bonus?` + ${formatPKR(f.bonus)}`:""}{ f.deductions?` − ${formatPKR(f.deductions)}`:""}</div>
                </div>
              )}
              <div className="ma"><button className="bs" onClick={()=>setShowAdd(false)}>Cancel</button><button className="bg" onClick={doSave}><I n="ok" s={15}/>Save Record</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MY SALARY (STAFF) ────────────────────────────────────────────────────────
function MySalaryPage({user,data}){
  const myRecords=data.salary.filter(s=>s.user_id===user.id);
  const totalEarned=myRecords.filter(s=>s.status==="paid").reduce((s,r)=>s+Number(r.total),0);
  const totalPending=myRecords.filter(s=>s.status==="pending").reduce((s,r)=>s+Number(r.total),0);
  return(
    <div>
      <div className="sg">
        <div className="sc gr"><div className="si gr"><I n="ok" s={16}/></div><div className="sv" style={{fontSize:20}}>{formatPKR(totalEarned)}</div><div className="sl">Total Received</div></div>
        <div className="sc gold"><div className="si gold"><I n="cal" s={16}/></div><div className="sv" style={{fontSize:20}}>{formatPKR(totalPending)}</div><div className="sl">Pending</div></div>
      </div>
      <div className="card">
        <div className="ch"><I n="cal" s={17} c="var(--g)"/><div className="ct">My Salary History</div></div>
        <div className="cb">
          {myRecords.length===0&&<div style={{color:"var(--txd)",fontSize:13,textAlign:"center",padding:"30px 0"}}>No salary records yet. Contact admin.</div>}
          {myRecords.slice().reverse().map(rec=>(
            <div key={rec.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{rec.month}</div>
                <div style={{fontSize:12,color:"var(--txd)"}}>{rec.days_worked} days × {formatPKR(rec.daily_rate)}</div>
              </div>
              <div style={{marginLeft:"auto",textAlign:"right"}}>
                <div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--g)"}}>{formatPKR(rec.total)}</div>
                <span className={rec.status==="paid"?"b b-active":"b b-pending"}>{rec.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COMING SOON ──────────────────────────────────────────────────────────────

// ─── GOOGLE SHEETS SYNC PAGE ──────────────────────────────────────────────────
function SyncPage({data,setData,toast}){
  const [url,setUrl]=useState(data.sheets_url||"");
  const [syncing,setSyncing]=useState(false);
  const [log,setLog]=useState([]);

  const addLog=(msg,ok=true)=>setLog(p=>[{msg,ok,t:new Date().toLocaleTimeString("en-PK")},...p.slice(0,19)]);

  const saveUrl=()=>{
    const d={...data,sheets_url:url};
    setData(d);save(d);toast("Sheets URL saved!");
  };

  const syncSheet=async(sheet,rows)=>{
    if(!url) return addLog("No Apps Script URL set.",false);
    try{
      await fetch(url,{method:"POST",mode:"no-cors",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet,rows})});
      addLog("Synced: "+sheet+" ("+rows.length+" rows)");
    }catch(e){addLog("Failed: "+sheet,false);}
  };

  const syncAll=async()=>{
    if(!url){toast("Set Apps Script URL first!");return;}
    setSyncing(true);
    addLog("Starting full sync...");

    // STAFF
    const staffRows=data.users.filter(u=>u.role!=="admin").map(u=>
      [u.name,u.role==="ba"?"BA":"Supervisor",u.phone,u.team||"",u.daily_rate]);
    await syncSheet("Staff",staffRows);

    // STALLS
    const stallRows=data.stalls.map(s=>
      [s.name,s.city,s.dept,s.client||"",s.from_date,s.to_date,s.client_charged,s.duty_start]);
    await syncSheet("Stalls",stallRows);

    // ALLOCATIONS
    const allocRows=data.allocations.map(a=>{
      const u=data.users.find(x=>x.id===a.user_id);
      const s=data.stalls.find(x=>x.id===a.stall_id);
      return[u?.name||"",u?.role||"",s?.name||"",s?.city||"",a.duty_start,a.daily_rate,a.from_date,a.to_date,a.active?"Active":"Ended"];
    });
    await syncSheet("Allocations",allocRows);

    // ATTENDANCE
    const attRows=data.attendance.map(a=>{
      const u=data.users.find(x=>x.id===a.user_id);
      const s=data.stalls.find(x=>x.id===a.stall_id);
      return[a.date,u?.name||"",u?.role||"",s?.name||"",s?.city||"",a.clock_in,a.clock_out||"",a.dist+"m"];
    });
    await syncSheet("Attendance",attRows);

    // CLIENT PAYMENTS
    const cpRows=data.client_payments.map(p=>{
      const s=data.stalls.find(x=>x.id===p.stall_id);
      return[p.date,p.activity,s?.name||"General",p.amount,p.status,p.notes||""];
    });
    await syncSheet("ClientPayments",cpRows);

    // HANDOVERS
    const hoRows=data.handovers.map(h=>{
      const u=data.users.find(x=>x.id===h.supervisor_id);
      const s=data.stalls.find(x=>x.id===h.stall_id);
      return[h.date_given,u?.name||"",s?.name||"General",h.amount_given,h.amount_returned||0,h.date_returned||"Pending",h.notes||""];
    });
    await syncSheet("Handovers",hoRows);

    // EXPENSES
    const exRows=data.expenses.map(e=>{
      const u=data.users.find(x=>x.id===e.user_id);
      const s=data.stalls.find(x=>x.id===e.stall_id);
      return[e.date,u?.name||"",e.type,e.amount,s?.name||"",e.notes||""];
    });
    await syncSheet("Expenses",exRows);

    // SALARY
    const salRows=data.salary.map(r=>{
      const u=data.users.find(x=>x.id===r.user_id);
      return[r.month,u?.name||"",u?.role||"",r.days_worked,r.daily_rate,r.bonus||0,r.deductions||0,r.total,r.status,r.notes||""];
    });
    await syncSheet("Salary",salRows);

    setSyncing(false);
    addLog("Full sync complete!");
    toast("All data synced to Google Sheets!");
  };

  const scriptCode=`// SHINKORE MARKETING — Google Apps Script
// Paste this in script.google.com and deploy as Web App

function doPost(e){
  var data=JSON.parse(e.postData.contents);
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sheet=ss.getSheetByName(data.sheet)||ss.insertSheet(data.sheet);
  
  var headers={
    Staff:["Name","Role","Phone","Team","Daily Rate"],
    Stalls:["Name","City","Dept","Client","From","To","Charged","Duty Start"],
    Allocations:["Staff","Role","Stall","City","Duty Start","Rate","From","To","Status"],
    Attendance:["Date","Staff","Role","Stall","City","Clock In","Clock Out","Distance"],
    ClientPayments:["Date","Activity","Stall","Amount","Status","Notes"],
    Handovers:["Date Given","Supervisor","Stall","Given","Returned","Return Date","Notes"],
    Expenses:["Date","Staff","Type","Amount","Stall","Notes"],
    Salary:["Month","Staff","Role","Days","Rate","Bonus","Deductions","Total","Status","Notes"]
  };
  
  if(sheet.getLastRow()===0 && headers[data.sheet]){
    sheet.appendRow(headers[data.sheet]);
    sheet.getRange(1,1,1,headers[data.sheet].length).setBackground("#C9A84C").setFontColor("#fff").setFontWeight("bold");
  }
  
  // Clear old data (keep header)
  if(sheet.getLastRow()>1) sheet.deleteRows(2,sheet.getLastRow()-1);
  
  // Write new data
  data.rows.forEach(function(row){sheet.appendRow(row);});
  
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
}`;

  return(
    <div>
      <div className="info info-blue"><I n="sync" s={15}/>
        <div><strong>Google Sheets Auto-Sync</strong> — All data pushed to your Google Sheet with one tap. Set up once, sync anytime.</div>
      </div>

      {/* SETUP STEPS */}
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="key" s={17} c="var(--g)"/><div><div className="ct">One-Time Setup</div><div className="cs">5 steps, takes 3 minutes</div></div></div>
        <div className="cb">
          {[
            {n:"1",t:"Open Google Sheets",d:"Go to sheets.google.com → Create new spreadsheet → Name it 'Shinkore Marketing'"},
            {n:"2",t:"Open Apps Script",d:"In the sheet: Extensions → Apps Script → delete existing code"},
            {n:"3",t:"Paste the Script",d:"Copy the script below → paste into Apps Script → Save (Ctrl+S)"},
            {n:"4",t:"Deploy as Web App",d:"Click Deploy → New Deployment → Type: Web App → Execute as: Me → Who has access: Anyone → Deploy → Copy URL"},
            {n:"5",t:"Paste URL Below",d:"Paste the Web App URL in the field below → Save → Press Sync All"},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:14,marginBottom:16}}>
              <div style={{width:28,height:28,background:"var(--g)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Rajdhani",fontWeight:700,fontSize:14,color:"var(--d1)",flexShrink:0}}>{s.n}</div>
              <div><div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{s.t}</div><div style={{fontSize:12,color:"var(--txd)"}}>{s.d}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* SCRIPT CODE */}
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="set" s={17} c="var(--bl)"/><div style={{flex:1}}><div className="ct">Apps Script Code</div><div className="cs">Paste this into Google Apps Script</div></div>
          <button className="bg" onClick={()=>{navigator.clipboard.writeText(scriptCode);toast("Script copied!")}}><I n="ok" s={14}/>Copy</button>
        </div>
        <div className="cb">
          <div style={{background:"var(--d1)",border:"1px solid var(--bo)",borderRadius:10,padding:14,fontFamily:"monospace",fontSize:11,color:"#7EC8A4",whiteSpace:"pre-wrap",lineHeight:1.7,maxHeight:220,overflowY:"auto"}}>{scriptCode}</div>
        </div>
      </div>

      {/* URL INPUT */}
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="sync" s={17} c="var(--g)"/><div className="ct">Your Apps Script URL</div></div>
        <div className="cb">
          <div className="fg"><label className="fl">Web App URL (from Deploy step)</label>
            <input className="fi" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..."/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button className="bg" onClick={saveUrl}><I n="ok" s={15}/>Save URL</button>
            <button className="bg" onClick={syncAll} style={{flex:1,justifyContent:"center",opacity:syncing?0.7:1}}>
              <I n="sync" s={15}/>{syncing?"Syncing...":"Sync All Data Now"}
            </button>
          </div>
        </div>
      </div>

      {/* WHAT SYNCS */}
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="map" s={17} c="var(--g)"/><div><div className="ct">What Gets Synced</div><div className="cs">8 sheets auto-created in your Google Sheet</div></div></div>
        <div className="cb">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
            {["📋 Staff","📍 Stalls","🔗 Allocations","🕐 Attendance","💵 Client Payments","💼 Handovers","🚗 Expenses","💰 Salary"].map(s=>(
              <div key={s} style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:8,padding:"8px 12px",fontSize:13}}>{s}</div>
            ))}
          </div>
        </div>
      </div>

      {/* SYNC LOG */}
      {log.length>0&&(
        <div className="card">
          <div className="ch"><I n="clock" s={16} c="var(--txd)"/><div className="ct" style={{color:"var(--txd)"}}>Sync Log</div></div>
          <div className="cb">
            {log.map((l,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(201,168,76,.06)",fontSize:13}}>
                <span style={{color:l.ok?"var(--gr)":"var(--rd)",fontSize:16}}>{l.ok?"✓":"✗"}</span>
                <span style={{color:"var(--txd)",fontSize:11,flexShrink:0}}>{l.t}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APK / PWA INSTALL PAGE ───────────────────────────────────────────────────
function ApkPage(){
  const [copied,setCopied]=useState("");
  const copy=(text,key)=>{navigator.clipboard.writeText(text);setCopied(key);setTimeout(()=>setCopied(""),2000);};

  return(
    <div>
      <div className="info info-blue"><I n="apk" s={15}/>
        <div><strong>Install as App (PWA + APK)</strong> — Two free ways to install Shinkore Marketing on Android as a real app.</div>
      </div>

      {/* METHOD 1 - PWA */}
      <div className="card" style={{marginBottom:16}}>
        <div className="ch">
          <div style={{width:36,height:36,background:"var(--gd)",border:"1px solid var(--g)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Rajdhani",fontWeight:700,color:"var(--g)"}}>1</div>
          <div><div className="ct">Install as PWA (Easiest — No App Store needed)</div><div className="cs">Works on Android Chrome · Takes 30 seconds</div></div>
        </div>
        <div className="cb">
          {[
            {n:"1",t:"Deploy to Render",d:"Push your ShinkoreMarketing.jsx to GitHub → connect to Render (same as your Solar app)"},
            {n:"2",t:"Open in Chrome on Android",d:"Open your Render URL in Chrome browser on the phone"},
            {n:"3",t:"Add to Home Screen",d:"Chrome will show 'Add to Home Screen' banner → tap it → OR tap ⋮ menu → 'Install App'"},
            {n:"4",t:"Done",d:"App icon appears on home screen. Opens fullscreen like a real app. Works offline too."},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:12,marginBottom:14,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,background:"var(--g)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Rajdhani",fontWeight:700,fontSize:12,color:"var(--d1)",flexShrink:0}}>{s.n}</div>
              <div><div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{s.t}</div><div style={{fontSize:12,color:"var(--txd)"}}>{s.d}</div></div>
            </div>
          ))}
          <div style={{background:"var(--d3)",borderRadius:10,padding:12,marginTop:4}}>
            <div style={{fontSize:11,color:"var(--txd)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Add this to your Flask app.py for PWA support</div>
            <div style={{fontFamily:"monospace",fontSize:12,color:"#7EC8A4"}}>{"@app.route('/manifest.json')\ndef manifest():\n    return jsonify({\n      'name': 'Shinkore Marketing',\n      'short_name': 'Shinkore',\n      'start_url': '/',\n      'display': 'standalone',\n      'background_color': '#08090D',\n      'theme_color': '#C9A84C',\n      'icons': [{'src':'/static/icon.png','sizes':'192x192','type':'image/png'}]\n    })"}</div>
            <button className="bg" style={{marginTop:10,fontSize:12}} onClick={()=>copy(`@app.route('/manifest.json')\ndef manifest():\n    return jsonify({'name':'Shinkore Marketing','short_name':'Shinkore','start_url':'/','display':'standalone','background_color':'#08090D','theme_color':'#C9A84C','icons':[{'src':'/static/icon.png','sizes':'192x192','type':'image/png'}]})`,"pwa")}>
              <I n="ok" s={13}/>{copied==="pwa"?"Copied!":"Copy Code"}
            </button>
          </div>
        </div>
      </div>

      {/* METHOD 2 - APK BUILDER */}
      <div className="card">
        <div className="ch">
          <div style={{width:36,height:36,background:"var(--gd)",border:"1px solid var(--g)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Rajdhani",fontWeight:700,color:"var(--g)"}}>2</div>
          <div><div className="ct">Convert to Real APK (pwabuilder.com)</div><div className="cs">Free · Creates installable .apk file</div></div>
        </div>
        <div className="cb">
          {[
            {n:"1",t:"Deploy app first",d:"Your app must be live on a URL (Render free tier is fine)"},
            {n:"2",t:"Go to pwabuilder.com",d:"Enter your Render app URL → click Start"},
            {n:"3",t:"Download Android Package",d:"Click Android → Download → You get an .apk file"},
            {n:"4",t:"Install on phones",d:"Share the .apk via WhatsApp to all staff → They install it → Done. No Play Store needed."},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:12,marginBottom:14,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,background:"var(--bl)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Rajdhani",fontWeight:700,fontSize:12,color:"#fff",flexShrink:0}}>{s.n}</div>
              <div><div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{s.t}</div><div style={{fontSize:12,color:"var(--txd)"}}>{s.d}</div></div>
            </div>
          ))}
          <button className="bw" onClick={()=>window.open("https://www.pwabuilder.com","_blank")}><I n="wa" s={14}/>Open pwabuilder.com</button>
        </div>
      </div>

      {/* SYSTEM STATUS */}
      <div className="card" style={{marginTop:16}}>
        <div className="ch"><I n="ok" s={17} c="var(--gr)"/><div className="ct">All Phases Complete</div></div>
        <div className="cb">
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {["✅ Phase 1 — Auth, Staff, Teams, Session Persistence","✅ Phase 2 — GPS Stalls, Allocations, Clock In/Out, 3-Way Alerts","✅ Phase 3 — Cash Flow, Client Payments, Handovers, Expenses","✅ Phase 4 — Salary Calculator, PDF Slips, WhatsApp Send","✅ Phase 5 — Google Sheets Auto-Sync (8 sheets)","✅ Phase 6 — PWA + APK Install Guide"].map(s=>(
              <div key={s} style={{fontSize:13,color:"var(--gr)",padding:"8px 12px",background:"rgba(46,204,113,.06)",border:"1px solid rgba(46,204,113,.15)",borderRadius:8}}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Soon({title}){
  return(
    <div className="card">
      <div style={{textAlign:"center",padding:"70px 20px",color:"var(--txd)"}}>
        <I n="clock" s={48} c="var(--txd)"/>
        <div style={{fontFamily:"Rajdhani",fontSize:22,marginTop:16,color:"var(--tx)"}}>{title}</div>
        <div style={{fontSize:13,marginTop:6}}>Coming in Phase 3/4</div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const getSaved=()=>{try{const s=localStorage.getItem("shinkore_session");return s?JSON.parse(s):null;}catch{return null;}};
  const [user,setUser]=useState(getSaved);
  const [page,setPage]=useState(()=>{const u=getSaved();return u?(u.role==="admin"?"dash":"my-dash"):"dash";});
  
  
  const [data,setData]=useState(initData());
  const [toastMsg,setToastMsg]=useState("");
  const [sideOpen,setSideOpen]=useState(false);

  const toast=(m)=>setToastMsg(m);
  const logout=()=>{localStorage.removeItem("shinkore_session");setUser(null);setPage("dash");};
  const doLogin=(u)=>{const d=initData();const fresh=d.users.find(x=>x.id===u.id)||u;localStorage.setItem("shinkore_session",JSON.stringify(fresh));setUser(fresh);setPage(fresh.role==="admin"?"dash":"my-dash");};

  const titles={dash:"Dashboard","my-dash":"My Dashboard",staff:"Staff & Teams",stalls:"Permission Stalls",alloc:"Allocations",attend:"Attendance",cash:"Cash & Finance",salary:"Salary & Slips",alerts:"Late Alerts",settings:"Settings","clock-in":"Clock In / Out","my-salary":"My Salary"};

  if(!user) return <><style>{css}</style><Login onLogin={doLogin}/></>;

  const isAdmin=user.role==="admin";

  const render=()=>{
    if(isAdmin){
      switch(page){
        case "dash": return <AdminDash data={data}/>;
        case "staff": return <StaffPage data={data} setData={setData} toast={toast}/>;
        case "stalls": return <StallsPage data={data} setData={setData} toast={toast}/>;
        case "alloc": return <AllocPage data={data} setData={setData} toast={toast}/>;
        case "attend": return <AttendancePage data={data} setData={setData} toast={toast}/>;
        case "alerts": return <AlertsPage data={data} toast={toast}/>;
        case "settings": return <SettingsPage data={data} setData={setData} toast={toast}/>;
        case "sync": return <SyncPage data={data} setData={setData} toast={toast}/>;
        case "apk": return <ApkPage/>;
        case "cash": return <CashPage data={data} setData={setData} toast={toast}/>;
        case "salary": return <SalaryPage data={data} setData={setData} toast={toast}/>;
        default: return <AdminDash data={data}/>;
      }
    } else {
      switch(page){
        case "my-dash": return <MyDash user={user} data={data}/>;
        case "clock-in": return <ClockPage user={user} data={data} setData={setData} toast={toast}/>;
        case "my-salary": return <MySalaryPage user={user} data={data}/>;
        default: return <MyDash user={user} data={data}/>;
      }
    }
  };

  return(
    <>
      <style>{css}</style>
      <div className="layout">
        <Sidebar user={user} page={page} setPage={setPage} open={sideOpen} onClose={()=>setSideOpen(false)}/>
        <main className="main">
          <div className="topbar">
            <button className="mbtn" onClick={()=>setSideOpen(o=>!o)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="tb-title">{titles[page]||page}</div>
            <div className="tb-sub">{COMPANY}</div>
            <button className="bic" onClick={logout} title="Logout"><I n="out" s={15}/></button>
          </div>
          <div className="content">{render()}</div>
        </main>
      </div>
      {toastMsg&&<Toast msg={toastMsg} onDone={()=>setToastMsg("")}/>}
    </>
  );
}
