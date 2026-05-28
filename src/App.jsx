import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
const SB=createClient("https://isqlqmhueoiwnlcsvsfg.supabase.co","sb_publishable_hPu0RIbvCd_DBCM4s2lH2g_U6CONZdr");
const pushToSB=async(table,rows)=>{if(!rows||rows.length===0)return;try{await SB.from(table).upsert(rows,{onConflict:"id"});}catch(e){console.log("SB error",e);}};
const loadFromSB=async()=>{try{const tables=["sm_users","sm_stalls","sm_allocations","sm_attendance","sm_client_payments","sm_handovers","sm_expenses","sm_salary","sm_personal"];const results={};for(const t of tables){const{data}=await SB.from(t).select("*");results[t]=data||[];}return results;}catch(e){return null;}};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "Khalid";
const COMPANY = "Shinkore Marketing";
const ADMIN_PHONES = ["00923135443656", "00923174886655"];
const GPS_RADIUS_M = 200;
const sendDailySummary=(data)=>{
  const today=new Date().toISOString().slice(0,10);
  const todayActs=(data.activities||[]).filter(a=>a.date===today);
  const submitted=todayActs.filter(a=>a.approval_status==="submitted").length;
  const approved=todayActs.filter(a=>a.approval_status==="approved").length;
  const highRemarks=todayActs.filter(a=>a.ba_remark_cat==="high"||a.sup_remark_cat==="high").length;
  const totalKg=todayActs.reduce((s,a)=>s+Number(a.total_kg||0),0);
  const totalPcs=todayActs.reduce((s,a)=>s+Number(a.total_pcs||0),0);
  const totalInterceptions=todayActs.reduce((s,a)=>s+Number(a.total_interceptions||0),0);
  const msg="📊 *Shinkore Marketing — Daily Summary*\n"
    +"Date: "+today+"\n\n"
    +"✅ Approved: "+approved+"\n"
    +"⏳ Pending Approval: "+submitted+"\n"
    +"📋 Total Activities: "+todayActs.length+"\n\n"
    +"📈 *Today's Performance*\n"
    +"Interceptions: "+totalInterceptions+"\n"
    +"Sales KG: "+totalKg+" kg\n"
    +"Sales PCs: "+totalPcs+" pcs\n\n"
    +(highRemarks>0?"🔴 High Priority Remarks: "+highRemarks+"\n\n":"")
    +"— Shinkore Marketing System";
  ADMIN_PHONES.forEach(ph=>sendWA(ph,msg));
};
const IMGBB_KEY="23d6b85fb8d0698b3bf3ec4d4c5deb22";
const uploadPhoto=async(file)=>{const fd=new FormData();fd.append("image",file);fd.append("key",IMGBB_KEY);try{const r=await fetch("https://api.imgbb.com/1/upload",{method:"POST",body:fd});const d=await r.json();if(d.success)return{url:d.data.url,thumb:d.data.thumb.url};return null;}catch{return null;}};

// ─── DATA INIT ────────────────────────────────────────────────────────────────
const initData = () => {
  const d = localStorage.getItem("shinkore_v2");
  if (d) return JSON.parse(d);
  return {
    users: [
      { id:"u1", name:"Khalid Orakzai", phone:"00923135443656", role:"admin", daily_rate:0, team:"", callmebot_key:"", pin:"" },
      { id:"u2", name:"Khan", phone:"03001111111", role:"supervisor", daily_rate:1500, team:"Team A", callmebot_key:"", pin:"123" },
      { id:"u3", name:"Muna", phone:"03002222222", role:"ba", daily_rate:800, team:"Team A", callmebot_key:"", pin:"123" },
    ],
    teams: [],
    stalls: [],
    allocations: [],
    attendance: [],
    client_payments: [],
    handovers: [],
    expenses: [],
    salary: [],
    personal: [],
    activity_photos: [],
    stock_items: [],
    remarks: [],
    targets: [],
    activities: [],
    remarks: [],
    stock_items: [],
    clients: [{id:"c1",name:"Shahadat",brand:"Brite",phone:"03001234999",email:"",pin:"1234",active:true}],
    daily_plans: [],
    targets: [],
    activity_photos: [],
    callmebot: { admin1:"", admin2:"" },
    sheets_url: "", csv_exported: false,
  };
};
const save = (d) => {
  localStorage.setItem("shinkore_v2", JSON.stringify(d));
  pushToSB("sm_users", d.users||[]);
  pushToSB("sm_stalls", d.stalls||[]);
  pushToSB("sm_allocations", d.allocations||[]);
  pushToSB("sm_attendance", d.attendance||[]);
  pushToSB("sm_client_payments", d.client_payments||[]);
  pushToSB("sm_handovers", d.handovers||[]);
  pushToSB("sm_expenses", d.expenses||[]);
  pushToSB("sm_salary", d.salary||[]);
  pushToSB("sm_personal", d.personal||[]);
};
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
    const u=(data.users||[]).find(x=>x.phone===f.phone);
    const cl=(data.clients||[]).find(x=>x.phone===f.phone);
    if(cl){
      if(f.pass!==cl.pin) return setErr("Wrong PIN.");
      onLogin({...cl,role:"client"});
      return;
    }
    if(!u) return setErr("Phone not found. Ask admin to register you.");
    if(u.role==="admin"&&f.pass!==ADMIN_PASSWORD) return setErr("Wrong admin password.");
    if(u.role!=="admin"&&u.pin&&f.pass!==u.pin) return setErr("Wrong PIN. Contact admin if forgotten.");
    onLogin(u);
  };

  const doUp=()=>{
    setErr("");
    if(!f.name||!f.phone) return setErr("Name and phone required.");
    if((data.users||[]).find(u=>u.phone===f.phone)) return setErr("Phone already registered.");
    const nu={id:genId(),name:f.name,phone:f.phone,role:f.role,daily_rate:Number(f.daily_rate)||0,team:"",callmebot_key:""};
    (data.users||[]).push(nu); save(data); onLogin(nu);
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
            <div className="fg"><label className="fl">Password (Admin only)</label><input className="fi" type="password" placeholder="Admin: password | Staff: PIN" value={f.pass} onChange={e=>set("pass",e.target.value)}/></div>
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
    {id:"personal",icon:"money",label:"Personal Finance"},
    {id:"activity",icon:"map",label:"Activity Reports"},
    {id:"daily_plan",icon:"cal",label:"Daily Plans"},
    {id:"clients",icon:"users",label:"Clients"},
    {id:"client_pdf",icon:"pdf",label:"Client Report PDF"},
    {id:"settings",icon:"set",label:"Settings / CallMeBot"},,
  ];
  const staffNav=[
    {id:"my-dash",icon:"dash",label:"My Dashboard"},
    {id:"clock-in",icon:"clock",label:"Clock In / Out"},
    {id:"my-salary",icon:"money",label:"My Salary"},
    {id:"my-activity",icon:"map",label:"My Activities"},
  ];
  const clientNav=[
    {id:"client_dash",icon:"dash",label:"My Dashboard"},
  ];
  const nav=isAdmin?adminNav:user.role==="client"?clientNav:staffNav;
  return(
    <>
      <div className={`ov ${open?"show":""}`} onClick={onClose}/>
      <aside className={`sb ${open?"open":""}`}>
        <div className="sb-brand">
          <img src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg" style={{width:42,height:42,borderRadius:8,objectFit:"cover"}}/>
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
function AdminDash({data,toast}){
  const todayDate=new Date().toISOString().slice(0,10);
  const todayActs=(data.activities||[]).filter(a=>a.date===todayDate);
  const pendingApprovals=todayActs.filter(a=>a.approval_status==="submitted").length;
  const highRemarks=(data.activities||[]).filter(a=>a.ba_remark_cat==="high"||a.sup_remark_cat==="high").length;
  const staff=(data.users||[]).filter(u=>u.role!=="admin");
  const today=new Date().toISOString().slice(0,10);
  const todayAtt=(data.attendance||[]).filter(a=>a.date===today);
  const activeAlloc=data.allocations.filter(a=>a.active);

  return(
    <div>
      <div className="sg">
        <div className="sc gold"><div className="si gold"><I n="users" s={18}/></div><div className="sv">{staff.length}</div><div className="sl">Total Staff</div></div>
        <div className="sc bl"><div className="si bl"><I n="pin" s={18}/></div><div className="sv">{(data.stalls||[]).length}</div><div className="sl">Active Stalls</div></div>
        <div className="sc gr"><div className="si gr"><I n="alloc" s={18}/></div><div className="sv">{activeAlloc.length}</div><div className="sl">Allocations</div></div>
        <div className="sc rd"><div className="si rd"><I n="clock" s={18}/></div><div className="sv">{todayAtt.length}</div><div className="sl">Checked In Today</div></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div className="card">
          <div className="ch"><I n="alloc" s={17} c="var(--g)"/><div><div className="ct">Today's Allocations</div><div className="cs">Who is where today</div></div></div>
          <div className="cb">
            {activeAlloc.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No allocations yet.</div>}
            {activeAlloc.slice(0,6).map(a=>{
              const u=(data.users||[]).find(x=>x.id===a.user_id);
              const s=(data.stalls||[]).find(x=>x.id===a.stall_id);
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
            {(data.stalls||[]).length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No stalls added yet.</div>}
            {(data.stalls||[]).map(s=>{
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
  const [f,setF]=useState({name:"",phone:"",role:"ba",daily_rate:"",team:"",callmebot_key:"",paid_by:"admin"});
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
    const d={...data,users:(data.users||[]).filter(x=>x.id!==u.id)};
    setData(d);save(d);toast("Removed.");
  };

  const addTeam=()=>{
    const name=prompt("Team name:");
    if(!name) return;
    const d={...data,teams:[...data.teams,name]};
    setData(d);save(d);toast(`Team "${name}" created!`);
  };

  const list=(data.users||[]).filter(u=>u.role!=="admin"&&(u.name.toLowerCase().includes(search.toLowerCase())||u.phone.includes(search)));

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
              <div className="fg"><label className="fl">PIN (4 digit password)</label><input className="fi" type="password" value={f.pin||""} onChange={e=>set("pin",e.target.value)} placeholder="e.g. 1234"/></div>
              <div className="fg"><label className="fl">Salary Paid By (Default)</label><select className="fsel" value={f.paid_by||"admin"} onChange={e=>set("paid_by",e.target.value)}><option value="admin">Shinkore / Admin</option><option value="client">Client</option><option value="both">Both (Split)</option></select></div>
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
  const emptyF={name:"",city:"",dept:"",focal_name:"",focal_mob:"",lat:"",lng:"",from_date:"",to_date:"",num_days:"",client:"",duty_start:"09:00",perm_cost:"",perm_charged:"",ba_cost:"",ba_charged:"",sup_cost:"",sup_charged:"",other_cost:"",other_charged:"",notes:""};
  const [f,setF]=useState(emptyF);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const calc=(fm)=>{const d=Number(fm.num_days)||1;const tc=(Number(fm.perm_charged)||0)+(Number(fm.ba_charged)||0)*d+(Number(fm.sup_charged)||0)*d+(Number(fm.other_charged)||0);const tx=(Number(fm.perm_cost)||0)+(Number(fm.ba_cost)||0)*d+(Number(fm.sup_cost)||0)*d+(Number(fm.other_cost)||0);return{tc,tx,profit:tc-tx};};

  const [gpsCapturing,setGpsCapturing]=useState(false);
  const [gpsAccuracy,setGpsAccuracy]=useState(null);
  const getMyLoc=()=>{
    if(!navigator.geolocation) return toast("GPS not available");
    setGpsCapturing(true);
    setGpsAccuracy(null);
    navigator.geolocation.getCurrentPosition(p=>{
      const acc=Math.round(p.coords.accuracy);
      set("lat",p.coords.latitude.toFixed(6));
      set("lng",p.coords.longitude.toFixed(6));
      setGpsAccuracy(acc);
      setGpsCapturing(false);
      if(acc<=20) toast("✅ Excellent GPS! Accuracy: "+acc+"m");
      else if(acc<=50) toast("✅ Good GPS! Accuracy: "+acc+"m");
      else if(acc<=100) toast("⚠️ Fair GPS. Accuracy: "+acc+"m. Try again outdoors.");
      else toast("❌ Poor GPS ("+acc+"m). Move outside and retry.");
    },e=>{
      setGpsCapturing(false);
      toast("GPS denied. Enable location in browser settings.");
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  };

  const openAdd=()=>{setEditing(null);setF(emptyF);setShow(true)};
  const openEdit=(s)=>{setEditing(s);setF({...emptyF,...s});setShow(true)};

  const doSave=()=>{
    if(!f.name||!f.city||!f.lat||!f.lng) return toast("Name, city and GPS required.");
    const{tc,tx,profit}=calc(f);
    const sid=editing?editing.id:genId();
    const sd={...f,id:sid,num_days:Number(f.num_days)||0,client_charged:tc,total_cost:tx,profit,perm_cost:Number(f.perm_cost)||0,perm_charged:Number(f.perm_charged)||0,ba_cost:Number(f.ba_cost)||0,ba_charged:Number(f.ba_charged)||0,sup_cost:Number(f.sup_cost)||0,sup_charged:Number(f.sup_charged)||0,other_cost:Number(f.other_cost)||0,other_charged:Number(f.other_charged)||0};
    const d={...data};
    if(editing) d.stalls=d.stalls.map(s=>s.id===editing.id?{...s,...sd}:s);
    else{
      d.stalls.push(sd);
      if(tc>0) d.client_payments.push({id:genId(),stall_id:sid,amount:tc,activity:"Stall: "+f.name,date:f.from_date||new Date().toISOString().slice(0,10),status:"pending",notes:"Auto: Permission "+formatPKR(Number(f.perm_charged)||0)+" + BA "+formatPKR((Number(f.ba_charged)||0)*Number(f.num_days||1))+" + Sup "+formatPKR((Number(f.sup_charged)||0)*Number(f.num_days||1))});
    }
    setData(d);save(d);setShow(false);toast(editing?"Stall updated!":"Stall added + billing created!");
  };

  const doDel=(s)=>{
    if(!confirm(`Delete stall "${s.name}"?`)) return;
    const d={...data,stalls:(data.stalls||[]).filter(x=>x.id!==s.id)};
    setData(d);save(d);toast("Stall removed.");
  };

  return(
    <div>
      <div className="card">
        <div className="ch">
          <I n="pin" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Permission Stalls</div><div className="cs">{(data.stalls||[]).length} stalls</div></div>
          <button className="bg" onClick={openAdd}><I n="plus" s={15}/>Add Stall</button>
        </div>
        <div className="cb">
          {(data.stalls||[]).length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"var(--txd)"}}>No stalls yet. Add your first permission stall.</div>}
          {(data.stalls||[]).map(s=>{
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
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>GPS</div><div style={{fontSize:13,fontWeight:600,color:s.lat&&s.lng?"var(--g)":"var(--rd)"}}>{s.lat&&s.lng?"🎯 Verified":"❌ Not Set"}</div></div>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Duty Start</div><div style={{fontSize:13,fontWeight:600}}>{s.duty_start}</div></div>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>GPS</div><div style={{fontSize:12,color:"var(--bl)"}}>{Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}</div></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:"var(--txd)"}}>Assigned:</span>
                  {assigned.length===0&&<span style={{fontSize:12,color:"var(--txd)"}}>No staff yet</span>}
                  {assigned.map(a=>{
                    const u=(data.users||[]).find(x=>x.id===a.user_id);
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
                <div className="fg"><label className="fl">Duty Start Time</label><input className="fi" type="time" value={f.duty_start} onChange={e=>set("duty_start",e.target.value)}/></div>
                <div className="fg"><label className="fl">Number of Days</label><input className="fi" type="number" value={f.num_days} onChange={e=>set("num_days",e.target.value)} placeholder="e.g. 30"/></div>
              </div>
              <div className="fg"><label className="fl">GPS Coordinates</label>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <input className="fi" placeholder="Latitude" value={f.lat} onChange={e=>set("lat",e.target.value)} style={{flex:1}}/>
                  <input className="fi" placeholder="Longitude" value={f.lng} onChange={e=>set("lng",e.target.value)} style={{flex:1}}/>
                </div>
                <button className="bg" onClick={getMyLoc} disabled={gpsCapturing} style={{width:"100%",justifyContent:"center",opacity:gpsCapturing?0.7:1}}>
                  <I n="gps" s={14}/>{gpsCapturing?"📡 Getting GPS...":"Capture My Location"}
                </button>
                {gpsAccuracy!==null&&<div style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:gpsAccuracy<=20?"rgba(46,204,113,.15)":gpsAccuracy<=50?"rgba(46,204,113,.1)":gpsAccuracy<=100?"rgba(240,165,0,.15)":"rgba(231,76,60,.15)",border:"1px solid "+(gpsAccuracy<=50?"rgba(46,204,113,.3)":gpsAccuracy<=100?"rgba(240,165,0,.3)":"rgba(231,76,60,.3)"),fontSize:12,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{gpsAccuracy<=20?"🎯":gpsAccuracy<=50?"✅":gpsAccuracy<=100?"⚠️":"❌"}</span>
                  <div>
                    <div style={{fontWeight:600,color:gpsAccuracy<=50?"var(--g)":gpsAccuracy<=100?"var(--or)":"var(--rd)"}}>{gpsAccuracy<=20?"Excellent":gpsAccuracy<=50?"Good":gpsAccuracy<=100?"Fair":"Poor"} GPS — {gpsAccuracy}m accuracy</div>
                    <div style={{color:"var(--txd)",fontSize:11}}>{gpsAccuracy<=100?"Location saved! ✓":"Move outdoors and try again"}</div>
                  </div>
                </div>}
                {f.lat&&f.lng&&<div style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:"rgba(58,155,213,.1)",border:"1px solid rgba(58,155,213,.25)",fontSize:12,color:"var(--bl)"}}>
                  📍 Saved: {f.lat}, {f.lng} — <a href={"https://maps.google.com/?q="+f.lat+","+f.lng} target="_blank" style={{color:"var(--bl)"}}>View on Map ↗</a>
                </div>}
              </div>
              <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:8}}>🏛️ Permission Details</div>
                <div className="frow">
                  <div className="fg"><label className="fl">Focal Person (optional)</label><input className="fi" value={f.focal_name} onChange={e=>set("focal_name",e.target.value)} placeholder="Name"/></div>
                  <div className="fg"><label className="fl">Focal Mobile (optional)</label><input className="fi" value={f.focal_mob} onChange={e=>set("focal_mob",e.target.value)} placeholder="03001234567"/></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Permission — You Pay (PKR)</label><input className="fi" type="number" value={f.perm_cost} onChange={e=>set("perm_cost",e.target.value)} placeholder="5000"/></div>
                  <div className="fg"><label className="fl">Permission — Charge Client (PKR)</label><input className="fi" type="number" value={f.perm_charged} onChange={e=>set("perm_charged",e.target.value)} placeholder="10000"/></div>
                </div>
              </div>
              <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:8}}>👥 Staff Rates (Per Day)</div>
                <div style={{fontSize:11,color:"var(--txd)",marginBottom:6}}>Business Ambassador</div>
                <div className="frow">
                  <div className="fg"><label className="fl">BA — You Pay/Day</label><input className="fi" type="number" value={f.ba_cost} onChange={e=>set("ba_cost",e.target.value)} placeholder="800"/></div>
                  <div className="fg"><label className="fl">BA — Charge Client/Day</label><input className="fi" type="number" value={f.ba_charged} onChange={e=>set("ba_charged",e.target.value)} placeholder="1000"/></div>
                </div>
                <div style={{fontSize:11,color:"var(--txd)",marginBottom:6}}>Supervisor</div>
                <div className="frow">
                  <div className="fg"><label className="fl">Supervisor — You Pay/Day</label><input className="fi" type="number" value={f.sup_cost} onChange={e=>set("sup_cost",e.target.value)} placeholder="1500"/></div>
                  <div className="fg"><label className="fl">Supervisor — Charge Client/Day</label><input className="fi" type="number" value={f.sup_charged} onChange={e=>set("sup_charged",e.target.value)} placeholder="2000"/></div>
                </div>
              </div>
              <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:8}}>💼 Other Charges (Optional)</div>
                <div className="frow">
                  <div className="fg"><label className="fl">Other — You Pay</label><input className="fi" type="number" value={f.other_cost} onChange={e=>set("other_cost",e.target.value)} placeholder="0"/></div>
                  <div className="fg"><label className="fl">Other — Charge Client</label><input className="fi" type="number" value={f.other_charged} onChange={e=>set("other_charged",e.target.value)} placeholder="0"/></div>
                </div>
                <div className="fg"><label className="fl">Notes (Optional)</label><input className="fi" value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any extra info"/></div>
              </div>
              {f.num_days?(()=>{const{tc,tx,profit}=calc(f);return(<div style={{background:"var(--d1)",border:"1px solid var(--g)",borderRadius:10,padding:"14px",marginBottom:10}}><div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:8}}>📊 Live Profit ({f.num_days} days)</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}><div><div style={{fontSize:10,color:"var(--txd)"}}>Total Invoice</div><div style={{fontFamily:"Rajdhani",fontSize:16,color:"var(--g)"}}>{formatPKR(tc)}</div></div><div><div style={{fontSize:10,color:"var(--txd)"}}>Your Cost</div><div style={{fontFamily:"Rajdhani",fontSize:16,color:"var(--rd)"}}>{formatPKR(tx)}</div></div><div><div style={{fontSize:10,color:"var(--txd)"}}>Net Profit</div><div style={{fontFamily:"Rajdhani",fontSize:16,color:profit>=0?"var(--gr)":"var(--rd)"}}>{formatPKR(profit)}</div></div></div></div>);})():null}
              <div className="info info-blue" style={{marginBottom:10}}><I n="money" s={13}/>Adding stall auto-creates billing record in Cash & Finance</div>
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
  const [f,setF]=useState({stall_id:"",user_id:"",duty_start:"09:00",daily_rate:"",from_date:"",to_date:"",paid_by:"admin"});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const onStallChange=(sid)=>{
    set("stall_id",sid);
    const stall=(data.stalls||[]).find(s=>s.id===sid);
    const u=(data.users||[]).find(x=>x.id===f.user_id);
    if(stall&&u){
      if(u.role==="ba"&&stall.ba_cost) set("daily_rate",stall.ba_cost);
      else if(u.role==="supervisor"&&stall.sup_cost) set("daily_rate",stall.sup_cost);
    }
    if(stall){
      if(stall.from_date) set("from_date",stall.from_date);
      if(stall.to_date) set("to_date",stall.to_date);
      set("duty_start",stall.duty_start||"09:00");
    }
  };
  const nonAdmin=(data.users||[]).filter(u=>u.role!=="admin");

  const openAdd=()=>{
    setF({stall_id:data.stalls[0]?.id||"",user_id:nonAdmin[0]?.id||"",duty_start:"09:00",daily_rate:"",from_date:new Date().toISOString().slice(0,10),to_date:""});
    setShow(true);
  };

  const onStaffChange=(uid)=>{
    const u=(data.users||[]).find(x=>x.id===uid);
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
          <button className="bg" onClick={openAdd} disabled={(data.stalls||[]).length===0||nonAdmin.length===0}><I n="plus" s={15}/>Allocate Staff</button>
        </div>
        <div className="cb">
          {(data.stalls||[]).length===0&&<div className="info info-warn"><I n="alert" s={14}/>Add stalls first before allocating staff.</div>}
          {active.length===0&&(data.stalls||[]).length>0&&<div style={{color:"var(--txd)",fontSize:13}}>No active allocations. Press "Allocate Staff" to assign.</div>}
          {active.map(a=>{
            const u=(data.users||[]).find(x=>x.id===a.user_id);
            const s=(data.stalls||[]).find(x=>x.id===a.stall_id);
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
              const u=(data.users||[]).find(x=>x.id===a.user_id);
              const s=(data.stalls||[]).find(x=>x.id===a.stall_id);
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
                <select className="fsel" value={f.stall_id} onChange={e=>onStallChange(e.target.value)}>
                  <option value="">-- Select stall --</option>
                  {(data.stalls||[]).map(s=><option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
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
  const todayAtt=(data.attendance||[]).filter(a=>a.user_id===user.id&&a.date===today);

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
    const stall=(data.stalls||[]).find(s=>s.id===alloc.stall_id);
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
    const d={...data,attendance:(data.attendance||[]).map(a=>a.id===att.id?{...a,clock_out:now}:a)};
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
        const stall=(data.stalls||[]).find(s=>s.id===alloc.stall_id);
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
  const dayAtt=(data.attendance||[]).filter(a=>a.date===date);

  const sendLateAlert=(u,stall)=>{
    const now=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    const alloc=data.allocations.find(a=>a.user_id===u.id&&a.stall_id===stall.id&&a.active);
    const team=u.team||"Unassigned";
    const supId=data.allocations.find(a=>a.stall_id===stall.id&&a.active&&a.user_id!==u.id&&(data.users||[]).find(x=>x.id===a.user_id&&x.role==="supervisor"));
    const sup=supId?(data.users||[]).find(x=>x.id===supId.user_id):null;
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
            const u=(data.users||[]).find(x=>x.id===a.user_id);
            const s=(data.stalls||[]).find(x=>x.id===a.stall_id);
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
    const stall=alloc?(data.stalls||[]).find(s=>s.id===alloc.stall_id):null;
    const supAlloc=stall?data.allocations.find(a=>a.stall_id===stall.id&&a.active&&a.user_id!==u.id&&(data.users||[]).find(x=>x.id===a.user_id&&x.role==="supervisor")):null;
    const sup=supAlloc?(data.users||[]).find(x=>x.id===supAlloc.user_id):null;
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
          {(data.users||[]).filter(u=>u.role!=="admin").map(u=>{
            const alloc=data.allocations.find(a=>a.user_id===u.id&&a.active);
            const stall=alloc?(data.stalls||[]).find(s=>s.id===alloc.stall_id):null;
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
function MyDash({user,data,setPage}){
  const today=new Date().toISOString().slice(0,10);
  const isSup=user.role==="supervisor";
  const allocs=data.allocations.filter(a=>a.user_id===user.id&&a.active);
  const myAtt=(data.attendance||[]).filter(a=>a.user_id===user.id);
  const todayAtt=myAtt.filter(a=>a.date===today);
  const thisMonthStr=today.slice(0,7);
  const monthDays=new Set(myAtt.filter(a=>a.date.startsWith(thisMonthStr)).map(a=>a.date)).size;
  const monthEarned=monthDays*(user.daily_rate||0);
  const myActs=(data.activities||[]).filter(a=>isSup?a.supervisor_id===user.id:a.ba_id===user.id);
  const pendingActs=myActs.filter(a=>a.approval_status==="draft"||a.approval_status==="pending");
  const myBAs=isSup?(data.users||[]).filter(u=>{
    var myStallIds=data.allocations.filter(a=>a.user_id===user.id&&a.active).map(a=>a.stall_id);
    return u.role==="ba"&&data.allocations.some(a=>a.user_id===u.id&&a.active&&myStallIds.includes(a.stall_id));
  }):[];
  const [now,setNow]=useState(new Date());
  useEffect(()=>{var t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  var timeStr=now.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  var dateStr=now.toLocaleDateString("en-PK",{weekday:"long",month:"long",day:"numeric"});
  var last7=[];
  for(var i=6;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);last7.push(d.toISOString().slice(0,10));}
  return(
    <div>
      <div className="card" style={{marginBottom:14,background:"linear-gradient(135deg,var(--d2),var(--d3))"}}>
        <div className="cb">
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
            <div className={`av ${avatarClass(user.role)}`} style={{width:64,height:64,fontSize:24,borderRadius:16,boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>{getInitials(user.name)}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Rajdhani",fontSize:23,fontWeight:700}}>{user.name}</div>
              <div style={{fontSize:13,color:"var(--bl)",fontWeight:600}}>{isSup?"👮 Supervisor":"🧑 Business Ambassador"}</div>
              <div style={{fontSize:12,color:"var(--txd)"}}>{user.phone} · Team: {user.team||"—"}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"Rajdhani",fontSize:26,color:"var(--g)",fontWeight:700}}>{formatPKR(user.daily_rate)}</div>
              <div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase"}}>Per Day</div>
            </div>
          </div>
          <div style={{background:"var(--d3)",borderRadius:12,padding:"10px 14px",textAlign:"center",border:"1px solid var(--bo)"}}>
            <div style={{fontFamily:"Rajdhani",fontSize:32,fontWeight:700,color:"var(--g)",letterSpacing:2}}>{timeStr}</div>
            <div style={{fontSize:12,color:"var(--txd)"}}>{dateStr}</div>
          </div>
        </div>
      </div>
      <div className="sg" style={{marginBottom:14}}>
        <div className="sc gr"><div className="si gr"><I n="ok" s={16}/></div><div className="sv">{monthDays}</div><div className="sl">Days This Month</div></div>
        <div className="sc gold"><div className="si gold"><I n="money" s={16}/></div><div className="sv">{formatPKR(monthEarned)}</div><div className="sl" style={{fontSize:9}}>Month Earned</div></div>
        <div className="sc bl"><div className="si bl"><I n="pin" s={16}/></div><div className="sv">{allocs.length}</div><div className="sl">Active Stalls</div></div>
        <div className="sc rd"><div className="si rd"><I n="alert" s={16}/></div><div className="sv">{pendingActs.length}</div><div className="sl">Pending Reports</div></div>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <div className="ch"><I n="clock" s={16} c="var(--g)"/><div className="ct">Today's Stalls</div></div>
        <div className="cb">
          {allocs.length===0&&<div className="info info-warn"><I n="alert" s={13}/>No active stall assigned.</div>}
          {allocs.map(a=>{
            var s=(data.stalls||[]).find(x=>x.id===a.stall_id);
            var att=todayAtt.find(x=>x.stall_id===a.stall_id);
            if(!s)return null;
            return(
              <div key={a.id} style={{background:"var(--d3)",borderRadius:12,padding:"12px 14px",marginBottom:10,border:"1px solid var(--bo)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <I n="pin" s={15} c="var(--g)"/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
                    <div style={{fontSize:12,color:"var(--txd)"}}>{s.city} · Duty: {a.duty_start||"—"}</div>
                  </div>
                  <div style={{fontSize:11,padding:"3px 8px",borderRadius:6,background:s.lat&&s.lng?"rgba(46,204,113,.15)":"rgba(231,76,60,.15)",color:s.lat&&s.lng?"var(--g)":"var(--rd)",border:"1px solid "+(s.lat&&s.lng?"rgba(46,204,113,.3)":"rgba(231,76,60,.3)")}}>{s.lat&&s.lng?"🎯 GPS":"❌ No GPS"}</div>
                </div>
                {att?<div style={{background:"rgba(46,204,113,.1)",border:"1px solid rgba(46,204,113,.25)",borderRadius:8,padding:"8px 12px",fontSize:13}}>
                  <span style={{color:"var(--g)",fontWeight:600}}>✅ In: {att.clock_in}</span>
                  {att.clock_out&&<span style={{color:"var(--txd)",marginLeft:12}}>→ Out: {att.clock_out}</span>}
                  {att.dist&&<span style={{color:"var(--txd)",fontSize:11,marginLeft:12}}>📏 {att.dist}m</span>}
                </div>:<div style={{background:"rgba(240,165,0,.1)",border:"1px solid rgba(240,165,0,.25)",borderRadius:8,padding:"8px 12px",fontSize:13,display:"flex",alignItems:"center",gap:8}}>
                  <I n="alert" s={13} c="var(--or)"/>
                  <span style={{color:"var(--or)"}}>Not clocked in</span>
                  <button onClick={()=>setPage&&setPage("clock-in")} style={{marginLeft:"auto",background:"var(--g)",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>Clock In →</button>
                </div>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <div className="ch"><I n="ok" s={16} c="var(--g)"/><div className="ct">This Week</div></div>
        <div className="cb">
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
            {last7.map(function(d){
              var att=myAtt.find(function(a){return a.date===d;});
              var isToday=d===today;
              var day=new Date(d+"T00:00:00").toLocaleDateString("en-PK",{weekday:"short"}).slice(0,2);
              return(
                <div key={d} style={{textAlign:"center"}}>
                  <div style={{fontSize:10,color:"var(--txd)",marginBottom:4}}>{day}</div>
                  <div style={{width:34,height:34,borderRadius:8,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,background:att?"rgba(46,204,113,.2)":isToday?"rgba(58,155,213,.15)":"var(--d3)",border:"1px solid "+(att?"rgba(46,204,113,.4)":isToday?"rgba(58,155,213,.4)":"var(--bo)"),color:att?"var(--g)":isToday?"var(--bl)":"var(--txd)"}}>
                    {att?"✓":isToday?"·":"—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {isSup&&myBAs.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div className="ch"><I n="users" s={16} c="var(--bl)"/><div className="ct">My BA Team Today</div></div>
          <div className="cb">
            {myBAs.map(function(ba){
              var baAtt=(data.attendance||[]).find(function(a){return a.user_id===ba.id&&a.date===today;});
              var baActs=(data.activities||[]).filter(function(a){return a.ba_id===ba.id&&a.date===today;});
              return(
                <div key={ba.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--bo)"}}>
                  <div className="av av-green" style={{width:40,height:40,fontSize:14,borderRadius:10}}>{getInitials(ba.name)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{ba.name}</div>
                    <div style={{fontSize:12,color:"var(--txd)"}}>{ba.phone}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <div style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:baAtt?"rgba(46,204,113,.15)":"rgba(231,76,60,.15)",color:baAtt?"var(--g)":"var(--rd)",border:"1px solid "+(baAtt?"rgba(46,204,113,.3)":"rgba(231,76,60,.3)")}}>{baAtt?"✅ In "+baAtt.clock_in:"❌ Not In"}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{baActs.length} report{baActs.length!==1?"s":""} today</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="card" style={{marginBottom:14}}>
        <div className="ch"><I n="dash" s={16} c="var(--g)"/><div className="ct">Quick Actions</div></div>
        <div className="cb">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button onClick={()=>setPage&&setPage("clock-in")} style={{background:"rgba(46,204,113,.1)",border:"1px solid rgba(46,204,113,.3)",borderRadius:12,padding:"14px 10px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>⏰</div><div style={{fontSize:13,fontWeight:600,color:"var(--g)"}}>Clock In/Out</div>
            </button>
            <button onClick={()=>setPage&&setPage(isSup?"activity":"my-activity")} style={{background:"rgba(58,155,213,.1)",border:"1px solid rgba(58,155,213,.3)",borderRadius:12,padding:"14px 10px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>📋</div><div style={{fontSize:13,fontWeight:600,color:"var(--bl)"}}>Activity Report</div>
            </button>
            <button onClick={()=>setPage&&setPage("my-salary")} style={{background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.3)",borderRadius:12,padding:"14px 10px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>💰</div><div style={{fontSize:13,fontWeight:600,color:"var(--gold)"}}>My Salary</div>
            </button>
            <button onClick={()=>setPage&&setPage("attend")} style={{background:"rgba(155,89,182,.1)",border:"1px solid rgba(155,89,182,.3)",borderRadius:12,padding:"14px 10px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>📅</div><div style={{fontSize:13,fontWeight:600,color:"#9b59b6"}}>Attendance</div>
            </button>
          </div>
        </div>
      </div>
      {myActs.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div className="ch"><I n="map" s={16} c="var(--g)"/><div className="ct">Recent Activities</div></div>
          <div className="cb">
            {myActs.slice(0,5).map(function(a){
              return(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--bo)"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{a.store_name}, {a.city}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{a.brand} · {a.date} · {a.type}</div>
                  </div>
                  <div style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:a.approval_status==="approved"?"rgba(46,204,113,.15)":a.approval_status==="rejected"?"rgba(231,76,60,.15)":"rgba(240,165,0,.15)",color:a.approval_status==="approved"?"var(--g)":a.approval_status==="rejected"?"var(--rd)":"var(--or)",border:"1px solid "+(a.approval_status==="approved"?"rgba(46,204,113,.3)":a.approval_status==="rejected"?"rgba(231,76,60,.3)":"rgba(240,165,0,.3)")}}>
                    {a.approval_status==="approved"?"✅":a.approval_status==="rejected"?"❌":"⏳"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  const [hof,setHof]=useState({supervisor_id:"",stall_id:"",activity_id:"",amount_given:"",date_given:new Date().toISOString().slice(0,10),notes:""});

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

  const supervisors=(data.users||[]).filter(u=>u.role==="supervisor");
  const nonAdmin=(data.users||[]).filter(u=>u.role!=="admin");

  // TOTALS
  const clientPaidSalary=(data.salary||[]).filter(s=>{const alloc=(data.allocations||[]).find(a=>a.user_id===s.user_id&&a.active);return alloc?.paid_by==="client"||alloc?.paid_by==="both";}).reduce((s,x)=>s+Number(x.total||0),0);
  const adminPaidSalary=(data.salary||[]).filter(s=>{const alloc=(data.allocations||[]).find(a=>a.user_id===s.user_id&&a.active);return !alloc||alloc?.paid_by==="admin"||alloc?.paid_by==="both";}).reduce((s,x)=>s+Number(x.total||0),0);
  const totalReceived=(data.client_payments||[]).filter(p=>p.status==="received").reduce((s,p)=>s+Number(p.amount),0);
  const totalPending=(data.client_payments||[]).filter(p=>p.status==="pending").reduce((s,p)=>s+Number(p.amount),0);
  const totalGiven=(data.handovers||[]).reduce((s,h)=>s+Number(h.amount_given),0);
  const totalReturned=(data.handovers||[]).reduce((s,h)=>s+Number(h.amount_returned||0),0);
  const totalExpenses=(data.expenses||[]).reduce((s,e)=>s+Number(e.amount),0);
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
    const sup=(data.users||[]).find(u=>u.id===hof.supervisor_id);
    const stall=(data.stalls||[]).find(s=>s.id===hof.stall_id);
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
    const d={...data,handovers:(data.handovers||[]).map(h=>h.id===rbHo.id?{...h,amount_returned:Number(rbAmount),date_returned:new Date().toISOString().slice(0,10)}:h)};
    setData(d);save(d);setShowRB(false);setRbHo(null);toast("Balance return recorded!");
  };

  const openRB=(ho)=>{setRbHo(ho);setRbAmount("");setShowRB(true);};

  const getStallName=(id)=>{const s=(data.stalls||[]).find(x=>x.id===id);return s?s.name:"—";};
  const getUserName=(id)=>{const u=(data.users||[]).find(x=>x.id===id);return u?u.name:"—";};

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
              {(data.client_payments||[]).length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No payments yet.</div>}
              {(data.client_payments||[]).slice(-5).reverse().map(p=>(
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
                const given=(data.handovers||[]).filter(h=>h.supervisor_id===sup.id).reduce((s,h)=>s+Number(h.amount_given),0);
                const returned=(data.handovers||[]).filter(h=>h.supervisor_id===sup.id).reduce((s,h)=>s+Number(h.amount_returned||0),0);
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
                  {(data.client_payments||[]).length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:"var(--txd)",padding:30}}>No client payments recorded yet.</td></tr>}
                  {(data.client_payments||[]).map(p=>(
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
              {(data.handovers||[]).length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No handovers yet.</div>}
              {(data.handovers||[]).map(h=>{
                const sup=(data.users||[]).find(u=>u.id===h.supervisor_id);
                const stall=(data.stalls||[]).find(s=>s.id===h.stall_id);
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
                  {(data.expenses||[]).length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:"var(--txd)",padding:30}}>No expenses recorded yet.</td></tr>}
                  {(data.expenses||[]).map(e=>(
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
                  {(data.stalls||[]).map(s=><option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
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
                  {(data.stalls||[]).map(s=><option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
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
                    {(data.stalls||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
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
  <div><div style="display:flex;align-items:center;gap:12px"><img src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg" style="width:55px;height:55px;border-radius:6px;object-fit:cover"/><div class="co-name">SHINKORE MARKETING</div></div><div class="co-sub">CEO: Khalid Orakzai</div><div class="co-sub">Civil Officer Col Office 28 | 03135443656 | 0992414034</div><div class="co-sub">www.appabbottabad.com</div></div>
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
  <div><div style="display:flex;align-items:center;gap:12px"><img src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg" style="width:55px;height:55px;border-radius:6px;object-fit:cover"/><div class="co-name">SHINKORE MARKETING</div></div><div class="co-sub">CEO: Khalid Orakzai | Civil Officer Col Office 28</div><div class="co-sub">03135443656 | 0992414034 | www.appabbottabad.com</div></div>
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
<div class="footer">Shinkore Marketing | CEO: Khalid Orakzai | Civil Officer Col Office 28 | 03135443656 | www.appabbottabad.com</div>
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
  const calcSalary=(days,rate,bonus,deductions)=>{
    return(Number(days)||0)*(Number(rate)||0)+(Number(bonus)||0)-(Number(deductions)||0);
  };
  const getApprovedDays=(userId,month)=>{
    const acts=(data.activities||[]).filter(a=>
      a.ba_id===userId&&
      a.approval_status==="approved"&&
      a.date&&a.date.startsWith(month)
    );
    return[...new Set(acts.map(a=>a.date))].length;
  };
  const [tab,setTab]=useState("salary");
  const [showAdd,setShowAdd]=useState(false);
  const [selUser,setSelUser]=useState("");
  const [f,setF]=useState({user_id:"",month:"",days_worked:"",daily_rate:"",bonus:"",deductions:"",notes:"",status:"pending"});
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));
  const today=new Date().toLocaleDateString("en-PK",{year:"numeric",month:"long",day:"numeric"});
  const nonAdmin=(data.users||[]).filter(u=>u.role!=="admin");

  const openAdd=(u)=>{
    const now=new Date();
    const mon=now.toLocaleDateString("en-PK",{month:"long",year:"numeric"});
    const att=(data.attendance||[]).filter(a=>a.user_id===u.id);
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
      const u=(data.users||[]).find(x=>x.id===rec.user_id);
      if(u) sendWA(u.phone,`*Shinkore Marketing — Salary Paid* ✅\n\nDear ${u.name},\n\nAap ki ${rec.month} ki salary *${formatPKR(rec.total)}* receive ho gayi hai.\n\nDin: ${rec.days_worked} · Rate: ${formatPKR(rec.daily_rate)}/din\n\nShukriya! — Khalid Orakzai`);
    }
    toast(ns==="paid"?"Marked paid — WhatsApp sent!":"Marked pending.");
  };

  const doSlip=(rec)=>{
    const u=(data.users||[]).find(x=>x.id===rec.user_id);
    if(!u) return;
    const html=generateSlipHTML(u,rec,data.stalls,data.allocations);
    openPrint(html);
  };

  const shareSlipWA=(rec)=>{
    const u=(data.users||[]).find(x=>x.id===rec.user_id);
    if(!u) return;
    const msg=`*SHINKORE MARKETING — Salary Slip*\n\n👤 Name: ${u.name}\n🏷️ Role: ${u.role==="ba"?"Business Ambassador":"Supervisor"}\n📅 Month: ${rec.month}\n📆 Days Worked: ${rec.days_worked}\n💵 Rate/Day: ${formatPKR(rec.daily_rate)}\n${rec.bonus?`🎁 Bonus: ${formatPKR(rec.bonus)}\n`:""}${rec.deductions?`➖ Deductions: ${formatPKR(rec.deductions)}\n`:""}\n💰 *Net Salary: ${formatPKR(rec.total)}*\nStatus: ${rec.status==="paid"?"✅ PAID":"⏳ PENDING"}\n\n— Shinkore Marketing`;
    sendWA(u.phone,msg);
  };

  const doBill=(stall)=>{
    const payments=(data.client_payments||[]).filter(p=>p.stall_id===stall.id);
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
                  const att=(data.attendance||[]).filter(a=>a.user_id===u.id);
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
                const u=(data.users||[]).find(x=>x.id===rec.user_id);
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
            {(data.stalls||[]).length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No stalls added yet.</div>}
            {(data.stalls||[]).map(stall=>{
              const payments=(data.client_payments||[]).filter(p=>p.stall_id===stall.id);
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
                <select className="fsel" value={f.user_id} onChange={e=>{sf("user_id",e.target.value);const u=(data.users||[]).find(x=>x.id===e.target.value);if(u)sf("daily_rate",u.daily_rate);}}>
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


// ─── PERSONAL FINANCE PAGE ───────────────────────────────────────────────────
function PersonalPage({data,setData,toast}){
  const [tab,setTab]=useState("overview");
  const [show,setShow]=useState(false);
  const [f,setF]=useState({type:"expense",category:"fuel",amount:"",date:new Date().toISOString().slice(0,10),person_name:"",description:"",status:"paid",notes:""});
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));
  const personal=data.personal||[];

  const totalFuel=personal.filter(x=>x.category==="fuel").reduce((s,x)=>s+Number(x.amount),0);
  const totalMaint=personal.filter(x=>x.category==="maintenance").reduce((s,x)=>s+Number(x.amount),0);
  const loansGiven=personal.filter(x=>x.type==="loan_given"&&x.status==="pending").reduce((s,x)=>s+Number(x.amount),0);
  const loansReceived=personal.filter(x=>x.type==="loan_received"&&x.status==="pending").reduce((s,x)=>s+Number(x.amount),0);
  const netLoans=loansGiven-loansReceived;

  const doSave=()=>{
    if(!f.amount) return toast("Enter amount.");
    const d={...data,personal:[...(data.personal||[]),{id:genId(),...f,amount:Number(f.amount)}]};
    setData(d);save(d);setShow(false);toast("Saved!");
  };

  const markPaid=(item)=>{
    const d={...data,personal:(data.personal||[]).map(x=>x.id===item.id?{...x,status:"paid"}:x)};
    setData(d);save(d);toast("Marked as paid!");
  };

  return(
    <div>
      <div className="sg">
        <div className="sc rd"><div className="si rd"><I n="money" s={17}/></div><div className="sv" style={{fontSize:18}}>{formatPKR(totalFuel)}</div><div className="sl">Fuel Total</div></div>
        <div className="sc bl"><div className="si bl"><I n="set" s={17}/></div><div className="sv" style={{fontSize:18}}>{formatPKR(totalMaint)}</div><div className="sl">Maintenance</div></div>
        <div className="sc gold"><div className="si gold"><I n="money" s={17}/></div><div className="sv" style={{fontSize:18}}>{formatPKR(loansGiven)}</div><div className="sl">Loans Given</div></div>
        <div className="sc gr"><div className="si gr"><I n="money" s={17}/></div><div className="sv" style={{fontSize:18,color:netLoans>=0?"var(--gr)":"var(--rd)"}}>{formatPKR(Math.abs(netLoans))}</div><div className="sl">{netLoans>=0?"Net: Owed to You":"Net: You Owe"}</div></div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {["overview","car","loans"].map(t=>(
          <button key={t} className={tab===t?"bg":"bs"} onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t==="overview"?"Overview":t==="car"?"Car & Fuel":"Loans"}</button>
        ))}
        <button className="bg" onClick={()=>setShow(true)} style={{marginLeft:"auto"}}><I n="plus" s={15}/>Add Record</button>
      </div>

      {tab==="overview"&&(
        <div className="card">
          <div className="ch"><I n="money" s={17} c="var(--g)"/><div className="ct">Recent Records</div></div>
          <div className="cb">
            {personal.length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No records yet.</div>}
            {personal.slice().reverse().slice(0,10).map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{item.description||item.category}</div>
                  <div style={{fontSize:11,color:"var(--txd)"}}>{item.type==="loan_given"?"Loan Given":item.type==="loan_received"?"Loan Received":item.category} · {item.date}</div>
                  {item.person_name&&<div style={{fontSize:11,color:"var(--bl)"}}>{item.person_name}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"Rajdhani",fontSize:16,color:item.type==="loan_received"?"var(--gr)":"var(--rd)"}}>{formatPKR(item.amount)}</div>
                  <span className={item.status==="paid"?"b b-active":"b b-pending"}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="car"&&(
        <div className="card">
          <div className="ch"><I n="set" s={17} c="var(--g)"/><div className="ct">Car Expenses</div></div>
          <div className="cb">
            {personal.filter(x=>["fuel","maintenance","other_car"].includes(x.category)).length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No car expenses yet.</div>}
            {personal.filter(x=>["fuel","maintenance","other_car"].includes(x.category)).map(item=>(
              <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,textTransform:"capitalize"}}>{item.category}</div>
                  <div style={{fontSize:11,color:"var(--txd)"}}>{item.description||""} · {item.date}</div>
                </div>
                <div style={{fontFamily:"Rajdhani",fontSize:16,color:"var(--rd)"}}>{formatPKR(item.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="loans"&&(
        <div>
          <div className="card" style={{marginBottom:14}}>
            <div className="ch"><I n="money" s={17} c="var(--or)"/><div><div className="ct">Loans Given</div><div className="cs">Money you gave to others</div></div></div>
            <div className="cb">
              {personal.filter(x=>x.type==="loan_given").length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No loans given.</div>}
              {personal.filter(x=>x.type==="loan_given").map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{item.person_name||"Unknown"}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{item.description||""} · {item.date}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"Rajdhani",fontSize:16,color:"var(--or)"}}>{formatPKR(item.amount)}</div>
                    <span className={item.status==="paid"?"b b-active":"b b-pending"}>{item.status}</span>
                  </div>
                  {item.status==="pending"&&<button className="bg" onClick={()=>markPaid(item)} style={{fontSize:11,padding:"5px 10px"}}><I n="ok" s={12}/>Paid</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="ch"><I n="money" s={17} c="var(--gr)"/><div><div className="ct">Loans Received</div><div className="cs">Money others gave you</div></div></div>
            <div className="cb">
              {personal.filter(x=>x.type==="loan_received").length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No loans received.</div>}
              {personal.filter(x=>x.type==="loan_received").map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{item.person_name||"Unknown"}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{item.description||""} · {item.date}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"Rajdhani",fontSize:16,color:"var(--gr)"}}>{formatPKR(item.amount)}</div>
                    <span className={item.status==="paid"?"b b-active":"b b-pending"}>{item.status}</span>
                  </div>
                  {item.status==="pending"&&<button className="bg" onClick={()=>markPaid(item)} style={{fontSize:11,padding:"5px 10px"}}><I n="ok" s={12}/>Paid</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Add Personal Record</div><div className="mc" onClick={()=>setShow(false)}>x</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Type</label>
                <select className="fsel" value={f.type} onChange={e=>sf("type",e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="loan_given">Loan Given</option>
                  <option value="loan_received">Loan Received</option>
                </select>
              </div>
              {f.type==="expense"&&<div className="fg"><label className="fl">Category</label>
                <select className="fsel" value={f.category} onChange={e=>sf("category",e.target.value)}>
                  <option value="fuel">Fuel</option>
                  <option value="maintenance">Car Maintenance</option>
                  <option value="other_car">Other Car</option>
                  <option value="personal">Personal</option>
                </select>
              </div>}
              {(f.type==="loan_given"||f.type==="loan_received")&&<div className="fg"><label className="fl">Person Name</label><input className="fi" value={f.person_name} onChange={e=>sf("person_name",e.target.value)} placeholder="Name of person"/></div>}
              <div className="frow">
                <div className="fg"><label className="fl">Amount (PKR)</label><input className="fi" type="number" value={f.amount} onChange={e=>sf("amount",e.target.value)}/></div>
                <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={f.date} onChange={e=>sf("date",e.target.value)}/></div>
              </div>
              <div className="fg"><label className="fl">Description</label><input className="fi" value={f.description} onChange={e=>sf("description",e.target.value)} placeholder="Details"/></div>
              <div className="fg"><label className="fl">Status</label>
                <select className="fsel" value={f.status} onChange={e=>sf("status",e.target.value)}>
                  <option value="paid">Paid / Done</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="ma"><button className="bs" onClick={()=>setShow(false)}>Cancel</button><button className="bg" onClick={doSave}><I n="ok" s={15}/>Save</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ACTIVITY REPORTS ─────────────────────────────────────────────────────────
function ActivityPage({user,data,setData,toast}){
  const isAdmin=user.role==="admin";
  const isSup=user.role==="supervisor";
  const isBA=user.role==="ba";
  const [view,setView]=useState("list");
  const [editing,setEditing]=useState(null);
  const [filter,setFilter]=useState({ba:"",city:"",brand:"",date:"",status:""});
  const calcHours=(pi,po,bs,be)=>{if(!pi||!po)return"—";const toMin=(t)=>{const[h,m]=t.split(":").map(Number);return h*60+m;};let w=toMin(po)-toMin(pi);if(bs&&be)w-=(toMin(be)-toMin(bs));if(w<0)return"—";return Math.floor(w/60)+"h "+(w%60)+"m";};
  const catColor=(cat)=>cat==="high"?"var(--rd)":cat==="medium"?"var(--or)":"var(--gr)";
  const catBg=(cat)=>cat==="high"?"rgba(231,76,60,.12)":cat==="medium"?"rgba(240,165,0,.12)":"rgba(46,204,113,.12)";
  const addItem=(field)=>setForm(p=>({...p,[field]:[...p[field],{id:genId(),name:"",qty:"",size:""}]}));
  const updateItem=(field,id,key,val)=>setForm(p=>({...p,[field]:p[field].map(x=>x.id===id?{...x,[key]:val}:x)}));
  const removeItem=(field,id)=>setForm(p=>({...p,[field]:p[field].filter(x=>x.id!==id)}));
  const emptyAct={id:"",type:"productive",location_type:"instore",activity_title:"",ba_gender:"male",city:"",store_name:"",brand:"",ba_id:isBA?user.id:"",supervisor_id:isSup?user.id:"",date:new Date().toISOString().slice(0,10),punch_in:"",punch_out:"",break_start:"",break_end:"",gift_items:[],usership:[],total_interceptions:"",total_productive:"",sales_items:[],total_kg:"",total_pcs:"",sampling_items:[],stock_received:[],stock_used:[],stock_returned:"",ba_remark:"",ba_remark_cat:"low",ba_remark_status:"pending",sup_remark:"",sup_remark_cat:"low",sup_remark_status:"pending",admin_note:"",admin_status:"pending",approval_status:"draft",photos:[],created_by:user.id};
  const [form,setForm]=useState(emptyAct);
  const sf=(k,v)=>setForm(p=>({...p,[k]:v}));
  const bas=(data.users||[]).filter(u=>u.role==="ba");
  const sups=(data.users||[]).filter(u=>u.role==="supervisor");
  const doSave=()=>{
    if(!form.city||!form.store_name||!form.brand)return toast("City, store and brand required.");
    if(!form.ba_id)return toast("Select BA.");
    const rec={...form,id:form.id||genId()};
    const d={...data};
    if(editing)d.activities=d.activities.map(a=>a.id===rec.id?rec:a);
    else d.activities=[...(d.activities||[]),rec];
    if(rec.ba_remark_cat==="high"||rec.sup_remark_cat==="high"){
      const ba=(data.users||[]).find(u=>u.id===rec.ba_id);
      const msg="HIGH PRIORITY REMARK - SHINKORE\nBA: "+(ba?.name||"")+"\nStore: "+rec.store_name+", "+rec.city+"\nBrand: "+rec.brand+"\nRemark: "+(rec.ba_remark||rec.sup_remark);
      ADMIN_PHONES.forEach(ph=>sendWA(ph,msg));
    }
    setData(d);save(d);setView("list");setEditing(null);toast(editing?"Updated!":"Activity saved!");
  };
  const openEdit=(act)=>{setForm({...emptyAct,...act});setEditing(act);setView("form");};
  const openNew=()=>{setForm({...emptyAct,ba_id:isBA?user.id:"",supervisor_id:isSup?user.id:""});setEditing(null);setView("form");};
  const printActivity=(act)=>{
    const ba=(data.users||[]).find(u=>u.id===act.ba_id);
    const sup=(data.users||[]).find(u=>u.id===act.supervisor_id);
    const hrs=calcHours(act.punch_in,act.punch_out,act.break_start,act.break_end);
    const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;padding:30px;max-width:720px;margin:0 auto}.co{font-size:24px;font-weight:700;color:#C9A84C}.sec{margin:16px 0}.st{font-size:15px;font-weight:700;background:#f5f0e8;padding:8px 12px;border-left:4px solid #C9A84C;margin-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kv{padding:6px 0;border-bottom:1px solid #f0e8d0}.k{font-size:11px;color:#888;text-transform:uppercase}.v{font-size:14px;font-weight:600}table{width:100%;border-collapse:collapse}th{background:#C9A84C;color:#fff;padding:8px;font-size:12px}td{padding:8px;border-bottom:1px solid #f0e8d0}.high{color:#c0392b}.medium{color:#b87800}.low{color:#1a8a4a}</style></head><body>'
    +'<div class="co">SHINKORE MARKETING</div><div style="font-size:11px;color:#888">CEO: Khalid Orakzai | 03135443656 | www.appabbottabad.com</div><hr style="border-color:#C9A84C;margin:12px 0">'
    +'<div style="display:flex;justify-content:space-between"><div><strong>ACTIVITY REPORT</strong></div><div>'+act.date+'</div></div>'
    +'<div class="sec"><div class="st">Activity Details</div><div class="grid">'
    +'<div class="kv"><div class="k">Type</div><div class="v">'+act.type+'</div></div>'
    +'<div class="kv"><div class="k">Location</div><div class="v">'+act.location_type+'</div></div>'
    +'<div class="kv"><div class="k">City</div><div class="v">'+act.city+'</div></div>'
    +'<div class="kv"><div class="k">Store</div><div class="v">'+act.store_name+'</div></div>'
    +'<div class="kv"><div class="k">Brand</div><div class="v">'+act.brand+'</div></div>'
    +'<div class="kv"><div class="k">BA</div><div class="v">'+(ba?.name||"—")+'</div></div>'
    +'<div class="kv"><div class="k">Supervisor</div><div class="v">'+(sup?.name||"—")+'</div></div>'
    +'<div class="kv"><div class="k">Hours</div><div class="v">'+hrs+'</div></div>'
    +'</div></div>'
    +(act.type==="productive"?'<div class="sec"><div class="st">Productive Data</div><div class="grid"><div class="kv"><div class="k">Interceptions</div><div class="v">'+(act.total_interceptions||0)+'</div></div><div class="kv"><div class="k">Buyers</div><div class="v">'+(act.total_productive||0)+'</div></div><div class="kv"><div class="k">Total KG</div><div class="v">'+(act.total_kg||0)+' kg</div></div><div class="kv"><div class="k">Total PCs</div><div class="v">'+(act.total_pcs||0)+' pcs</div></div></div>'
    +((act.sales_items||[]).length?'<table style="margin-top:8px"><thead><tr><th>Product</th><th>Size</th><th>Qty</th></tr></thead><tbody>'+(act.sales_items||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+(x.size||"")+'</td><td>'+x.qty+'</td></tr>').join('')+'</tbody></table>':'')
    +'</div>':'')
    +(act.type==="gifting"&&(act.gift_items||[]).length?'<div class="sec"><div class="st">Gift Items</div><table><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody>'+(act.gift_items||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+x.qty+'</td></tr>').join('')+'<tr><td><strong>Total</strong></td><td><strong>'+(act.gift_items||[]).reduce((s,x)=>s+Number(x.qty||0),0)+'</strong></td></tr></tbody></table></div>':"")
    +(act.type==="sampling"&&(act.sampling_items||[]).length?'<div class="sec"><div class="st">Sampling</div><table><thead><tr><th>Product</th><th>Qty</th></tr></thead><tbody>'+(act.sampling_items||[]).map(x=>'<tr><td>'+x.name+'</td><td>'+x.qty+'</td></tr>').join('')+'</tbody></table></div>':"")
    +(act.ba_remark?'<div class="sec"><div class="st">Remarks</div><div style="padding:8px;background:#f9f9f9;border-radius:6px"><div class="k">BA: <span class="'+act.ba_remark_cat+'">'+act.ba_remark_cat.toUpperCase()+'</span></div><div>'+act.ba_remark+'</div></div></div>':"")
    +(act.sup_remark?'<div style="padding:8px;background:#f9f9f9;border-radius:6px;margin-top:6px"><div class="k">SUP: <span class="'+act.sup_remark_cat+'">'+act.sup_remark_cat.toUpperCase()+'</span></div><div>'+act.sup_remark+'</div></div>':"")
    +'<div style="display:flex;justify-content:space-between;margin-top:40px"><div style="border-top:1px solid #999;width:160px;padding-top:6px;text-align:center;font-size:12px">BA: '+(ba?.name||"")+'</div><div style="border-top:1px solid #999;width:160px;padding-top:6px;text-align:center;font-size:12px">Supervisor: '+(sup?.name||"")+'</div><div style="border-top:1px solid #999;width:160px;padding-top:6px;text-align:center;font-size:12px">Admin: Khalid Orakzai</div></div>'
    +'</body></html>';
    openPrint(html);
  };
  let acts=(data.activities||[]).slice().reverse();
  if(isBA)acts=acts.filter(a=>a.ba_id===user.id);
  if(isSup)acts=acts.filter(a=>a.supervisor_id===user.id);
  if(filter.ba)acts=acts.filter(a=>a.ba_id===filter.ba);
  if(filter.city)acts=acts.filter(a=>a.city.toLowerCase().includes(filter.city.toLowerCase()));
  if(filter.brand)acts=acts.filter(a=>a.brand.toLowerCase().includes(filter.brand.toLowerCase()));
  if(filter.date)acts=acts.filter(a=>a.date===filter.date);
  if(filter.status)acts=acts.filter(a=>a.ba_remark_status===filter.status||a.sup_remark_status===filter.status);
  const highRemarks=acts.filter(a=>a.ba_remark_cat==="high"||a.sup_remark_cat==="high").length;

  if(view==="form")return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="bs" onClick={()=>{setView("list");setEditing(null);}}><I n="back" s={16}/>Back</button>
        <div style={{fontFamily:"Rajdhani",fontSize:20,fontWeight:700}}>{editing?"Edit Activity":"New Activity Report"}</div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="map" s={16} c="var(--g)"/><div className="ct">Activity Info</div></div>
        <div className="cb">
          <div className="fg"><label className="fl">Activity Title</label><input className="fi" value={form.activity_title} onChange={e=>sf("activity_title",e.target.value)} placeholder="e.g. Brite In-store Activity – Male BA Gifting"/></div>
          <div className="frow">
            <div className="fg"><label className="fl">Activity Type</label>
              <select className="fsel" value={form.type} onChange={e=>sf("type",e.target.value)}>
                <option value="productive">Productive</option>
                <option value="gifting">Gifting</option>
                <option value="sampling">Free Sampling</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Location Type</label>
              <select className="fsel" value={form.location_type} onChange={e=>sf("location_type",e.target.value)}>
                <option value="instore">In-Store</option>
                <option value="doortodoor">Door to Door</option>
                <option value="stall">Stall</option>
              </select>
            </div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">BA Gender</label><select className="fsel" value={form.ba_gender} onChange={e=>sf("ba_gender",e.target.value)}><option value="male">Male BA</option><option value="female">Female BA</option></select></div>
            <div className="fg"><label className="fl">Brand</label><input className="fi" value={form.brand} onChange={e=>sf("brand",e.target.value)} placeholder="e.g. Brite"/></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">City</label><input className="fi" value={form.city} onChange={e=>sf("city",e.target.value)} placeholder="e.g. Abbottabad"/></div>
            <div className="fg"><label className="fl">Store / Location</label><input className="fi" value={form.store_name} onChange={e=>sf("store_name",e.target.value)} placeholder="e.g. Gilani Mart"/></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={form.date} onChange={e=>sf("date",e.target.value)}/></div>
          </div>
          {(isAdmin||isSup)&&<div className="frow">
            <div className="fg"><label className="fl">Business Ambassador</label>
              <select className="fsel" value={form.ba_id} onChange={e=>sf("ba_id",e.target.value)}>
                <option value="">-- Select BA --</option>
                {bas.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Supervisor</label>
              <select className="fsel" value={form.supervisor_id} onChange={e=>sf("supervisor_id",e.target.value)}>
                <option value="">-- Select --</option>
                {sups.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>}
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="clock" s={16} c="var(--g)"/><div className="ct">Timing</div></div>
        <div className="cb">
          <div className="frow">
            <div className="fg"><label className="fl">Store In Time</label><input className="fi" type="time" value={form.punch_in} onChange={e=>sf("punch_in",e.target.value)}/></div>
            <div className="fg"><label className="fl">Store Out Time</label><input className="fi" type="time" value={form.punch_out} onChange={e=>sf("punch_out",e.target.value)}/></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">Break Start</label><input className="fi" type="time" value={form.break_start} onChange={e=>sf("break_start",e.target.value)}/></div>
            <div className="fg"><label className="fl">Break End</label><input className="fi" type="time" value={form.break_end} onChange={e=>sf("break_end",e.target.value)}/></div>
          </div>
          {form.punch_in&&form.punch_out&&<div style={{background:"var(--gd)",borderRadius:9,padding:"10px 14px",fontSize:13}}>Total Hours: <strong style={{color:"var(--g)"}}>{calcHours(form.punch_in,form.punch_out,form.break_start,form.break_end)}</strong></div>}
        </div>
      </div>
      {form.type==="gifting"&&<div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="plus" s={16} c="var(--g)"/><div style={{flex:1}}><div className="ct">Gift Items</div></div><button className="bg" onClick={()=>addItem("gift_items")} style={{fontSize:12}}><I n="plus" s={13}/>Add</button></div>
        <div className="cb">
          {form.gift_items.map(item=>(<div key={item.id} style={{display:"flex",gap:8,marginBottom:8}}><input className="fi" placeholder="Item name" value={item.name} onChange={e=>updateItem("gift_items",item.id,"name",e.target.value)} style={{flex:2}}/><input className="fi" placeholder="Qty" type="number" value={item.qty} onChange={e=>updateItem("gift_items",item.id,"qty",e.target.value)} style={{flex:1}}/><button className="brd" onClick={()=>removeItem("gift_items",item.id)}><I n="del" s={13}/></button></div>))}
          {form.gift_items.length>0&&<div style={{textAlign:"right",fontSize:13,color:"var(--g)",fontWeight:600}}>Total: {form.gift_items.reduce((s,x)=>s+Number(x.qty||0),0)}</div>}
        </div>
      </div>}
      {form.type==="productive"&&<div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="dash" s={16} c="var(--g)"/><div className="ct">Productive Data</div></div>
        <div className="cb">
          <div className="frow">
            <div className="fg"><label className="fl">Total Interceptions</label><input className="fi" type="number" value={form.total_interceptions} onChange={e=>sf("total_interceptions",e.target.value)}/></div>
            <div className="fg"><label className="fl">Productive Buyers</label><input className="fi" type="number" value={form.total_productive} onChange={e=>sf("total_productive",e.target.value)}/></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">Total KG</label><input className="fi" type="number" value={form.total_kg} onChange={e=>sf("total_kg",e.target.value)}/></div>
            <div className="fg"><label className="fl">Total PCs</label><input className="fi" type="number" value={form.total_pcs} onChange={e=>sf("total_pcs",e.target.value)}/></div>
          </div>
          <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:12,color:"var(--txd)"}}>Usership</div><button className="bg" onClick={()=>addItem("usership")} style={{fontSize:11,padding:"4px 10px"}}><I n="plus" s={12}/>Add</button></div>
          {form.usership.map(item=>(<div key={item.id} style={{display:"flex",gap:8,marginBottom:6}}><input className="fi" placeholder="Brand" value={item.name} onChange={e=>updateItem("usership",item.id,"name",e.target.value)} style={{flex:2}}/><input className="fi" placeholder="Count" type="number" value={item.qty} onChange={e=>updateItem("usership",item.id,"qty",e.target.value)} style={{flex:1}}/><button className="brd" onClick={()=>removeItem("usership",item.id)}><I n="del" s={12}/></button></div>))}
          <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:12,color:"var(--txd)"}}>Sales SKU</div><button className="bg" onClick={()=>addItem("sales_items")} style={{fontSize:11,padding:"4px 10px"}}><I n="plus" s={12}/>Add</button></div>
          {form.sales_items.map(item=>(<div key={item.id} style={{display:"flex",gap:8,marginBottom:6}}><input className="fi" placeholder="Product" value={item.name} onChange={e=>updateItem("sales_items",item.id,"name",e.target.value)} style={{flex:2}}/><input className="fi" placeholder="Size" value={item.size} onChange={e=>updateItem("sales_items",item.id,"size",e.target.value)} style={{flex:1}}/><input className="fi" placeholder="Qty" type="number" value={item.qty} onChange={e=>updateItem("sales_items",item.id,"qty",e.target.value)} style={{flex:1}}/><button className="brd" onClick={()=>removeItem("sales_items",item.id)}><I n="del" s={12}/></button></div>))}
        </div>
      </div>}
      {form.type==="sampling"&&<div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="plus" s={16} c="var(--g)"/><div style={{flex:1}}><div className="ct">Sampling Items</div></div><button className="bg" onClick={()=>addItem("sampling_items")} style={{fontSize:12}}><I n="plus" s={13}/>Add</button></div>
        <div className="cb">
          {form.sampling_items.map(item=>(<div key={item.id} style={{display:"flex",gap:8,marginBottom:6}}><input className="fi" placeholder="Product" value={item.name} onChange={e=>updateItem("sampling_items",item.id,"name",e.target.value)} style={{flex:2}}/><input className="fi" placeholder="Qty" type="number" value={item.qty} onChange={e=>updateItem("sampling_items",item.id,"qty",e.target.value)} style={{flex:1}}/><button className="brd" onClick={()=>removeItem("sampling_items",item.id)}><I n="del" s={12}/></button></div>))}
          {form.sampling_items.length>0&&<div style={{textAlign:"right",fontSize:13,color:"var(--g)",fontWeight:600}}>Total: {form.sampling_items.reduce((s,x)=>s+Number(x.qty||0),0)}</div>}
        </div>
      </div>}
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="users" s={16} c="var(--g)"/><div className="ct">Stock / Material</div></div>
        <div className="cb">
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div style={{fontSize:12,color:"var(--txd)"}}>Items Received</div><button className="bg" onClick={()=>addItem("stock_received")} style={{fontSize:11,padding:"4px 10px"}}><I n="plus" s={12}/>Add</button></div>
          {form.stock_received.map(item=>(<div key={item.id} style={{display:"flex",gap:8,marginBottom:6}}><input className="fi" placeholder="Item" value={item.name} onChange={e=>updateItem("stock_received",item.id,"name",e.target.value)} style={{flex:2}}/><input className="fi" placeholder="Qty" type="number" value={item.qty} onChange={e=>updateItem("stock_received",item.id,"qty",e.target.value)} style={{flex:1}}/><button className="brd" onClick={()=>removeItem("stock_received",item.id)}><I n="del" s={12}/></button></div>))}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,marginTop:10}}><div style={{fontSize:12,color:"var(--txd)"}}>Items Used</div><button className="bg" onClick={()=>addItem("stock_used")} style={{fontSize:11,padding:"4px 10px"}}><I n="plus" s={12}/>Add</button></div>
          {form.stock_used.map(item=>(<div key={item.id} style={{display:"flex",gap:8,marginBottom:6}}><input className="fi" placeholder="Item" value={item.name} onChange={e=>updateItem("stock_used",item.id,"name",e.target.value)} style={{flex:2}}/><input className="fi" placeholder="Qty" type="number" value={item.qty} onChange={e=>updateItem("stock_used",item.id,"qty",e.target.value)} style={{flex:1}}/><button className="brd" onClick={()=>removeItem("stock_used",item.id)}><I n="del" s={12}/></button></div>))}
          <div className="fg" style={{marginTop:8}}><label className="fl">Balance Returned</label><input className="fi" value={form.stock_returned} onChange={e=>sf("stock_returned",e.target.value)} placeholder="e.g. 5 bags returned"/></div>
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="pin" s={16} c="var(--bl)"/><div style={{flex:1}}><div className="ct">📸 Photos</div><div className="cs">Take photos as evidence</div></div></div>
        <div className="cb">
          <input type="file" accept="image/*" capture="environment" multiple style={{display:"none"}} id="photoInput" onChange={async(e)=>{const files=Array.from(e.target.files);toast("Uploading photos...");const uploaded=[];for(const file of files){const r=await uploadPhoto(file);if(r)uploaded.push({id:genId(),url:r.url,thumb:r.thumb});}if(uploaded.length>0){sf("photos",[...(form.photos||[]),...uploaded]);toast(uploaded.length+" photo(s) uploaded!");}else toast("Upload failed. Check internet.");e.target.value="";}}/>
          <button className="bg" onClick={()=>document.getElementById("photoInput").click()} style={{width:"100%",justifyContent:"center",marginBottom:12}}><I n="plus" s={15}/>Take / Upload Photos</button>
          {(form.photos||[]).length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{(form.photos||[]).map(p=>(<div key={p.id} style={{position:"relative"}}><img src={p.thumb||p.url} style={{width:70,height:70,borderRadius:8,objectFit:"cover"}}/><button onClick={()=>sf("photos",(form.photos||[]).filter(x=>x.id!==p.id))} style={{position:"absolute",top:-6,right:-6,background:"var(--rd)",border:"none",borderRadius:"50%",width:18,height:18,color:"#fff",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>))}</div>}
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="alert" s={16} c="var(--or)"/><div className="ct">Remarks</div></div>
        <div className="cb">
          {(isAdmin||isBA)&&<div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:8}}>BA Remarks</div>
            <div className="fg"><label className="fl">Remark</label><input className="fi" value={form.ba_remark} onChange={e=>sf("ba_remark",e.target.value)} placeholder="Enter remark..."/></div>
            <div className="frow">
              <div className="fg"><label className="fl">Priority</label><select className="fsel" value={form.ba_remark_cat} onChange={e=>sf("ba_remark_cat",e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="fg"><label className="fl">Status</label><select className="fsel" value={form.ba_remark_status} onChange={e=>sf("ba_remark_status",e.target.value)}><option value="pending">Pending</option><option value="solved">Solved</option></select></div>
            </div>
          </div>}
          {(isAdmin||isSup)&&<div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:"var(--bl)",fontWeight:600,marginBottom:8}}>Supervisor Remarks</div>
            <div className="fg"><label className="fl">Remark</label><input className="fi" value={form.sup_remark} onChange={e=>sf("sup_remark",e.target.value)} placeholder="Supervisor notes..."/></div>
            <div className="frow">
              <div className="fg"><label className="fl">Priority</label><select className="fsel" value={form.sup_remark_cat} onChange={e=>sf("sup_remark_cat",e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="fg"><label className="fl">Status</label><select className="fsel" value={form.sup_remark_status} onChange={e=>sf("sup_remark_status",e.target.value)}><option value="pending">Pending</option><option value="solved">Solved</option></select></div>
            </div>
          </div>}
          {isAdmin&&<div>
            <div style={{fontSize:12,color:"var(--rd)",fontWeight:600,marginBottom:8}}>Admin Follow-up</div>
            <div className="fg"><label className="fl">Admin Note</label><input className="fi" value={form.admin_note} onChange={e=>sf("admin_note",e.target.value)} placeholder="Admin notes..."/></div>
            <div className="fg"><label className="fl">Status</label><select className="fsel" value={form.admin_status} onChange={e=>sf("admin_status",e.target.value)}><option value="pending">Pending</option><option value="follow_required">Follow Required</option><option value="resolved">Resolved</option><option value="escalated">Escalated</option></select></div>
          </div>}
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:24}}>
        <button className="bs" onClick={()=>{setView("list");setEditing(null);}}>Cancel</button>
        <button className="bg" onClick={()=>{sf("approval_status",isBA?"submitted":"approved");doSave();}} style={{flex:1,justifyContent:"center"}}><I n="ok" s={16}/>{editing?"Update":isBA?"Submit Report":"Save & Approve"}</button>
      </div>
    </div>
  );

  return(
    <div>
      {highRemarks>0&&<div className="info info-err" style={{marginBottom:14}}><I n="alert" s={15}/><strong>{highRemarks} High Priority Remark{highRemarks>1?"s":""} need attention!</strong></div>}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <button className="bg" onClick={openNew}><I n="plus" s={15}/>New Activity Report</button>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <div className="ch"><I n="set" s={16} c="var(--txd)"/><div className="ct" style={{color:"var(--txd)"}}>Filters</div></div>
        <div className="cb">
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {isAdmin&&<select className="fsel" style={{flex:1,minWidth:120}} value={filter.ba} onChange={e=>setFilter(p=>({...p,ba:e.target.value}))}><option value="">All BAs</option>{bas.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>}
            <input className="fi" style={{flex:1,minWidth:100}} placeholder="City" value={filter.city} onChange={e=>setFilter(p=>({...p,city:e.target.value}))}/>
            <input className="fi" style={{flex:1,minWidth:100}} placeholder="Brand" value={filter.brand} onChange={e=>setFilter(p=>({...p,brand:e.target.value}))}/>
            <input className="fi" style={{flex:1,minWidth:120}} type="date" value={filter.date} onChange={e=>setFilter(p=>({...p,date:e.target.value}))}/>
            <select className="fsel" style={{flex:1,minWidth:100}} value={filter.status} onChange={e=>setFilter(p=>({...p,status:e.target.value}))}><option value="">All Status</option><option value="pending">Pending</option><option value="solved">Solved</option></select>
            <button className="bs" onClick={()=>setFilter({ba:"",city:"",brand:"",date:"",status:""})}>Clear</button>
          </div>
        </div>
      </div>
      {acts.length===0&&<div style={{textAlign:"center",padding:"50px 20px",color:"var(--txd)"}}><I n="map" s={48} c="var(--txd)"/><div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:16,color:"var(--tx)"}}>No Activity Reports</div><div style={{fontSize:13,marginTop:6}}>Tap New Activity Report to start</div></div>}
      {acts.map(act=>{
        const ba=(data.users||[]).find(u=>u.id===act.ba_id);
        const sup=(data.users||[]).find(u=>u.id===act.supervisor_id);
        const hrs=calcHours(act.punch_in,act.punch_out,act.break_start,act.break_end);
        const hasHigh=act.ba_remark_cat==="high"||act.sup_remark_cat==="high";
        return(
          <div key={act.id} style={{background:"var(--d2)",border:"1px solid "+(hasHigh?"var(--rd)":"var(--bo)"),borderRadius:14,padding:16,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:10}}>
              <div>
                <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--g)"}}>{act.store_name}</div>
                <div style={{fontSize:12,color:"var(--txd)"}}>{act.city} · {act.brand} · {act.date}</div>
                <div style={{fontSize:12,color:"var(--txd)",marginTop:2}}>BA: <span style={{color:"var(--gr)"}}>{ba?.name||"—"}</span> · Sup: <span style={{color:"var(--bl)"}}>{sup?.name||"—"}</span></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                <span style={{background:"var(--gd)",border:"1px solid var(--bo)",borderRadius:20,padding:"2px 10px",fontSize:11,textTransform:"capitalize"}}>{act.type}</span>
                <span style={{fontSize:11,color:"var(--txd)"}}>{hrs}</span>
              </div>
            </div>
            {act.type==="productive"&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
              {[["Intercept",act.total_interceptions||0,"var(--g)"],["Buyers",act.total_productive||0,"var(--gr)"],["KG",act.total_kg||0,"var(--bl)"],["PCs",act.total_pcs||0,"var(--or)"]].map(([l,v,col])=>(
                <div key={l} style={{textAlign:"center",background:"var(--d3)",borderRadius:8,padding:"6px 4px"}}>
                  <div style={{fontSize:10,color:"var(--txd)"}}>{l}</div>
                  <div style={{fontFamily:"Rajdhani",fontSize:16,color:col}}>{v}</div>
                </div>
              ))}
            </div>}
            {act.type==="gifting"&&<div style={{fontSize:13,color:"var(--txd)",marginBottom:8}}>Total Gifts: <strong style={{color:"var(--g)"}}>{(act.gift_items||[]).reduce((s,x)=>s+Number(x.qty||0),0)}</strong></div>}
            {act.type==="sampling"&&<div style={{fontSize:13,color:"var(--txd)",marginBottom:8}}>Total Samples: <strong style={{color:"var(--g)"}}>{(act.sampling_items||[]).reduce((s,x)=>s+Number(x.qty||0),0)}</strong></div>}
            {act.ba_remark&&<div style={{background:catBg(act.ba_remark_cat),border:"1px solid "+catColor(act.ba_remark_cat),borderRadius:8,padding:"8px 12px",marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--txd)"}}>BA Remark</span><span style={{fontSize:10,color:catColor(act.ba_remark_cat),fontWeight:600,textTransform:"uppercase"}}>{act.ba_remark_cat} · {act.ba_remark_status}</span></div>
              <div style={{fontSize:13,marginTop:4}}>{act.ba_remark}</div>
              {isAdmin&&act.ba_remark_status==="pending"&&<button className="bg" style={{marginTop:6,fontSize:11,padding:"3px 10px"}} onClick={()=>{const d={...data,activities:data.activities.map(a=>a.id===act.id?{...a,ba_remark_status:"solved"}:a)};setData(d);save(d);toast("Solved!");}}>Mark Solved</button>}
            </div>}
            {act.sup_remark&&<div style={{background:catBg(act.sup_remark_cat),border:"1px solid "+catColor(act.sup_remark_cat),borderRadius:8,padding:"8px 12px",marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--txd)"}}>Supervisor Remark</span><span style={{fontSize:10,color:catColor(act.sup_remark_cat),fontWeight:600,textTransform:"uppercase"}}>{act.sup_remark_cat} · {act.sup_remark_status}</span></div>
              <div style={{fontSize:13,marginTop:4}}>{act.sup_remark}</div>
              {isAdmin&&act.sup_remark_status==="pending"&&<button className="bg" style={{marginTop:6,fontSize:11,padding:"3px 10px"}} onClick={()=>{const d={...data,activities:data.activities.map(a=>a.id===act.id?{...a,sup_remark_status:"solved"}:a)};setData(d);save(d);toast("Solved!");}}>Mark Solved</button>}
            </div>}
            <div style={{display:"flex",gap:8,paddingTop:10,borderTop:"1px solid var(--bo)",flexWrap:"wrap"}}>
              <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,fontWeight:600,background:act.approval_status==="approved"?"rgba(46,204,113,.12)":act.approval_status==="submitted"?"rgba(58,155,213,.12)":act.approval_status==="rejected"?"rgba(231,76,60,.12)":"rgba(201,168,76,.12)",color:act.approval_status==="approved"?"var(--gr)":act.approval_status==="submitted"?"var(--bl)":act.approval_status==="rejected"?"var(--rd)":"var(--g)"}}>{act.approval_status==="approved"?"✅ Approved":act.approval_status==="submitted"?"⏳ Pending Approval":act.approval_status==="rejected"?"❌ Rejected":"📝 Draft"}</span>
              {(isAdmin||isSup)&&act.approval_status==="submitted"&&<button className="bg" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>{const d={...data,activities:data.activities.map(a=>a.id===act.id?{...a,approval_status:"approved"}:a)};setData(d);save(d);const ba2=(data.users||[]).find(u=>u.id===act.ba_id);if(ba2?.phone)sendWA(ba2.phone,"✅ Shinkore Marketing\nYour activity report approved!\nStore: "+act.store_name+"\nDate: "+act.date);toast("Approved! BA notified.");}}><I n="ok" s={13}/>Approve</button>}
              {(isAdmin||isSup)&&act.approval_status==="submitted"&&<button className="brd" style={{fontSize:12}} onClick={()=>{const reason=prompt("Rejection reason:");if(!reason)return;const d={...data,activities:data.activities.map(a=>a.id===act.id?{...a,approval_status:"rejected",rejection_reason:reason}:a)};setData(d);save(d);const ba2=(data.users||[]).find(u=>u.id===act.ba_id);if(ba2?.phone)sendWA(ba2.phone,"❌ Shinkore Marketing\nActivity report rejected.\nReason: "+reason+"\nPlease edit and resubmit.");toast("Rejected. BA notified.");}}><I n="del" s={13}/>Reject</button>}
              <button className="bs" onClick={()=>openEdit(act)} style={{fontSize:12}}><I n="edit" s={13}/>Edit</button>
              <button className="bs" onClick={()=>printActivity(act)} style={{fontSize:12}}><I n="pdf" s={13}/>PDF</button>
              <button className="bw" onClick={()=>{const ba2=(data.users||[]).find(u=>u.id===act.ba_id);sendWA(ADMIN_PHONES[0],"Activity: "+act.type+" | "+act.store_name+", "+act.city+"\nBA: "+(ba2?.name||"")+"\nDate: "+act.date);}} style={{fontSize:12}}><I n="wa" s={13}/>Share</button>
              {isAdmin&&<button className="brd" onClick={()=>{if(!confirm("Delete?"))return;const d={...data,activities:data.activities.filter(a=>a.id!==act.id)};setData(d);save(d);toast("Deleted.");}} style={{marginLeft:"auto",fontSize:12}}><I n="del" s={13}/>Delete</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DAILY PLAN PAGE ──────────────────────────────────────────────────────────
function DailyPlanPage({user,data,setData,toast}){
  const [show,setShow]=useState(false);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const emptyP={id:"",date:new Date().toISOString().slice(0,10),ba_id:"",supervisor_id:"",client_id:"",brand:"",city:"",store_name:"",location_type:"instore",expected_interceptions:0,expected_sales:0,notes:"",status:"pending"};
  const [f,setF]=useState(emptyP);
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));
  const bas=(data.users||[]).filter(u=>u.role==="ba");
  const sups=(data.users||[]).filter(u=>u.role==="supervisor");
  const plans=(data.daily_plans||[]).filter(p=>p.date===date);

  const doSave=()=>{
    if(!f.ba_id||!f.city||!f.store_name)return toast("BA, city and store required.");
    const client=data.clients?.find(x=>x.id===f.client_id);
    const rec={...f,id:f.id||genId(),brand:f.brand||(client?.brand||"")};
    const d={...data,daily_plans:[...(data.daily_plans||[]).filter(x=>x.id!==rec.id),rec]};
    const ba=(data.users||[]).find(u=>u.id===rec.ba_id);
    if(ba?.phone)sendWA(ba.phone,"📋 *Shinkore Marketing — Daily Plan*\n\nDate: "+rec.date+"\nStore: "+rec.store_name+", "+rec.city+"\nBrand: "+rec.brand+"\nLocation: "+rec.location_type+"\nExpected Interceptions: "+rec.expected_interceptions+"\nExpected Sales: "+rec.expected_sales+"\n\nPlease submit activity report by end of day.\n— Admin");
    setData(d);save(d);setShow(false);toast("Plan created! BA notified.");
  };

  return(
    <div>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)} style={{maxWidth:160}}/>
        <button className="bg" onClick={()=>{setF({...emptyP,date});setShow(true)}}><I n="plus" s={15}/>Create Plan</button>
      </div>
      {plans.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>
        <I n="cal" s={48} c="var(--txd)"/>
        <div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:16,color:"var(--tx)"}}>No Plans for {date}</div>
        <div style={{fontSize:13,marginTop:6}}>Create daily activity plans for your BAs</div>
      </div>}
      {plans.map(p=>{
        const ba=(data.users||[]).find(u=>u.id===p.ba_id);
        const sup=(data.users||[]).find(u=>u.id===p.supervisor_id);
        const act=(data.activities||[]).find(a=>a.ba_id===p.ba_id&&a.date===p.date);
        return(
          <div key={p.id} style={{background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:14,padding:16,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--g)"}}>{p.store_name}</div>
                <div style={{fontSize:12,color:"var(--txd)"}}>{p.city} · {p.brand} · {p.location_type}</div>
                <div style={{fontSize:12,color:"var(--txd)",marginTop:2}}>BA: <span style={{color:"var(--gr)"}}>{ba?.name||"—"}</span>{sup?<span> · Sup: <span style={{color:"var(--bl)"}}>{sup.name}</span></span>:""}</div>
              </div>
              <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,fontWeight:600,background:act?"rgba(46,204,113,.12)":"rgba(240,165,0,.12)",color:act?"var(--gr)":"var(--or)"}}>{act?"✅ Submitted":"⏳ Pending"}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{background:"var(--d3)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:"var(--txd)"}}>Expected Interceptions</div>
                <div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--g)"}}>{p.expected_interceptions}</div>
                {act&&<div style={{fontSize:11,color:Number(act.total_interceptions)>=Number(p.expected_interceptions)?"var(--gr)":"var(--rd)"}}>Actual: {act.total_interceptions||0}</div>}
              </div>
              <div style={{background:"var(--d3)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:"var(--txd)"}}>Expected Sales (PCs)</div>
                <div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--g)"}}>{p.expected_sales}</div>
                {act&&<div style={{fontSize:11,color:Number(act.total_pcs)>=Number(p.expected_sales)?"var(--gr)":"var(--rd)"}}>Actual: {act.total_pcs||0}</div>}
              </div>
            </div>
            {p.notes&&<div style={{fontSize:12,color:"var(--txd)",marginBottom:10}}>Note: {p.notes}</div>}
            <div style={{display:"flex",gap:8}}>
              <button className="bw" onClick={()=>{const ba2=(data.users||[]).find(u=>u.id===p.ba_id);if(ba2)sendWA(ba2.phone,"📋 Reminder: Please submit your activity report for today.\nStore: "+p.store_name+"\n— Shinkore Marketing");}} style={{fontSize:12}}><I n="wa" s={13}/>Remind BA</button>
              <button className="brd" onClick={()=>{const d={...data,daily_plans:(data.daily_plans||[]).filter(x=>x.id!==p.id)};setData(d);save(d);toast("Deleted.");}} style={{marginLeft:"auto",fontSize:12}}><I n="del" s={13}/>Delete</button>
            </div>
          </div>
        );
      })}
      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Create Daily Plan</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="frow">
                <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={f.date} onChange={e=>sf("date",e.target.value)}/></div>
                <div className="fg"><label className="fl">Location Type</label><select className="fsel" value={f.location_type} onChange={e=>sf("location_type",e.target.value)}><option value="instore">In-Store</option><option value="doortodoor">Door to Door</option><option value="stall">Stall</option></select></div>
              </div>
              <div className="fg"><label className="fl">Assign BA</label><select className="fsel" value={f.ba_id} onChange={e=>sf("ba_id",e.target.value)}><option value="">-- Select BA --</option>{bas.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="fg"><label className="fl">Supervisor</label><select className="fsel" value={f.supervisor_id} onChange={e=>sf("supervisor_id",e.target.value)}><option value="">-- Select --</option>{sups.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="fg"><label className="fl">Client</label><select className="fsel" value={f.client_id} onChange={e=>{sf("client_id",e.target.value);const cl=data.clients?.find(x=>x.id===e.target.value);if(cl)sf("brand",cl.brand);}}><option value="">-- Select Client --</option>{(data.clients||[]).map(cl=><option key={cl.id} value={cl.id}>{cl.name} ({cl.brand})</option>)}</select></div>
              <div className="frow">
                <div className="fg"><label className="fl">City</label><input className="fi" value={f.city} onChange={e=>sf("city",e.target.value)} placeholder="e.g. Abbottabad"/></div>
                <div className="fg"><label className="fl">Store Name</label><input className="fi" value={f.store_name} onChange={e=>sf("store_name",e.target.value)} placeholder="e.g. Gilani Mart"/></div>
              </div>
              <div className="fg"><label className="fl">Brand</label><input className="fi" value={f.brand} onChange={e=>sf("brand",e.target.value)} placeholder="e.g. Brite"/></div>
              <div className="frow">
                <div className="fg"><label className="fl">Expected Interceptions</label><input className="fi" type="number" value={f.expected_interceptions} onChange={e=>sf("expected_interceptions",e.target.value)}/></div>
                <div className="fg"><label className="fl">Expected Sales (PCs)</label><input className="fi" type="number" value={f.expected_sales} onChange={e=>sf("expected_sales",e.target.value)}/></div>
              </div>
              <div className="fg"><label className="fl">Notes</label><input className="fi" value={f.notes} onChange={e=>sf("notes",e.target.value)} placeholder="Instructions for BA"/></div>
              <div className="ma"><button className="bs" onClick={()=>setShow(false)}>Cancel</button><button className="bg" onClick={doSave}><I n="ok" s={15}/>Create & Notify BA</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CLIENTS PAGE ─────────────────────────────────────────────────────────────
function ClientsPage({user,data,setData,toast}){
  const [show,setShow]=useState(false);
  const [editing,setEditing]=useState(null);
  const emptyC={name:"",brand:"",phone:"",email:"",pin:"",active:true};
  const [f,setF]=useState(emptyC);
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));

  const doSave=()=>{
    if(!f.name||!f.brand)return toast("Name and brand required.");
    const d={...data};
    if(editing)d.clients=d.clients.map(c=>c.id===editing.id?{...c,...f}:c);
    else d.clients=[...(d.clients||[]),{id:genId(),...f}];
    setData(d);save(d);setShow(false);toast(editing?"Updated!":"Client added!");
  };

  const clientActivities=(clientId)=>{
    const client=data.clients?.find(c=>c.id===clientId);
    if(!client)return[];
    return(data.activities||[]).filter(a=>a.brand&&a.brand.toLowerCase().includes(client.brand.toLowerCase())&&a.approval_status==="approved");
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <button className="bg" onClick={()=>{setEditing(null);setF(emptyC);setShow(true)}}><I n="plus" s={15}/>Add Client</button>
      </div>
      {(data.clients||[]).length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}><I n="users" s={48} c="var(--txd)"/><div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:16,color:"var(--tx)"}}>No Clients Yet</div><div style={{fontSize:13,marginTop:6}}>Add your first client</div></div>}
      {(data.clients||[]).map(client=>{
        const acts=clientActivities(client.id);
        const totalInterceptions=acts.reduce((s,a)=>s+Number(a.total_interceptions||0),0);
        const totalSalesKg=acts.reduce((s,a)=>s+Number(a.total_kg||0),0);
        const totalSalesPcs=acts.reduce((s,a)=>s+Number(a.total_pcs||0),0);
        return(
          <div key={client.id} style={{background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:14,padding:16,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontFamily:"Rajdhani",fontSize:20,fontWeight:700,color:"var(--g)"}}>{client.name}</div>
                <div style={{fontSize:13,color:"var(--txd)"}}>Brand: {client.brand}</div>
                {client.phone&&<div style={{fontSize:12,color:"var(--txd)"}}>{client.phone}</div>}
              </div>
              <span style={{background:client.active?"rgba(46,204,113,.12)":"rgba(231,76,60,.12)",color:client.active?"var(--gr)":"var(--rd)",border:"1px solid "+(client.active?"rgba(46,204,113,.3)":"rgba(231,76,60,.3)"),borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600}}>{client.active?"Active":"Inactive"}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
              <div style={{textAlign:"center",background:"var(--d3)",borderRadius:8,padding:"8px 4px"}}><div style={{fontSize:10,color:"var(--txd)"}}>Activities</div><div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--g)"}}>{acts.length}</div></div>
              <div style={{textAlign:"center",background:"var(--d3)",borderRadius:8,padding:"8px 4px"}}><div style={{fontSize:10,color:"var(--txd)"}}>Interceptions</div><div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--bl)"}}>{totalInterceptions}</div></div>
              <div style={{textAlign:"center",background:"var(--d3)",borderRadius:8,padding:"8px 4px"}}><div style={{fontSize:10,color:"var(--txd)"}}>Sales KG</div><div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--gr)"}}>{totalSalesKg}</div></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="bs" onClick={()=>{setEditing(client);setF({name:client.name,brand:client.brand,phone:client.phone||"",email:client.email||"",pin:client.pin||"",active:client.active});setShow(true);}} style={{fontSize:12}}><I n="edit" s={13}/>Edit</button>
              <button className="bw" onClick={()=>sendWA(client.phone,"Hello "+client.name+", this is Shinkore Marketing. Here is a summary of your brand "+client.brand+" activities: "+acts.length+" activities completed, "+totalInterceptions+" interceptions, "+totalSalesKg+"kg sales.")} style={{fontSize:12}}><I n="wa" s={13}/>Send Summary</button>
            </div>
          </div>
        );
      })}
      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">{editing?"Edit Client":"Add Client"}</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="frow">
                <div className="fg"><label className="fl">Client Name</label><input className="fi" value={f.name} onChange={e=>sf("name",e.target.value)} placeholder="e.g. Unilever"/></div>
                <div className="fg"><label className="fl">Brand</label><input className="fi" value={f.brand} onChange={e=>sf("brand",e.target.value)} placeholder="e.g. Brite"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Phone</label><input className="fi" value={f.phone} onChange={e=>sf("phone",e.target.value)} placeholder="03001234567"/></div>
                <div className="fg"><label className="fl">PIN (client login)</label><input className="fi" type="password" value={f.pin} onChange={e=>sf("pin",e.target.value)} placeholder="4 digits"/></div>
              </div>
              <div className="fg"><label className="fl">Email (optional)</label><input className="fi" value={f.email} onChange={e=>sf("email",e.target.value)} placeholder="client@email.com"/></div>
              <div className="fg"><label className="fl">Status</label><select className="fsel" value={f.active} onChange={e=>sf("active",e.target.value==="true")}><option value="true">Active</option><option value="false">Inactive</option></select></div>
              <div className="ma"><button className="bs" onClick={()=>setShow(false)}>Cancel</button><button className="bg" onClick={doSave}><I n="ok" s={15}/>{editing?"Save":"Add Client"}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CLIENT ACTIVITY PDF ──────────────────────────────────────────────────────
function ClientPDFPage({user,data,toast}){
  const [clientId,setClientId]=useState("");
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [preview,setPreview]=useState(false);

  const client=(data.clients||[]).find(c=>c.id===clientId);
  const acts=(data.activities||[]).filter(a=>
    a.approval_status==="approved"&&
    a.date&&a.date.startsWith(month)&&
    client&&a.brand&&a.brand.toLowerCase().includes(client.brand.toLowerCase())
  );

  const totalInterceptions=acts.reduce((s,a)=>s+Number(a.total_interceptions||0),0);
  const totalBuyers=acts.reduce((s,a)=>s+Number(a.total_productive||0),0);
  const totalKg=acts.reduce((s,a)=>s+Number(a.total_kg||0),0);
  const totalPcs=acts.reduce((s,a)=>s+Number(a.total_pcs||0),0);
  const totalGifts=acts.reduce((s,a)=>s+(a.gift_items||[]).reduce((x,i)=>x+Number(i.qty||0),0),0);
  const totalSamples=acts.reduce((s,a)=>s+(a.sampling_items||[]).reduce((x,i)=>x+Number(i.qty||0),0),0);
  const cities=[...new Set(acts.map(a=>a.city).filter(Boolean))];
  const stores=[...new Set(acts.map(a=>a.store_name).filter(Boolean))];

  const generatePDF=()=>{
    if(!client)return toast("Select a client first.");
    if(acts.length===0)return toast("No approved activities found for this period.");
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto}
.header{padding-bottom:20px;border-bottom:3px solid #C9A84C;margin-bottom:24px}
.co{font-size:28px;font-weight:700;color:#C9A84C;letter-spacing:2px}
.co-sub{font-size:12px;color:#888;margin-top:4px}
.report-title{font-size:22px;font-weight:700;margin-top:16px;color:#1a1a1a}
.report-sub{font-size:13px;color:#888;margin-top:4px}
.section{margin-bottom:24px}
.sec-title{font-size:16px;font-weight:700;background:#f5f0e8;padding:10px 14px;border-left:4px solid #C9A84C;margin-bottom:12px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.stat{background:#f9f6ef;border:1px solid #e8d8a0;border-radius:10px;padding:16px;text-align:center}
.stat-val{font-size:32px;font-weight:700;color:#C9A84C}
.stat-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#C9A84C;color:#fff;padding:10px 12px;font-size:12px;text-align:left}
td{padding:10px 12px;border-bottom:1px solid #f0e8d0;font-size:13px}
tr:nth-child(even) td{background:#fdfaf4}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e0d0b0;font-size:11px;color:#aaa;text-align:center}
.badge{display:inline-block;background:#e8f4ec;color:#1a8a4a;border:1px solid #a0d8b8;border-radius:20px;padding:2px 12px;font-size:11px;font-weight:600}
</style></head><body>
<div class="header">
  <div class="co">SHINKORE MARKETING</div>
  <div class="co-sub">CEO: Khalid Orakzai | Civil Officer Col Office 28 | 03135443656 | www.appabbottabad.com</div>
  <div class="report-title">Client Activity Report</div>
  <div class="report-sub">Prepared for: <strong>${client.name}</strong> | Brand: <strong>${client.brand}</strong> | Period: <strong>${month}</strong></div>
</div>

<div class="section">
  <div class="sec-title">Performance Summary</div>
  <div class="stats">
    <div class="stat"><div class="stat-val">${acts.length}</div><div class="stat-label">Total Activities</div></div>
    <div class="stat"><div class="stat-val">${totalInterceptions}</div><div class="stat-label">Total Interceptions</div></div>
    <div class="stat"><div class="stat-val">${totalBuyers}</div><div class="stat-label">Productive Buyers</div></div>
    <div class="stat"><div class="stat-val">${totalKg} kg</div><div class="stat-label">Total Sales KG</div></div>
    <div class="stat"><div class="stat-val">${totalPcs}</div><div class="stat-label">Total Sales PCs</div></div>
    ${totalGifts>0?'<div class="stat"><div class="stat-val">'+totalGifts+'</div><div class="stat-label">Total Gifts</div></div>':""}
    ${totalSamples>0?'<div class="stat"><div class="stat-val">'+totalSamples+'</div><div class="stat-label">Total Samples</div></div>':""}
  </div>
  <div style="margin-top:8px;font-size:13px;color:#555">
    <strong>Cities covered:</strong> ${cities.join(", ")||"—"}<br>
    <strong>Stores covered:</strong> ${stores.length} stores
  </div>
</div>

<div class="section">
  <div class="sec-title">Activity Details</div>
  <table>
    <thead><tr><th>Date</th><th>Store</th><th>City</th><th>Type</th><th>BA</th><th>Interceptions</th><th>Sales PCs</th><th>Sales KG</th></tr></thead>
    <tbody>
    ${acts.map(a=>{
      const ba=(data.users||[]).find(u=>u.id===a.ba_id);
      return '<tr><td>'+a.date+'</td><td>'+a.store_name+'</td><td>'+a.city+'</td><td style="text-transform:capitalize">'+a.type+'</td><td>'+(ba?.name||"—")+'</td><td>'+(a.total_interceptions||0)+'</td><td>'+(a.total_pcs||0)+'</td><td>'+(a.total_kg||0)+' kg</td></tr>';
    }).join("")}
    <tr style="font-weight:700;background:#f5f0e8"><td colspan="5">TOTAL</td><td>${totalInterceptions}</td><td>${totalPcs}</td><td>${totalKg} kg</td></tr>
    </tbody>
  </table>
</div>

${acts.some(a=>(a.photos||[]).length>0)?'<div class="section"><div class="sec-title">Activity Photos</div><div style="display:flex;flex-wrap:wrap;gap:10px">'+acts.flatMap(a=>(a.photos||[]).map(p=>'<img src="'+p.url+'" style="width:150px;height:150px;object-fit:cover;border-radius:8px;border:1px solid #e0d0b0"/>')).join("")+'</div></div>':""}

<div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:16px;border-top:1px solid #e0d0b0">
  <div style="text-align:center;width:180px"><div style="border-top:1px solid #999;padding-top:8px;font-size:12px;color:#555">Prepared by<br><strong>Khalid Orakzai</strong><br>CEO, Shinkore Marketing</div></div>
  <div style="text-align:center;width:180px"><div style="border-top:1px solid #999;padding-top:8px;font-size:12px;color:#555">Client Representative<br><strong>${client.name}</strong></div></div>
</div>

<div class="footer">Shinkore Marketing | Generated ${new Date().toLocaleDateString("en-PK")} | www.appabbottabad.com | This report is confidential</div>
</body></html>`;
    openPrint(html);
  };

  return(
    <div>
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="pdf" s={16} c="var(--g)"/><div><div className="ct">Generate Client Report</div><div className="cs">Professional PDF for your client</div></div></div>
        <div className="cb">
          <div className="frow">
            <div className="fg"><label className="fl">Select Client</label>
              <select className="fsel" value={clientId} onChange={e=>setClientId(e.target.value)}>
                <option value="">-- Select Client --</option>
                {(data.clients||[]).map(cl=><option key={cl.id} value={cl.id}>{cl.name} ({cl.brand})</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Month</label>
              <input className="fi" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>
            </div>
          </div>
          {client&&<div style={{background:"var(--gd)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 16px",marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8}}>
              <div><div style={{fontSize:10,color:"var(--txd)"}}>Activities</div><div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--g)"}}>{acts.length}</div></div>
              <div><div style={{fontSize:10,color:"var(--txd)"}}>Interceptions</div><div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--bl)"}}>{totalInterceptions}</div></div>
              <div><div style={{fontSize:10,color:"var(--txd)"}}>Sales KG</div><div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--gr)"}}>{totalKg}</div></div>
              <div><div style={{fontSize:10,color:"var(--txd)"}}>Sales PCs</div><div style={{fontFamily:"Rajdhani",fontSize:20,color:"var(--or)"}}>{totalPcs}</div></div>
            </div>
          </div>}
          <button className="bg" onClick={generatePDF} style={{width:"100%",justifyContent:"center"}}><I n="pdf" s={16}/>Generate Client PDF Report</button>
          {client&&acts.length>0&&<button className="bw" onClick={()=>{if(client.phone)sendWA(client.phone,"Dear "+client.name+", please find your brand "+client.brand+" activity report for "+month+" attached. Total: "+acts.length+" activities, "+totalInterceptions+" interceptions, "+totalKg+"kg sales. Contact us for the full report. — Shinkore Marketing 03135443656");else toast("No phone number for this client.");}} style={{width:"100%",justifyContent:"center",marginTop:8}}><I n="wa" s={16}/>Send Summary to Client via WhatsApp</button>}
        </div>
      </div>
      {(data.clients||[]).length===0&&<div style={{textAlign:"center",padding:"30px",color:"var(--txd)",fontSize:13}}>No clients added yet. Go to Clients section to add your first client.</div>}
    </div>
  );
}


// ─── CLIENT DASHBOARD V2 ──────────────────────────────────────────────────────
function ClientDashPage({user,data,toast}){
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [tab,setTab]=useState("overview");
  const client=(data.clients||[]).find(c=>c.id===user.id)||user;
  const acts=(data.activities||[]).filter(a=>
    a.approval_status==="approved"&&
    a.brand&&client.brand&&
    a.brand.toLowerCase().includes(client.brand.toLowerCase())&&
    a.date&&a.date.startsWith(month)
  ).sort((a,b)=>a.date>b.date?-1:1);

  const totalInterceptions=acts.reduce((s,a)=>s+Number(a.total_interceptions||0),0);
  const totalBuyers=acts.reduce((s,a)=>s+Number(a.total_productive||0),0);
  const totalKg=acts.reduce((s,a)=>s+Number(a.total_kg||0),0);
  const totalPcs=acts.reduce((s,a)=>s+Number(a.total_pcs||0),0);
  const totalGifts=acts.reduce((s,a)=>s+(a.gift_items||[]).reduce((x,i)=>x+Number(i.qty||0),0),0);
  const totalSamples=acts.reduce((s,a)=>s+(a.sampling_items||[]).reduce((x,i)=>x+Number(i.qty||0),0),0);

  // Store breakdown
  const storeMap={};
  acts.forEach(a=>{
    const k=a.store_name+"|"+a.city;
    if(!storeMap[k])storeMap[k]={store:a.store_name,city:a.city,acts:0,interceptions:0,pcs:0,kg:0};
    storeMap[k].acts++;
    storeMap[k].interceptions+=Number(a.total_interceptions||0);
    storeMap[k].pcs+=Number(a.total_pcs||0);
    storeMap[k].kg+=Number(a.total_kg||0);
  });
  const stores=Object.values(storeMap).sort((a,b)=>b.interceptions-a.interceptions);

  // SKU breakdown
  const skuMap={};
  acts.forEach(a=>(a.sales_items||[]).forEach(i=>{
    const k=i.name+(i.size?" "+i.size:"");
    if(!skuMap[k])skuMap[k]={name:k,qty:0};
    skuMap[k].qty+=Number(i.qty||0);
  }));
  const skus=Object.values(skuMap).sort((a,b)=>b.qty-a.qty);

  // Gift breakdown
  const giftMap={};
  acts.forEach(a=>(a.gift_items||[]).forEach(i=>{
    if(!giftMap[i.name])giftMap[i.name]={name:i.name,qty:0};
    giftMap[i.name].qty+=Number(i.qty||0);
  }));
  const gifts=Object.values(giftMap).sort((a,b)=>b.qty-a.qty);

  // BA breakdown
  const baMap={};
  acts.forEach(a=>{
    const ba=(data.users||[]).find(u=>u.id===a.ba_id);
    const k=a.ba_id;
    if(!baMap[k])baMap[k]={name:ba?.name||"Unknown",acts:0,interceptions:0,pcs:0};
    baMap[k].acts++;
    baMap[k].interceptions+=Number(a.total_interceptions||0);
    baMap[k].pcs+=Number(a.total_pcs||0);
  });
  const bas=Object.values(baMap).sort((a,b)=>b.interceptions-a.interceptions);

  // City breakdown
  const cityMap={};
  acts.forEach(a=>{
    if(!cityMap[a.city])cityMap[a.city]={city:a.city,acts:0,interceptions:0,pcs:0};
    cityMap[a.city].acts++;
    cityMap[a.city].interceptions+=Number(a.total_interceptions||0);
    cityMap[a.city].pcs+=Number(a.total_pcs||0);
  });
  const cities=Object.values(cityMap).sort((a,b)=>b.acts-a.acts);

  const photos=acts.flatMap(a=>(a.photos||[]).map(p=>({...p,store:a.store_name,date:a.date})));

  const printReport=()=>{
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:sans-serif;padding:30px;max-width:800px;margin:0 auto;color:#1a1a1a}
.co{font-size:24px;font-weight:700;color:#C9A84C}.sub{font-size:11px;color:#888}
.title{font-size:20px;font-weight:700;margin:16px 0 4px}
.sec{margin:20px 0}.st{font-size:14px;font-weight:700;background:#f5f0e8;padding:8px 12px;border-left:4px solid #C9A84C;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.stat{background:#f9f6ef;border:1px solid #e8d8a0;border-radius:8px;padding:12px;text-align:center}
.sv{font-size:26px;font-weight:700;color:#C9A84C}.sl{font-size:10px;color:#888;text-transform:uppercase}
table{width:100%;border-collapse:collapse}th{background:#C9A84C;color:#fff;padding:8px;font-size:12px;text-align:left}td{padding:8px;border-bottom:1px solid #f0e8d0;font-size:12px}
.footer{margin-top:30px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #e0d0b0;padding-top:12px}
</style></head><body>
<div style="display:flex;align-items:center;gap:16px"><img src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg" style="width:60px;height:60px;border-radius:8px;object-fit:cover"/><div><div class="co">SHINKORE MARKETING</div><div class="sub">CEO: Khalid Orakzai | 03135443656 | www.appabbottabad.com</div></div></div>
<div class="title">Brand Activity Report — ${client.brand}</div>
<div class="sub">Client: ${client.name} | Period: ${month} | Generated: ${new Date().toLocaleDateString("en-PK")}</div>
<div class="sec"><div class="st">Performance Summary</div>
<div class="grid">
<div class="stat"><div class="sv">${acts.length}</div><div class="sl">Activities</div></div>
<div class="stat"><div class="sv">${totalInterceptions}</div><div class="sl">Interceptions</div></div>
<div class="stat"><div class="sv">${totalBuyers}</div><div class="sl">Buyers</div></div>
<div class="stat"><div class="sv">${totalKg}kg</div><div class="sl">Sales KG</div></div>
<div class="stat"><div class="sv">${totalPcs}</div><div class="sl">Sales PCs</div></div>
<div class="stat"><div class="sv">${totalGifts}</div><div class="sl">Gifts</div></div>
</div></div>
${skus.length>0?'<div class="sec"><div class="st">Sales by Product (SKU)</div><table><thead><tr><th>Product</th><th>Qty Sold</th></tr></thead><tbody>'+skus.map(s=>'<tr><td>'+s.name+'</td><td>'+s.qty+'</td></tr>').join('')+'</tbody></table></div>':""}
${stores.length>0?'<div class="sec"><div class="st">Store-wise Performance</div><table><thead><tr><th>Store</th><th>City</th><th>Activities</th><th>Interceptions</th><th>Sales PCs</th></tr></thead><tbody>'+stores.map(s=>'<tr><td>'+s.store+'</td><td>'+s.city+'</td><td>'+s.acts+'</td><td>'+s.interceptions+'</td><td>'+s.pcs+'</td></tr>').join('')+'</tbody></table></div>':""}
${gifts.length>0?'<div class="sec"><div class="st">Gifting Summary</div><table><thead><tr><th>Item</th><th>Total Distributed</th></tr></thead><tbody>'+gifts.map(g=>'<tr><td>'+g.name+'</td><td>'+g.qty+'</td></tr>').join('')+'</tbody></table></div>':""}
${bas.length>0?'<div class="sec"><div class="st">BA Performance</div><table><thead><tr><th>BA Name</th><th>Activities</th><th>Interceptions</th><th>Sales PCs</th></tr></thead><tbody>'+bas.map(b=>'<tr><td>'+b.name+'</td><td>'+b.acts+'</td><td>'+b.interceptions+'</td><td>'+b.pcs+'</td></tr>').join('')+'</tbody></table></div>':""}
<div class="sec"><div class="st">Staff Cost (Billed to Client)
</div>
<div class="sec"><div class="st">Daily Activity Log</div><table><thead><tr><th>Date</th><th>Store</th><th>City</th><th>Type</th><th>Interceptions</th><th>Sales PCs</th><th>KG</th></tr></thead><tbody>
${acts.map(a=>{const ba=(data.users||[]).find(u=>u.id===a.ba_id);return'<tr><td>'+a.date+'</td><td>'+a.store_name+'</td><td>'+a.city+'</td><td>'+a.type+'</td><td>'+(a.total_interceptions||0)+'</td><td>'+(a.total_pcs||0)+'</td><td>'+(a.total_kg||0)+'kg</td></tr>';}).join('')}
</tbody></table></div>
${photos.length>0?'<div class="sec"><div class="st">Field Photos</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+photos.map(p=>'<div style="text-align:center"><img src="'+p.url+'" style="width:130px;height:130px;object-fit:cover;border-radius:6px"/><div style="font-size:10px;color:#888;margin-top:2px">'+p.store+'</div></div>').join('')+'</div></div>':""}
<div style="display:flex;justify-content:space-between;margin-top:30px">
<div style="border-top:1px solid #999;width:160px;padding-top:6px;text-align:center;font-size:11px">Shinkore Marketing<br>Khalid Orakzai</div>
<div style="border-top:1px solid #999;width:160px;padding-top:6px;text-align:center;font-size:11px">Client<br>${client.name}</div>
</div>
<div class="footer">Shinkore Marketing | Confidential | www.appabbottabad.com</div>
</body></html>`;
    openPrint(html);
  };

  const tabs=["overview","stores","products","bas","photos"];
  const tabLabels={overview:"Overview",stores:"Stores",products:"Products",bas:"BAs",photos:"Photos"};

  return(
    <div>
      <div style={{background:"var(--gd)",border:"1px solid var(--g)",borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{fontFamily:"Rajdhani",fontSize:22,fontWeight:700,color:"var(--g)"}}>{client.name}</div>
        <div style={{fontSize:13,color:"var(--txd)"}}>Brand: <strong style={{color:"var(--tx)"}}>{client.brand}</strong></div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <input className="fi" type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{maxWidth:160}}/>
        <button className="bg" onClick={printReport}><I n="pdf" s={15}/>Download PDF</button>
        {client.phone&&<button className="bw" onClick={()=>sendWA(client.phone,"Dear "+client.name+", your "+client.brand+" brand report for "+month+": "+acts.length+" activities, "+totalInterceptions+" interceptions, "+totalKg+"kg sales, "+totalPcs+" pcs. Full PDF available on your dashboard. — Shinkore Marketing")}><I n="wa" s={15}/>Share</button>}
      </div>

      <div className="sg" style={{marginBottom:16}}>
        {[["Activities",acts.length,"var(--g)"],["Interceptions",totalInterceptions,"var(--bl)"],["Buyers",totalBuyers,"var(--gr)"],["KG",totalKg+"kg","var(--or)"],["PCs",totalPcs,"var(--g)"],["Gifts",totalGifts,"var(--bl)"],["Samples",totalSamples,"var(--gr)"]].map(([l,v,col])=>(
          <div key={l} className="sc"><div className="sv" style={{fontSize:18,color:col}}>{v}</div><div className="sl">{l}</div></div>
        ))}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {tabs.map(t=><button key={t} className={tab===t?"bg":"bs"} onClick={()=>setTab(t)} style={{fontSize:12,whiteSpace:"nowrap"}}>{tabLabels[t]}</button>)}
      </div>

      {tab==="overview"&&<div>
        {acts.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}><I n="map" s={48} c="var(--txd)"/><div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:16}}>No Activities for {month}</div></div>}
        {acts.map(act=>{
          const ba=(data.users||[]).find(u=>u.id===act.ba_id);
          return(<div key={act.id} style={{background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div><div style={{fontFamily:"Rajdhani",fontSize:16,fontWeight:700,color:"var(--g)"}}>{act.store_name}</div>
              <div style={{fontSize:11,color:"var(--txd)"}}>{act.city} · {act.date} · {ba?.name||"—"}</div></div>
              <span style={{fontSize:11,background:"var(--gd)",border:"1px solid var(--bo)",borderRadius:20,padding:"2px 8px",textTransform:"capitalize"}}>{act.type}</span>
            </div>
            {act.type==="productive"&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
              {[["Intercept",act.total_interceptions||0,"var(--g)"],["Buyers",act.total_productive||0,"var(--gr)"],["KG",act.total_kg||0,"var(--bl)"],["PCs",act.total_pcs||0,"var(--or)"]].map(([l,v,col])=>(<div key={l} style={{textAlign:"center",background:"var(--d3)",borderRadius:6,padding:"6px 4px"}}><div style={{fontSize:10,color:"var(--txd)"}}>{l}</div><div style={{fontFamily:"Rajdhani",fontSize:15,color:col}}>{v}</div></div>))}
            </div>}
            {(act.sales_items||[]).length>0&&<div style={{fontSize:12,color:"var(--txd)",marginBottom:6}}>Sales: {act.sales_items.map(s=>s.name+(s.size?" "+s.size:"")+" ("+s.qty+")").join(", ")}</div>}
            {act.type==="gifting"&&(act.gift_items||[]).length>0&&<div style={{fontSize:12,color:"var(--txd)",marginBottom:6}}>Gifts: {act.gift_items.filter(g=>Number(g.qty)>0).map(g=>g.name+" ("+g.qty+")").join(", ")}</div>}
            {(act.photos||[]).length>0&&<div style={{display:"flex",gap:4,marginTop:6}}>{act.photos.map(p=>(<img key={p.id} src={p.thumb||p.url} style={{width:50,height:50,borderRadius:4,objectFit:"cover",cursor:"pointer"}} onClick={()=>window.open(p.url,"_blank")}/>))}</div>}
          </div>);
        })}
      </div>}

      {tab==="stores"&&<div>
        {stores.length===0&&<div style={{textAlign:"center",padding:"30px",color:"var(--txd)"}}>No store data yet</div>}
        {stores.map((s,i)=>(<div key={i} style={{background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:12,padding:14,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div><div style={{fontFamily:"Rajdhani",fontSize:16,fontWeight:700,color:"var(--g)"}}>{s.store}</div><div style={{fontSize:12,color:"var(--txd)"}}>{s.city}</div></div>
            <span style={{fontFamily:"Rajdhani",fontSize:14,color:"var(--g)"}}>{s.acts} visits</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[["Interceptions",s.interceptions,"var(--bl)"],["Sales PCs",s.pcs,"var(--gr)"],["Sales KG",s.kg+"kg","var(--or)"]].map(([l,v,col])=>(<div key={l} style={{textAlign:"center",background:"var(--d3)",borderRadius:6,padding:"8px 4px"}}><div style={{fontSize:10,color:"var(--txd)"}}>{l}</div><div style={{fontFamily:"Rajdhani",fontSize:16,color:col}}>{v}</div></div>))}
          </div>
        </div>))}
      </div>}

      {tab==="products"&&<div>
        {skus.length===0&&gifts.length===0&&<div style={{textAlign:"center",padding:"30px",color:"var(--txd)"}}>No product data yet</div>}
        {skus.length>0&&<div className="card" style={{marginBottom:12}}>
          <div className="ch"><I n="dash" s={16} c="var(--g)"/><div className="ct">Sales by SKU</div></div>
          <div className="cb">
            {skus.map((s,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--bo)"}}>
              <div style={{fontSize:13,fontWeight:600}}>{s.name}</div>
              <div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--g)"}}>{s.qty} pcs</div>
            </div>))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontWeight:700}}>
              <div>Total</div><div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--gr)"}}>{totalPcs} pcs</div>
            </div>
          </div>
        </div>}
        {gifts.length>0&&<div className="card">
          <div className="ch"><I n="plus" s={16} c="var(--g)"/><div className="ct">Gifting Items</div></div>
          <div className="cb">
            {gifts.map((g,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--bo)"}}>
              <div style={{fontSize:13,fontWeight:600}}>{g.name}</div>
              <div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--bl)"}}>{g.qty}</div>
            </div>))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontWeight:700}}>
              <div>Total Gifts</div><div style={{fontFamily:"Rajdhani",fontSize:18,color:"var(--gr)"}}>{totalGifts}</div>
            </div>
          </div>
        </div>}
      </div>}

      {tab==="bas"&&<div>
        {bas.length===0&&<div style={{textAlign:"center",padding:"30px",color:"var(--txd)"}}>No BA data yet</div>}
        {bas.map((b,i)=>(<div key={i} style={{background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:12,padding:14,marginBottom:10}}>
          <div style={{fontFamily:"Rajdhani",fontSize:17,fontWeight:700,color:"var(--g)",marginBottom:10}}>{b.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[["Activities",b.acts,"var(--g)"],["Interceptions",b.interceptions,"var(--bl)"],["Sales PCs",b.pcs,"var(--gr)"]].map(([l,v,col])=>(<div key={l} style={{textAlign:"center",background:"var(--d3)",borderRadius:6,padding:"8px 4px"}}><div style={{fontSize:10,color:"var(--txd)"}}>{l}</div><div style={{fontFamily:"Rajdhani",fontSize:16,color:col}}>{v}</div></div>))}
          </div>
        </div>))}
      </div>}

      {tab==="photos"&&<div>
        {photos.length===0&&<div style={{textAlign:"center",padding:"30px",color:"var(--txd)"}}>No photos uploaded yet</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {photos.map((p,i)=>(<div key={i} style={{position:"relative"}}>
            <img src={p.thumb||p.url} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:8,cursor:"pointer"}} onClick={()=>window.open(p.url,"_blank")}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,.6)",color:"#fff",fontSize:9,padding:"2px 4px",borderRadius:"0 0 8px 8px"}}>{p.store} · {p.date}</div>
          </div>))}
        </div>
      </div>}
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

  const exportCSV=(sheet,rows,headers)=>{const nl=String.fromCharCode(10);const h=headers.join(",")+nl;const r=rows.map(row=>row.map(x=>String(x||"")).join(",")).join(nl);const blob=new Blob([h+r],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=sheet+".csv";a.click();
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
    const staffRows=(data.users||[]).filter(u=>u.role!=="admin").map(u=>
      [u.name,u.role==="ba"?"BA":"Supervisor",u.phone,u.team||"",u.daily_rate]);
    await syncSheet("Staff",staffRows);

    // STALLS
    const stallRows=(data.stalls||[]).map(s=>
      [s.name,s.city,s.dept,s.client||"",s.from_date,s.to_date,s.client_charged,s.duty_start]);
    await syncSheet("Stalls",stallRows);

    // ALLOCATIONS
    const allocRows=data.allocations.map(a=>{
      const u=(data.users||[]).find(x=>x.id===a.user_id);
      const s=(data.stalls||[]).find(x=>x.id===a.stall_id);
      return[u?.name||"",u?.role||"",s?.name||"",s?.city||"",a.duty_start,a.daily_rate,a.from_date,a.to_date,a.active?"Active":"Ended"];
    });
    await syncSheet("Allocations",allocRows);

    // ATTENDANCE
    const attRows=(data.attendance||[]).map(a=>{
      const u=(data.users||[]).find(x=>x.id===a.user_id);
      const s=(data.stalls||[]).find(x=>x.id===a.stall_id);
      return[a.date,u?.name||"",u?.role||"",s?.name||"",s?.city||"",a.clock_in,a.clock_out||"",a.dist+"m"];
    });
    await syncSheet("Attendance",attRows);

    // CLIENT PAYMENTS
    const cpRows=(data.client_payments||[]).map(p=>{
      const s=(data.stalls||[]).find(x=>x.id===p.stall_id);
      return[p.date,p.activity,s?.name||"General",p.amount,p.status,p.notes||""];
    });
    await syncSheet("ClientPayments",cpRows);

    // HANDOVERS
    const hoRows=(data.handovers||[]).map(h=>{
      const u=(data.users||[]).find(x=>x.id===h.supervisor_id);
      const s=(data.stalls||[]).find(x=>x.id===h.stall_id);
      return[h.date_given,u?.name||"",s?.name||"General",h.amount_given,h.amount_returned||0,h.date_returned||"Pending",h.notes||""];
    });
    await syncSheet("Handovers",hoRows);

    // EXPENSES
    const exRows=(data.expenses||[]).map(e=>{
      const u=(data.users||[]).find(x=>x.id===e.user_id);
      const s=(data.stalls||[]).find(x=>x.id===e.stall_id);
      return[e.date,u?.name||"",e.type,e.amount,s?.name||"",e.notes||""];
    });
    await syncSheet("Expenses",exRows);

    // SALARY
    const salRows=data.salary.map(r=>{
      const u=(data.users||[]).find(x=>x.id===r.user_id);
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
  const [page,setPage]=useState(()=>{const u=getSaved();return u?(u.role==="admin"?"dash":u.role==="supervisor"?"dash":u.role==="client"?"client_dash":"my-dash"):"dash";});
  
  
  const [data,setData]=useState(initData());
  const [toastMsg,setToastMsg]=useState("");
  const [sideOpen,setSideOpen]=useState(false);

  const toast=(m)=>setToastMsg(m);
  const logout=()=>{localStorage.removeItem("shinkore_session");setUser(null);setPage("dash");};
  const doLogin=(u)=>{const d=initData();const fresh=d.users.find(x=>x.id===u.id)||u;localStorage.setItem("shinkore_session",JSON.stringify(fresh));setUser(fresh);setPage(fresh.role==="admin"?"dash":"my-dash");};

  const titles={dash:"Dashboard","my-dash":"My Dashboard",staff:"Staff & Teams",stalls:"Permission Stalls",alloc:"Allocations",attend:"Attendance",cash:"Cash & Finance",salary:"Salary & Slips",alerts:"Late Alerts",settings:"Settings","clock-in":"Clock In / Out","my-salary":"My Salary",activity:"Activity Reports","my-activity":"My Activities",personal:"Personal Finance",sync:"Google Sheets Sync",apk:"Install APK / PWA"};

  const urlRole=window.location.pathname.includes("admin")?"admin":window.location.pathname.includes("supervisor")?"supervisor":window.location.pathname.includes("ba")?"ba":""; if(!user) return <><style>{css}</style><Login onLogin={doLogin} urlRole={urlRole}/></>;

  const isAdmin=user.role==="admin";

  const render=()=>{
    if(isAdmin){
      switch(page){
        case "dash": return <AdminDash data={data} toast={toast}/>;
        case "staff": return <StaffPage data={data} setData={setData} toast={toast}/>;
        case "stalls": return <StallsPage data={data} setData={setData} toast={toast}/>;
        case "alloc": return <AllocPage data={data} setData={setData} toast={toast}/>;
        case "attend": return <AttendancePage data={data} setData={setData} toast={toast}/>;
        case "alerts": return <AlertsPage data={data} toast={toast}/>;
        case "personal": return <PersonalPage data={data} setData={setData} toast={toast}/>;
        case "activity": return <ActivityPage user={user} data={data} setData={setData} toast={toast}/>;
        case "daily_plan": return <DailyPlanPage user={user} data={data} setData={setData} toast={toast}/>;
        case "clients": return <ClientsPage user={user} data={data} setData={setData} toast={toast}/>;
        case "client_pdf": return <ClientPDFPage user={user} data={data} toast={toast}/>;
        case "client_dash": return <ClientDashPage user={user} data={data} toast={toast}/>;
        case "settings": return <SettingsPage data={data} setData={setData} toast={toast}/>;
        case "sync": return <SyncPage data={data} setData={setData} toast={toast}/>;
        case "apk": return <ApkPage/>;
        case "cash": return <CashPage data={data} setData={setData} toast={toast}/>;
        case "salary": return <SalaryPage data={data} setData={setData} toast={toast}/>;
        default: return <AdminDash data={data}/>;
      }
    } else if(user.role==="client"){
      return <ClientDashPage user={user} data={data} toast={toast}/>;
    } else {
      switch(page){
        case "my-dash": return <MyDash user={user} data={data}/>;
        case "clock-in": return <ClockPage user={user} data={data} setData={setData} toast={toast}/>;
        case "my-salary": return <MySalaryPage user={user} data={data}/>;
        case "my-activity": return <ActivityPage user={user} data={data} setData={setData} toast={toast}/>;
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
