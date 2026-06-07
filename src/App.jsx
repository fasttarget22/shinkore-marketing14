// rebuild trigger 1
import { useState, useEffect, useRef } from "react";
import { css } from "./styles.js";
import { createClient } from "@supabase/supabase-js";
const SB=createClient("https://isqlqmhueoiwnlcsvsfg.supabase.co","sb_publishable_hPu0RIbvCd_DBCM4s2lH2g_U6CONZdr");
const pushToSB=async(table,rows)=>{if(!rows||rows.length===0)return true;try{const{error}=await SB.from(table).upsert(rows,{onConflict:"id"});if(!error)return true;console.log("SB batch error",table,error,"— retrying row by row");
  // Batch failed (often one bad row). Retry individually so good rows still save.
  let allOk=true;
  for(const row of rows){
    try{const{error:e2}=await SB.from(table).upsert([row],{onConflict:"id"});if(e2){console.log("SB row skipped",table,row.id,e2.message);allOk=false;}}
    catch(er){console.log("SB row exception",table,row.id,er);allOk=false;}
  }
  return allOk;
}catch(e){console.log("SB error",table,e);return false;}};
let syncStatusCb=null;
const setSyncStatusCb=(fn)=>{syncStatusCb=fn;};
const deleteFromSB=async(table,id)=>{try{const{error}=await SB.from(table).delete().eq("id",id);if(error){console.log("SB delete error",table,error);return false;}return true;}catch(e){console.log("SB delete error",table,e);return false;}};
const loadFromSB=async()=>{try{const tables=["sm_users","sm_stalls","sm_allocations","sm_attendance","sm_client_payments","sm_handovers","sm_expenses","sm_salary","sm_personal","sm_trainings","sm_training_done","sm_documents","sm_dtd_clock"];const results={};for(const t of tables){const{data}=await SB.from(t).select("*");results[t]=data||[];}return results;}catch(e){return null;}};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
console.log("[DEBUG] Admin pass:", import.meta.env.VITE_ADMIN_PASSWORD ? "loaded, length=" + import.meta.env.VITE_ADMIN_PASSWORD.length : "UNDEFINED - env var not reaching build");
const hashPIN=async(pin)=>{const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(pin)));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");};
const isHashed=(pin)=>typeof pin==="string"&&/^[0-9a-f]{64}$/.test(pin);
const COMPANY = "Shinkore Marketing";
const ADMIN_PHONES = (import.meta.env.VITE_ADMIN_PHONES||"00923135443656,00923174886655,00923159279212").split(",").filter(Boolean);
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
const IMGBB_KEY=import.meta.env.VITE_IMGBB_KEY;
const uploadPhoto=async(file)=>{const fd=new FormData();fd.append("image",file);fd.append("key",IMGBB_KEY);try{const r=await fetch("https://api.imgbb.com/1/upload",{method:"POST",body:fd});const d=await r.json();if(d.success)return{url:d.data.url,thumb:d.data.thumb.url};return null;}catch{return null;}};

const getClientSettings=(client)=>{
  const s=client?.settings||{};
  return{
    stall_enabled:  s.stall_enabled  ??true,
    dtd_enabled:    s.dtd_enabled    ??true,
    sop_required:   s.sop_required   ??false,
    gps_required:   s.gps_required   ??false,
    activities:{
      sampling: s.activities?.sampling??true,
      gifting:  s.activities?.gifting ??true,
      sales:    s.activities?.sales   ??true,
    },
    bonus: s.bonus||{metric:"units",tiers:[]},
  };
};

// Returns {workdays, doors, units, revenue} each {actual, target, pct} or null if no target row found.
const calcAchievement=(campaign,ba_id,visits,items,targets,products)=>{
  const target=targets.find(t=>t.campaign_id===campaign.id&&t.ba_id===ba_id);
  if(!target)return null;
  const today=new Date().toISOString().slice(0,10);
  const periodEnd=campaign.end_date&&campaign.end_date<today?campaign.end_date:today;
  const workdays=Math.max(1,Math.round((new Date(periodEnd)-new Date(campaign.start_date))/86400000)+1);
  const baVisits=(visits||[]).filter(v=>v.campaign_id===campaign.id&&v.ba_id===ba_id);
  const visitIds=new Set(baVisits.map(v=>v.id));
  const saleItems=(items||[]).filter(i=>visitIds.has(i.visit_id)&&i.type==="sale");
  const actualDoors=baVisits.length;
  const actualUnits=saleItems.reduce((s,i)=>s+(Number(i.qty)||0),0);
  const actualRevenue=saleItems.reduce((s,i)=>s+(Number(i.qty)||0)*((products||[]).find(p=>p.id===i.product_id)?.unit_price||0),0);
  const doorTarget=(target.doors_per_day||0)*workdays;
  const unitTarget=(target.units_per_day||0)*workdays;
  const revTarget=target.revenue_target||0;
  return{
    workdays,
    doors:{actual:actualDoors,target:doorTarget,pct:doorTarget>0?actualDoors/doorTarget*100:null},
    units:{actual:actualUnits,target:unitTarget,pct:unitTarget>0?actualUnits/unitTarget*100:null},
    revenue:{actual:actualRevenue,target:revTarget,pct:revTarget>0?actualRevenue/revTarget*100:null},
  };
};

// Returns PKR earned (highest matching tier) or 0.  Returns 0 (invisible) when tiers empty.
const calcBonus=(achievement,bonusCriteria)=>{
  if(!achievement||!bonusCriteria||!(bonusCriteria.tiers||[]).length)return 0;
  const metric=bonusCriteria.metric||"units";
  const pct=achievement[metric]?.pct;
  if(pct===null||pct===undefined)return 0;
  const eligible=(bonusCriteria.tiers).filter(t=>pct>=Number(t.pct)).sort((a,b)=>Number(b.pct)-Number(a.pct));
  return eligible.length?Number(eligible[0].amount):0;
};

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
    dtd_clock: [],
    client_payments: [],
    handovers: [],
    expenses: [],
    salary: [],
    documents: [],
    personal: [],
    activity_photos: [],
    stock_items: [],
    remarks: [],
    targets: [],
    activities: [],
    clients: [{id:"c1",name:"Shahadat",brand:"Brite",phone:"03001234999",email:"",pin:"1234",active:true}],
    daily_plans: [],
    trainings: [],
    training_done: [],
    callmebot: { admin1:"", admin2:"" },
    sheets_url: "", csv_exported: false,
  };
};
const save = (d) => {
  localStorage.setItem("shinkore_v2", JSON.stringify(d));
  if(syncStatusCb) syncStatusCb("syncing");
  SB.from("sm_settings").upsert({id:"sheets_url",value:d.sheets_url||""},{onConflict:"id"})
    .then(({error})=>{if(error)console.error("[save] sm_settings upsert failed:",error);})
    .catch(e=>console.error("[save] sm_settings exception:",e));
  Promise.all([
    pushToSB("sm_users", d.users||[]),
    pushToSB("sm_stalls", d.stalls||[]),
    pushToSB("sm_allocations", d.allocations||[]),
    pushToSB("sm_attendance", d.attendance||[]),
    pushToSB("sm_client_payments", d.client_payments||[]),
    pushToSB("sm_handovers", d.handovers||[]),
    pushToSB("sm_expenses", d.expenses||[]),
    pushToSB("sm_salary", d.salary||[]),
    pushToSB("sm_documents", d.documents||[]),
    pushToSB("sm_personal", d.personal||[]),
    pushToSB("sm_trainings", d.trainings||[]),
    pushToSB("sm_training_done", d.training_done||[])
  ]).then(function(results){
    var allOk=results.every(function(r){return r===true;});
    if(syncStatusCb) syncStatusCb(allOk?"synced":"failed");
  });
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
// Normalise any stored format to a bare international number for wa.me / CallMeBot.
// "00923…" → "923…"  |  "03…" → "923…"  |  "923…" → "923…" (unchanged)
const waNumber = (phone) => {
  const clean = phone.replace(/[^0-9]/g,"");
  if (clean.startsWith("92")) return clean;
  if (clean.startsWith("00")) return clean.slice(2);
  if (clean.startsWith("0"))  return "92" + clean.slice(1);
  return "92" + clean;
};

const sendWA = (phone, msg) => {
  window.open(`https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(msg)}`,"_blank");
};

const sendCallMeBot = async (phone, apiKey, msg) => {
  if (!apiKey) return false;
  const num = waNumber(phone);
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
    box:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    flag:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
    chart:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    briefcase:<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="2" y1="13" x2="22" y2="13"/></svg>,
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
  const [showAccess,setShowAccess]=useState(false);
  const [accessCode,setAccessCode]=useState("");
  const [accessErr,setAccessErr]=useState("");
  const [accessLoading,setAccessLoading]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const data=initData();

  const doIn=async()=>{
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
    if(u.role!=="admin"){
      if(!u.pin||!u.pin.trim()) return setErr("Wrong PIN. Contact admin if forgotten.");
      if(isHashed(u.pin)){
        const h=await hashPIN(f.pass.trim());
        if(h!==u.pin) return setErr("Wrong PIN. Contact admin if forgotten.");
      } else {
        if(f.pass.trim()!==u.pin.trim()) return setErr("Wrong PIN. Contact admin if forgotten.");
        const h=await hashPIN(f.pass.trim());
        const d=initData();d.users=d.users.map(x=>x.id===u.id?{...x,pin:h}:x);save(d);
      }
    }
    onLogin(u);
  };

  const doEnterPortal=async()=>{
    const code=accessCode.trim().toUpperCase();
    if(!code){setAccessErr("Enter your access code.");return;}
    setAccessLoading(true);setAccessErr("");
    const{data:rows,error}=await SB.from("sm_clients")
      .select("id,name,brand,phone,email,active,settings,access_code")
      .eq("access_code",code)
      .not("access_code","is",null)
      .limit(1);
    setAccessLoading(false);
    if(error||!rows||rows.length===0){setAccessErr("Invalid access code. Try again.");return;}
    const{access_code:_,...session}=rows[0];
    onLogin({...session,role:"client",login_method:"access_code"});
  };

  return(
    <div className="lw">
      <div className="lc">
        <div className="brand">
          <img src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg" alt="Logo" style={{width:56,height:56,borderRadius:12,objectFit:"cover",border:"2px solid rgba(201,168,76,.5)",boxShadow:"0 4px 16px rgba(201,168,76,.2)",flexShrink:0}}/>
          <div><h1>SHINKORE</h1><p>Marketing Operations</p></div>
        </div>
        {!showAccess&&<>
          <div style={{textAlign:"center",marginBottom:8,fontSize:12,color:"var(--txd)"}}>Sign in with your phone and PIN provided by admin</div>
          {err&&<div className="info info-err" style={{marginBottom:14}}><I n="alert" s={15}/>{err}</div>}
          <div className="fg"><label className="fl">Phone Number</label><input className="fi" placeholder="03001234567" value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
          <div className="fg"><label className="fl">PIN / Password</label><input className="fi" type="password" placeholder="Enter your PIN" value={f.pass} onChange={e=>set("pass",e.target.value)}/></div>
          <button className="bp" onClick={doIn}>SIGN IN →</button>
          <div style={{textAlign:"center",margin:"14px 0 4px",fontSize:12,color:"var(--txd)"}}>— or —</div>
          <button className="bs" style={{width:"100%",justifyContent:"center",fontSize:13}} onClick={()=>{setShowAccess(true);setErr("");}}>🔑 Client Portal — Enter Access Code</button>
        </>}
        {showAccess&&<>
          <div style={{textAlign:"center",marginBottom:12,fontSize:13,color:"var(--txd)"}}>Enter your 6-character client access code</div>
          {accessErr&&<div className="info info-err" style={{marginBottom:10}}><I n="alert" s={14}/>{accessErr}</div>}
          <div className="fg">
            <label className="fl">Access Code</label>
            <input className="fi" placeholder="e.g. K7X2M9" value={accessCode} maxLength={6}
              style={{textTransform:"uppercase",letterSpacing:6,fontFamily:"monospace",fontSize:20,textAlign:"center"}}
              onChange={e=>setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))}
              onKeyDown={e=>e.key==="Enter"&&doEnterPortal()}/>
          </div>
          <button className="bp" onClick={doEnterPortal} disabled={accessLoading}>{accessLoading?"Verifying…":"ENTER PORTAL →"}</button>
          <button className="bs" style={{width:"100%",justifyContent:"center",marginTop:8,fontSize:12}} onClick={()=>{setShowAccess(false);setAccessErr("");setAccessCode("");}}>← Back to staff login</button>
        </>}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({user,data,page,setPage,open,onClose}){
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
    {id:"training",icon:"users",label:"Training"},
    {id:"clients",icon:"users",label:"Clients"},
    {id:"control-panel",icon:"set",label:"Control Panel"},
    {id:"products",icon:"box",label:"Products"},
    {id:"campaigns",icon:"flag",label:"Campaigns"},
    {id:"dtd-admin",icon:"chart",label:"DTD Reports"},
    {id:"careers",icon:"briefcase",label:"Careers"},
    {id:"sops",icon:"pdf",label:"SOP Manager"},
    {id:"client_pdf",icon:"pdf",label:"Client Report PDF"},
    {id:"letters",icon:"pdf",label:"Letters & Documents"},
    {id:"documents",icon:"pdf",label:"Document History"},
    {id:"settings",icon:"set",label:"Settings"},
  ];
  const isAllocated=(data.allocations||[]).some(function(a){return a.user_id===user.id&&a.active;});
  const isSupervisor=user.role==="supervisor";
  const staffNav=isAllocated?(isSupervisor?[
    {id:"my-dash",icon:"dash",label:"My Dashboard"},
    {id:"clock-in",icon:"clock",label:"Clock In / Out"},
    {id:"my-salary",icon:"money",label:"My Salary"},
    {id:"documents",icon:"pdf",label:"My Documents"},
    {id:"activity",icon:"map",label:"Activity Reports"},
    {id:"attend",icon:"clock",label:"Attendance"},
    {id:"alerts",icon:"alert",label:"Late Alerts"},
    {id:"training",icon:"users",label:"Training"},
    {id:"dtd-dash",icon:"map",label:"DTD Visits"},
  ]:[
    {id:"my-dash",icon:"dash",label:"My Dashboard"},
    {id:"clock-in",icon:"clock",label:"Clock In / Out"},
    {id:"my-salary",icon:"money",label:"My Salary"},
    {id:"documents",icon:"pdf",label:"My Documents"},
    {id:"my-activity",icon:"map",label:"My Activities"},
    {id:"attend",icon:"clock",label:"Attendance"},
    {id:"training",icon:"users",label:"Training"},
    {id:"dtd-dash",icon:"map",label:"DTD Visits"},
  ]):[
    {id:"my-dash",icon:"dash",label:"My Dashboard"},
    {id:"my-salary",icon:"money",label:"My Salary"},
    {id:"documents",icon:"pdf",label:"My Documents"},
    {id:"dtd-dash",icon:"map",label:"DTD Visits"},
  ];
  const clientNav=[
    {id:"client_dash",icon:"dash",label:"My Dashboard"},
    {id:"client_portal",icon:"chart",label:"DTD Activity"},
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
function AdminDash({data,toast,setPage}){
  const hour = new Date().getHours();
  const greeting = hour<12?"Good Morning":hour<17?"Good Afternoon":"Good Evening";
  const quotes = [
    "Building Brands. Empowering Teams. Delivering Excellence.",
    "Excellence is not a destination — it is a continuous journey.",
    "Great teams don't happen by chance. They are built with purpose.",
    "Every stall. Every BA. Every day. That is how we win.",
    "Field excellence today. Market leadership tomorrow."
  ];
  const quote = quotes[new Date().getDay() % quotes.length];
  const todayDate=new Date().toISOString().slice(0,10);
  const [alertPopup,setAlertPopup]=useState(null);
  const [alertDismissed,setAlertDismissed]=useState([]);
  useEffect(()=>{
    const check=async()=>{
      const now=new Date();
      const today=now.toISOString().slice(0,10);
      const cur=now.getHours()*60+now.getMinutes();
      const att=(data.attendance||[]).filter(a=>a.date===today);
      const absent=data.allocations.filter(a=>a.active).filter(a=>{
        const userExists=(data.users||[]).some(x=>x.id===a.user_id);
        if(!userExists)return false;
        const h=(a.duty_start||"09:00").split(":");
        const duty=Number(h[0])*60+Number(h[1]);
        return cur>duty+30&&!att.find(x=>x.user_id===a.user_id)&&!(alertDismissed||[]).includes(a.user_id);
      });
      if(absent.length>0&&!alertPopup){
        const details=absent.map(a=>{
          var u=(data.users||[]).find(x=>x.id===a.user_id);
          var s=(data.stalls||[]).find(x=>x.id===a.stall_id);
          return (u?u.name:"?")+"/"+(u?u.role:"")+" at "+(s?s.name:"?")+","+(s?s.city:"")+" duty:"+a.duty_start;
        }).join("; ");
        setAlertPopup({absent,details,msg:absent.length+" staff not checked in on time!"});
      }
    };
    check();
    const t=setInterval(check,5*60*1000);
    return()=>clearInterval(t);
  },[data.attendance,data.allocations]);
  const todayActs=(data.activities||[]).filter(a=>a.date===todayDate);
  const pendingApprovals=todayActs.filter(a=>a.approval_status==="submitted").length;
  const stuckReports=(data.activities||[]).filter(function(a){
    if(a.approval_status!=="submitted")return false;
    if(!a.submitted_at)return false;
    var hrs=(Date.now()-new Date(a.submitted_at).getTime())/3600000;
    return hrs>12;
  });
  const highRemarks=(data.activities||[]).filter(a=>a.ba_remark_cat==="high"||a.sup_remark_cat==="high").length;
  // Staff who clocked in today but submitted NO activity report
  const noReportStaff=(data.allocations||[]).filter(function(a){
    if(!a.active)return false;
    var att=(data.attendance||[]).find(function(x){return x.user_id===a.user_id&&x.date===todayDate;});
    if(!att)return false;
    var dutyH=parseInt((a.duty_start||"09:00").split(":")[0],10);
    var nowH=new Date().getHours();
    if(nowH<dutyH+6)return false;
    var hasReport=(data.activities||[]).find(function(act){return act.user_id===a.user_id&&act.date===todayDate;});
    return !hasReport;
  });
  const staff=(data.users||[]).filter(u=>u.role!=="admin");
  const today=new Date().toISOString().slice(0,10);
  const todayAtt=(data.attendance||[]).filter(a=>a.date===today);
  const activeAlloc=data.allocations.filter(a=>a.active);
  const thisMonth=today.slice(0,7);
  const monthActs=(data.activities||[]).filter(a=>a.date&&a.date.startsWith(thisMonth));
  const totalInterceptions=monthActs.reduce((s,a)=>s+Number(a.total_interceptions||0),0);
  const totalSales=monthActs.reduce((s,a)=>s+Number(a.total_pcs||0),0);
  const notCheckedIn=activeAlloc.filter(a=>!todayAtt.find(x=>x.user_id===a.user_id)).length;

  return(
    <div>
      <div style={{background:"linear-gradient(135deg,rgba(201,168,76,.1) 0%,rgba(201,168,76,.03) 60%,transparent 100%)",border:"1px solid rgba(201,168,76,.22)",borderRadius:18,padding:"20px 22px",marginBottom:22,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-50,right:-50,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,168,76,.1) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
          <img src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg" alt="Logo" style={{width:58,height:58,borderRadius:12,objectFit:"cover",border:"2px solid rgba(201,168,76,.5)",flexShrink:0,boxShadow:"0 4px 16px rgba(201,168,76,.25)"}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--g)",letterSpacing:.5,lineHeight:1,whiteSpace:"nowrap"}}>SHINKORE MARKETING</div>
            <div style={{fontSize:10,color:"var(--txd)",letterSpacing:1.5,textTransform:"uppercase",marginTop:2,whiteSpace:"nowrap"}}>Marketing Operations</div>
            <div style={{fontSize:10,color:"var(--txd)",marginTop:4,display:"flex",flexDirection:"column",gap:2}}>
              <span>👤 CEO: Khalid Orakzai</span>
              <span>📍 Civil Officer Col Office 28, Abbottabad</span>
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>{greeting}</div>
            <div style={{fontFamily:"Rajdhani",fontSize:15,fontWeight:700,color:"var(--g)",marginTop:2}}>{new Date().toLocaleDateString("en-PK",{weekday:"short",day:"numeric",month:"short"})}</div>
          </div>
        </div>
        <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(201,168,76,.35),transparent)",marginBottom:14}}/>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:3,height:30,background:"linear-gradient(180deg,var(--g),transparent)",borderRadius:2,flexShrink:0}}/>
          <div style={{fontSize:12,color:"var(--tx)",fontStyle:"italic",lineHeight:1.6,opacity:.85}}>"{quote}"</div>
        </div>
      </div>
      <div className="sg">
        <div className="sc gold" onClick={()=>setPage&&setPage("staff")} style={{cursor:"pointer"}}><div className="si gold"><I n="users" s={18}/></div><div className="sv">{staff.length}</div><div className="sl">Total Staff</div></div>
        <div className="sc bl" onClick={()=>setPage&&setPage("stalls")} style={{cursor:"pointer"}}><div className="si bl"><I n="pin" s={18}/></div><div className="sv">{(data.stalls||[]).length}</div><div className="sl">Active Stalls</div></div>
        <div className="sc gr" onClick={()=>setPage&&setPage("alloc")} style={{cursor:"pointer"}}><div className="si gr"><I n="alloc" s={18}/></div><div className="sv">{activeAlloc.length}</div><div className="sl">Allocations</div></div>
        <div className="sc rd" onClick={()=>setPage&&setPage("attend")} style={{cursor:"pointer"}}><div className="si rd"><I n="clock" s={18}/></div><div className="sv">{todayAtt.length}</div><div className="sl">Checked In Today</div></div>
      </div>

      {noReportStaff.length>0&&(
        <div className="card" style={{marginBottom:18,border:"1px solid rgba(240,165,0,.4)"}}>
          <div className="ch" style={{borderBottom:"1px solid rgba(240,165,0,.25)"}}>
            <span style={{fontSize:20}}>📋</span>
            <div style={{flex:1}}><div className="ct" style={{color:"var(--or)"}}>Report Not Submitted</div><div className="cs">{noReportStaff.length} staff clocked in but no activity report</div></div>
          </div>
          <div className="cb">
            {noReportStaff.map(function(a){
              var u=(data.users||[]).find(function(x){return x.id===a.user_id;});
              var s=(data.stalls||[]).find(function(x){return x.id===a.stall_id;});
              if(!u||!s)return null;
              return(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600}}>{u.name}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{s.name} · {s.city} · Duty: {a.duty_start}</div>
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    <button className="bw" style={{fontSize:12,padding:"6px 10px"}} onClick={function(){
                      var msg="📋 *SHINKORE MARKETING*\n\n"+
                        "Assalam o Alaikum *"+u.name+"*!\n\n"+
                        "Aap ne aaj "+s.name+", "+s.city+" par duty ki lekin abhi tak apni activity report submit nahi ki.\n\n"+
                        "Bara-e-meharbani app mein apni aaj ki report foran submit karein.\n\n"+
                        "App: https://shinkore-marketing14.pages.dev\n— Khalid Orakzai";
                      sendWA(u.phone,msg);
                    }}><I n="wa" s={13}/>Remind</button>
                    {ADMIN_PHONES.map(ph=>(
                      <button key={ph} style={{fontSize:10,padding:"3px 8px",background:"rgba(201,168,76,.15)",border:"1px solid rgba(201,168,76,.4)",borderRadius:6,cursor:"pointer",color:"var(--g)"}} onClick={()=>sendWA(ph,"⚠️ Reminder sent to "+u.name+" — report not submitted for "+s.name+", "+s.city+".")}>...{waNumber(ph).slice(-4)}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {alertPopup&&(
        <div onClick={function(e){if(e.target===e.currentTarget)setAlertPopup(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"var(--d2)",border:"2px solid var(--rd)",borderRadius:16,padding:20,maxWidth:400,width:"100%",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{fontSize:28}}>🚨</span>
              <div><div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--rd)"}}>ATTENDANCE ALERT</div>
              <div style={{fontSize:11,color:"var(--txd)"}}>{alertPopup.absent.length} staff not checked in</div></div>
            </div>
            <div style={{background:"rgba(231,76,60,.1)",border:"1px solid rgba(231,76,60,.3)",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:12,lineHeight:1.6}}>
              {alertPopup.msg}
            </div>
            {alertPopup.absent.map(function(a){
              var u=(data.users||[]).find(function(x){return x.id===a.user_id;});
              var s=(data.stalls||[]).find(function(x){return x.id===a.stall_id;});
              return(
                <div key={a.user_id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--bo)"}}>
                  <div style={{width:36,height:36,borderRadius:9,background:"rgba(231,76,60,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,color:"var(--rd)"}}>{u?getInitials(u.name):"?"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{u?u.name:"Unknown"}</div>
                    <div style={{fontSize:11,color:"var(--txd)"}}>{s?s.name:"?"}, {s?s.city:"?"} · Duty: {a.duty_start}</div>
                  </div>
                  <button onClick={function(){sendWA(u?u.phone:"","Shinkore: Aap ne abhi tak "+(s?s.name:"stall")+" par check-in nahi kiya. Foran report karein.");}} style={{fontSize:11,background:"rgba(37,211,102,.1)",border:"1px solid rgba(37,211,102,.3)",borderRadius:6,padding:"3px 8px",cursor:"pointer",color:"#25d366"}}>WA</button>
                </div>
              );
            })}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              {ADMIN_PHONES.map(ph=>(
                <button key={ph} onClick={function(){sendWA(ph,"ATTENDANCE ALERT\n"+alertPopup.msg+"\n\n"+alertPopup.details);}} style={{flex:1,background:"rgba(201,168,76,.2)",border:"1px solid rgba(201,168,76,.5)",borderRadius:8,padding:8,cursor:"pointer",color:"var(--g)",fontSize:11,fontWeight:600}}>📤 ...{waNumber(ph).slice(-4)}</button>
              ))}
              <button onClick={function(){setAlertDismissed(function(prev){return prev.concat(alertPopup.absent.map(function(a){return a.user_id;}));});setAlertPopup(null);}} style={{flex:1,background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:8,padding:8,cursor:"pointer",color:"var(--txd)",fontSize:12}}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
      {(pendingApprovals>0||highRemarks>0)&&<div className="sg" style={{marginBottom:16}}>
        {pendingApprovals>0&&<div className="sc rd" onClick={()=>setPage&&setPage("activity")} style={{cursor:"pointer"}}><div className="si rd"><I n="alert" s={18}/></div><div className="sv">{pendingApprovals}</div><div className="sl">Pending Approvals</div></div>}
        {highRemarks>0&&<div className="sc rd" onClick={()=>setPage&&setPage("activity")} style={{cursor:"pointer"}}><div className="si rd"><I n="alert" s={18}/></div><div className="sv">{highRemarks}</div><div className="sl">High Priority</div></div>}
      </div>}
      {stuckReports.length>0&&<div style={{background:"rgba(231,76,60,.1)",border:"1px solid rgba(231,76,60,.3)",borderRadius:12,padding:"12px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setPage&&setPage("activity")}>
        <span style={{fontSize:22}}>⏰</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14,color:"var(--rd)"}}>{stuckReports.length} report{stuckReports.length!==1?"s":""} awaiting approval over 12h</div>
          <div style={{fontSize:12,color:"var(--txd)"}}>Tap to review and approve/reject so BAs aren't left waiting.</div>
        </div>
        <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          {ADMIN_PHONES.map(ph=>(
            <button key={ph} onClick={function(e){e.stopPropagation();var lines=stuckReports.map(function(a){var ba=(data.users||[]).find(function(u){return u.id===a.ba_id;});return (ba?ba.name:"?")+" — "+a.store_name+", "+a.city+" ("+a.date+")";}).join("\n");sendWA(ph,"⏰ STUCK REPORTS — pending approval over 12h:\n\n"+lines);}} style={{background:"rgba(201,168,76,.15)",border:"1px solid rgba(201,168,76,.4)",borderRadius:8,padding:"5px 8px",cursor:"pointer",color:"var(--g)",fontSize:11,whiteSpace:"nowrap"}}>📤 ...{waNumber(ph).slice(-4)}</button>
          ))}
        </div>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div className="card">
          <div className="ch" onClick={()=>setPage&&setPage("alloc")} style={{cursor:"pointer"}}><I n="alloc" s={17} c="var(--g)"/><div><div className="ct">Today's Allocations ↗</div><div className="cs">Who is where today</div></div></div>
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
          <div className="ch" onClick={()=>setPage&&setPage("stalls")} style={{cursor:"pointer"}}><I n="pin" s={17} c="var(--bl)"/><div><div className="ct">Active Stalls ↗</div><div className="cs">Running permissions</div></div></div>
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
  const [f,setF]=useState({name:"",phone:"",role:"ba",daily_rate:"",team:"",callmebot_key:"",paid_by:"admin",sup_id:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const openAdd=()=>{setEditing(null);setF({name:"",phone:"",role:"ba",daily_rate:"",team:"",callmebot_key:""});setShow(true)};
  const [showBulk,setShowBulk]=useState(false);
  const [bulkText,setBulkText]=useState("");
  const doBulkImport=async()=>{
    var lines=bulkText.split("\n").map(function(l){return l.trim();}).filter(Boolean);
    if(lines.length===0){toast("Paste some names and numbers first.");return;}
    var existingPhones={};
    (data.users||[]).forEach(function(u){if(u.phone)existingPhones[u.phone.replace(/[^0-9]/g,"")]=true;});
    const pinHash=await hashPIN("1234");
    var newUsers=[];var added=0,skipped=0;
    lines.forEach(function(line){
      // Skip header-like lines
      if(/^name\s+phone/i.test(line)||/^contacts/i.test(line))return;
      // Find the phone: last token containing 6+ digits
      var m=line.match(/([+0-9][0-9\-\s]{6,})$/);
      var phone="",name=line;
      if(m){phone=m[1].trim();name=line.slice(0,m.index).trim();}
      if(!name){skipped++;return;}
      var digits=phone.replace(/[^0-9]/g,"");
      if(digits&&existingPhones[digits]){skipped++;return;}
      if(digits)existingPhones[digits]=true;
      newUsers.push({id:genId(),name:name,phone:phone||"",role:"ba",daily_rate:0,team:"",callmebot_key:"",pin:pinHash,paid_by:"admin"});
      added++;
    });
    if(added===0){toast("Nothing new to add (all duplicates or empty).");return;}
    var d={...data,users:[...(data.users||[]),...newUsers]};
    setData(d);save(d);setShowBulk(false);setBulkText("");
    toast(added+" staff added"+(skipped>0?", "+skipped+" skipped":"")+". PIN=1234, edit to fix details.");
  };
  const openEdit=(u)=>{setEditing(u);setF({name:u.name,phone:u.phone,role:u.role,daily_rate:u.daily_rate,team:u.team||"",callmebot_key:u.callmebot_key||"",paid_by:u.paid_by||"admin",pin:u.pin||"",sup_id:u.sup_id||"",cnic:u.cnic||"",cnic_front:u.cnic_front||"",cnic_back:u.cnic_back||"",photo:u.photo||"",address:u.address||"",emergency_name:u.emergency_name||"",emergency_phone:u.emergency_phone||"",join_date:u.join_date||"",bank_account:u.bank_account||"",blood_group:u.blood_group||"",hr_notes:u.hr_notes||""});setShow(true)};

  const doSave=async()=>{
    if(!f.name||!f.phone) return;
    const d={...data};
    if(editing){
      const pinVal=!f.pin?(editing.pin||""):isHashed(f.pin)?f.pin:await hashPIN(f.pin);
      d.users=d.users.map(u=>u.id===editing.id?{...u,...f,daily_rate:Number(f.daily_rate),pin:pinVal}:u);
    } else {
      if(d.users.find(u=>u.phone===f.phone)){toast("Phone exists!");return;}
      const pinVal=f.pin?await hashPIN(f.pin):"";
      d.users.push({id:genId(),...f,daily_rate:Number(f.daily_rate),pin:pinVal});
    }
    setData(d);save(d);setShow(false);toast(editing?"Updated!":"Staff added!");
  };

  const doDel=(u)=>{
    if(!confirm(`Delete ${u.name}?`)) return;
    var orphanAllocs=(data.allocations||[]).filter(x=>x.user_id===u.id);
    var orphanAtt=(data.attendance||[]).filter(x=>x.user_id===u.id);
    const d={...data,users:(data.users||[]).filter(x=>x.id!==u.id),allocations:(data.allocations||[]).filter(x=>x.user_id!==u.id),attendance:(data.attendance||[]).filter(x=>x.user_id!==u.id)};
    setData(d);save(d);deleteFromSB("sm_users",u.id);orphanAllocs.forEach(function(a){deleteFromSB("sm_allocations",a.id);});orphanAtt.forEach(function(a){deleteFromSB("sm_attendance",a.id);});toast("Removed.");
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
          <button className="bs" onClick={()=>setShowBulk(true)}><I n="users" s={15}/>📋 Bulk Import</button>
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

                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,background:"var(--d3)",borderRadius:8,padding:"6px 10px"}}>
                  <span style={{fontSize:11,color:"var(--txd)"}}>🔑 Login PIN:</span>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--g)",letterSpacing:1}}>{isHashed(u.pin)?"●●●● (secured)":u.pin||"— not set —"}</span>
                  {u.pin&&!isHashed(u.pin)&&<button onClick={()=>{navigator.clipboard.writeText(u.pin);toast("PIN copied!");}} style={{marginLeft:"auto",fontSize:10,background:"transparent",border:"1px solid var(--bo)",borderRadius:5,padding:"2px 8px",cursor:"pointer",color:"var(--txd)"}}>Copy</button>}
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

      {showBulk&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowBulk(false)}>
          <div className="md">
            <div className="mh"><div className="mt">📋 Bulk Import Staff</div><div className="mc" onClick={()=>setShowBulk(false)}>×</div></div>
            <div className="mb">
              <div className="info info-blue" style={{marginBottom:12}}><I n="alert" s={14}/><div>Paste one per line: <strong>Name then Phone</strong>. All added as BA, PIN <strong>1234</strong>, rate 0 — edit each later to fix. Duplicates (same phone) are skipped.</div></div>
              <textarea className="fi" value={bulkText} onChange={e=>setBulkText(e.target.value)} rows={10} style={{minHeight:200,fontFamily:"monospace",fontSize:12,lineHeight:1.6}} placeholder={"Iqra Kamra BA +923180989404\nKomal Haripur BA +923140920914\n..."}/>
              <div className="ma"><button className="bs" onClick={()=>setShowBulk(false)}>Cancel</button><button className="bg" onClick={doBulkImport}><I n="ok" s={15}/>Import All</button></div>
            </div>
          </div>
        </div>
      )}
      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">{editing?"Edit Staff":"Add Staff"}</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="frow">
                <div className="fg" style={{flexBasis:"100%"}}>
                  {("contacts" in navigator && "ContactsManager" in window)&&<button type="button" onClick={async()=>{try{var sel=await navigator.contacts.select(["name","tel"],{multiple:false});if(sel&&sel[0]){var picked=sel[0];if(picked.name&&picked.name[0])set("name",picked.name[0]);if(picked.tel&&picked.tel[0]){var num=picked.tel[0].replace(/\s|-/g,"");set("phone",num);}toast("Contact picked!");}}catch(err){toast("Could not open contacts.");}}} style={{width:"100%",marginBottom:10,background:"rgba(58,155,213,.12)",border:"1px solid rgba(58,155,213,.3)",borderRadius:8,padding:"8px",cursor:"pointer",color:"var(--bl)",fontSize:13,fontWeight:600}}>📇 Pick from Phone Contacts</button>}
                </div>
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
              {f.role==="ba"&&<div className="fg"><label className="fl">Reports To (Supervisor)</label>
                <select className="fsel" value={f.sup_id||""} onChange={e=>set("sup_id",e.target.value)}>
                  <option value="">-- No supervisor --</option>
                  {(data.users||[]).filter(u=>u.role==="supervisor").map(s=><option key={s.id} value={s.id}>{s.name} · {s.phone}</option>)}
                </select>
                <div style={{fontSize:11,color:"var(--txd)",marginTop:5}}>This BA will appear under the selected supervisor.</div>
              </div>}

              <div style={{borderTop:"1px solid var(--bo)",margin:"14px 0 10px",paddingTop:12}}>
                <div style={{fontFamily:"Rajdhani",fontSize:15,fontWeight:700,color:"var(--g)",marginBottom:10}}>📋 Employee Profile (HR)</div>
                <div className="frow">
                  <div className="fg"><label className="fl">CNIC Number</label><input className="fi" value={f.cnic||""} onChange={e=>set("cnic",e.target.value)} placeholder="00000-0000000-0"/></div>
                  <div className="fg"><label className="fl">Blood Group</label><input className="fi" value={f.blood_group||""} onChange={e=>set("blood_group",e.target.value)} placeholder="e.g. B+"/></div>
                </div>
                <div className="fg"><label className="fl">Address</label><input className="fi" value={f.address||""} onChange={e=>set("address",e.target.value)} placeholder="Full address"/></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Emergency Contact Name</label><input className="fi" value={f.emergency_name||""} onChange={e=>set("emergency_name",e.target.value)}/></div>
                  <div className="fg"><label className="fl">Emergency Phone</label><input className="fi" value={f.emergency_phone||""} onChange={e=>set("emergency_phone",e.target.value)}/></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Join Date</label><input className="fi" type="date" value={f.join_date||""} onChange={e=>set("join_date",e.target.value)}/></div>
                  <div className="fg"><label className="fl">Bank / JazzCash / Easypaisa</label><input className="fi" value={f.bank_account||""} onChange={e=>set("bank_account",e.target.value)} placeholder="Account for salary"/></div>
                </div>
                <div className="fg"><label className="fl">HR Notes</label><input className="fi" value={f.hr_notes||""} onChange={e=>set("hr_notes",e.target.value)} placeholder="Education, remarks, etc."/></div>
                <div style={{fontSize:11,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1,margin:"10px 0 8px"}}>Documents</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{k:"photo",label:"Photo"},{k:"cnic_front",label:"CNIC Front"},{k:"cnic_back",label:"CNIC Back"}].map(function(doc){
                    return(
                      <div key={doc.k} style={{flex:1,minWidth:90}}>
                        <label className="fl" style={{display:"block",marginBottom:4}}>{doc.label}</label>
                        {f[doc.k]?(
                          <div style={{position:"relative"}}>
                            <img src={f[doc.k]} style={{width:"100%",height:80,objectFit:"cover",borderRadius:8,border:"1px solid var(--bo)"}}/>
                            <button onClick={()=>set(doc.k,"")} style={{position:"absolute",top:-6,right:-6,background:"var(--rd)",border:"none",borderRadius:"50%",width:18,height:18,color:"#fff",fontSize:12,cursor:"pointer"}}>×</button>
                          </div>
                        ):(
                          <label style={{display:"flex",alignItems:"center",justifyContent:"center",height:80,border:"1px dashed var(--bo)",borderRadius:8,cursor:"pointer",fontSize:11,color:"var(--txd)"}}>
                            + Upload
                            <input type="file" accept="image/*" style={{display:"none"}} onChange={async(e)=>{var file=e.target.files[0];if(!file)return;toast("Uploading "+doc.label+"...");var r=await uploadPhoto(file);if(r){set(doc.k,r.url);toast(doc.label+" uploaded!");}else toast("Upload failed.");e.target.value="";}}/>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
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
  const emptyF={name:"",city:"",dept:"",focal_name:"",focal_mob:"",latitude:"",longitude:"",from_date:"",to_date:"",num_days:"",client:"",duty_start:"09:00",perm_cost:"",perm_charged:"",ba_cost:"",ba_charged:"",sup_cost:"",sup_charged:"",other_cost:"",other_charged:"",notes:"",products:[],activities:[]};
  const [f,setF]=useState(emptyF);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const calc=(fm)=>{const d=Number(fm.num_days)||1;const tc=(Number(fm.perm_charged)||0)+(Number(fm.ba_charged)||0)*d+(Number(fm.sup_charged)||0)*d+(Number(fm.other_charged)||0);const tx=(Number(fm.perm_cost)||0)+(Number(fm.ba_cost)||0)*d+(Number(fm.sup_cost)||0)*d+(Number(fm.other_cost)||0);return{tc,tx,profit:tc-tx};};

  const [clientProducts,setClientProducts]=useState([]);
  const [loadingProds,setLoadingProds]=useState(false);
  const [showNewProd,setShowNewProd]=useState(false);
  const [newProd,setNewProd]=useState({name:"",sku:"",unit_price:""});
  const [savingProd,setSavingProd]=useState(false);

  useEffect(()=>{
    if(!f.client){setClientProducts([]);setLoadingProds(false);return;}
    const match=(data.clients||[]).find(c=>(c.name||"").toLowerCase()===f.client.toLowerCase()||(c.brand||"").toLowerCase()===f.client.toLowerCase());
    if(!match){setClientProducts([]);setLoadingProds(false);return;}
    setLoadingProds(true);
    SB.from("sm_products").select("*").eq("client_id",match.id).then(({data:rows})=>{setClientProducts(rows||[]);setLoadingProds(false);});
  },[f.client]);

  const toggleProduct=(id,checked)=>set("products",checked?[...(f.products||[]).filter(x=>x!==id),id]:(f.products||[]).filter(x=>x!==id));
  const toggleActivity=(val,checked)=>set("activities",checked?[...(f.activities||[]).filter(x=>x!==val),val]:(f.activities||[]).filter(x=>x!==val));

  const saveNewProd=async()=>{
    if(!newProd.name.trim()||!newProd.sku.trim()) return toast("Product name and SKU required.");
    const match=(data.clients||[]).find(c=>(c.name||"").toLowerCase()===f.client.toLowerCase()||(c.brand||"").toLowerCase()===f.client.toLowerCase());
    if(!match) return toast("Client not found in clients list.");
    const dupSku=clientProducts.some(p=>p.sku.trim().toLowerCase()===newProd.sku.trim().toLowerCase());
    if(dupSku) return toast(`SKU "${newProd.sku}" already exists for this client.`);
    setSavingProd(true);
    const row={id:crypto.randomUUID(),client_id:match.id,name:newProd.name.trim(),sku:newProd.sku.trim().toUpperCase(),unit_price:Number(newProd.unit_price)||0};
    const{error}=await SB.from("sm_products").insert([row]);
    setSavingProd(false);
    if(error){toast("Failed to add product: "+error.message);return;}
    setClientProducts(cp=>[...cp,row]);
    setF(fv=>({...fv,products:[...(fv.products||[]),row.id]}));
    setNewProd({name:"",sku:"",unit_price:""});setShowNewProd(false);
    toast("Product added and selected!");
  };

  const [gpsCapturing,setGpsCapturing]=useState(false);
  const [gpsAccuracy,setGpsAccuracy]=useState(null);
  const getMyLoc=()=>{
    if(!navigator.geolocation) return toast("GPS not available");
    setGpsCapturing(true);
    setGpsAccuracy(null);
    navigator.geolocation.getCurrentPosition(p=>{
      const acc=Math.round(p.coords.accuracy);
      set("latitude",p.coords.latitude.toFixed(6));
      set("longitude",p.coords.longitude.toFixed(6));
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

  const openAdd=()=>{setEditing(null);setF(emptyF);setShowNewProd(false);setNewProd({name:"",sku:"",unit_price:""});setShow(true)};
  const openEdit=(s)=>{setEditing(s);setF({...emptyF,...s,products:Array.isArray(s.products)?s.products:[],activities:Array.isArray(s.activities)?s.activities:[]});setShowNewProd(false);setNewProd({name:"",sku:"",unit_price:""});setShow(true)};

  const doSave=()=>{
    if(!f.name||!f.city) return toast("Name and city required.");
    const{tc,tx,profit}=calc(f);
    const sid=editing?editing.id:genId();
    const sd={...f,id:sid,num_days:Number(f.num_days)||0,client_charged:tc,total_cost:tx,profit,perm_cost:Number(f.perm_cost)||0,perm_charged:Number(f.perm_charged)||0,ba_cost:Number(f.ba_cost)||0,ba_charged:Number(f.ba_charged)||0,sup_cost:Number(f.sup_cost)||0,sup_charged:Number(f.sup_charged)||0,other_cost:Number(f.other_cost)||0,other_charged:Number(f.other_charged)||0,latitude:f.latitude?Number(f.latitude):null,longitude:f.longitude?Number(f.longitude):null,products:Array.isArray(f.products)?f.products:[],activities:Array.isArray(f.activities)?f.activities:[]};
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
    setData(d);save(d);deleteFromSB("sm_stalls",s.id);toast("Stall removed.");
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
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>GPS</div><div style={{fontSize:13,fontWeight:600,color:s.latitude&&s.longitude?"var(--g)":"var(--rd)"}}>{s.latitude&&s.longitude?"🎯 Verified":"❌ Not Set"}</div></div>
                  <div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Duty Start</div><div style={{fontSize:13,fontWeight:600}}>{s.duty_start}</div></div>
                  {s.latitude&&s.longitude&&<div><div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1}}>Coordinates</div><div style={{fontSize:12,color:"var(--bl)"}}>{Number(s.latitude).toFixed(4)}, {Number(s.longitude).toFixed(4)}</div></div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:"var(--txd)"}}>Assigned:</span>
                  {assigned.length===0&&<span style={{fontSize:12,color:"var(--txd)"}}>No staff yet</span>}
                  {assigned.map(a=>{
                    const u=(data.users||[]).find(x=>x.id===a.user_id);
                    return u?<span key={a.id} style={{background:"var(--gd)",border:"1px solid var(--bo)",borderRadius:20,padding:"2px 10px",fontSize:12,color:"var(--gl)"}}>{u.name}</span>:null;
                  })}
                </div>
                {((s.activities||[]).length>0||(s.products||[]).length>0)&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                    {(s.activities||[]).map(a=>(
                      <span key={a} style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:a==="sampling"?"rgba(58,155,213,.15)":a==="gifting"?"rgba(201,168,76,.15)":"rgba(46,204,113,.15)",color:a==="sampling"?"var(--bl)":a==="gifting"?"var(--g)":"var(--gr)",border:"1px solid "+(a==="sampling"?"rgba(58,155,213,.3)":a==="gifting"?"rgba(201,168,76,.3)":"rgba(46,204,113,.3)"),textTransform:"capitalize"}}>{a}</span>
                    ))}
                    {(s.products||[]).length>0&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:"rgba(201,168,76,.08)",color:"var(--g)",border:"1px solid rgba(201,168,76,.2)"}}>{(s.products||[]).length} product{(s.products||[]).length!==1?"s":""}</span>}
                  </div>
                )}
                {s.notes&&<div style={{fontSize:11,color:"var(--txd)",marginTop:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.notes}</div>}
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
                <div className="fg"><label className="fl">Client</label>
                  <select className="fsel" value={f.client} onChange={e=>set("client",e.target.value)}>
                    <option value="">-- Select client --</option>
                    {(data.clients||[]).map(c=><option key={c.id} value={c.name}>{c.name}{c.brand?" — "+c.brand:""}</option>)}
                  </select>
                </div>
              </div>
              {/* Products / SKUs */}
              <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:8}}>📦 Products / SKUs</div>
                {!f.client?(
                  <div style={{fontSize:12,color:"var(--txd)"}}>Select a client above to load their products.</div>
                ):loadingProds?(
                  <div style={{fontSize:12,color:"var(--txd)"}}>Loading products...</div>
                ):(
                  <>
                    {clientProducts.length===0&&!showNewProd&&(
                      <div style={{fontSize:12,color:"var(--txd)",marginBottom:8}}>
                        {(data.clients||[]).find(c=>(c.name||"").toLowerCase()===f.client.toLowerCase()||(c.brand||"").toLowerCase()===f.client.toLowerCase())
                          ?"No products for this client yet."
                          :"Client not matched in clients list — check spelling or add them in Clients first."}
                      </div>
                    )}
                    {clientProducts.map(p=>(
                      <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,cursor:"pointer"}}>
                        <input type="checkbox" checked={(f.products||[]).includes(p.id)} onChange={e=>toggleProduct(p.id,e.target.checked)} style={{width:15,height:15,cursor:"pointer",accentColor:"var(--g)"}}/>
                        <span style={{flex:1,fontSize:13}}>{p.name}</span>
                        <span style={{fontSize:11,color:"var(--txd)",background:"var(--d1)",padding:"1px 7px",borderRadius:4}}>{p.sku}</span>
                        {p.unit_price>0&&<span style={{fontSize:11,color:"var(--g)",flexShrink:0}}>{formatPKR(p.unit_price)}</span>}
                      </label>
                    ))}
                    {showNewProd?(
                      <div style={{background:"var(--d1)",border:"1px solid var(--bo)",borderRadius:8,padding:"10px 12px",marginTop:clientProducts.length>0?8:0}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 90px",gap:8,marginBottom:8}}>
                          <input className="fi" placeholder="Product name" value={newProd.name} onChange={e=>setNewProd(p=>({...p,name:e.target.value}))} style={{fontSize:12}}/>
                          <input className="fi" placeholder="SKU" value={newProd.sku} onChange={e=>setNewProd(p=>({...p,sku:e.target.value}))} style={{fontSize:12}}/>
                          <input className="fi" type="number" placeholder="Price" value={newProd.unit_price} onChange={e=>setNewProd(p=>({...p,unit_price:e.target.value}))} style={{fontSize:12}}/>
                        </div>
                        <div className="ma">
                          <button className="bs" onClick={()=>{setShowNewProd(false);setNewProd({name:"",sku:"",unit_price:""});}} style={{fontSize:12}}>Cancel</button>
                          <button className="bg" onClick={saveNewProd} disabled={savingProd} style={{fontSize:12,opacity:savingProd?0.6:1}}><I n="ok" s={13}/>{savingProd?"Saving...":"Save Product"}</button>
                        </div>
                      </div>
                    ):(
                      <button className="bs" onClick={()=>setShowNewProd(true)} style={{fontSize:12,marginTop:clientProducts.length>0?8:0}}><I n="plus" s={12}/>Add New Product</button>
                    )}
                  </>
                )}
              </div>

              {/* Activity Types */}
              {(()=>{
                const mc=(data.clients||[]).find(c=>(c.name||"").toLowerCase()===f.client.toLowerCase()||(c.brand||"").toLowerCase()===f.client.toLowerCase());
                const cs=getClientSettings(mc);
                const allowed=[{val:"sampling",label:"Sampling"},{val:"gifting",label:"Gifting"},{val:"sales",label:"Sales"}].filter(a=>cs.activities[a.val]);
                return allowed.length>0?(
                  <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                    <div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:10}}>🎯 Activity Types</div>
                    <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                      {allowed.map(act=>(
                        <label key={act.val} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13}}>
                          <input type="checkbox" checked={(f.activities||[]).includes(act.val)} onChange={e=>toggleActivity(act.val,e.target.checked)} style={{width:15,height:15,cursor:"pointer",accentColor:"var(--g)"}}/>
                          {act.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ):null;
              })()}

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
                  <input className="fi" placeholder="Latitude" value={f.latitude} onChange={e=>set("latitude",e.target.value)} style={{flex:1}}/>
                  <input className="fi" placeholder="Longitude" value={f.longitude} onChange={e=>set("longitude",e.target.value)} style={{flex:1}}/>
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
                {f.latitude&&f.longitude&&<div style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:"rgba(58,155,213,.1)",border:"1px solid rgba(58,155,213,.25)",fontSize:12,color:"var(--bl)"}}>
                  📍 Saved: {f.latitude}, {f.longitude} — <a href={"https://maps.google.com/?q="+f.latitude+","+f.longitude} target="_blank" style={{color:"var(--bl)"}}>View on Map ↗</a>
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
                <div className="fg"><label className="fl">Notes (Optional)</label><textarea className="fi" value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any extra info" rows={2} style={{resize:"vertical",fontFamily:"inherit"}}/></div>
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
  const [tab,setTab]=useState("overview");
  const [show,setShow]=useState(false);
  const [f,setF]=useState({stall_id:"",user_id:"",duty_start:"09:00",duty_end:"17:00",daily_rate:"",from_date:"",to_date:"",paid_by:"admin"});
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
    setF({stall_id:data.stalls[0]?.id||"",user_id:nonAdmin[0]?.id||"",duty_start:"09:00",daily_rate:"",from_date:new Date().toISOString().slice(0,10),to_date:"",paid_by:"admin"});
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
    setData(d);save(d);setShow(false);
    var allocUser=(d.users||[]).find(function(u){return u.id===f.user_id;});
    var allocStall=(d.stalls||[]).find(function(s){return s.id===f.stall_id;});
    if(allocUser&&allocStall){
      var roleLabel=allocUser.role==="ba"?"Business Ambassador":"Supervisor";
      var msg="🌟 *SHINKORE MARKETING*\n\n"+
        "Assalam o Alaikum *"+allocUser.name+"*!\n\n"+
        "Aap ko naya kaam assign kiya gaya hai:\n\n"+
        "📍 *Store:* "+allocStall.name+"\n"+
        "🏙️ *City:* "+allocStall.city+"\n"+
        "🕐 *Duty Time:* "+f.duty_start+"\n"+
        "💼 *Role:* "+roleLabel+"\n"+
        "📅 *From:* "+f.from_date+"\n\n"+
        "📱 *App Login:*\n"+
        "Phone: "+allocUser.phone+"\n"+
        "PIN: "+(isHashed(allocUser.pin)?"(ask admin)":allocUser.pin||"1234")+"\n\n"+
        "App Link: https://shinkore-marketing14.pages.dev\n\n"+
        "Mehnat aur imandari se kaam karein.\n— Khalid Orakzai, CEO";
      sendWA(allocUser.phone,msg);
    }
    toast("Allocation saved! WhatsApp opening...");
  };

  const updateDuty=(a)=>{
    var current=a.duty_start||"09:00";
    var nt=prompt("New duty start time (HH:MM, 24-hour):",current);
    if(!nt)return;
    if(!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(nt)){toast("Invalid time. Use HH:MM like 09:00 or 14:30.");return;}
    var d={...data,allocations:data.allocations.map(function(x){return x.id===a.id?{...x,duty_start:nt}:x;})};
    setData(d);save(d);toast("Duty time updated to "+nt);
  };
  const doDeactivate=(a)=>{
    const d={...data,allocations:data.allocations.map(x=>x.id===a.id?{...x,active:false}:x)};
    setData(d);save(d);toast("Allocation ended.");
  };

  const active=data.allocations.filter(a=>a.active);
  const ended=data.allocations.filter(a=>!a.active);

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button className={tab==="overview"?"bg":"bs"} onClick={()=>setTab("overview")}><I n="users" s={14}/>Supervisor Overview</button>
        <button className={tab==="alloc"?"bg":"bs"} onClick={()=>setTab("alloc")}><I n="alloc" s={14}/>All Allocations</button>
      </div>
      {tab==="overview"&&(
        <div>
          {(data.users||[]).filter(u=>u.role==="supervisor").length===0&&<div className="info info-warn"><I n="alert" s={14}/>No supervisors added yet.</div>}
          {(data.users||[]).filter(u=>u.role==="supervisor").map(function(sup){
            var supAllocs=data.allocations.filter(function(a){return a.user_id===sup.id&&a.active;});
            var supStalls=supAllocs.map(function(a){return (data.stalls||[]).find(function(s){return s.id===a.stall_id;});}).filter(Boolean);
            var supStallIds=supStalls.map(function(s){return s.id;});
            var myBAs=(data.users||[]).filter(function(u){
              if(u.role!=="ba")return false;
              if(u.sup_id)return u.sup_id===sup.id;
              return data.allocations.some(function(a){return a.user_id===u.id&&a.active&&supStallIds.includes(a.stall_id);});
            });
            var brands=[...new Set(supStalls.map(function(s){return s.client||"";}).filter(Boolean))];
            var today=new Date().toISOString().slice(0,10);
            return(
              <div className="card" key={sup.id} style={{marginBottom:14}}>
                <div className="ch">
                  <div className="av av-blue" style={{width:44,height:44,fontSize:16,borderRadius:11}}>{getInitials(sup.name)}</div>
                  <div style={{flex:1}}><div className="ct">{sup.name}</div><div className="cs">👮 Supervisor · {sup.phone}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:12,color:"var(--g)",fontWeight:600}}>{formatPKR(sup.daily_rate)}/day</div></div>
                </div>
                <div className="cb">
                  {supStalls.length===0?<div className="info info-warn" style={{margin:0}}><I n="alert" s={13}/>Not allocated yet.</div>:(
                    <div>
                      <div style={{fontSize:11,color:"var(--txd)",marginBottom:6}}>📍 STALLS</div>
                      {supStalls.map(function(s){return(
                        <div key={s.id} style={{background:"var(--d3)",borderRadius:8,padding:"8px 10px",marginBottom:5,display:"flex",alignItems:"center",gap:8}}>
                          <I n="pin" s={13} c="var(--g)"/>
                          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{s.name}</div><div style={{fontSize:11,color:"var(--txd)"}}>{s.city} · {s.client||"—"}</div></div>
                          <span style={{fontSize:10,padding:"2px 6px",borderRadius:5,background:s.latitude?"rgba(46,204,113,.15)":"rgba(231,76,60,.15)",color:s.latitude?"var(--g)":"var(--rd)"}}>{s.latitude?"🎯 GPS":"❌"}</span>
                        </div>
                      );})}
                      {brands.length>0&&<div style={{fontSize:12,marginTop:6}}>🏷️ Brands: <strong>{brands.join(", ")}</strong></div>}
                      <div style={{fontSize:11,color:"var(--txd)",marginTop:10,marginBottom:6}}>👥 BAs ({myBAs.length})</div>
                      {myBAs.length===0?<div style={{fontSize:12,color:"var(--txd)"}}>No BAs on same stalls.</div>:myBAs.map(function(ba){
                        var att=(data.attendance||[]).find(function(a){return a.user_id===ba.id&&a.date===today;});
                        return(
                          <div key={ba.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--bo)"}}>
                            <div className="av av-green" style={{width:32,height:32,fontSize:11,borderRadius:8}}>{getInitials(ba.name)}</div>
                            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{ba.name}</div><div style={{fontSize:11,color:"var(--txd)"}}>{ba.phone}</div></div>
                            <span style={{fontSize:11,padding:"2px 8px",borderRadius:6,background:att?"rgba(46,204,113,.15)":"rgba(231,76,60,.15)",color:att?"var(--g)":"var(--rd)"}}>{att?"✅ In":"❌ Out"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab==="alloc"&&<div>
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
                  <button className="bs" onClick={()=>updateDuty(a)} style={{fontSize:12}}>🕐 Change Duty Time</button>
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
                <div className="fg"><label className="fl">Duty End Time</label><input className="fi" type="time" value={f.duty_end||"17:00"} onChange={e=>set("duty_end",e.target.value)}/></div>
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
      </div>}
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
    const dist=haversine(gps.lat,gps.lng,Number(stall.latitude),Number(stall.longitude));

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
    const alloc=(data.allocations||[]).find(a=>a.user_id===att.user_id&&a.stall_id===att.stall_id);
    if(alloc&&alloc.duty_end){
      const [eh,em]=alloc.duty_end.split(":").map(Number);
      const [nh,nm]=now.split(":").map(Number);
      const endMins=eh*60+em;
      const nowMins=nh*60+nm;
      if(nowMins<endMins){
        toast(`Cannot clock out before duty end time (${alloc.duty_end})`);
        return;
      }
    }
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
              <div style={{fontSize:12,color:"var(--txd)",marginBottom:8}}>GPS Target: {Number(stall.latitude).toFixed(5)}, {Number(stall.longitude).toFixed(5)} · Within {GPS_RADIUS_M}m required</div>
              <a href={"https://maps.google.com/?q="+stall.latitude+","+stall.longitude} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(58,155,213,.12)",border:"1px solid rgba(58,155,213,.3)",borderRadius:8,padding:"7px 14px",fontSize:13,color:"var(--bl)",fontWeight:600,textDecoration:"none",marginBottom:12}}>📍 View Store on Map</a>
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
function AttendancePage({user,data,setData,toast}){
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const dayAtt=(data.attendance||[]).filter(a=>a.date===date);
  const [manualFor,setManualFor]=useState(null);
  const [mIn,setMIn]=useState("");
  const [mOut,setMOut]=useState("");
  const [mReason,setMReason]=useState("");

  const delAtt=(att)=>{
    if(!confirm("Delete this attendance record?")) return;
    const d={...data,attendance:(data.attendance||[]).filter(x=>x.id!==att.id)};
    setData(d);save(d);deleteFromSB("sm_attendance",att.id);toast("Attendance deleted.");
  };

  const openManual=(alloc,existing)=>{
    setManualFor(alloc);
    setMIn(existing&&existing.clock_in?existing.clock_in:"");
    setMOut(existing&&existing.clock_out?existing.clock_out:"");
    setMReason(existing&&existing.manual_reason?existing.manual_reason:"");
  };
  const saveManual=()=>{
    if(!mIn){toast("Enter at least a clock-in time.");return;}
    if(!mReason.trim()){toast("Reason is required for manual entry.");return;}
    var alloc=manualFor;
    var d={...data};
    var existing=(d.attendance||[]).find(x=>x.user_id===alloc.user_id&&x.stall_id===alloc.stall_id&&x.date===date);
    if(existing){
      d.attendance=d.attendance.map(x=>x===existing?{...x,clock_in:mIn,clock_out:mOut||null,manual:true,manual_reason:mReason.trim()}:x);
    }else{
      d.attendance=[...(d.attendance||[]),{id:genId(),user_id:alloc.user_id,stall_id:alloc.stall_id,date:date,clock_in:mIn,clock_out:mOut||null,lat:null,lng:null,dist:0,manual:true,manual_reason:mReason.trim()}];
    }
    setData(d);save(d);setManualFor(null);toast("Manual attendance saved.");
  };

  const sendLateAlert=(u,stall,adminPhone)=>{
    const now=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    const alloc=data.allocations.find(a=>a.user_id===u.id&&a.stall_id===stall.id&&a.active);
    const team=u.team||"Unassigned";
    const supId=data.allocations.find(a=>a.stall_id===stall.id&&a.active&&a.user_id!==u.id&&(data.users||[]).find(x=>x.id===a.user_id&&x.role==="supervisor"));
    const sup=supId?(data.users||[]).find(x=>x.id===supId.user_id):null;
    const msg=buildLateMsg(u.name,u.role,stall.name,stall.city,team,alloc?.duty_start||"—",date);
    sendWA(adminPhone,msg);
    if(sup) sendWA(sup.phone,msg);
    sendWA(u.phone,`*Shinkore Marketing* — Aap ne ${date} ko abhi tak duty start nahi ki. Assigned location: ${stall.name}, ${stall.city}. Foran clock in karein.`);
    toast("Alert sent to ..."+waNumber(adminPhone).slice(-4)+(sup?" + "+sup.name:"")+" + "+u.name);
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
                    <div style={{fontSize:10,color:"var(--txd)"}}>{att.manual?"✏️ Manual entry":att.dist+"m from stall"}</div>
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:4}}>
                    <button className="bs" onClick={()=>openManual(a,att)} style={{fontSize:10,padding:"3px 8px"}}>✏️ Edit</button>
                    {user?.role==="admin"&&<button className="brd" onClick={()=>delAtt(att)} style={{fontSize:10,padding:"3px 8px"}}><I n="del" s={11}/></button>}
                  </div>
                  </div>
                ):(
                  <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:12,color:"var(--rd)",fontWeight:600}}>Not In</span>
                    {ADMIN_PHONES.map(ph=>(
                      <button key={ph} style={{fontSize:10,padding:"3px 8px",background:"rgba(201,168,76,.15)",border:"1px solid rgba(201,168,76,.4)",borderRadius:6,cursor:"pointer",color:"var(--g)"}} onClick={()=>sendLateAlert(u,s,ph)}><I n="wa" s={11}/>...{waNumber(ph).slice(-4)}</button>
                    ))}
                    <button className="bs" onClick={()=>openManual(a,null)} style={{fontSize:11,padding:"5px 10px"}}>✏️ Manual</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {manualFor&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setManualFor(null)}>
          <div className="md">
            <div className="mh"><div className="mt">Manual Attendance</div><div className="mc" onClick={()=>setManualFor(null)}>×</div></div>
            <div className="mb">
              <div className="info info-blue" style={{marginBottom:12}}><I n="alert" s={14}/><div>Manual entry for {date}. A reason is required for the record.</div></div>
              <div className="frow">
                <div className="fg"><label className="fl">Clock In</label><input className="fi" type="time" value={mIn} onChange={e=>setMIn(e.target.value)}/></div>
                <div className="fg"><label className="fl">Clock Out (optional)</label><input className="fi" type="time" value={mOut} onChange={e=>setMOut(e.target.value)}/></div>
              </div>
              <div className="fg"><label className="fl">Reason / Proof Reference *</label><input className="fi" value={mReason} onChange={e=>setMReason(e.target.value)} placeholder="e.g. GPS failed, confirmed by phone call"/></div>
              <div className="ma"><button className="bs" onClick={()=>setManualFor(null)}>Cancel</button><button className="bg" onClick={saveManual}><I n="ok" s={15}/>Save Entry</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ALERTS PAGE ──────────────────────────────────────────────────────────────
function AlertsPage({data,toast}){
  const today=new Date().toISOString().slice(0,10);

  const sendManualLate=(u,adminPhone)=>{
    const now=new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});
    const alloc=data.allocations.find(a=>a.user_id===u.id&&a.active);
    const stall=alloc?(data.stalls||[]).find(s=>s.id===alloc.stall_id):null;
    const supAlloc=stall?data.allocations.find(a=>a.stall_id===stall.id&&a.active&&a.user_id!==u.id&&(data.users||[]).find(x=>x.id===a.user_id&&x.role==="supervisor")):null;
    const sup=supAlloc?(data.users||[]).find(x=>x.id===supAlloc.user_id):null;
    const msg=buildLateMsg(u.name,u.role,stall?.name||"Assigned Location",stall?.city||"",u.team||"Unassigned",alloc?.duty_start||now,today);
    sendWA(adminPhone,msg);
    if(sup) sendWA(sup.phone,msg);
    sendWA(u.phone,`*Shinkore Marketing* — Aap ne aaj abhi tak duty start nahi ki${stall?` at ${stall.name}`:""}.`);
    toast("Alert sent to ..."+waNumber(adminPhone).slice(-4)+(sup?" + "+sup.name:"")+" + "+u.name);
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
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {ADMIN_PHONES.map(ph=>(
                    <button key={ph} className="brd" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>sendManualLate(u,ph)}><I n="wa" s={12}/>...{waNumber(ph).slice(-4)}</button>
                  ))}
                </div>
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
  const isAllocated=allocs.length>0;
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
          {!isAllocated&&<div style={{background:"rgba(231,76,60,.1)",border:"2px solid rgba(231,76,60,.3)",borderRadius:14,padding:"20px",textAlign:"center",marginBottom:14}}>
            <div style={{fontSize:36,marginBottom:8}}>🔒</div>
            <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--rd)",marginBottom:6}}>Not Allocated</div>
            <div style={{fontSize:13,color:"var(--txd)",marginBottom:12}}>You are not assigned to any stall yet. Contact admin (Khalid) to get allocated.</div>
            <div style={{fontSize:12,color:"var(--txd)"}}>You can only view your salary until allocated.</div>
            <button onClick={()=>sendWA("00923135443656","Assalam o Alaikum Khalid! Mujhe abhi tak kisi stall par allocate nahi kiya gaya. Please meri allocation karein. - "+user.name)} style={{marginTop:12,background:"rgba(37,211,102,.15)",border:"1px solid rgba(37,211,102,.3)",borderRadius:8,padding:"8px 16px",cursor:"pointer",color:"#25d366",fontSize:13}}>📱 WhatsApp Khalid</button>
          </div>}
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
                  <div style={{fontSize:11,padding:"3px 8px",borderRadius:6,background:s.latitude&&s.longitude?"rgba(46,204,113,.15)":"rgba(231,76,60,.15)",color:s.latitude&&s.longitude?"var(--g)":"var(--rd)",border:"1px solid "+(s.latitude&&s.longitude?"rgba(46,204,113,.3)":"rgba(231,76,60,.3)")}}>{s.latitude&&s.longitude?"🎯 GPS":"❌ No GPS"}</div>
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
                <thead><tr><th>Activity</th><th>Stall</th><th>Amount</th><th>Date</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
                <tbody>
                  {(data.client_payments||[]).length===0&&<tr><td colSpan={7} style={{textAlign:"center",color:"var(--txd)",padding:30}}>No client payments recorded yet.</td></tr>}
                  {(data.client_payments||[]).map(p=>(
                    <tr key={p.id}>
                      <td style={{fontWeight:600}}>{p.activity}</td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{getStallName(p.stall_id)}</td>
                      <td><span style={{fontFamily:"Rajdhani",fontSize:15,color:p.status==="received"?"var(--gr)":"var(--or)"}}>{formatPKR(p.amount)}</span></td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{p.date}</td>
                      <td><span className={p.status==="received"?"b b-active":"b b-pending"}>{p.status}</span></td>
                      <td style={{color:"var(--txd)",fontSize:12}}>{p.notes||"—"}</td>
                      <td style={{display:"flex",gap:6}}>
                        {p.status!=="received"&&<button onClick={()=>{var d={...data,client_payments:data.client_payments.map(x=>x.id===p.id?{...x,status:"received"}:x)};setData(d);save(d);toast("Marked as received!");}} style={{background:"var(--gr)",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✓ Received</button>}
                        <button onClick={()=>{if(!confirm("Delete this payment?"))return;var d={...data,client_payments:data.client_payments.filter(x=>x.id!==p.id)};setData(d);save(d);deleteFromSB("sm_client_payments",p.id);toast("Payment deleted.");}} style={{background:"#e53",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑 Delete</button>
                      </td>
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
    ${user.bank_account ? `<div style="font-size:12px;color:#1a8a4a;margin-top:6px;font-weight:600">💳 ${user.bank_account}</div>` : ""}
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
  if(!w){alert("Please allow popups in your browser to view the PDF slip.");return;}
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
  const [dtdBreakdown,setDtdBreakdown]=useState([]);
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));
  const today=new Date().toLocaleDateString("en-PK",{year:"numeric",month:"long",day:"numeric"});
  const nonAdmin=(data.users||[]).filter(u=>u.role!=="admin");

  // DTD data fetched once on mount for bonus pre-calculation
  const [dtdData,setDtdData]=useState(null);
  useEffect(()=>{
    Promise.all([
      SB.from("sm_campaigns").select("id,name,client_id,start_date,end_date,assigned_bas"),
      SB.from("sm_door_visits").select("id,campaign_id,ba_id"),
      SB.from("sm_door_items").select("visit_id,product_id,qty,type"),
      SB.from("sm_campaign_targets").select("id,campaign_id,ba_id,doors_per_day,units_per_day,revenue_target"),
      SB.from("sm_products").select("id,unit_price"),
      SB.from("sm_clients").select("id,settings"),
    ]).then(([r1,r2,r3,r4,r5,r6])=>{
      setDtdData({
        campaigns:r1.data||[],visits:r2.data||[],items:r3.data||[],
        targets:r4.data||[],products:r5.data||[],clients:r6.data||[],
      });
    });
  },[]);

  const calcDTDBonus=(userId)=>{
    if(!dtdData)return{total:0,breakdown:[]};
    const{campaigns,visits,items,targets,products,clients}=dtdData;
    const myCamps=campaigns.filter(c=>(c.assigned_bas||[]).includes(userId));
    if(!myCamps.length)return{total:0,breakdown:[]};
    let total=0;const breakdown=[];
    myCamps.forEach(camp=>{
      const client=clients.find(cl=>cl.id===camp.client_id);
      const bonusCriteria=getClientSettings(client).bonus;
      if(!(bonusCriteria.tiers||[]).length)return;
      const ach=calcAchievement(camp,userId,visits,items,targets,products);
      const earned=calcBonus(ach,bonusCriteria);
      if(earned>0){total+=earned;breakdown.push({name:camp.name,earned});}
    });
    return{total,breakdown};
  };

  const openAdd=(u)=>{
    const now=new Date();
    const mon=now.toLocaleDateString("en-PK",{month:"long",year:"numeric"});
    const att=(data.attendance||[]).filter(a=>a.user_id===u.id);
    const attDays=new Set(att.map(a=>a.date)).size;
    const dtdClocks=(data.dtd_clock||[]).filter(d=>d.ba_id===u.id);
    const dtdDays=new Set(dtdClocks.map(d=>d.work_date)).size;
    const days=attDays+dtdDays;
    const{total:dtdTotal,breakdown}=calcDTDBonus(u.id);
    const autoNotes=breakdown.length?breakdown.map(b=>`${b.name}: PKR ${b.earned.toLocaleString()}`).join(", "):"";
    setDtdBreakdown(breakdown);
    setF({user_id:u.id,month:mon,days_worked:days||0,daily_rate:u.daily_rate||0,bonus:dtdTotal||"",deductions:"",notes:autoNotes,status:"pending"});
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
    // Archive to document history
    var docs=(data.documents||[]).slice();
    var existsIdx=docs.findIndex(function(x){return x.type==="salary_slip"&&x.user_id===u.id&&x.month===rec.month;});
    var docRec={id:existsIdx>-1?docs[existsIdx].id:genId(),user_id:u.id,user_name:u.name,type:"salary_slip",title:"Salary Slip — "+rec.month,month:rec.month,content_html:html,generated_date:new Date().toISOString().slice(0,10),generated_by:"admin"};
    if(existsIdx>-1)docs[existsIdx]=docRec;else docs.push(docRec);
    var nd={...data,documents:docs};
    setData(nd);save(nd);
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
                        {(()=>{const{total:dt}=calcDTDBonus(u.id);return dt>0?<div style={{fontSize:11,color:"var(--gr)",marginTop:2}}>DTD Bonus: PKR {dt.toLocaleString()}</div>:null;})()}
                        {u.bank_account&&<div style={{fontSize:11,color:"var(--g)",marginTop:2}}>💳 {u.bank_account}</div>}
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
                <div className="fg"><label className="fl">Bonus (PKR)</label><input className="fi" type="number" value={f.bonus} onChange={e=>sf("bonus",e.target.value)} placeholder="0"/>
                  {dtdBreakdown.length>0&&<div style={{fontSize:11,color:"var(--gr)",marginTop:4}}>DTD auto-calculated: {dtdBreakdown.map(b=>`${b.name} PKR ${b.earned.toLocaleString()}`).join(" + ")}</div>}
                </div>
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
  const myRecords=(data.salary||[]).filter(s=>s.user_id===user.id);
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
                <div style={{marginTop:6}}>
                  <button onClick={()=>{const html=generateSlipHTML(user,rec,data.stalls,data.allocations);openPrint(html);}} style={{fontSize:11,background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.3)",borderRadius:6,padding:"3px 8px",cursor:"pointer",color:"var(--gold)"}}>📄 PDF Slip</button>
                </div>
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
  const [editing,setEditing]=useState(null);
  const emptyRec={type:"expense",category:"fuel",amount:"",date:new Date().toISOString().slice(0,10),person_name:"",description:"",status:"paid",notes:""};
  const [f,setF]=useState(emptyRec);
  const sf=(k,v)=>setF(p=>({...p,[k]:v}));
  const openAdd=()=>{setEditing(null);setF(emptyRec);setShow(true);};
  const openEdit=(item)=>{setEditing(item);setF({type:item.type||"expense",category:item.category||"fuel",amount:String(item.amount||""),date:item.date||new Date().toISOString().slice(0,10),person_name:item.person_name||"",description:item.description||"",status:item.status||"paid",notes:item.notes||""});setShow(true);};
  const doDelete=(item)=>{if(!confirm("Delete this record?"))return;const d={...data,personal:(data.personal||[]).filter(x=>x.id!==item.id)};setData(d);save(d);deleteFromSB("sm_personal",item.id);toast("Deleted.");};
  const personal=data.personal||[];

  const totalFuel=personal.filter(x=>x.category==="fuel"&&x.type!=="loan_given"&&x.type!=="loan_received").reduce((s,x)=>s+Number(x.amount),0);
  const totalMaint=personal.filter(x=>x.category==="maintenance").reduce((s,x)=>s+Number(x.amount),0);
  const loansGiven=personal.filter(x=>x.type==="loan_given"&&x.status==="pending").reduce((s,x)=>s+Number(x.amount),0);
  const loansReceived=personal.filter(x=>x.type==="loan_received"&&x.status==="pending").reduce((s,x)=>s+Number(x.amount),0);
  const netLoans=loansGiven-loansReceived;

  const doSave=()=>{
    if(!f.amount) return toast("Enter amount.");
    // Clear stale category on loans so they don't show under Car/Fuel
    var clean={...f,amount:Number(f.amount)};
    if(clean.type==="loan_given"||clean.type==="loan_received"){clean.category="loan";}
    let d;
    if(editing){d={...data,personal:(data.personal||[]).map(x=>x.id===editing.id?{...x,...clean}:x)};}
    else{d={...data,personal:[...(data.personal||[]),{id:genId(),...clean}]};}
    setData(d);save(d);setShow(false);setEditing(null);toast(editing?"Updated!":"Saved!");
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
        <button className="bg" onClick={openAdd} style={{marginLeft:"auto"}}><I n="plus" s={15}/>Add Record</button>
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
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <button className="bic" onClick={()=>openEdit(item)} style={{padding:5}}><I n="edit" s={12}/></button>
                  <button className="bic" onClick={()=>doDelete(item)} style={{padding:5,color:"var(--rd)"}}><I n="del" s={12}/></button>
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
            {personal.filter(x=>["fuel","maintenance","other_car"].includes(x.category)&&x.type!=="loan_given"&&x.type!=="loan_received").length===0&&<div style={{color:"var(--txd)",fontSize:13}}>No car expenses yet.</div>}
            {personal.filter(x=>["fuel","maintenance","other_car"].includes(x.category)&&x.type!=="loan_given"&&x.type!=="loan_received").map(item=>(
              <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,textTransform:"capitalize"}}>{item.category}</div>
                  <div style={{fontSize:11,color:"var(--txd)"}}>{item.description||""} · {item.date}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontFamily:"Rajdhani",fontSize:16,color:"var(--rd)"}}>{formatPKR(item.amount)}</div>
                  <button className="bic" onClick={()=>openEdit(item)} style={{padding:5}}><I n="edit" s={12}/></button>
                  <button className="bic" onClick={()=>doDelete(item)} style={{padding:5,color:"var(--rd)"}}><I n="del" s={12}/></button>
                </div>
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
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <button className="bic" onClick={()=>openEdit(item)} style={{padding:5}}><I n="edit" s={12}/></button>
                    <button className="bic" onClick={()=>doDelete(item)} style={{padding:5,color:"var(--rd)"}}><I n="del" s={12}/></button>
                  </div>
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
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <button className="bic" onClick={()=>openEdit(item)} style={{padding:5}}><I n="edit" s={12}/></button>
                    <button className="bic" onClick={()=>doDelete(item)} style={{padding:5,color:"var(--rd)"}}><I n="del" s={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">{editing?"Edit Record":"Add Personal Record"}</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
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
  const doSave=(override)=>{
    if(!form.city||!form.store_name||!form.brand)return toast("City, store and brand required.");
    if(!form.ba_id)return toast("Select BA.");
    const rec={...form,...(override||{}),id:form.id||genId()};
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
  const openNew=()=>{
    var autoFill={};
    var today=new Date().toISOString().slice(0,10);
    if(isBA||isSup){
      var myAlloc=data.allocations.find(function(a){return a.user_id===user.id&&a.active;});
      if(!myAlloc&&(isBA||isSup)){toast("You are not allocated to any stall. Contact admin to assign you first.");return;}
      if(myAlloc){
        var myStall=(data.stalls||[]).find(function(s){return s.id===myAlloc.stall_id;});
        if(myStall){
          autoFill.store_name=myStall.name||"";
          autoFill.city=myStall.city||"";
          autoFill.brand=myStall.client||"";
          // Find supervisor on same stall
          var supAlloc=data.allocations.find(function(a){
            return a.stall_id===myAlloc.stall_id&&a.active&&a.user_id!==user.id&&
            (data.users||[]).find(function(u){return u.id===a.user_id&&u.role==="supervisor";});
          });
          if(supAlloc) autoFill.supervisor_id=supAlloc.user_id;
        }
        // Auto-fill punch in from today's attendance
        var todayAtt=(data.attendance||[]).find(function(a){
          return a.user_id===user.id&&a.stall_id===myAlloc.stall_id&&a.date===today;
        });
        if(todayAtt){
          autoFill.punch_in=todayAtt.clock_in||"";
          if(todayAtt.clock_out) autoFill.punch_out=todayAtt.clock_out;
        }
      }
    }
    setForm({...emptyAct,...autoFill,ba_id:isBA?user.id:"",supervisor_id:isSup?user.id:autoFill.supervisor_id||""});
    setEditing(null);setView("form");
  };
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
            <div className="fg">
              <label className="fl">Store In Time</label>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input className="fi" type="time" value={form.punch_in} onChange={e=>sf("punch_in",e.target.value)} style={{flex:1}}/>
                <button onClick={()=>sf("punch_in",new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",hour12:false}))} style={{background:"rgba(46,204,113,.15)",border:"1px solid rgba(46,204,113,.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--g)",fontSize:11,whiteSpace:"nowrap"}}>⏱ Now</button>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Store Out Time</label>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input className="fi" type="time" value={form.punch_out} onChange={e=>sf("punch_out",e.target.value)} style={{flex:1}}/>
                <button onClick={()=>sf("punch_out",new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",hour12:false}))} style={{background:"rgba(231,76,60,.15)",border:"1px solid rgba(231,76,60,.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--rd)",fontSize:11,whiteSpace:"nowrap"}}>⏱ Now</button>
              </div>
            </div>
          </div>
          <div className="frow">
            <div className="fg">
              <label className="fl">Break Start</label>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input className="fi" type="time" value={form.break_start} onChange={e=>sf("break_start",e.target.value)} style={{flex:1}}/>
                <button onClick={()=>sf("break_start",new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",hour12:false}))} style={{background:"rgba(240,165,0,.15)",border:"1px solid rgba(240,165,0,.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--or)",fontSize:11,whiteSpace:"nowrap"}}>⏱ Now</button>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Break End</label>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input className="fi" type="time" value={form.break_end} onChange={e=>sf("break_end",e.target.value)} style={{flex:1}}/>
                <button onClick={()=>sf("break_end",new Date().toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",hour12:false}))} style={{background:"rgba(46,204,113,.15)",border:"1px solid rgba(46,204,113,.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--g)",fontSize:11,whiteSpace:"nowrap"}}>⏱ Now</button>
              </div>
            </div>
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
          {form.sales_items.map(item=>(
            <div key={item.id} style={{marginBottom:8,background:"var(--d3)",borderRadius:8,padding:"8px"}}>
              <div style={{display:"flex",gap:6,marginBottom:6}}>
                <input className="fi" placeholder="Product name" value={item.name} onChange={e=>updateItem("sales_items",item.id,"name",e.target.value)} style={{flex:3}}/>
                <input className="fi" placeholder="Size" value={item.size} onChange={e=>updateItem("sales_items",item.id,"size",e.target.value)} style={{flex:1}}/>
                <button className="brd" onClick={()=>removeItem("sales_items",item.id)}><I n="del" s={12}/></button>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input className="fi" placeholder="Qty" type="number" value={item.qty} onChange={e=>updateItem("sales_items",item.id,"qty",e.target.value)} style={{flex:1}}/>
                <input className="fi" placeholder="Price/unit PKR" type="number" value={item.price||""} onChange={e=>updateItem("sales_items",item.id,"price",e.target.value)} style={{flex:2}}/>
                {item.qty&&item.price&&<div style={{fontSize:12,color:"var(--g)",fontWeight:600,whiteSpace:"nowrap"}}>= PKR {(Number(item.qty)*Number(item.price)).toLocaleString()}</div>}
              </div>
            </div>
          ))}
          {form.sales_items.length>0&&form.sales_items.some(i=>i.price&&i.qty)&&(
            <div style={{background:"var(--gd)",borderRadius:8,padding:"8px 12px",fontSize:13,fontWeight:600,color:"var(--g)"}}>
              Total Sales Value: PKR {form.sales_items.reduce((s,i)=>s+(Number(i.qty||0)*Number(i.price||0)),0).toLocaleString()}
            </div>
          )}
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
        <button className="bg" onClick={()=>{doSave(isBA?{approval_status:"submitted",submitted_at:new Date().toISOString()}:{approval_status:"approved"});}} style={{flex:1,justifyContent:"center"}}><I n="ok" s={16}/>{editing?"Update":isBA?"Submit Report":"Save & Approve"}</button>
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
  const [accessCodes,setAccessCodes]=useState({});
  const [acLoading,setAcLoading]=useState({});

  useEffect(()=>{
    SB.from("sm_clients").select("id,access_code").then(({data:rows})=>{
      if(!rows)return;
      const map={};rows.forEach(r=>{map[r.id]=r.access_code||null;});
      setAccessCodes(map);
    });
  },[]);

  const doGenerate=async(client)=>{
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const newCode=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
    setAcLoading(p=>({...p,[client.id]:true}));
    const{data:updated,error:upErr}=await SB.from("sm_clients").update({access_code:newCode}).eq("id",client.id).select("id");
    if(upErr){setAcLoading(p=>({...p,[client.id]:false}));toast("Failed to generate code.");return;}
    if(!updated||updated.length===0){
      const{error:insErr}=await SB.from("sm_clients").insert([{id:client.id,name:client.name,brand:client.brand||"",phone:client.phone||"",email:client.email||"",pin:client.pin||"",active:client.active!==false,settings:{},access_code:newCode}]);
      if(insErr){setAcLoading(p=>({...p,[client.id]:false}));toast("Failed to generate code.");return;}
    }
    setAccessCodes(p=>({...p,[client.id]:newCode}));
    setAcLoading(p=>({...p,[client.id]:false}));
    toast("Access code generated!");
  };

  const doCopy=async(code)=>{
    try{await navigator.clipboard.writeText(code);toast("Copied!");}
    catch{toast("Copy failed — select and copy manually.");}
  };

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
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <button className="bs" onClick={()=>{setEditing(client);setF({name:client.name,brand:client.brand,phone:client.phone||"",email:client.email||"",pin:client.pin||"",active:client.active});setShow(true);}} style={{fontSize:12}}><I n="edit" s={13}/>Edit</button>
              <button className="bw" onClick={()=>sendWA(client.phone,"Hello "+client.name+", this is Shinkore Marketing. Here is a summary of your brand "+client.brand+" activities: "+acts.length+" activities completed, "+totalInterceptions+" interceptions, "+totalSalesKg+"kg sales.")} style={{fontSize:12}}><I n="wa" s={13}/>Send Summary</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,background:"var(--d3)",borderRadius:10,padding:"8px 12px"}}>
              <I n="key" s={14} c="var(--g)"/>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"var(--txd)",textTransform:"uppercase",letterSpacing:.5}}>Access Code</div>
                <div style={{fontFamily:"monospace",fontSize:16,letterSpacing:3,fontWeight:700,color:accessCodes[client.id]?"var(--g)":"var(--txd)"}}>{accessCodes[client.id]||"No code set"}</div>
              </div>
              {accessCodes[client.id]&&<button className="bic" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>doCopy(accessCodes[client.id])}>Copy</button>}
              <button className="bic" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>doGenerate(client)} disabled={acLoading[client.id]}>{acLoading[client.id]?"…":accessCodes[client.id]?"Regen":"Generate"}</button>
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
                <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                  <div style={{fontSize:12,color:"var(--g)",fontWeight:600,marginBottom:10}}>🔐 Client Permissions — What they can see</div>
                  {[{key:"perm_map",label:"🗺️ Store Locations Map",desc:"See their stores on map"},{key:"perm_distance",label:"📏 Live Distance",desc:"Distance from phone to stores"},{key:"perm_live",label:"🟢 Live Staff Status",desc:"Who is at store right now"},{key:"perm_sales",label:"📊 Sales & Activity Data",desc:"Performance reports"}].map(function(p){return(
                    <div key={p.key} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--bo)"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600}}>{p.label}</div>
                        <div style={{fontSize:11,color:"var(--txd)"}}>{p.desc}</div>
                      </div>
                      <label style={{position:"relative",display:"inline-block",width:44,height:24,cursor:"pointer"}}>
                        <input type="checkbox" checked={f[p.key]!==false} onChange={function(e){sf(p.key,e.target.checked);}} style={{opacity:0,width:0,height:0}}/>
                        <span style={{position:"absolute",inset:0,borderRadius:24,transition:".3s",background:f[p.key]!==false?"var(--g)":"var(--bo)"}}>
                          <span style={{position:"absolute",height:18,width:18,left:f[p.key]!==false?23:3,top:3,borderRadius:"50%",background:"#fff",transition:".3s"}}></span>
                        </span>
                      </label>
                    </div>
                  );})}
                </div>
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
    var cl=client||{name:"Sample Client",brand:"Sample Brand"};
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
  <div class="report-sub">Prepared for: <strong>${cl.name}</strong> | Brand: <strong>${cl.brand}</strong> | Period: <strong>${month}</strong></div>
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
  <div style="text-align:center;width:180px"><div style="border-top:1px solid #999;padding-top:8px;font-size:12px;color:#555">Client Representative<br><strong>${cl.name}</strong></div></div>
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


// ─── TRAINING PAGE ────────────────────────────────────────────────────────────
function TrainingPage({user,data,setData,toast}){
  const isAdmin=user.role==="admin";
  const [show,setShow]=useState(false);
  const [f,setF]=useState({title:"",description:"",link:""});
  const trainings=data.trainings||[];
  const done=data.training_done||[];

  const addTraining=()=>{
    if(!f.title.trim()){toast("Title required.");return;}
    var d={...data,trainings:[...(data.trainings||[]),{id:genId(),title:f.title.trim(),description:f.description.trim(),link:f.link.trim(),created:new Date().toISOString().slice(0,10)}]};
    setData(d);save(d);setShow(false);setF({title:"",description:"",link:""});toast("Training added!");
  };
  const delTraining=(t)=>{
    if(!confirm("Delete training \""+t.title+"\"?"))return;
    var d={...data,trainings:(data.trainings||[]).filter(x=>x.id!==t.id),training_done:(data.training_done||[]).filter(x=>x.training_id!==t.id)};
    setData(d);save(d);deleteFromSB("sm_trainings",t.id);toast("Deleted.");
  };
  const markDone=(t)=>{
    if(done.some(x=>x.training_id===t.id&&x.user_id===user.id)){toast("Already completed.");return;}
    var rec={id:genId(),training_id:t.id,user_id:user.id,date:new Date().toISOString().slice(0,10)};
    var d={...data,training_done:[...(data.training_done||[]),rec]};
    setData(d);save(d);toast("Marked complete! ✅");
  };
  const staffCount=(data.users||[]).filter(u=>u.role!=="admin").length;

  return(
    <div>
      {isAdmin&&<div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="users" s={16} c="var(--g)"/><div style={{flex:1}}><div className="ct">Training Modules</div><div className="cs">{trainings.length} module(s)</div></div><button className="bg" onClick={()=>setShow(true)}><I n="plus" s={15}/>Add</button></div>
      </div>}
      {trainings.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)",fontSize:13}}>No training modules yet.{isAdmin?" Tap Add to create one.":" Check back later."}</div>}
      {trainings.map(function(t){
        var myDone=done.some(x=>x.training_id===t.id&&x.user_id===user.id);
        var completedCount=done.filter(x=>x.training_id===t.id).length;
        return(
          <div className="card" key={t.id} style={{marginBottom:12}}>
            <div className="cb">
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{fontSize:22}}>📚</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{t.title}</div>
                  {t.description&&<div style={{fontSize:13,color:"var(--txd)",marginTop:4,lineHeight:1.6}}>{t.description}</div>}
                  {t.link&&<a href={t.link} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"var(--bl)",marginTop:6,display:"inline-block"}}>🔗 Open material</a>}
                </div>
              </div>
              {isAdmin?(
                <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,fontSize:12,color:"var(--txd)"}}>✅ {completedCount} of {staffCount} staff completed</div>
                  <button className="brd" onClick={()=>delTraining(t)} style={{fontSize:11,padding:"4px 10px"}}><I n="del" s={12}/>Delete</button>
                </div>
              ):(
                <div style={{marginTop:12}}>
                  {myDone?(
                    <div style={{background:"rgba(46,204,113,.12)",border:"1px solid rgba(46,204,113,.3)",borderRadius:8,padding:"8px",textAlign:"center",fontSize:13,color:"var(--g)",fontWeight:600}}>✅ Completed</div>
                  ):(
                    <button className="bg" onClick={()=>markDone(t)} style={{width:"100%",justifyContent:"center"}}><I n="ok" s={15}/>Mark Complete</button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Add Training Module</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Title *</label><input className="fi" value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="e.g. Customer Greeting & Pitch"/></div>
              <div className="fg"><label className="fl">Description</label><input className="fi" value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="What this covers"/></div>
              <div className="fg"><label className="fl">Material Link (video/PDF, optional)</label><input className="fi" value={f.link} onChange={e=>setF({...f,link:e.target.value})} placeholder="https://youtube.com/..."/></div>
              <div className="ma"><button className="bs" onClick={()=>setShow(false)}>Cancel</button><button className="bg" onClick={addTraining}><I n="ok" s={15}/>Add</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── LETTERS & DOCUMENTS PAGE ─────────────────────────────────────────────────
function DocumentsPage({data,user,toast}){
  const isAdmin=user.role==="admin";
  const [filter,setFilter]=useState("all");
  var allDocs=(data.documents||[]).slice().sort(function(a,b){return (b.generated_date||"").localeCompare(a.generated_date||"");});
  var myDocs=isAdmin?allDocs:allDocs.filter(function(d){return d.user_id===user.id;});
  if(filter!=="all")myDocs=myDocs.filter(function(d){return d.type===filter;});
  var reprint=function(doc){
    if(!doc.content_html){toast("No saved copy available.");return;}
    openPrint(doc.content_html);
  };
  var typeLabel=function(t){return t==="salary_slip"?"Salary Slip":t==="letter"?"Letter":t;};
  var typeColor=function(t){return t==="salary_slip"?"var(--g)":"var(--bl)";};
  return(
    <div>
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="pdf" s={16} c="var(--g)"/><div style={{flex:1}}><div className="ct">{isAdmin?"All Documents":"My Documents"}</div><div className="cs">{myDocs.length} saved {myDocs.length===1?"document":"documents"}</div></div></div>
        <div className="cb">
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <button className={filter==="all"?"bg":"bs"} onClick={function(){setFilter("all");}} style={{fontSize:12}}>All</button>
            <button className={filter==="salary_slip"?"bg":"bs"} onClick={function(){setFilter("salary_slip");}} style={{fontSize:12}}>Salary Slips</button>
            <button className={filter==="letter"?"bg":"bs"} onClick={function(){setFilter("letter");}} style={{fontSize:12}}>Letters</button>
          </div>
          {myDocs.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)",fontSize:13}}>No documents yet.</div>}
          {myDocs.map(function(doc){
            return(
              <div key={doc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:"1px solid rgba(201,168,76,.06)"}}>
                <div style={{width:38,height:38,borderRadius:9,background:"rgba(201,168,76,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I n="pdf" s={17} c={typeColor(doc.type)}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600}}>{doc.title}</div>
                  <div style={{fontSize:11,color:"var(--txd)"}}>{isAdmin?doc.user_name+" · ":""}{typeLabel(doc.type)} · {doc.generated_date}</div>
                </div>
                <button className="bs" onClick={function(){reprint(doc);}} style={{fontSize:12,flexShrink:0}}><I n="pdf" s={13}/>Open</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LettersPage({data,toast,setData,save}){
  const LETTER_TYPES=[
    {id:"bank",label:"Bank Account Opening Request",to:"The Branch Manager"},
    {id:"employment",label:"Employment / Appointment Letter",to:""},
    {id:"salary_cert",label:"Salary Certificate",to:"To Whom It May Concern"},
    {id:"experience",label:"Experience / Clearance Letter",to:"To Whom It May Concern"},
    {id:"authority",label:"Authority Letter",to:"To Whom It May Concern"},
    {id:"custom",label:"Custom Letter",to:""}
  ];
  const [typeId,setTypeId]=useState("bank");
  const [empId,setEmpId]=useState("");
  const [recipient,setRecipient]=useState("The Branch Manager");
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const staff=(data.users||[]).filter(u=>u.role!=="admin");
  const emp=staff.find(u=>u.id===empId);
  const type=LETTER_TYPES.find(t=>t.id===typeId);

  const onType=(id)=>{
    setTypeId(id);
    var t=LETTER_TYPES.find(x=>x.id===id);
    if(t&&t.to)setRecipient(t.to);
  };

  const generate=()=>{
    if(!body.trim()){toast("Write or draft the letter body first.");return;}
    var today=new Date().toLocaleDateString("en-PK",{year:"numeric",month:"long",day:"numeric"});
    var ref="SK-"+Date.now().toString().slice(-6);
    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+
      "@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');"+
      "*{margin:0;padding:0;box-sizing:border-box}"+
      "body{font-family:'DM Sans',sans-serif;color:#1a1a1a;padding:50px 56px;max-width:780px;margin:0 auto;line-height:1.8}"+
      ".lh{display:flex;align-items:center;gap:14px;border-bottom:3px solid #C9A84C;padding-bottom:18px;margin-bottom:6px}"+
      ".logo{width:62px;height:62px;border-radius:8px;object-fit:cover}"+
      ".cn{font-family:'Rajdhani',sans-serif;font-size:30px;font-weight:700;color:#C9A84C;letter-spacing:1px;line-height:1}"+
      ".cs{font-size:11px;color:#777;margin-top:3px}"+
      ".meta{display:flex;justify-content:space-between;font-size:12px;color:#888;margin:14px 0 30px}"+
      ".subject{font-weight:700;font-size:15px;margin:24px 0 16px;text-decoration:underline}"+
      ".to{font-size:14px;margin-bottom:18px}"+
      ".body{font-size:14px;white-space:pre-wrap;text-align:justify}"+
      ".sign{margin-top:54px}"+
      ".sign-name{font-weight:700;font-size:14px}"+
      ".sign-sub{font-size:12px;color:#666}"+
      ".foot{margin-top:50px;border-top:1px solid #e0d0b0;padding-top:14px;font-size:10px;color:#aaa;text-align:center}"+
      "@media print{body{padding:30px}}"+
      "</style></head><body>"+
      '<div class="lh"><img class="logo" src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg"/><div><div class="cn">SHINKORE MARKETING</div><div class="cs">CEO: Khalid Orakzai &nbsp;|&nbsp; Civil Officer Col Office 28, Abbottabad</div><div class="cs">03135443656 &nbsp;|&nbsp; 0992414034 &nbsp;|&nbsp; www.appabbottabad.com</div></div></div>'+
      '<div class="meta"><span>Ref: '+ref+'</span><span>Date: '+today+'</span></div>'+
      (recipient?'<div class="to"><strong>To:</strong> '+recipient+'</div>':"")+
      (subject?'<div class="subject">Subject: '+subject+'</div>':"")+
      '<div class="body">'+body.replace(/</g,"&lt;").replace(/\n/g,"<br>")+'</div>'+
      '<div class="sign"><div style="border-top:1px solid #999;width:200px;padding-top:8px"><div class="sign-name">Khalid Orakzai</div><div class="sign-sub">CEO, Shinkore Marketing</div></div></div>'+
      '<div class="foot">This is an official document issued by Shinkore Marketing | www.appabbottabad.com</div>'+
      "</body></html>";
    openPrint(html);
    // Archive letter to document history
    if(setData&&save){
      var emp=empId?(data.users||[]).find(function(x){return x.id===empId;}):null;
      var docs=(data.documents||[]).slice();
      var docRec={id:genId(),user_id:emp?emp.id:"",user_name:emp?emp.name:(recipient||"General"),type:"letter",title:(subject||type.label),month:"",content_html:html,generated_date:new Date().toISOString().slice(0,10),generated_by:"admin"};
      docs.push(docRec);
      var nd={...data,documents:docs};
      setData(nd);save(nd);
    }
  };

  return(
    <div>
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="pdf" s={16} c="var(--g)"/><div><div className="ct">Letters & Documents</div><div className="cs">Official letters on company letterhead</div></div></div>
        <div className="cb">
          <div className="fg"><label className="fl">Letter Type</label>
            <select className="fsel" value={typeId} onChange={e=>onType(e.target.value)}>
              {LETTER_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Employee (auto-fills details)</label>
            <select className="fsel" value={empId} onChange={e=>setEmpId(e.target.value)}>
              <option value="">-- None / general --</option>
              {staff.map(u=><option key={u.id} value={u.id}>{u.name} ({u.role==="ba"?"BA":"Supervisor"})</option>)}
            </select>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">To (Recipient)</label><input className="fi" value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="e.g. The Branch Manager, HBL Abbottabad"/></div>
            <div className="fg"><label className="fl">Subject</label><input className="fi" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject line"/></div>
          </div>
          <div className="fg"><label className="fl">Letter Body</label>
            <textarea className="fi" value={body} onChange={e=>setBody(e.target.value)} rows={10} style={{minHeight:200,fontFamily:"inherit",lineHeight:1.6}} placeholder="Write the letter body here. You can edit before generating the PDF."/>
          </div>
          <button className="bg" onClick={generate} style={{width:"100%",justifyContent:"center"}}><I n="pdf" s={16}/>Generate Letter PDF</button>
        </div>
      </div>
      {staff.length===0&&<div style={{textAlign:"center",padding:"20px",color:"var(--txd)",fontSize:13}}>Add staff to enable employee auto-fill.</div>}
    </div>
  );
}




// ─── CLIENT STORE MAP (LEAFLET) ───────────────────────────────────────────────
function ClientStoreMap({client,data}){
  const mapRef=useRef(null);
  const mapObj=useRef(null);
  const [myLoc,setMyLoc]=useState(null);
  const [gpsErr,setGpsErr]=useState("");
  const today=new Date().toISOString().slice(0,10);
  const myStores=(data.stalls||[]).filter(function(s){
    if(!s.latitude||!s.longitude)return false;
    const cn=(client.name||"").toLowerCase();
    const cb=(client.brand||"").toLowerCase();
    const sc=(s.client||"").toLowerCase();
    const sn=(s.name||"").toLowerCase();
    return (cn&&sc.includes(cn))||(cb&&(sc.includes(cb)||sn.includes(cb)));
  });
  const storeStatus=function(stallId){
    const att=(data.attendance||[]).find(function(a){return a.stall_id===stallId&&a.date===today&&!a.clock_out;});
    if(!att)return null;
    const u=(data.users||[]).find(function(x){return x.id===att.user_id;});
    return u?{name:u.name,role:u.role,time:att.clock_in}:null;
  };
  const getMyLocation=function(){
    setGpsErr("");
    if(!navigator.geolocation){setGpsErr("GPS not available");return;}
    navigator.geolocation.getCurrentPosition(function(pos){
      setMyLoc({lat:pos.coords.latitude,lng:pos.coords.longitude});
    },function(){setGpsErr("Enable location to see distances");},{enableHighAccuracy:true,timeout:10000});
  };
  useEffect(function(){getMyLocation();},[]);
  useEffect(function(){
    if(!window.L||!mapRef.current||myStores.length===0)return;
    if(mapObj.current){mapObj.current.remove();mapObj.current=null;}
    const L=window.L;
    const map=L.map(mapRef.current).setView([Number(myStores[0].latitude),Number(myStores[0].longitude)],12);
    mapObj.current=map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
    const bounds=[];
    myStores.forEach(function(s){
      const lat=Number(s.latitude),lng=Number(s.longitude);
      const st=storeStatus(s.id);
      const color=st?"#2ecc71":"#e74c3c";
      const icon=L.divIcon({className:"",html:'<div style="background:'+color+';width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',iconSize:[26,26],iconAnchor:[13,26]});
      L.marker([lat,lng],{icon:icon}).addTo(map).bindPopup("<b>"+s.name+"</b><br>"+s.city+"<br>"+(st?"🟢 "+st.name+" since "+st.time:"⚪ No staff present"));
      bounds.push([lat,lng]);
    });
    if(myLoc){
      const meIcon=L.divIcon({className:"",html:'<div style="background:#3a9bd5;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(58,155,213,0.3)"></div>',iconSize:[18,18],iconAnchor:[9,9]});
      L.marker([myLoc.lat,myLoc.lng],{icon:meIcon}).addTo(map).bindPopup("📍 You are here");
      bounds.push([myLoc.lat,myLoc.lng]);
    }
    if(bounds.length>1)map.fitBounds(bounds,{padding:[40,40]});
    setTimeout(function(){map.invalidateSize();},200);
    return function(){if(mapObj.current){mapObj.current.remove();mapObj.current=null;}};
  },[myStores.length,myLoc]);
  if(myStores.length===0)return(
    <div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>
      <div style={{fontSize:48}}>🗺️</div>
      <div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:16}}>No stores with GPS yet</div>
      <div style={{fontSize:13,marginTop:6}}>Stores appear here once admin sets their location.</div>
    </div>
  );
  return(
    <div>
      {gpsErr&&<div className="info info-warn" style={{marginBottom:12}}><I n="alert" s={13}/>{gpsErr} <button onClick={getMyLocation} style={{marginLeft:8,background:"var(--g)",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",fontSize:12,cursor:"pointer"}}>Retry</button></div>}
      <div ref={mapRef} style={{width:"100%",height:340,borderRadius:14,overflow:"hidden",border:"1px solid var(--bo)",marginBottom:14,background:"var(--d3)"}}></div>
      <div style={{display:"flex",gap:14,marginBottom:14,fontSize:12,color:"var(--txd)",justifyContent:"center"}}>
        <span>🟢 Staff present</span><span>⚪ Empty</span>{myLoc&&<span>🔵 You</span>}
      </div>
      {myStores.map(function(s){
        const st=storeStatus(s.id);
        const dist=myLoc?haversine(myLoc.lat,myLoc.lng,Number(s.latitude),Number(s.longitude)):null;
        const distStr=dist!==null?(dist>=1000?(dist/1000).toFixed(1)+" km":Math.round(dist)+" m"):null;
        return(
          <div key={s.id} style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:12,padding:"12px 14px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <I n="pin" s={16} c={st?"#2ecc71":"var(--txd)"}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
                <div style={{fontSize:12,color:"var(--txd)"}}>{s.city}{distStr&&client.perm_distance!==false?" · 📏 "+distStr+" away":""}</div>
              </div>
              <a href={"https://maps.google.com/?q="+s.latitude+","+s.longitude} target="_blank" style={{fontSize:12,color:"var(--bl)",textDecoration:"none",whiteSpace:"nowrap"}}>Directions ↗</a>
            </div>
            {client.perm_live!==false&&<div style={{marginTop:8,fontSize:12,padding:"6px 10px",borderRadius:8,background:st?"rgba(46,204,113,.1)":"var(--d2)",border:"1px solid "+(st?"rgba(46,204,113,.25)":"var(--bo)"),color:st?"var(--g)":"var(--txd)"}}>
              {st?"🟢 "+st.name+" ("+st.role+") since "+st.time:"⚪ No staff clocked in right now"}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── CLIENT DASHBOARD V2 ──────────────────────────────────────────────────────
// ─── CLIENT PORTAL (DTD + STALLS VIEW) ───────────────────────────────────────
function ClientPortalPage({user,data,toast}){
  const today=new Date().toISOString().slice(0,10);
  const [campaigns,setCampaigns]=useState([]);
  const [visits,setVisits]=useState([]);
  const [items,setItems]=useState([]);
  const [stalls,setStalls]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{loadAll();},[]);

  const loadAll=async()=>{
    setLoading(true);
    const{data:campData,error:e1}=await SB.from("sm_campaigns").select("id,name,start_date,end_date,status").eq("client_id",user.id);
    if(e1){toast("Failed to load campaigns.");setLoading(false);return;}
    const camps=campData||[];
    setCampaigns(camps);
    const campIds=camps.map(c=>c.id);

    let visitRows=[],itemRows=[];
    if(campIds.length>0){
      const{data:vData}=await SB.from("sm_door_visits")
        .select("id,campaign_id,ba_id,visit_time,customer_name")
        .in("campaign_id",campIds)
        .order("visit_time",{ascending:false})
        .limit(50);
      visitRows=vData||[];
      if(visitRows.length>0){
        const vIds=visitRows.map(v=>v.id);
        const{data:iData}=await SB.from("sm_door_items").select("visit_id,qty,type").in("visit_id",vIds);
        itemRows=iData||[];
      }
    }
    setVisits(visitRows);
    setItems(itemRows);

    const{data:stallData}=await SB.from("sm_stalls").select("id,name,city,from_date,to_date,client").ilike("client",user.name);
    setStalls(stallData||[]);
    setLoading(false);
  };

  const baFirstName=(baId)=>{const u=(data.users||[]).find(x=>x.id===baId);return u?u.name.split(" ")[0]:"Staff";};
  const visitItemCount=(vid)=>items.filter(i=>i.visit_id===vid).length;
  const activeStalls=stalls.filter(s=>s.from_date&&s.to_date&&s.from_date<=today&&s.to_date>=today).length;

  const stallStatus=(s)=>{
    if(!s.from_date||!s.to_date) return{label:"Unknown",color:"var(--txd)"};
    if(s.from_date>today) return{label:"Upcoming",color:"#3498db"};
    if(s.to_date<today) return{label:"Ended",color:"var(--txd)"};
    return{label:"Active",color:"var(--gr)"};
  };

  const cardStyle={background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:14,padding:"16px 20px",flex:1,minWidth:120};
  const thStyle={textAlign:"left",padding:"8px 10px",color:"var(--txd)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:.5};
  const tdStyle={padding:"8px 10px",fontSize:13,borderTop:"1px solid var(--bo)"};

  return(
    <div>
      <div style={{background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:14,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,var(--g),var(--bl))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏢</div>
        <div>
          <div style={{fontFamily:"Rajdhani",fontSize:22,fontWeight:700,color:"var(--g)"}}>{user.name}</div>
          <div style={{fontSize:13,color:"var(--txd)"}}>Brand: {user.brand||"—"} · Client Portal</div>
        </div>
      </div>

      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <div style={cardStyle}><div style={{fontFamily:"Rajdhani",fontSize:28,fontWeight:700,color:"var(--g)",lineHeight:1}}>{loading?"…":visits.length}</div><div style={{fontSize:11,color:"var(--txd)",marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>Doors Visited</div></div>
        <div style={cardStyle}><div style={{fontFamily:"Rajdhani",fontSize:28,fontWeight:700,color:"var(--g)",lineHeight:1}}>{loading?"…":items.length}</div><div style={{fontSize:11,color:"var(--txd)",marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>Items Distributed</div></div>
        <div style={cardStyle}><div style={{fontFamily:"Rajdhani",fontSize:28,fontWeight:700,color:"var(--g)",lineHeight:1}}>{loading?"…":activeStalls}</div><div style={{fontSize:11,color:"var(--txd)",marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>Active Stalls</div></div>
      </div>

      {loading&&<div className="card"><div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>Loading your data…</div></div>}

      {!loading&&<>
        <div className="card" style={{marginBottom:16}}>
          <div className="ch"><I n="map" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">Recent Door Visits</div><div className="cs">{visits.length} visits (last 50)</div></div>{visits.length>0&&<button className="bs" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>{const nl=String.fromCharCode(10);const h="Date,Time,Customer,Phone,Items,Field Rep"+nl;const r=visits.map(v=>{const dt=new Date(v.visit_time);return[dt.toLocaleDateString("en-GB"),dt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),v.customer_name||"",v.customer_phone||"",visitItemCount(v.id),baFirstName(v.ba_id)].join(",");}).join(nl);const blob=new Blob([h+r],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="visits.csv";a.click();}}><I n="pdf" s={13}/>Export</button>}</div>
          <div className="cb">
            {visits.length===0
              ?<div style={{textAlign:"center",padding:"32px",color:"var(--txd)"}}>
                  <div style={{fontSize:36,marginBottom:8}}>📭</div>
                  <div style={{fontFamily:"Rajdhani",fontSize:17,fontWeight:600}}>{campaigns.length===0?"No active campaigns yet":"No door visits recorded yet"}</div>
                </div>
              :<div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={thStyle}>Date</th><th style={thStyle}>Time</th><th style={thStyle}>Customer</th>
                    <th style={{...thStyle,textAlign:"center"}}>Items</th><th style={thStyle}>Field Rep</th>
                  </tr></thead>
                  <tbody>{visits.map(v=>{
                    const dt=new Date(v.visit_time);
                    return(<tr key={v.id}>
                      <td style={tdStyle}>{dt.toLocaleDateString("en-GB")}</td>
                      <td style={tdStyle}>{dt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</td>
                      <td style={tdStyle}>{v.customer_name}</td>
                      <td style={{...tdStyle,textAlign:"center"}}>{visitItemCount(v.id)}</td>
                      <td style={tdStyle}>{baFirstName(v.ba_id)}</td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            }
          </div>
        </div>

        <div className="card">
          <div className="ch"><I n="pin" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">Your Stalls</div><div className="cs">{stalls.length} stalls</div></div></div>
          <div className="cb">
            {stalls.length===0
              ?<div style={{textAlign:"center",padding:"32px",color:"var(--txd)"}}>
                  <div style={{fontSize:36,marginBottom:8}}>📍</div>
                  <div style={{fontFamily:"Rajdhani",fontSize:17,fontWeight:600}}>No stalls assigned yet</div>
                </div>
              :<div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={thStyle}>Location</th><th style={thStyle}>City</th>
                    <th style={thStyle}>Dates</th><th style={{...thStyle,textAlign:"center"}}>Status</th>
                  </tr></thead>
                  <tbody>{stalls.map(s=>{
                    const st=stallStatus(s);
                    return(<tr key={s.id}>
                      <td style={tdStyle}>{s.name}</td>
                      <td style={tdStyle}>{s.city||"—"}</td>
                      <td style={tdStyle}>{s.from_date||"?"} → {s.to_date||"?"}</td>
                      <td style={{...tdStyle,textAlign:"center"}}>
                        <span style={{fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:600,color:st.color,border:"1px solid "+st.color,background:st.color+"22"}}>{st.label}</span>
                      </td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            }
          </div>
        </div>
      </>}
    </div>
  );
}

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

  const tabs=[...(client.perm_map!==false?["map"]:[]),"overview","stores","products","bas","photos"];
  const tabLabels={map:"🗺️ Live Map",overview:"Overview",stores:"Stores",products:"Products",bas:"BAs",photos:"Photos"};

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

      {tab==="map"&&<ClientStoreMap client={client} data={data}/>}
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

  useEffect(()=>{if(data.sheets_url!==undefined)setUrl(data.sheets_url||"");},[data.sheets_url]);

  const saveUrl=()=>{
    const d={...data,sheets_url:url};
    setData(d);save(d);
    toast("Sheets URL saved!");
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

// ─── CAMPAIGNS PAGE ───────────────────────────────────────────────────────────
function CampaignsPage({data,toast}){
  const [campaigns,setCampaigns]=useState([]);
  const [targets,setTargets]=useState([]);
  const [loading,setLoading]=useState(true);
  const [show,setShow]=useState(false);
  const [editing,setEditing]=useState(null);
  const emptyF={name:"",client_id:"",start_date:"",end_date:"",selectedBAs:[],baTargets:{}};
  const [f,setF]=useState(emptyF);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const today=new Date().toISOString().slice(0,10);
  const staff=(data.users||[]).filter(u=>u.role==="ba"||u.role==="supervisor");

  useEffect(()=>{
    Promise.all([
      SB.from("sm_campaigns").select("*").order("created_at",{ascending:false}),
      SB.from("sm_campaign_targets").select("*")
    ]).then(([{data:cRows},{data:tRows}])=>{
      setCampaigns(cRows||[]);setTargets(tRows||[]);setLoading(false);
    });
  },[]);

  const openAdd=()=>{setEditing(null);setF(emptyF);setShow(true);};
  const openEdit=(c)=>{
    setEditing(c);
    const bt={};
    targets.filter(t=>t.campaign_id===c.id).forEach(t=>{bt[t.ba_id]={doors_per_day:t.doors_per_day||"",units_per_day:t.units_per_day||"",revenue_target:t.revenue_target||""};});
    setF({name:c.name,client_id:c.client_id,start_date:c.start_date||"",end_date:c.end_date||"",selectedBAs:c.assigned_bas||[],baTargets:bt});
    setShow(true);
  };

  const toggleBA=(uid)=>{
    setF(p=>{
      const isSel=p.selectedBAs.includes(uid);
      const sel=isSel?p.selectedBAs.filter(x=>x!==uid):[...p.selectedBAs,uid];
      const bt={...p.baTargets};
      if(isSel) delete bt[uid]; else bt[uid]={doors_per_day:"",units_per_day:"",revenue_target:""};
      return{...p,selectedBAs:sel,baTargets:bt};
    });
  };
  const setTarget=(baId,field,value)=>setF(p=>({...p,baTargets:{...p.baTargets,[baId]:{...p.baTargets[baId],[field]:value}}}));

  const doSave=async()=>{
    if(!f.name.trim()) return toast("Campaign name required.");
    if(!f.client_id) return toast("Select a client.");
    if(!f.start_date||!f.end_date) return toast("Start and end dates required.");
    if(f.end_date<f.start_date) return toast("End date must be after start date.");
    if(f.selectedBAs.length===0) return toast("Assign at least one BA or Supervisor.");
    const cid=editing?.id||crypto.randomUUID();
    const crow={id:cid,client_id:f.client_id,name:f.name.trim(),type:"dtd",start_date:f.start_date,end_date:f.end_date,assigned_bas:f.selectedBAs,status:"active"};
    const{error:e1}=await SB.from("sm_campaigns").upsert([crow],{onConflict:"id"});
    if(e1) return toast("Save failed: "+e1.message);
    const{error:e2}=await SB.from("sm_campaign_targets").delete().eq("campaign_id",cid);
    if(e2) return toast("Failed to clear old targets: "+e2.message);
    const trows=f.selectedBAs.map(baId=>({id:crypto.randomUUID(),campaign_id:cid,ba_id:baId,doors_per_day:Number(f.baTargets[baId]?.doors_per_day)||0,units_per_day:Number(f.baTargets[baId]?.units_per_day)||0,revenue_target:Number(f.baTargets[baId]?.revenue_target)||0}));
    if(trows.length>0){const{error:e3}=await SB.from("sm_campaign_targets").insert(trows);if(e3) return toast("Targets save failed: "+e3.message);}
    setCampaigns(p=>editing?p.map(x=>x.id===cid?crow:x):[crow,...p]);
    setTargets(p=>[...p.filter(t=>t.campaign_id!==cid),...trows]);
    setShow(false);toast(editing?"Campaign updated!":"Campaign created!");
  };

  const doDel=async(c)=>{
    if(!confirm(`Delete "${c.name}"? This also removes all BA targets.`)) return;
    await SB.from("sm_campaign_targets").delete().eq("campaign_id",c.id);
    const{error}=await SB.from("sm_campaigns").delete().eq("id",c.id);
    if(error) return toast("Delete failed.");
    setCampaigns(p=>p.filter(x=>x.id!==c.id));
    setTargets(p=>p.filter(t=>t.campaign_id!==c.id));
    toast("Campaign deleted.");
  };

  const clientName=(id)=>(data.clients||[]).find(c=>c.id===id)?.name||"—";

  return(
    <div>
      <div className="card">
        <div className="ch">
          <I n="flag" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Campaigns</div><div className="cs">{campaigns.length} campaigns</div></div>
          <button className="bg" onClick={openAdd}><I n="plus" s={15}/>New Campaign</button>
        </div>
        <div className="cb">
          {loading&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>Loading campaigns…</div>}
          {!loading&&campaigns.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>No campaigns yet. Create your first DTD campaign.</div>}
          {!loading&&campaigns.map(c=>{
            const cTargets=targets.filter(t=>t.campaign_id===c.id);
            const ended=c.end_date&&c.end_date<today;
            return(
              <div key={c.id} style={{background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:14,padding:16,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--g)"}}>{c.name}</div>
                    <div style={{fontSize:12,color:"var(--txd)",marginTop:2}}>{clientName(c.client_id)} · {c.start_date} → {c.end_date}</div>
                    <div style={{fontSize:12,color:"var(--txd)",marginTop:2}}>👥 {(c.assigned_bas||[]).length} staff assigned</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                    <span style={{fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:600,background:ended?"rgba(231,76,60,.12)":"rgba(46,204,113,.12)",color:ended?"var(--rd)":"var(--gr)",border:"1px solid "+(ended?"rgba(231,76,60,.3)":"rgba(46,204,113,.3)")}}>{ended?"Ended":"Active"}</span>
                    <button className="bic" onClick={()=>openEdit(c)}><I n="edit" s={14}/></button>
                    <button className="brd" onClick={()=>doDel(c)}><I n="del" s={13}/></button>
                  </div>
                </div>
                {cTargets.length>0&&(
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:"1px solid var(--bo)"}}>
                          <th style={{textAlign:"left",padding:"4px 8px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Staff</th>
                          <th style={{textAlign:"right",padding:"4px 8px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Doors/Day</th>
                          <th style={{textAlign:"right",padding:"4px 8px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Units/Day</th>
                          <th style={{textAlign:"right",padding:"4px 8px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Rev Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cTargets.map(t=>{
                          const u=(data.users||[]).find(x=>x.id===t.ba_id);
                          return(
                            <tr key={t.id} style={{borderBottom:"1px solid var(--bo)"}}>
                              <td style={{padding:"5px 8px",fontWeight:600}}>{u?.name||"—"}</td>
                              <td style={{padding:"5px 8px",textAlign:"right",color:"var(--bl)"}}>{t.doors_per_day||0}</td>
                              <td style={{padding:"5px 8px",textAlign:"right",color:"var(--bl)"}}>{t.units_per_day||0}</td>
                              <td style={{padding:"5px 8px",textAlign:"right",color:"var(--g)",fontFamily:"Rajdhani",fontWeight:700}}>{formatPKR(t.revenue_target)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">{editing?"Edit Campaign":"New Campaign"}</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Campaign Name</label><input className="fi" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. June DTD — Brite"/></div>
              <div className="fg"><label className="fl">Client</label>
                <select className="fsel" value={f.client_id} onChange={e=>set("client_id",e.target.value)}>
                  <option value="">— Select Client —</option>
                  {(data.clients||[]).map(c=><option key={c.id} value={c.id}>{c.name} ({c.brand})</option>)}
                </select>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Start Date</label><input className="fi" type="date" value={f.start_date} onChange={e=>set("start_date",e.target.value)}/></div>
                <div className="fg"><label className="fl">End Date</label><input className="fi" type="date" value={f.end_date} onChange={e=>set("end_date",e.target.value)}/></div>
              </div>
              <div style={{marginBottom:12}}>
                <label className="fl">Assign BAs &amp; Supervisors</label>
                <div style={{background:"var(--d3)",borderRadius:8,border:"1px solid var(--bo)",maxHeight:180,overflowY:"auto"}}>
                  {staff.length===0&&<div style={{padding:"12px",fontSize:12,color:"var(--txd)"}}>No BA or Supervisor staff found.</div>}
                  {staff.map(u=>{
                    const sel=f.selectedBAs.includes(u.id);
                    return(
                      <div key={u.id} onClick={()=>toggleBA(u.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",cursor:"pointer",background:sel?"rgba(201,168,76,.08)":"transparent",borderBottom:"1px solid var(--bo)"}}>
                        <div style={{width:18,height:18,borderRadius:4,border:"2px solid "+(sel?"var(--g)":"var(--bo)"),background:sel?"var(--g)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {sel&&<svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>}
                        </div>
                        <span style={{flex:1,fontSize:13,fontWeight:sel?600:400}}>{u.name}</span>
                        <span style={{fontSize:10,padding:"1px 7px",borderRadius:10,background:"var(--d2)",color:"var(--txd)",border:"1px solid var(--bo)"}}>{u.role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {f.selectedBAs.length>0&&(
                <div style={{marginBottom:12}}>
                  <label className="fl">Targets per BA</label>
                  <div style={{background:"var(--d3)",borderRadius:8,border:"1px solid var(--bo)",overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:"1px solid var(--bo)"}}>
                          <th style={{textAlign:"left",padding:"6px 10px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.8}}>Staff</th>
                          <th style={{padding:"6px 4px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.8,textAlign:"center"}}>Doors/Day</th>
                          <th style={{padding:"6px 4px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.8,textAlign:"center"}}>Units/Day</th>
                          <th style={{padding:"6px 4px",color:"var(--txd)",fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:.8,textAlign:"center"}}>Revenue (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.selectedBAs.map(baId=>{
                          const u=(data.users||[]).find(x=>x.id===baId);
                          const t=f.baTargets[baId]||{};
                          return(
                            <tr key={baId} style={{borderBottom:"1px solid var(--bo)"}}>
                              <td style={{padding:"5px 10px",fontWeight:600}}>{u?.name||"—"}</td>
                              <td style={{padding:"3px 4px"}}><input className="fi" type="number" min="0" style={{padding:"4px 6px",fontSize:12,textAlign:"center"}} value={t.doors_per_day||""} onChange={e=>setTarget(baId,"doors_per_day",e.target.value)} placeholder="0"/></td>
                              <td style={{padding:"3px 4px"}}><input className="fi" type="number" min="0" style={{padding:"4px 6px",fontSize:12,textAlign:"center"}} value={t.units_per_day||""} onChange={e=>setTarget(baId,"units_per_day",e.target.value)} placeholder="0"/></td>
                              <td style={{padding:"3px 4px"}}><input className="fi" type="number" min="0" style={{padding:"4px 6px",fontSize:12}} value={t.revenue_target||""} onChange={e=>setTarget(baId,"revenue_target",e.target.value)} placeholder="0"/></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {(()=>{const sc=(data.clients||[]).find(c=>c.id===f.client_id);const dtdOk=!sc||getClientSettings(sc).dtd_enabled;return !dtdOk?(<div className="info info-warn" style={{marginBottom:10}}><I n="alert" s={13}/>DTD is disabled for this client. Enable it in Control Panel first.</div>):null;})()}
              <div className="ma"><button className="bs" onClick={()=>setShow(false)}>Cancel</button><button className="bg" onClick={doSave} disabled={(()=>{const sc=(data.clients||[]).find(c=>c.id===f.client_id);return sc&&!getClientSettings(sc).dtd_enabled;})()} style={{opacity:(()=>{const sc=(data.clients||[]).find(c=>c.id===f.client_id);return sc&&!getClientSettings(sc).dtd_enabled?0.4:1;})()}}><I n="ok" s={15}/>{editing?"Save Changes":"Create Campaign"}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PRODUCTS PAGE ────────────────────────────────────────────────────────────
function ProductsPage({data,toast}){
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [show,setShow]=useState(false);
  const [editing,setEditing]=useState(null);
  const [filterClient,setFilterClient]=useState("");
  const [showCSV,setShowCSV]=useState(false);
  const [csvClient,setCsvClient]=useState("");
  const [csvRows,setCsvRows]=useState([]);
  const [csvSkipped,setCsvSkipped]=useState(0);
  const emptyF={client_id:"",name:"",sku:"",unit_price:""};
  const [f,setF]=useState(emptyF);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  useEffect(()=>{
    SB.from("sm_products").select("*").order("created_at",{ascending:false})
      .then(({data:rows})=>{setProducts(rows||[]);setLoading(false);});
  },[]);

  const doSave=async()=>{
    if(!f.client_id||!f.name||!f.sku) return toast("Client, name and SKU required.");
    const skuLower=f.sku.trim().toLowerCase();
    const dup=products.find(p=>p.client_id===f.client_id&&p.sku.toLowerCase()===skuLower&&(!editing||p.id!==editing.id));
    if(dup) return toast(`SKU "${f.sku.trim()}" already exists for this client.`);
    const row={id:editing?editing.id:crypto.randomUUID(),client_id:f.client_id,name:f.name.trim(),sku:f.sku.trim(),unit_price:Number(f.unit_price)||0};
    const{error}=await SB.from("sm_products").upsert([row],{onConflict:"id"});
    if(error) return toast("Save failed: "+error.message);
    setProducts(p=>editing?p.map(x=>x.id===editing.id?row:x):[row,...p]);
    setShow(false);toast(editing?"Product updated!":"Product added!");
  };

  const doDel=async(prod)=>{
    if(!confirm(`Delete "${prod.name}"?`)) return;
    const{error}=await SB.from("sm_products").delete().eq("id",prod.id);
    if(error) return toast("Delete failed.");
    setProducts(p=>p.filter(x=>x.id!==prod.id));
    toast("Removed.");
  };

  const parseCSV=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const lines=ev.target.result.split("\n").map(l=>l.trim()).filter(Boolean);
      const start=/^name/i.test(lines[0])?1:0;
      const all=lines.slice(start).map(line=>{
        const parts=line.split(",").map(s=>s.trim().replace(/^"|"$/g,""));
        const priceRaw=parts[2]||"";
        const price=priceRaw===""?0:Number(priceRaw);
        return{name:parts[0]||"",sku:parts[1]||"",unit_price:price,_bad:!parts[0]||!parts[1]||isNaN(price)};
      });
      const valid=all.filter(r=>!r._bad).map(({_bad,...r})=>r);
      setCsvRows(valid);
      setCsvSkipped(all.length-valid.length);
    };
    reader.readAsText(file);
  };

  const doImportCSV=async()=>{
    if(!csvClient) return toast("Select a client first.");
    if(csvRows.length===0) return toast("No valid rows found in CSV.");
    const existingSKUs=new Set(products.filter(p=>p.client_id===csvClient).map(p=>p.sku.toLowerCase()));
    const newRows=csvRows.filter(r=>!existingSKUs.has(r.sku.toLowerCase()));
    const dupCount=csvRows.length-newRows.length;
    if(newRows.length===0) return toast("All SKUs already exist for this client — nothing imported.");
    const rows=newRows.map(r=>({id:crypto.randomUUID(),client_id:csvClient,name:r.name,sku:r.sku,unit_price:r.unit_price}));
    const{error}=await SB.from("sm_products").insert(rows);
    if(error) return toast("Import failed: "+error.message);
    setProducts(p=>[...rows,...p]);
    setShowCSV(false);setCsvRows([]);setCsvClient("");setCsvSkipped(0);
    const note=[rows.length+" imported",dupCount>0?dupCount+" duplicate SKUs skipped":"",csvSkipped>0?csvSkipped+" bad rows skipped":""].filter(Boolean).join(", ");
    toast(note+"!");
  };

  const filtered=filterClient?products.filter(p=>p.client_id===filterClient):products;
  const clientName=(id)=>(data.clients||[]).find(c=>c.id===id)?.name||"—";

  return(
    <div>
      <div className="card">
        <div className="ch">
          <I n="box" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Products</div><div className="cs">{filtered.length} of {products.length}</div></div>
          <button className="brd" style={{marginRight:8}} onClick={()=>{setCsvRows([]);setCsvClient("");setCsvSkipped(0);setShowCSV(true);}}>⬆ CSV</button>
          <button className="bg" onClick={()=>{setEditing(null);setF(emptyF);setShow(true);}}><I n="plus" s={15}/>Add Product</button>
        </div>
        <div style={{padding:"0 16px 12px",display:"flex",gap:8,alignItems:"center"}}>
          <select className="fsel" style={{flex:1}} value={filterClient} onChange={e=>setFilterClient(e.target.value)}>
            <option value="">All Clients ({products.length})</option>
            {(data.clients||[]).map(c=>{const cnt=products.filter(p=>p.client_id===c.id).length;return<option key={c.id} value={c.id}>{c.name} — {cnt} products</option>;})}
          </select>
          {filterClient&&<button className="brd" onClick={()=>setFilterClient("")} style={{fontSize:11,padding:"6px 10px",whiteSpace:"nowrap"}}>✕ Clear</button>}
        </div>
        <div className="cb">
          {loading&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>Loading products…</div>}
          {!loading&&filtered.length===0&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>No products yet. Add one or import from CSV.</div>}
          {!loading&&filtered.length>0&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{borderBottom:"2px solid var(--bo)"}}>
                    <th style={{textAlign:"left",padding:"6px 10px",color:"var(--txd)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Client</th>
                    <th style={{textAlign:"left",padding:"6px 10px",color:"var(--txd)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Product Name</th>
                    <th style={{textAlign:"left",padding:"6px 10px",color:"var(--txd)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>SKU</th>
                    <th style={{textAlign:"right",padding:"6px 10px",color:"var(--txd)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Unit Price</th>
                    <th style={{width:72}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p=>(
                    <tr key={p.id} style={{borderBottom:"1px solid var(--bo)"}}>
                      <td style={{padding:"9px 10px",fontSize:12,color:"var(--bl)"}}>{clientName(p.client_id)}</td>
                      <td style={{padding:"9px 10px",fontWeight:600}}>{p.name}</td>
                      <td style={{padding:"9px 10px",fontFamily:"monospace",fontSize:12,color:"var(--txd)",letterSpacing:.5}}>{p.sku}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",color:"var(--g)",fontFamily:"Rajdhani",fontSize:15,fontWeight:700}}>{formatPKR(p.unit_price)}</td>
                      <td style={{padding:"9px 10px"}}>
                        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                          <button className="bic" onClick={()=>{setEditing(p);setF({client_id:p.client_id,name:p.name,sku:p.sku,unit_price:p.unit_price});setShow(true);}}><I n="edit" s={13}/></button>
                          <button className="brd" onClick={()=>doDel(p)} style={{padding:"4px 8px",fontSize:11}}><I n="del" s={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {show&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShow(false)}>
          <div className="md">
            <div className="mh"><div className="mt">{editing?"Edit Product":"Add Product"}</div><div className="mc" onClick={()=>setShow(false)}>×</div></div>
            <div className="mb">
              <div className="fg"><label className="fl">Client</label>
                <select className="fsel" value={f.client_id} onChange={e=>set("client_id",e.target.value)}>
                  <option value="">— Select Client —</option>
                  {(data.clients||[]).map(c=><option key={c.id} value={c.id}>{c.name} ({c.brand})</option>)}
                </select>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Product Name</label><input className="fi" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Brite 500g"/></div>
                <div className="fg"><label className="fl">SKU</label><input className="fi" value={f.sku} onChange={e=>set("sku",e.target.value)} placeholder="e.g. BRT-500G"/></div>
              </div>
              <div className="fg"><label className="fl">Unit Price (PKR)</label><input className="fi" type="number" min="0" step="0.01" value={f.unit_price} onChange={e=>set("unit_price",e.target.value)} placeholder="0"/></div>
              <div className="ma"><button className="bs" onClick={()=>setShow(false)}>Cancel</button><button className="bg" onClick={doSave}><I n="ok" s={15}/>{editing?"Save Changes":"Add Product"}</button></div>
            </div>
          </div>
        </div>
      )}

      {showCSV&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowCSV(false)}>
          <div className="md">
            <div className="mh"><div className="mt">Import Products from CSV</div><div className="mc" onClick={()=>setShowCSV(false)}>×</div></div>
            <div className="mb">
              <div className="info info-blue" style={{marginBottom:12}}><I n="alert" s={14}/><div>Columns (in order): <strong>name, sku, unit_price</strong>. Header row is auto-detected and skipped.</div></div>
              <div className="fg"><label className="fl">Assign all rows to client</label>
                <select className="fsel" value={csvClient} onChange={e=>setCsvClient(e.target.value)}>
                  <option value="">— Select Client —</option>
                  {(data.clients||[]).map(c=><option key={c.id} value={c.id}>{c.name} ({c.brand})</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl">CSV File</label>
                <input type="file" accept=".csv,text/csv" onChange={parseCSV} style={{display:"block",padding:"8px 0",color:"var(--tx)",fontSize:13}}/>
              </div>
              {csvRows.length>0&&<div style={{background:"rgba(46,204,113,.1)",border:"1px solid rgba(46,204,113,.3)",borderRadius:8,padding:"8px 12px",fontSize:12,marginBottom:8,color:"var(--g)"}}>
                ✅ {csvRows.length} rows ready — {csvRows.slice(0,3).map(r=>r.name).join(", ")}{csvRows.length>3?" …":""}
              </div>}
              {csvSkipped>0&&<div style={{background:"rgba(240,165,0,.1)",border:"1px solid rgba(240,165,0,.3)",borderRadius:8,padding:"8px 12px",fontSize:12,marginBottom:8,color:"var(--or)"}}>
                ⚠️ {csvSkipped} row{csvSkipped>1?"s":""} skipped — missing name/SKU or non-numeric price.
              </div>}
              <div className="ma">
                <button className="bs" onClick={()=>setShowCSV(false)}>Cancel</button>
                <button className="bg" onClick={doImportCSV} disabled={!csvClient||csvRows.length===0} style={{opacity:(!csvClient||csvRows.length===0)?0.5:1}}>
                  <I n="ok" s={15}/>Import {csvRows.length>0?csvRows.length+" Products":""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CLIENT CONTROL PANEL ─────────────────────────────────────────────────────
function ClientControlPanelPage({data,setData,toast}){
  const clients=data.clients||[];
  const [bonusEdits,setBonusEdits]=useState(()=>{
    const m={};
    (data.clients||[]).forEach(c=>{const b=getClientSettings(c).bonus;m[c.id]={metric:b.metric||"units",tiers:(b.tiers||[]).map(t=>({pct:String(t.pct),amount:String(t.amount)}))};});
    return m;
  });
  const [bonusSaving,setBonusSaving]=useState({});

  const saveSettings=async(client,newSettings)=>{
    const updated=clients.map(c=>c.id===client.id?{...c,settings:newSettings}:c);
    const newData={...data,clients:updated};
    setData(newData);
    localStorage.setItem("shinkore_v2",JSON.stringify(newData));
    const row={id:client.id,name:client.name||"",brand:client.brand||"",phone:client.phone||"",email:client.email||"",pin:client.pin||"",active:client.active!==false,settings:newSettings};
    const{error}=await SB.from("sm_clients").upsert([row],{onConflict:"id"});
    if(error) toast("Save failed: "+error.message);
  };

  const toggle=(client,path,value)=>{
    const cs=getClientSettings(client);
    let ns={...cs};
    if(path==="activities.sampling") ns={...ns,activities:{...ns.activities,sampling:value}};
    else if(path==="activities.gifting") ns={...ns,activities:{...ns.activities,gifting:value}};
    else if(path==="activities.sales") ns={...ns,activities:{...ns.activities,sales:value}};
    else ns={...ns,[path]:value};
    saveSettings(client,ns);
  };

  const saveBonusCriteria=async(client)=>{
    const edit=bonusEdits[client.id]||{metric:"units",tiers:[]};
    const validTiers=edit.tiers.filter(t=>t.pct.trim()&&t.amount.trim()&&!isNaN(Number(t.pct))&&!isNaN(Number(t.amount)));
    const sorted=[...validTiers].sort((a,b)=>Number(a.pct)-Number(b.pct));
    const bonusObj={metric:edit.metric,tiers:sorted.map(t=>({pct:Number(t.pct),amount:Number(t.amount)}))};
    const cs=getClientSettings(client);
    setBonusSaving(p=>({...p,[client.id]:true}));
    await saveSettings(client,{...cs,bonus:bonusObj});
    setBonusSaving(p=>({...p,[client.id]:false}));
    toast("Bonus criteria saved!");
  };

  const setBE=(clientId,updater)=>setBonusEdits(p=>({...p,[clientId]:updater(p[clientId]||{metric:"units",tiers:[]})}));
  const setMetric=(clientId,metric)=>setBE(clientId,e=>({...e,metric}));
  const addTier=(clientId)=>setBE(clientId,e=>({...e,tiers:[...e.tiers,{pct:"",amount:""}]}));
  const removeTier=(clientId,idx)=>setBE(clientId,e=>({...e,tiers:e.tiers.filter((_,i)=>i!==idx)}));
  const setTierField=(clientId,idx,key,val)=>setBE(clientId,e=>{const t=[...e.tiers];t[idx]={...t[idx],[key]:val};return{...e,tiers:t};});

  const Row=({label,val,onToggle})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--bo)"}}>
      <span style={{fontSize:13}}>{label}</span>
      <button onClick={()=>onToggle(!val)} style={{padding:"4px 14px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:val?"var(--g)":"rgba(255,255,255,.08)",color:val?"#000":"var(--txd)",minWidth:52}}>
        {val?"ON":"OFF"}
      </button>
    </div>
  );

  if(clients.length===0) return(
    <div className="card"><div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>No clients yet. Add them in the Clients page first.</div></div>
  );

  return(
    <div>
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="set" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">Client Control Panel</div><div className="cs">Configure what each client's staff can do</div></div></div>
      </div>
      {clients.map(client=>{
        const cs=getClientSettings(client);
        const be=bonusEdits[client.id]||{metric:"units",tiers:[]};
        return(
          <div key={client.id} className="card" style={{marginBottom:12}}>
            <div className="ch">
              <div className="av av-green" style={{width:36,height:36,fontSize:13,borderRadius:9,flexShrink:0}}>{(client.name||"?").charAt(0).toUpperCase()}</div>
              <div style={{flex:1}}><div className="ct">{client.name}</div><div className="cs">{client.brand||"No brand"}</div></div>
            </div>
            <div className="cb">
              <div style={{fontSize:11,color:"var(--g)",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Work Types</div>
              <Row label="Stall work enabled"   val={cs.stall_enabled} onToggle={v=>toggle(client,"stall_enabled",v)}/>
              <Row label="Door-to-door (DTD) enabled" val={cs.dtd_enabled} onToggle={v=>toggle(client,"dtd_enabled",v)}/>
              <div style={{fontSize:11,color:"var(--g)",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginTop:12,marginBottom:4}}>Activities Allowed</div>
              <Row label="Sampling" val={cs.activities.sampling} onToggle={v=>toggle(client,"activities.sampling",v)}/>
              <Row label="Gifting"  val={cs.activities.gifting}  onToggle={v=>toggle(client,"activities.gifting",v)}/>
              <Row label="Sales"    val={cs.activities.sales}    onToggle={v=>toggle(client,"activities.sales",v)}/>
              <div style={{fontSize:11,color:"var(--g)",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginTop:12,marginBottom:4}}>Requirements</div>
              <Row label="SOP checklist required at door visits" val={cs.sop_required} onToggle={v=>toggle(client,"sop_required",v)}/>
              <Row label="GPS capture required at door visits"   val={cs.gps_required} onToggle={v=>toggle(client,"gps_required",v)}/>
              <div style={{fontSize:11,color:"var(--g)",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginTop:12,marginBottom:8}}>Bonus Criteria</div>
              <div style={{marginBottom:8}}>
                <label className="fl">Achievement Metric</label>
                <select className="fi" value={be.metric} onChange={e=>setMetric(client.id,e.target.value)}>
                  <option value="units">Units (sale qty)</option>
                  <option value="doors">Doors visited</option>
                  <option value="revenue">Revenue (PKR)</option>
                </select>
              </div>
              <div style={{fontSize:12,color:"var(--txd)",marginBottom:6}}>Tiers: if achievement ≥ %, BA earns the PKR amount (highest matching tier wins)</div>
              {be.tiers.map((t,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                  <input className="fi" type="number" min="1" max="200" placeholder="%" value={t.pct}
                    style={{width:70,textAlign:"center"}} onChange={e=>setTierField(client.id,i,"pct",e.target.value)}/>
                  <span style={{fontSize:12,color:"var(--txd)",flexShrink:0}}>% →</span>
                  <input className="fi" type="number" min="0" placeholder="PKR" value={t.amount}
                    style={{flex:1}} onChange={e=>setTierField(client.id,i,"amount",e.target.value)}/>
                  <button className="brd" style={{padding:"4px 8px",flexShrink:0}} onClick={()=>removeTier(client.id,i)}><I n="del" s={12}/></button>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button className="bic" style={{fontSize:12}} onClick={()=>addTier(client.id)}><I n="plus" s={12}/>Add Tier</button>
                <button className="bg" style={{fontSize:12}} onClick={()=>saveBonusCriteria(client)} disabled={bonusSaving[client.id]}>{bonusSaving[client.id]?"Saving…":"Save Bonus"}</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DTD ADMIN DASHBOARD ──────────────────────────────────────────────────────
function DTDAdminPage({data,toast}){
  const today=new Date().toISOString().slice(0,10);
  const [campaigns,setCampaigns]=useState([]);
  const [visits,setVisits]=useState([]);
  const [items,setItems]=useState([]);
  const [clocks,setClocks]=useState([]);
  const [products,setProducts]=useState([]);
  const [targets,setTargets]=useState([]);
  const [clientSettings,setClientSettings]=useState({});
  const [loading,setLoading]=useState(true);
  const [expandedId,setExpandedId]=useState(null);
  const [filters,setFilters]=useState({campaign_id:"",client_id:"",ba_id:"",date_from:"",date_to:"",activity_type:""});
  const setF=(k,v)=>setFilters(f=>({...f,[k]:v}));
  const clearFilters=()=>setFilters({campaign_id:"",client_id:"",ba_id:"",date_from:"",date_to:"",activity_type:""});

  const loadAll=async()=>{
    setLoading(true);
    const [r1,r2,r3,r4,r5,r6,r7]=await Promise.all([
      SB.from("sm_campaigns").select("id,client_id,name,type,start_date,end_date,assigned_bas,status").order("created_at",{ascending:false}),
      SB.from("sm_door_visits").select("id,campaign_id,ba_id,client_id,latitude,longitude,visit_time,customer_name,customer_phone,photo_url,sop_checklist").order("visit_time",{ascending:false}),
      SB.from("sm_door_items").select("id,visit_id,product_id,sku,product_name,qty,type"),
      SB.from("sm_dtd_clock").select("id,campaign_id,ba_id,clock_in,clock_out,work_date"),
      SB.from("sm_products").select("id,client_id,name,sku,unit_price"),
      SB.from("sm_campaign_targets").select("id,campaign_id,ba_id,doors_per_day,units_per_day,revenue_target"),
      SB.from("sm_clients").select("id,settings"),
    ]);
    if(r1.error){toast("Failed to load campaigns: "+r1.error.message);}
    else setCampaigns(r1.data||[]);
    if(r2.error){toast("Failed to load visits: "+r2.error.message);}
    else setVisits(r2.data||[]);
    if(r3.error){toast("Failed to load items: "+r3.error.message);}
    else setItems(r3.data||[]);
    if(r4.error){toast("Failed to load clock records: "+r4.error.message);}
    else setClocks(r4.data||[]);
    if(r5.error){toast("Failed to load products: "+r5.error.message);}
    else setProducts(r5.data||[]);
    if(!r6.error){setTargets(r6.data||[]);}
    if(!r7.error){
      const m={};(r7.data||[]).forEach(c=>{m[c.id]=getClientSettings(c);});
      setClientSettings(m);
    }
    setLoading(false);
  };
  useEffect(()=>{loadAll();},[]);

  const userName=(id)=>(data.users||[]).find(u=>u.id===id)?.name||"Unknown";
  const clientName=(id)=>(data.clients||[]).find(c=>c.id===id)?.name||"—";
  const productPrice=(pid)=>(products.find(p=>p.id===pid)?.unit_price)||0;

  // --- filtered visits (client-side) ---
  const filteredVisits=visits.filter(v=>{
    if(filters.campaign_id&&v.campaign_id!==filters.campaign_id) return false;
    if(filters.client_id){
      const camp=campaigns.find(c=>c.id===v.campaign_id);
      if(!camp||camp.client_id!==filters.client_id) return false;
    }
    if(filters.ba_id&&v.ba_id!==filters.ba_id) return false;
    if(filters.date_from&&v.visit_time.slice(0,10)<filters.date_from) return false;
    if(filters.date_to&&v.visit_time.slice(0,10)>filters.date_to) return false;
    if(filters.activity_type){
      const vItems=items.filter(i=>i.visit_id===v.id);
      if(!vItems.some(i=>i.type===filters.activity_type)) return false;
    }
    return true;
  });

  const visitIds=new Set(filteredVisits.map(v=>v.id));
  const filteredItems=items.filter(i=>visitIds.has(i.visit_id));

  // --- summary cards ---
  const totalDoors=filteredVisits.length;
  const totalItems=filteredItems.length;
  const totalSales=filteredItems.filter(i=>i.type==="sale").reduce((sum,i)=>sum+i.qty*productPrice(i.product_id),0);
  const activeBAsToday=new Set(clocks.filter(c=>c.work_date===today&&c.clock_in).map(c=>c.ba_id)).size;

  // --- per-visit helpers ---
  const visitItems=(vid)=>items.filter(i=>i.visit_id===vid);
  const visitItemCount=(vid)=>visitItems(vid).length;
  const visitActivityTypes=(vid)=>{
    const types=[...new Set(visitItems(vid).map(i=>i.type))].filter(Boolean);
    return types.length?types.map(t=>t.charAt(0).toUpperCase()+t.slice(1)).join(", "):"—";
  };

  // --- CSV export ---
  const doExport=()=>{
    if(filteredVisits.length===0){toast("No visits to export.");return;}
    const headers=["Date","Time","BA Name","Client","Customer Name","Customer Phone","Items Count","Sales Value (PKR)"];
    const rows=filteredVisits.map(v=>{
      const camp=campaigns.find(c=>c.id===v.campaign_id);
      const vIt=visitItems(v.id);
      const sales=vIt.filter(i=>i.type==="sale").reduce((s,i)=>s+i.qty*productPrice(i.product_id),0);
      const dt=new Date(v.visit_time);
      return[
        dt.toLocaleDateString("en-GB"),
        dt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),
        userName(v.ba_id),
        camp?clientName(camp.client_id):"—",
        v.customer_name,
        v.customer_phone,
        vIt.length,
        sales,
      ].map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",");
    });
    const csv=[headers.join(","),...rows].join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`dtd_visits_${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("CSV exported.");
  };

  const tableVisits=filteredVisits.slice(0,100);

  // --- unique lists for filter dropdowns ---
  const allBAs=(data.users||[]).filter(u=>u.role==="ba"||u.role==="supervisor");
  const allClients=data.clients||[];

  const cardStyle={background:"var(--d2)",border:"1px solid var(--bo)",borderRadius:14,padding:"16px 20px",flex:1,minWidth:130};
  const cardNum={fontFamily:"Rajdhani",fontSize:28,fontWeight:700,color:"var(--g)",lineHeight:1};
  const cardLbl={fontSize:11,color:"var(--txd)",marginTop:4,textTransform:"uppercase",letterSpacing:.5};
  const thStyle={textAlign:"left",padding:"8px 10px",color:"var(--txd)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"};
  const tdStyle={padding:"8px 10px",fontSize:13,verticalAlign:"middle",borderTop:"1px solid var(--bo)"};
  const typeBadge=(t)=>{
    const colors={sale:"rgba(46,204,113,.15)",sample:"rgba(52,152,219,.15)",gift:"rgba(155,89,182,.15)",return:"rgba(231,76,60,.15)"};
    const text={sale:"var(--gr)",sample:"#3498db",gift:"#9b59b6",return:"var(--rd)"};
    return<span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:colors[t]||"var(--d3)",color:text[t]||"var(--tx)",fontWeight:600}}>{t?t.charAt(0).toUpperCase()+t.slice(1):"—"}</span>;
  };

  return(
    <div>
      {/* Filters */}
      <div className="card" style={{marginBottom:16}}>
        <div className="ch"><I n="chart" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">DTD Reports</div><div className="cs">Monitor all door-to-door campaign activity</div></div>
          <button className="bg" onClick={loadAll} disabled={loading} style={{marginRight:8}}><I n="sync" s={14}/>Refresh</button>
          <button className="bg" onClick={doExport}><I n="pdf" s={14}/>Export CSV</button>
        </div>
        <div className="cb">
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            <div className="fg" style={{margin:0,flex:"1 1 160px"}}>
              <label className="fl">Campaign</label>
              <select className="fi" value={filters.campaign_id} onChange={e=>setF("campaign_id",e.target.value)}>
                <option value="">All Campaigns</option>
                {campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fg" style={{margin:0,flex:"1 1 140px"}}>
              <label className="fl">Client</label>
              <select className="fi" value={filters.client_id} onChange={e=>setF("client_id",e.target.value)}>
                <option value="">All Clients</option>
                {allClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fg" style={{margin:0,flex:"1 1 140px"}}>
              <label className="fl">BA / Staff</label>
              <select className="fi" value={filters.ba_id} onChange={e=>setF("ba_id",e.target.value)}>
                <option value="">All Staff</option>
                {allBAs.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="fg" style={{margin:0,flex:"1 1 130px"}}>
              <label className="fl">From Date</label>
              <input className="fi" type="date" value={filters.date_from} onChange={e=>setF("date_from",e.target.value)}/>
            </div>
            <div className="fg" style={{margin:0,flex:"1 1 130px"}}>
              <label className="fl">To Date</label>
              <input className="fi" type="date" value={filters.date_to} onChange={e=>setF("date_to",e.target.value)}/>
            </div>
            <div className="fg" style={{margin:0,flex:"1 1 130px"}}>
              <label className="fl">Activity Type</label>
              <select className="fi" value={filters.activity_type} onChange={e=>setF("activity_type",e.target.value)}>
                <option value="">All Types</option>
                <option value="sale">Sale</option>
                <option value="sample">Sample</option>
                <option value="gift">Gift</option>
                <option value="return">Return</option>
              </select>
            </div>
            <button className="bic" onClick={clearFilters} title="Clear filters" style={{height:38,padding:"0 14px",fontSize:12,whiteSpace:"nowrap",flexShrink:0}}>Clear Filters</button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <div style={cardStyle}><div style={cardNum}>{loading?"…":totalDoors}</div><div style={cardLbl}>Doors Visited</div></div>
        <div style={cardStyle}><div style={cardNum}>{loading?"…":totalItems}</div><div style={cardLbl}>Items Distributed</div></div>
        <div style={cardStyle}><div style={cardNum}>{loading?"…":"PKR "+totalSales.toLocaleString()}</div><div style={cardLbl}>Sales Value</div></div>
        <div style={cardStyle}><div style={cardNum}>{loading?"…":activeBAsToday}</div><div style={cardLbl}>Active BAs Today</div></div>
      </div>

      {/* Per-BA Achievement — only when a campaign is selected and it has tiers configured */}
      {(()=>{
        if(!filters.campaign_id||loading)return null;
        const camp=campaigns.find(c=>c.id===filters.campaign_id);
        if(!camp)return null;
        const bonusCriteria=clientSettings[camp.client_id]?.bonus;
        if(!bonusCriteria||(bonusCriteria.tiers||[]).length===0)return null;
        const bas=(camp.assigned_bas||[]).map(baId=>(data.users||[]).find(u=>u.id===baId)).filter(Boolean);
        if(bas.length===0)return null;
        const metricLabel={units:"Units",doors:"Doors",revenue:"Revenue PKR"};
        return(
          <div className="card" style={{marginBottom:16}}>
            <div className="ch"><I n="chart" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">BA Achievement</div><div className="cs">{camp.name} · Metric: {metricLabel[bonusCriteria.metric]||bonusCriteria.metric}</div></div></div>
            <div className="cb">
              {bas.map(ba=>{
                const ach=calcAchievement(camp,ba.id,visits,items,targets,products);
                if(!ach)return(<div key={ba.id} style={{padding:"8px 0",borderBottom:"1px solid var(--bo)",fontSize:13,color:"var(--txd)"}}>{ba.name} — No target set</div>);
                const metric=bonusCriteria.metric||"units";
                const{actual,target:tgt,pct}=ach[metric]||{};
                const earned=calcBonus(ach,bonusCriteria);
                const barPct=Math.min(pct||0,120);
                const barColor=pct>=100?"var(--gr)":pct>=80?"#f39c12":"var(--rd)";
                return(
                  <div key={ba.id} style={{padding:"10px 0",borderBottom:"1px solid var(--bo)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600}}>{ba.name}</span>
                      <span style={{fontSize:12,color:"var(--txd)"}}>{actual??0} / {tgt??0} ({pct!==null?(pct.toFixed(0)+"%"):"—"})</span>
                    </div>
                    <div style={{height:6,borderRadius:3,background:"var(--d3)",overflow:"hidden",marginBottom:4}}>
                      <div style={{height:"100%",width:barPct+"%",background:barColor,borderRadius:3,transition:"width .4s"}}/>
                    </div>
                    <div style={{fontSize:11,color:earned>0?"var(--gr)":"var(--txd)"}}>{earned>0?"Earned bonus: PKR "+earned.toLocaleString():"No bonus tier met yet"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Visits Table */}
      <div className="card">
        <div className="ch">
          <I n="map" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">Visit Log</div><div className="cs">{loading?"Loading…":`${filteredVisits.length} visit${filteredVisits.length!==1?"s":""} ${filteredVisits.length>100?"(showing first 100)":""}`}</div></div>
        </div>
        <div className="cb">
          {loading&&<div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>Loading visits…</div>}
          {!loading&&filteredVisits.length===0&&(
            <div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>
              <div style={{fontSize:36,marginBottom:8}}>📭</div>
              <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:600}}>{visits.length===0?"No visits recorded yet":"No visits match the current filters"}</div>
              <div style={{fontSize:13,marginTop:4}}>{visits.length===0?"Visits will appear here once BAs start logging door-to-door activity.":"Try adjusting or clearing the filters above."}</div>
            </div>
          )}
          {!loading&&filteredVisits.length>0&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>BA</th>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Phone</th>
                    <th style={{...thStyle,textAlign:"center"}}>Items</th>
                    <th style={thStyle}>Activity</th>
                    <th style={{...thStyle,textAlign:"center"}}>GPS</th>
                    <th style={{...thStyle,textAlign:"center"}}>SOP</th>
                  </tr>
                </thead>
                <tbody>
                  {tableVisits.map(v=>{
                    const camp=campaigns.find(c=>c.id===v.campaign_id);
                    const dt=new Date(v.visit_time);
                    const isExp=expandedId===v.id;
                    const vItems=visitItems(v.id);
                    const sopItems=v.sop_checklist;
                    return(
                      <React.Fragment key={v.id}>
                        <tr onClick={()=>setExpandedId(isExp?null:v.id)} style={{cursor:"pointer",background:isExp?"var(--d3)":"transparent",transition:"background .15s"}}>
                          <td style={tdStyle}>{dt.toLocaleDateString("en-GB")}</td>
                          <td style={tdStyle}>{dt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</td>
                          <td style={tdStyle}>{userName(v.ba_id)}</td>
                          <td style={tdStyle}>{camp?clientName(camp.client_id):"—"}</td>
                          <td style={tdStyle}>{v.customer_name}</td>
                          <td style={tdStyle}>{v.customer_phone}</td>
                          <td style={{...tdStyle,textAlign:"center"}}>{visitItemCount(v.id)}</td>
                          <td style={tdStyle}>{visitActivityTypes(v.id)}</td>
                          <td style={{...tdStyle,textAlign:"center"}}>
                            {v.latitude&&v.longitude
                              ?<a href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{textDecoration:"none",fontSize:16}}>📍</a>
                              :"—"}
                          </td>
                          <td style={{...tdStyle,textAlign:"center"}}>
                            {sopItems&&sopItems.length>0
                              ?<span title={`${sopItems.filter(s=>s.checked).length}/${sopItems.length} checked`}>✅</span>
                              :"—"}
                          </td>
                        </tr>
                        {isExp&&(
                          <tr style={{background:"var(--d3)"}}>
                            <td colSpan={10} style={{padding:"12px 16px",borderTop:"1px solid var(--bo)"}}>
                              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                                {/* Items list */}
                                <div style={{flex:"1 1 260px"}}>
                                  <div style={{fontWeight:600,fontSize:12,textTransform:"uppercase",letterSpacing:.5,color:"var(--txd)",marginBottom:8}}>Items</div>
                                  {vItems.length===0
                                    ?<div style={{fontSize:13,color:"var(--txd)"}}>No items recorded.</div>
                                    :<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                                      <thead><tr>
                                        <th style={{...thStyle,padding:"4px 8px"}}>SKU</th>
                                        <th style={{...thStyle,padding:"4px 8px"}}>Product</th>
                                        <th style={{...thStyle,padding:"4px 8px",textAlign:"right"}}>Qty</th>
                                        <th style={{...thStyle,padding:"4px 8px"}}>Type</th>
                                      </tr></thead>
                                      <tbody>
                                        {vItems.map(it=>(
                                          <tr key={it.id}>
                                            <td style={{padding:"4px 8px",borderTop:"1px solid var(--bo)"}}>{it.sku||"—"}</td>
                                            <td style={{padding:"4px 8px",borderTop:"1px solid var(--bo)"}}>{it.product_name}</td>
                                            <td style={{padding:"4px 8px",textAlign:"right",borderTop:"1px solid var(--bo)"}}>{it.qty}</td>
                                            <td style={{padding:"4px 8px",borderTop:"1px solid var(--bo)"}}>{typeBadge(it.type)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  }
                                </div>
                                {/* SOP checklist */}
                                {sopItems&&sopItems.length>0&&(
                                  <div style={{flex:"1 1 200px"}}>
                                    <div style={{fontWeight:600,fontSize:12,textTransform:"uppercase",letterSpacing:.5,color:"var(--txd)",marginBottom:8}}>SOP Checklist</div>
                                    {sopItems.map((s,i)=>(
                                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:5}}>
                                        <span style={{fontSize:15}}>{s.checked?"✅":"☐"}</span>
                                        <span style={{color:s.checked?"var(--tx)":"var(--txd)"}}>{s.text}</span>
                                        {s.required&&!s.checked&&<span style={{fontSize:10,color:"var(--rd)",fontWeight:600}}>REQ</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Photo */}
                                {v.photo_url&&(
                                  <div style={{flex:"0 0 auto"}}>
                                    <div style={{fontWeight:600,fontSize:12,textTransform:"uppercase",letterSpacing:.5,color:"var(--txd)",marginBottom:8}}>Photo</div>
                                    <a href={v.photo_url} target="_blank" rel="noreferrer">
                                      <img src={v.photo_url} alt="Visit" style={{width:120,height:90,objectFit:"cover",borderRadius:8,border:"1px solid var(--bo)"}}/>
                                    </a>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PUBLIC JOB APPLICATION PAGE ──────────────────────────────────────────────
function PublicJobPage({jobId}){
  const [job,setJob]=useState(null);
  const [loading,setLoading]=useState(true);
  const [notFound,setNotFound]=useState(false);
  const [form,setForm]=useState({name:"",phone:"",education:"",experience_years:"",experience_text:""});
  const [submitting,setSubmitting]=useState(false);
  const [hasSubmitted,setHasSubmitted]=useState(false);
  const [err,setErr]=useState("");

  useEffect(()=>{
    (async()=>{
      const {data:row,error}=await SB.from("sm_jobs").select("*").eq("id",jobId).single();
      if(error||!row) setNotFound(true);
      else setJob(row);
      setLoading(false);
    })();
  },[]);

  const doApply=async()=>{
    setErr("");
    if(!form.name.trim()) return setErr("Full name is required.");
    if(!form.phone.trim()) return setErr("Phone number is required.");
    setSubmitting(true);
    const {error}=await SB.from("sm_applications").insert({
      id:crypto.randomUUID(),
      job_id:jobId,
      name:form.name.trim(),
      phone:form.phone.trim(),
      education:form.education.trim(),
      experience_years:parseInt(form.experience_years)||0,
      experience_text:form.experience_text.trim(),
      status:"new",
      created_at:new Date().toISOString(),
    });
    setSubmitting(false);
    if(error){setErr("Submission failed. Please try again.");return;}
    setHasSubmitted(true);
  };

  if(loading) return <div className="lw"><div style={{color:"var(--txd)",fontFamily:"Rajdhani",fontSize:18}}>Loading…</div></div>;

  if(notFound) return (
    <div className="lw">
      <div className="lc" style={{textAlign:"center",padding:"48px 32px"}}>
        <div style={{fontSize:40,marginBottom:12}}>🔍</div>
        <div style={{fontFamily:"Rajdhani",fontSize:22,fontWeight:700,color:"var(--tx)"}}>Invalid Link</div>
        <div style={{fontSize:14,color:"var(--txd)",marginTop:8}}>This job link is not valid or has been removed.</div>
      </div>
    </div>
  );

  if(hasSubmitted) return (
    <div className="lw">
      <div className="lc" style={{textAlign:"center",padding:"48px 32px"}}>
        <div style={{fontSize:48,marginBottom:16}}>✅</div>
        <div style={{fontFamily:"Rajdhani",fontSize:24,fontWeight:700,color:"var(--gr)"}}>Application Submitted!</div>
        <div style={{fontSize:14,color:"var(--txd)",marginTop:12,lineHeight:1.6}}>Thank you for applying for <strong style={{color:"var(--tx)"}}>{job.title}</strong>.<br/>We'll contact you via WhatsApp if shortlisted.</div>
      </div>
    </div>
  );

  const isClosed=job.status==="closed"||job.status==="draft";

  return (
    <div style={{minHeight:"100vh",background:"var(--d1)",padding:"28px 16px"}}>
      <div style={{maxWidth:560,margin:"0 auto"}}>
        <div style={{fontFamily:"Rajdhani",fontSize:11,color:"var(--txd)",marginBottom:20,letterSpacing:2,textTransform:"uppercase"}}>Shinkore Marketing — Careers</div>
        <div className="card" style={{marginBottom:16}}>
          <div className="ch">
            <div style={{flex:1,minWidth:0}}>
              <div className="ct">{job.title}</div>
              {job.location&&<div className="cs">📍 {job.location}</div>}
            </div>
            {job.status==="open"
              ?<span className="b" style={{background:"rgba(46,204,113,.12)",color:"var(--gr)",border:"1px solid rgba(46,204,113,.22)"}}>Open</span>
              :<span className="b" style={{background:"var(--d3)",color:"var(--txd)",border:"1px solid var(--bo)"}}>Closed</span>}
          </div>
          <div className="cb">
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:job.description?14:0}}>
              {job.duration&&<span style={{fontSize:12,background:"var(--d3)",color:"var(--txd)",padding:"4px 10px",borderRadius:12,border:"1px solid var(--bo)"}}>⏱ {job.duration}</span>}
              {job.salary_range&&<span style={{fontSize:12,background:"var(--d3)",color:"var(--txd)",padding:"4px 10px",borderRadius:12,border:"1px solid var(--bo)"}}>💰 {job.salary_range}</span>}
              {job.experience&&<span style={{fontSize:12,background:"var(--d3)",color:"var(--txd)",padding:"4px 10px",borderRadius:12,border:"1px solid var(--bo)"}}>🎓 {job.experience}</span>}
              {job.gender&&job.gender!=="Any"&&<span style={{fontSize:12,background:"var(--d3)",color:"var(--txd)",padding:"4px 10px",borderRadius:12,border:"1px solid var(--bo)"}}>👤 {job.gender}</span>}
            </div>
            {job.description&&<div style={{fontSize:14,color:"var(--tx)",lineHeight:1.75,whiteSpace:"pre-wrap"}}>{job.description}</div>}
          </div>
        </div>

        {isClosed?(
          <div className="card">
            <div className="cb" style={{textAlign:"center",padding:"32px"}}>
              <div style={{fontSize:32,marginBottom:10}}>🔒</div>
              <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--tx)"}}>No Longer Accepting Applications</div>
              <div style={{fontSize:13,color:"var(--txd)",marginTop:6}}>This position has been closed. Check back for future openings.</div>
            </div>
          </div>
        ):(
          <div className="card">
            <div className="ch"><div className="ct">Apply Now</div></div>
            <div className="cb">
              {err&&<div className="info info-err" style={{marginBottom:14}}><I n="alert" s={14}/>{err}</div>}
              <div className="fg"><label className="fl">Full Name *</label><input className="fi" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Your full name"/></div>
              <div className="fg"><label className="fl">Phone Number *</label><input className="fi" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="03xx-xxxxxxx" type="tel"/></div>
              <div className="fg"><label className="fl">Education</label><input className="fi" value={form.education} onChange={e=>setForm(p=>({...p,education:e.target.value}))} placeholder="e.g. BBA, FAST 2022"/></div>
              <div className="fg"><label className="fl">Years of Experience</label><input className="fi" value={form.experience_years} onChange={e=>setForm(p=>({...p,experience_years:e.target.value}))} placeholder="0" type="number" min="0"/></div>
              <div className="fg"><label className="fl">Tell Us About Yourself</label><textarea className="fi" value={form.experience_text} onChange={e=>setForm(p=>({...p,experience_text:e.target.value}))} placeholder="Briefly describe your background and why you're a good fit…" rows={4} style={{resize:"vertical"}}/></div>
              <button className="bp" onClick={doApply} disabled={submitting}>{submitting?"Submitting…":"Submit Application"}</button>
              <div style={{fontSize:11,color:"var(--txd)",textAlign:"center",marginTop:10}}>We'll contact you via WhatsApp if shortlisted.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CAREERS (ADMIN) ──────────────────────────────────────────────────────────
function CareersPage({data,toast}){
  const [jobs,setJobs]=useState([]);
  const [apps,setApps]=useState({});
  const [expanded,setExpanded]=useState({});
  const [loading,setLoading]=useState(true);
  const [showModal,setShowModal]=useState(false);
  const [form,setForm]=useState({title:"",location:"",experience:"",gender:"Any",duration:"",salary_range:"",description:""});
  const [saving,setSaving]=useState(false);
  const [appLoading,setAppLoading]=useState({});

  useEffect(()=>{loadJobs();},[]);

  const loadJobs=async()=>{
    setLoading(true);
    const {data:rows}=await SB.from("sm_jobs").select("*").order("created_at",{ascending:false});
    setJobs(rows||[]);
    setLoading(false);
  };

  const loadApps=async(jobId)=>{
    setAppLoading(p=>({...p,[jobId]:true}));
    const {data:rows}=await SB.from("sm_applications").select("*").eq("job_id",jobId).order("created_at",{ascending:false});
    setApps(p=>({...p,[jobId]:rows||[]}));
    setAppLoading(p=>({...p,[jobId]:false}));
  };

  const toggleExpand=async(jobId)=>{
    const next=!expanded[jobId];
    setExpanded(p=>({...p,[jobId]:next}));
    if(next&&!apps[jobId]) await loadApps(jobId);
  };

  const doPost=async()=>{
    if(!form.title.trim())return toast("Job title is required.");
    setSaving(true);
    const {error}=await SB.from("sm_jobs").insert({
      id:crypto.randomUUID(),
      title:form.title.trim(),
      location:form.location.trim(),
      experience:form.experience.trim(),
      gender:form.gender,
      duration:form.duration.trim(),
      salary_range:form.salary_range.trim(),
      description:form.description.trim(),
      status:"open",
      created_at:new Date().toISOString(),
    });
    setSaving(false);
    if(error){toast("Failed to post job.");return;}
    toast("Job posted!");
    setShowModal(false);
    setForm({title:"",location:"",experience:"",gender:"Any",duration:"",salary_range:"",description:""});
    loadJobs();
  };

  const toggleStatus=async(job)=>{
    const next=job.status==="open"?"closed":"open";
    await SB.from("sm_jobs").update({status:next}).eq("id",job.id);
    setJobs(p=>p.map(j=>j.id===job.id?{...j,status:next}:j));
    toast(`Job marked ${next}.`);
  };

  const setAppStatus=async(jobId,appId,status,app,job)=>{
    await SB.from("sm_applications").update({status}).eq("id",appId);
    setApps(p=>({...p,[jobId]:(p[jobId]||[]).map(a=>a.id===appId?{...a,status}:a)}));
    if(app&&job&&app.phone&&status!=="new"){
      const nm=app.name||"there";const ti=job.title||"the position";
      const msgs={
        contacted:"Hi "+nm+", thank you for applying for "+ti+" at Shinkore Marketing. We'd like to discuss your application.",
        shortlisted:"Hi "+nm+", great news! You've been shortlisted for "+ti+" at Shinkore Marketing. We'll be in touch with next steps soon.",
        rejected:"Hi "+nm+", thank you for applying for "+ti+" at Shinkore Marketing. We have decided to proceed with other candidates this time. We wish you the best.",
        hired:"Hi "+nm+", congratulations! You have been selected for "+ti+" at Shinkore Marketing. Please contact us to confirm your joining details."
      };
      if(msgs[status]) sendWA(app.phone,msgs[status]);
    }
  };

  const copyLink=(id)=>{
    const link=`https://shinkore-marketing14.pages.dev/?job=${id}`;
    navigator.clipboard.writeText(link).then(()=>toast("Link copied!")).catch(()=>toast("Copy failed."));
  };

  const statusBadge=(s)=>{
    if(s==="open") return <span className="b" style={{background:"rgba(46,204,113,.12)",color:"var(--gr)",border:"1px solid rgba(46,204,113,.22)"}}>Open</span>;
    if(s==="closed") return <span className="b" style={{background:"var(--d3)",color:"var(--txd)",border:"1px solid var(--bo)"}}>Closed</span>;
    return <span className="b b-pending">Draft</span>;
  };

  const appStatusColor={new:"var(--gr)",contacted:"var(--bl)",shortlisted:"#9B59B6",rejected:"var(--rd)",hired:"var(--g)"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div className="card">
        <div className="ch">
          <I n="briefcase" s={17} c="var(--g)"/>
          <div style={{flex:1}}>
            <div className="ct">Job Postings</div>
            <div className="cs">{loading?"Loading…":`${jobs.length} job${jobs.length!==1?"s":""} posted`}</div>
          </div>
          <button className="bg" onClick={()=>setShowModal(true)}><I n="plus" s={15}/> Post Job</button>
        </div>
      </div>

      {!loading&&jobs.length===0&&(
        <div className="card"><div className="cb" style={{textAlign:"center",padding:"48px"}}>
          <div style={{fontSize:36,marginBottom:8}}>📋</div>
          <div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:600,color:"var(--tx)"}}>No Jobs Posted Yet</div>
          <div style={{fontSize:13,color:"var(--txd)",marginTop:6}}>Post a job to generate a shareable application link.</div>
        </div></div>
      )}

      {jobs.map(job=>{
        const appList=apps[job.id]||[];
        const isOpen=!!expanded[job.id];
        return (
          <div key={job.id} className="card">
            <div className="ch">
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <div className="ct">{job.title}</div>
                  {statusBadge(job.status)}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {job.location&&<span className="cs">📍 {job.location}</span>}
                  {job.duration&&<span className="cs">⏱ {job.duration}</span>}
                  {job.salary_range&&<span className="cs">💰 {job.salary_range}</span>}
                  {job.experience&&<span className="cs">🎓 {job.experience}</span>}
                  {job.gender&&job.gender!=="Any"&&<span className="cs">👤 {job.gender}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                <button className="bs" style={{fontSize:12,padding:"6px 11px"}} onClick={()=>copyLink(job.id)}>🔗 Copy Link</button>
                <button className="bs" style={{fontSize:12,padding:"6px 11px"}} onClick={()=>toggleStatus(job)}>{job.status==="open"?"Close":"Reopen"}</button>
                <button className="bg" style={{fontSize:12,padding:"6px 11px"}} onClick={()=>toggleExpand(job.id)}>{isOpen?"Hide ▲":"Applications ▼"}</button>
              </div>
            </div>

            {isOpen&&(
              <div className="cb" style={{borderTop:"1px solid var(--bo)"}}>
                {appLoading[job.id]&&<div style={{textAlign:"center",padding:"20px",color:"var(--txd)"}}>Loading…</div>}
                {!appLoading[job.id]&&appList.length===0&&(
                  <div style={{textAlign:"center",padding:"20px",color:"var(--txd)",fontSize:13}}>No applications yet. Share the link to start receiving applicants.</div>
                )}
                {!appLoading[job.id]&&appList.length>0&&(
                  <div>
                    <div style={{fontSize:11,color:"var(--txd)",marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>{appList.length} application{appList.length!==1?"s":""}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {appList.map(app=>(
                        <div key={app.id} style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:app.experience_text?8:0}}>
                            <div>
                              <div style={{fontWeight:600,fontSize:14,color:"var(--tx)"}}>{app.name}</div>
                              <div style={{fontSize:12,color:"var(--txd)",marginTop:2}}>
                                {app.phone}
                                {app.education?` · ${app.education}`:""}
                                {app.experience_years!=null?` · ${app.experience_years}yr exp`:""}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                              <select value={app.status||"new"} onChange={e=>setAppStatus(job.id,app.id,e.target.value,app,job)} style={{fontSize:12,padding:"4px 8px",borderRadius:7,border:"1px solid var(--bo)",background:"var(--d4)",color:appStatusColor[app.status||"new"]||"var(--tx)",outline:"none"}}>
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="rejected">Rejected</option>
                                <option value="hired">Hired</option>
                              </select>
                              <button className="bw" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>sendWA(app.phone,`Hi ${app.name}, thank you for applying for ${job.title} at Shinkore Marketing. We'd like to discuss your application.`)}><I n="wa" s={13}/> WhatsApp</button>
                            </div>
                          </div>
                          {app.experience_text&&<div style={{fontSize:12,color:"var(--tx)",background:"var(--d4)",border:"1px solid var(--bo)",padding:"8px 10px",borderRadius:7,lineHeight:1.6}}>{app.experience_text}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showModal&&(
        <div className="mo" onClick={()=>setShowModal(false)}>
          <div className="md" style={{maxWidth:500}} onClick={e=>e.stopPropagation()}>
            <div className="mh">
              <div className="mt">Post New Job</div>
              <button className="mc" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <div className="mb">
              <div className="fg"><label className="fl">Job Title *</label><input className="fi" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Brand Ambassador – Karachi"/></div>
              <div className="frow">
                <div className="fg"><label className="fl">Location</label><input className="fi" value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="City / Area"/></div>
                <div className="fg"><label className="fl">Duration</label><input className="fi" value={form.duration} onChange={e=>setForm(p=>({...p,duration:e.target.value}))} placeholder="e.g. 3 months"/></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Experience Required</label><input className="fi" value={form.experience} onChange={e=>setForm(p=>({...p,experience:e.target.value}))} placeholder="e.g. 1+ years"/></div>
                <div className="fg"><label className="fl">Gender</label><select className="fsel" value={form.gender} onChange={e=>setForm(p=>({...p,gender:e.target.value}))}><option>Any</option><option>Male</option><option>Female</option></select></div>
              </div>
              <div className="fg"><label className="fl">Salary Range</label><input className="fi" value={form.salary_range} onChange={e=>setForm(p=>({...p,salary_range:e.target.value}))} placeholder="e.g. PKR 25,000–35,000/month"/></div>
              <div className="fg"><label className="fl">Job Description</label><textarea className="fi" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Responsibilities, requirements, benefits…" rows={5} style={{resize:"vertical"}}/></div>
              <div className="ma">
                <button className="bs" onClick={()=>setShowModal(false)}>Cancel</button>
                <button className="bg" onClick={doPost} disabled={saving}>{saving?"Posting…":"Post Job"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SOP MANAGER ──────────────────────────────────────────────────────────────
function SOPManagerPage({data,toast}){
  const [clientId,setClientId]=useState("");
  const [sop,setSop]=useState(null);
  const [loadingSop,setLoadingSop]=useState(false);
  const [saving,setSaving]=useState(false);
  const [instructions,setInstructions]=useState("");
  const [checklist,setChecklist]=useState([]);

  useEffect(()=>{
    if(!clientId){setSop(null);setInstructions("");setChecklist([]);return;}
    setLoadingSop(true);
    SB.from("sm_sops").select("*").eq("client_id",clientId).limit(1).then(({data:rows})=>{
      const row=(rows&&rows[0])||null;
      setSop(row);
      setInstructions(row?row.instructions||"":"");
      setChecklist(row?(row.checklist||[]):[]);
      setLoadingSop(false);
    });
  },[clientId]);

  const addItem=()=>setChecklist(c=>[...c,{id:crypto.randomUUID(),text:"",required:true}]);
  const delItem=(id)=>setChecklist(c=>c.filter(i=>i.id!==id));
  const setItemText=(id,text)=>setChecklist(c=>c.map(i=>i.id===id?{...i,text}:i));
  const toggleRequired=(id)=>setChecklist(c=>c.map(i=>i.id===id?{...i,required:!i.required}:i));

  const doSave=async()=>{
    if(!clientId) return;
    const cleanItems=checklist.filter(i=>i.text.trim());
    const row={id:sop?.id||crypto.randomUUID(),client_id:clientId,instructions:instructions.trim(),checklist:cleanItems,created_at:sop?.created_at||new Date().toISOString()};
    setSaving(true);
    const{error}=await SB.from("sm_sops").upsert([row],{onConflict:"id"});
    setSaving(false);
    if(error){toast("Save failed: "+error.message);return;}
    setSop(row);toast("SOP saved!");
  };

  const clients=data.clients||[];
  return(
    <div>
      <div className="card">
        <div className="ch"><I n="pdf" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">SOP Manager</div><div className="cs">Standard Operating Procedures per client</div></div></div>
        <div className="cb">
          <div className="fg" style={{marginBottom:16}}>
            <label className="fl">Select Client</label>
            <select className="fsel" value={clientId} onChange={e=>setClientId(e.target.value)}>
              <option value="">-- Select client --</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.brand?" — "+c.brand:""}</option>)}
            </select>
          </div>
          {!clientId&&<div style={{textAlign:"center",padding:"24px 0",color:"var(--txd)",fontSize:13}}>Select a client to manage their SOP.</div>}
          {clientId&&loadingSop&&<div style={{textAlign:"center",padding:"20px",color:"var(--txd)",fontSize:13}}>Loading...</div>}
          {clientId&&!loadingSop&&(
            <>
              {sop
                ?<div className="info info-blue" style={{marginBottom:12}}><I n="ok" s={13}/>Existing SOP loaded — editing.</div>
                :<div className="info info-warn" style={{marginBottom:12}}><I n="alert" s={13}/>No SOP yet — will create on save.</div>}
              <div className="fg" style={{marginBottom:14}}>
                <label className="fl">Instructions / Rules</label>
                <textarea className="fi" value={instructions} onChange={e=>setInstructions(e.target.value)} rows={4} placeholder="Enter rules, steps or instructions BAs must follow at every door visit..." style={{resize:"vertical",minHeight:90,fontFamily:"inherit"}}/>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:12,color:"var(--g)",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Checklist Items</div>
                  <button className="bg" onClick={addItem} style={{fontSize:12,padding:"4px 12px"}}><I n="plus" s={12}/>Add item</button>
                </div>
                {checklist.length===0&&<div style={{fontSize:12,color:"var(--txd)",textAlign:"center",padding:"12px 0"}}>No items yet. Add steps BAs must confirm at each visit.</div>}
                {checklist.map(item=>(
                  <div key={item.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,marginBottom:8,alignItems:"center"}}>
                    <input className="fi" value={item.text} onChange={e=>setItemText(item.id,e.target.value)} placeholder="e.g. Showed product demo" style={{fontSize:13}}/>
                    <button onClick={()=>toggleRequired(item.id)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(item.required?"rgba(231,76,60,.5)":"rgba(201,168,76,.4)"),background:item.required?"rgba(231,76,60,.12)":"rgba(201,168,76,.08)",color:item.required?"var(--rd)":"var(--g)",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                      {item.required?"Required":"Optional"}
                    </button>
                    <button onClick={()=>delItem(item.id)} style={{background:"rgba(231,76,60,.12)",border:"1px solid rgba(231,76,60,.3)",borderRadius:7,color:"var(--rd)",cursor:"pointer",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,lineHeight:1}}>×</button>
                  </div>
                ))}
              </div>
              <div className="ma">
                <button className="bg" onClick={doSave} disabled={saving} style={{opacity:saving?0.6:1}}><I n="ok" s={15}/>{saving?"Saving...":"Save SOP"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DTD DASH ─────────────────────────────────────────────────────────────────
function DTDDashPage({user,toast}){
  const today=new Date().toISOString().slice(0,10);
  const fmtTime=(iso)=>{if(!iso)return"";try{return new Date(iso).toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit"});}catch{return iso;}};

  const [loading,setLoading]=useState(true);
  const [campaigns,setCampaigns]=useState([]);
  const [activeCampaign,setActiveCampaign]=useState(null);
  const [products,setProducts]=useState([]);
  const [clockRow,setClockRow]=useState(null);
  const [clockLoading,setClockLoading]=useState(false);
  const [visits,setVisits]=useState([]);
  const [visitItemCounts,setVisitItemCounts]=useState({});
  const [showModal,setShowModal]=useState(false);
  const [saving,setSaving]=useState(false);
  const [clientSop,setClientSop]=useState(null);
  const [sopChecks,setSopChecks]=useState({});
  const [clientSettings,setClientSettings]=useState(getClientSettings(null));
  const [myTarget,setMyTarget]=useState(null);
  const [allVisitItems,setAllVisitItems]=useState([]);

  const emptyForm=()=>({customer_name:"",customer_phone:"",photo_url:"",photoUploading:false,gps:null,gpsCapturing:false,gpsError:"",lines:[{product_id:"",sku:"",product_name:"",qty:1,type:"sale"}]});
  const [form,setForm]=useState(emptyForm());

  useEffect(()=>{
    SB.from("sm_campaigns").select("*").eq("status","active").then(({data:rows})=>{
      const mine=(rows||[]).filter(c=>{const bas=c.assigned_bas;if(!bas)return false;return Array.isArray(bas)?bas.includes(user.id):false;});
      setCampaigns(mine);
      if(mine.length===1)loadCampaign(mine[0]);
      else setLoading(false);
    });
  },[]);

  const loadCampaign=(c)=>{
    setActiveCampaign(c);
    setLoading(true);
    setMyTarget(null);setAllVisitItems([]);
    Promise.all([
      SB.from("sm_products").select("*").eq("client_id",c.client_id),
      SB.from("sm_dtd_clock").select("*").eq("ba_id",user.id).eq("campaign_id",c.id).eq("work_date",today).limit(1),
      SB.from("sm_door_visits").select("*").eq("ba_id",user.id).eq("campaign_id",c.id),
      SB.from("sm_clients").select("id,settings").eq("id",c.client_id).limit(1),
      SB.from("sm_campaign_targets").select("*").eq("campaign_id",c.id).eq("ba_id",user.id).limit(1),
    ]).then(([{data:prods},{data:clocks},{data:allVisits},{data:cRows},{data:tRows}])=>{
      const prods_=prods||[];
      setProducts(prods_);
      const cs=getClientSettings((cRows&&cRows[0])||null);
      setClientSettings(cs);
      setClockRow((clocks&&clocks[0])||null);
      setMyTarget((tRows&&tRows[0])||null);
      const todayV=(allVisits||[]).filter(v=>v.visit_time&&v.visit_time.startsWith(today));
      setVisits(todayV);
      const allV=allVisits||[];
      if(allV.length>0){
        const ids=allV.map(v=>v.id);
        SB.from("sm_door_items").select("visit_id,product_id,qty,type").in("visit_id",ids).then(({data:items})=>{
          setAllVisitItems(items||[]);
          const counts={};
          (items||[]).filter(i=>todayV.some(v=>v.id===i.visit_id)).forEach(item=>{counts[item.visit_id]=(counts[item.visit_id]||0)+1;});
          setVisitItemCounts(counts);
        });
      } else {
        setAllVisitItems([]);
      }
      setLoading(false);
    });
  };

  const doClockIn=async()=>{
    setClockLoading(true);
    const row={id:crypto.randomUUID(),campaign_id:activeCampaign.id,ba_id:user.id,clock_in:new Date().toISOString(),clock_out:null,work_date:today};
    const{error}=await SB.from("sm_dtd_clock").insert([row]);
    setClockLoading(false);
    if(error){toast("Clock in failed: "+error.message);return;}
    setClockRow(row);toast("Clocked in! Start your door visits.");
  };

  const doClockOut=async()=>{
    setClockLoading(true);
    const outTime=new Date().toISOString();
    const{error}=await SB.from("sm_dtd_clock").update({clock_out:outTime}).eq("id",clockRow.id);
    setClockLoading(false);
    if(error){toast("Clock out failed: "+error.message);return;}
    setClockRow({...clockRow,clock_out:outTime});toast("Clocked out. Good work today!");
  };

  const captureGPS=()=>{
    setForm(f=>({...f,gpsCapturing:true,gpsError:""}));
    if(!navigator.geolocation){setForm(f=>({...f,gpsCapturing:false,gpsError:"GPS not available on this device."}));return;}
    navigator.geolocation.getCurrentPosition(
      pos=>{setForm(f=>({...f,gps:{lat:pos.coords.latitude.toFixed(6),lng:pos.coords.longitude.toFixed(6)},gpsCapturing:false,gpsError:""}));},
      ()=>{setForm(f=>({...f,gpsCapturing:false,gpsError:"GPS denied. Enable location and tap Retry."}));},
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    );
  };

  const openModal=()=>{
    setForm(emptyForm());setSopChecks({});setClientSop(null);setShowModal(true);
    setTimeout(captureGPS,0);
    SB.from("sm_sops").select("*").eq("client_id",activeCampaign.client_id).limit(1)
      .then(({data:rows})=>setClientSop((rows&&rows[0])||null));
  };

  const setLine=(idx,key,val)=>{
    setForm(f=>{
      const lines=[...f.lines];
      lines[idx]={...lines[idx],[key]:val};
      if(key==="product_id"){const p=products.find(x=>x.id===val);if(p){lines[idx].sku=p.sku;lines[idx].product_name=p.name;}}
      return{...f,lines};
    });
  };
  const addLine=()=>setForm(f=>({...f,lines:[...f.lines,{product_id:"",sku:"",product_name:"",qty:1,type:"sale"}]}));
  const removeLine=(idx)=>setForm(f=>({...f,lines:f.lines.filter((_,i)=>i!==idx)}));

  const doSaveVisit=async()=>{
    if(clientSettings.gps_required&&!form.gps){toast("GPS required for this client — capture location first.");return;}
    if(!form.customer_name.trim()){toast("Customer name required.");return;}
    if(!form.customer_phone.trim()){toast("Customer phone required.");return;}
    const validLines=form.lines.filter(l=>l.product_id);
    if(validLines.length===0){toast("Add at least one product.");return;}
    if(validLines.some(l=>Number(l.qty)<1)){toast("Qty must be at least 1.");return;}
    if(clientSop&&clientSettings.sop_required){
      const missing=(clientSop.checklist||[]).filter(item=>item.required&&!sopChecks[item.id]);
      if(missing.length>0){toast(`Required: "${missing[0].text}" must be ticked.`);return;}
    }
    setSaving(true);
    const visitId=crypto.randomUUID();
    const sopSnapshot=clientSop
      ?(clientSop.checklist||[]).map(item=>({id:item.id,text:item.text,required:item.required,checked:!!sopChecks[item.id]}))
      :null;
    const visitRow={id:visitId,campaign_id:activeCampaign.id,ba_id:user.id,client_id:activeCampaign.client_id,latitude:Number(form.gps.lat),longitude:Number(form.gps.lng),visit_time:new Date().toISOString(),customer_name:form.customer_name.trim(),customer_phone:form.customer_phone.trim(),photo_url:form.photo_url||null,sop_checklist:sopSnapshot};
    const{error:e1}=await SB.from("sm_door_visits").insert([visitRow]);
    if(e1){setSaving(false);toast("Save failed: "+e1.message);return;}
    const itemRows=validLines.map(l=>({id:crypto.randomUUID(),visit_id:visitId,product_id:l.product_id,sku:l.sku,product_name:l.product_name,qty:Number(l.qty),type:l.type}));
    const{error:e2}=await SB.from("sm_door_items").insert(itemRows);
    setSaving(false);
    // Always add visit to local state and close modal — visit row exists in Supabase either way.
    // If items failed, show a warning and record 0 items so the user knows to follow up.
    setVisits(v=>[visitRow,...v]);
    setVisitItemCounts(c=>({...c,[visitId]:e2?0:itemRows.length}));
    setShowModal(false);setForm(emptyForm());
    if(e2)toast("⚠️ Visit saved but products failed to record — contact admin.");
    else toast("Visit saved! ✅");
  };

  if(loading)return<div className="card"><div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}>Loading...</div></div>;

  if(campaigns.length===0)return(
    <div className="card">
      <div style={{textAlign:"center",padding:"48px 20px"}}>
        <div style={{fontSize:48}}>🚪</div>
        <div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:14,color:"var(--g)"}}>No Active DTD Campaign</div>
        <div style={{fontSize:13,marginTop:6,color:"var(--txd)"}}>No active DTD campaign is assigned to you. Contact admin.</div>
      </div>
    </div>
  );

  if(!activeCampaign)return(
    <div className="card">
      <div className="ch"><I n="flag" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">Select Campaign</div><div className="cs">{campaigns.length} active campaigns assigned</div></div></div>
      <div className="cb">
        {campaigns.map(c=>(
          <button key={c.id} onClick={()=>loadCampaign(c)} style={{display:"block",width:"100%",textAlign:"left",background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:"pointer",color:"var(--tx)"}}>
            <div style={{fontWeight:700,fontSize:14,color:"var(--g)"}}>{c.name}</div>
            <div style={{fontSize:12,color:"var(--txd)",marginTop:3}}>{c.start_date} → {c.end_date}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return(
    <div>
      {/* Campaign header */}
      <div className="card" style={{marginBottom:12}}>
        <div className="ch">
          <I n="flag" s={17} c="var(--g)"/>
          <div style={{flex:1}}><div className="ct">{activeCampaign.name}</div><div className="cs">{activeCampaign.start_date} → {activeCampaign.end_date}</div></div>
          {campaigns.length>1&&<button className="bs" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>{setActiveCampaign(null);setLoading(false);}}>Switch</button>}
        </div>
      </div>

      {/* Clock card */}
      <div className="card" style={{marginBottom:12}}>
        <div className="ch"><I n="clock" s={17} c="var(--g)"/><div className="ct">Today's Shift</div></div>
        <div className="cb">
          {!clockRow?(
            <div style={{textAlign:"center",paddingBottom:4}}>
              <div style={{fontSize:13,color:"var(--txd)",marginBottom:10}}>Not clocked in yet.</div>
              <button className="bg" onClick={doClockIn} disabled={clockLoading} style={{width:"100%",justifyContent:"center"}}><I n="clock" s={15}/>{clockLoading?"Clocking in...":"Clock In"}</button>
            </div>
          ):clockRow.clock_out?(
            <div style={{background:"rgba(201,168,76,.08)",border:"1px solid rgba(201,168,76,.2)",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:13,color:"var(--g)",fontWeight:600}}>✅ Duty complete</div>
              <div style={{fontSize:12,color:"var(--txd)",marginTop:4}}>In: {fmtTime(clockRow.clock_in)} → Out: {fmtTime(clockRow.clock_out)}</div>
            </div>
          ):(
            <div>
              <div style={{background:"rgba(46,204,113,.08)",border:"1px solid rgba(46,204,113,.2)",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                <div style={{fontSize:13,color:"var(--gr)",fontWeight:600}}>🟢 On duty since {fmtTime(clockRow.clock_in)}</div>
              </div>
              <button onClick={doClockOut} disabled={clockLoading} style={{width:"100%",background:"rgba(231,76,60,.12)",border:"1px solid rgba(231,76,60,.35)",borderRadius:10,padding:"11px",color:"var(--rd)",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <I n="out" s={15}/>{clockLoading?"Clocking out...":"Clock Out"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="sg" style={{marginBottom:12}}>
        <div className="sc gold"><div className="si gold"><I n="users" s={17}/></div><div className="sv" style={{fontSize:22}}>{visits.length}</div><div className="sl">Doors Today</div></div>
      </div>

      {/* Achievement progress — only shown when target exists AND client has bonus tiers */}
      {(()=>{
        const bonusCriteria=clientSettings.bonus;
        if(!myTarget||!(bonusCriteria?.tiers||[]).length)return null;
        const ach=calcAchievement(activeCampaign,user.id,
          // build allVisits array from today visits + allVisitItems context
          visits.map(v=>({...v,campaign_id:activeCampaign.id,ba_id:user.id})),
          allVisitItems,
          [myTarget],
          products
        );
        // Re-fetch all visits not just today's for accurate campaign achievement
        // allVisitItems is loaded from all visits so we need all visits too
        // We stored allVisits inside loadCampaign but only kept todayV in `visits`.
        // Use a separate local achievement based on items already fetched:
        const metric=bonusCriteria.metric||"units";
        const saleItems=allVisitItems.filter(i=>i.type==="sale");
        const actualUnits=saleItems.reduce((s,i)=>s+(Number(i.qty)||0),0);
        const actualRevenue=saleItems.reduce((s,i)=>s+(Number(i.qty)||0)*((products||[]).find(p=>p.id===i.product_id)?.unit_price||0),0);
        // For doors we need total visit count across all days — stored via allVisitItems visit_ids
        const uniqueVisitIds=new Set(allVisitItems.map(i=>i.visit_id));
        const actualDoors=uniqueVisitIds.size||visits.length;
        const periodEnd=activeCampaign.end_date&&activeCampaign.end_date<today?activeCampaign.end_date:today;
        const workdays=Math.max(1,Math.round((new Date(periodEnd)-new Date(activeCampaign.start_date))/86400000)+1);
        const doorTgt=(myTarget.doors_per_day||0)*workdays;
        const unitTgt=(myTarget.units_per_day||0)*workdays;
        const revTgt=myTarget.revenue_target||0;
        const actuals={doors:{actual:actualDoors,target:doorTgt},units:{actual:actualUnits,target:unitTgt},revenue:{actual:actualRevenue,target:revTgt}};
        const{actual,target:tgt}=actuals[metric]||{actual:0,target:0};
        const pct=tgt>0?actual/tgt*100:null;
        const barPct=Math.min(pct||0,120);
        const barColor=pct>=100?"var(--gr)":pct>=80?"#f39c12":"var(--rd)";
        const earned=calcBonus({doors:{pct:doorTgt>0?actualDoors/doorTgt*100:null},units:{pct:unitTgt>0?actualUnits/unitTgt*100:null},revenue:{pct:revTgt>0?actualRevenue/revTgt*100:null}},bonusCriteria);
        const metricLabel={units:"Units",doors:"Doors",revenue:"Revenue PKR"};
        return(
          <div className="card" style={{marginBottom:12}}>
            <div className="ch"><I n="chart" s={17} c="var(--g)"/><div style={{flex:1}}><div className="ct">My Achievement</div><div className="cs">{metricLabel[metric]||metric} · {workdays} day{workdays!==1?"s":""} elapsed</div></div></div>
            <div className="cb">
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
                <span>{actual} / {tgt} {metric}</span>
                <span style={{fontWeight:700,color:barColor}}>{pct!==null?pct.toFixed(0)+"%":"No target"}</span>
              </div>
              <div style={{height:8,borderRadius:4,background:"var(--d3)",overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:barPct+"%",background:barColor,borderRadius:4,transition:"width .4s"}}/>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:earned>0?"var(--gr)":"var(--txd)"}}>
                {earned>0?"🎉 Earned bonus: PKR "+earned.toLocaleString():"No bonus tier met yet — keep going!"}
              </div>
            </div>
          </div>
        );
      })()}

      {/* New visit button */}
      <button className="bg" onClick={openModal} disabled={!clockRow} style={{width:"100%",justifyContent:"center",marginBottom:clockRow?12:4,fontSize:15,padding:"12px",opacity:!clockRow?0.4:1}}>
        <I n="plus" s={16}/>New Door Visit
      </button>
      {!clockRow&&<div style={{fontSize:12,color:"var(--txd)",textAlign:"center",marginBottom:12}}>Clock in first to record visits.</div>}

      {/* Today's visits list */}
      {visits.length>0&&(
        <div className="card">
          <div className="ch"><I n="map" s={17} c="var(--g)"/><div className="ct">Today's Visits</div><div className="cs">{visits.length} door{visits.length!==1?"s":""}</div></div>
          <div className="cb">
            {visits.map(v=>(
              <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid var(--bo)"}}>
                <div className="av av-green" style={{width:36,height:36,fontSize:13,borderRadius:9,flexShrink:0}}>{(v.customer_name||"?").charAt(0).toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{v.customer_name}</div>
                  <div style={{fontSize:11,color:"var(--txd)"}}>{fmtTime(v.visit_time)} · {visitItemCounts[v.id]||0} item{(visitItemCounts[v.id]||0)!==1?"s":""}</div>
                </div>
                {v.photo_url&&<img src={v.photo_url} style={{width:36,height:36,objectFit:"cover",borderRadius:8,border:"1px solid var(--bo)"}}/>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Visit Modal */}
      {showModal&&(
        <div className="mo" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="md">
            <div className="mh"><div className="mt">New Door Visit</div><div className="mc" onClick={()=>setShowModal(false)}>×</div></div>
            <div className="mb">

              {/* SOP */}
              {clientSop&&(
                <div style={{background:"var(--d3)",border:"1px solid rgba(201,168,76,.3)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                  <div style={{fontSize:11,color:"var(--g)",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>📋 Client SOP</div>
                  {clientSop.instructions&&<div style={{fontSize:12,color:"var(--tx)",marginBottom:10,lineHeight:1.5}}>{clientSop.instructions}</div>}
                  {(clientSop.checklist||[]).length>0&&(
                    <div>
                      {(clientSop.checklist||[]).map(item=>(
                        <label key={item.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,cursor:"pointer"}}>
                          <input type="checkbox" checked={!!sopChecks[item.id]} onChange={e=>setSopChecks(s=>({...s,[item.id]:e.target.checked}))} style={{width:16,height:16,cursor:"pointer",accentColor:"var(--g)"}}/>
                          <span style={{fontSize:13,color:"var(--tx)",flex:1}}>{item.text}</span>
                          {item.required&&<span style={{color:"var(--rd)",fontSize:12,fontWeight:700,flexShrink:0}}>*</span>}
                        </label>
                      ))}
                      <div style={{fontSize:10,color:"var(--txd)",marginTop:6}}>* Required — must be ticked before saving.</div>
                    </div>
                  )}
                </div>
              )}

              {/* GPS */}
              <div style={{background:"var(--d3)",border:"1px solid var(--bo)",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:11,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>GPS Location{clientSettings.gps_required?<span style={{color:"var(--rd)",marginLeft:4}}>*</span>:<span style={{color:"var(--txd)",fontSize:10,marginLeft:4}}>(optional)</span>}</div>
                {form.gpsCapturing?(
                  <div style={{fontSize:13,color:"var(--or)"}}>📡 Capturing GPS...</div>
                ):form.gps?(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontSize:12,color:"var(--g)"}}>✅ {form.gps.lat}, {form.gps.lng}</div>
                    <button className="bs" style={{fontSize:11,padding:"3px 10px"}} onClick={captureGPS}>Retry</button>
                  </div>
                ):(
                  <div>
                    <div style={{fontSize:12,color:"var(--rd)",marginBottom:6}}>{form.gpsError||"GPS not captured."}</div>
                    <button className="bg" onClick={captureGPS} style={{fontSize:12,padding:"6px 14px"}}><I n="gps" s={13}/>Retry GPS</button>
                  </div>
                )}
              </div>

              {/* Customer */}
              <div className="frow">
                <div className="fg"><label className="fl">Customer Name *</label><input className="fi" value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} placeholder="Full name"/></div>
                <div className="fg"><label className="fl">Customer Phone *</label><input className="fi" value={form.customer_phone} onChange={e=>setForm(f=>({...f,customer_phone:e.target.value}))} placeholder="03001234567"/></div>
              </div>

              {/* Products */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:"var(--txd)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Products</div>
                {form.lines.map((line,idx)=>(
                  <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 56px 88px 28px",gap:6,marginBottom:6,alignItems:"center"}}>
                    <select className="fsel" value={line.product_id} onChange={e=>setLine(idx,"product_id",e.target.value)} style={{fontSize:12}}>
                      <option value="">-- SKU --</option>
                      {products.map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                    </select>
                    <input className="fi" type="number" min="1" value={line.qty} onChange={e=>setLine(idx,"qty",e.target.value)} style={{fontSize:12,textAlign:"center"}} placeholder="Qty"/>
                    <select className="fsel" value={line.type} onChange={e=>setLine(idx,"type",e.target.value)} style={{fontSize:12}}>
                      {clientSettings.activities.sales    &&<option value="sale">Sale</option>}
                      {clientSettings.activities.sampling &&<option value="sample">Sample</option>}
                      {clientSettings.activities.gifting  &&<option value="gift">Gift</option>}
                      <option value="return">Return</option>
                    </select>
                    {form.lines.length>1
                      ?<button onClick={()=>removeLine(idx)} style={{background:"rgba(231,76,60,.15)",border:"1px solid rgba(231,76,60,.3)",borderRadius:6,color:"var(--rd)",cursor:"pointer",height:30,width:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,lineHeight:1}}>×</button>
                      :<div/>}
                  </div>
                ))}
                <button className="bs" onClick={addLine} style={{fontSize:12,padding:"5px 12px",marginTop:2}}><I n="plus" s={12}/>Add another product</button>
              </div>

              {/* Photo */}
              <div className="fg" style={{marginBottom:10}}>
                <label className="fl">Photo (optional)</label>
                {form.photo_url?(
                  <div style={{position:"relative",display:"inline-block"}}>
                    <img src={form.photo_url} style={{width:80,height:80,objectFit:"cover",borderRadius:8,border:"1px solid var(--bo)"}}/>
                    <button onClick={()=>setForm(f=>({...f,photo_url:""}))} style={{position:"absolute",top:-6,right:-6,background:"var(--rd)",border:"none",borderRadius:"50%",width:18,height:18,color:"#fff",fontSize:12,cursor:"pointer",lineHeight:1}}>×</button>
                  </div>
                ):form.photoUploading?(
                  <div style={{fontSize:12,color:"var(--or)"}}>Uploading photo...</div>
                ):(
                  <label style={{display:"flex",alignItems:"center",justifyContent:"center",height:60,border:"1px dashed var(--bo)",borderRadius:8,cursor:"pointer",fontSize:12,color:"var(--txd)",gap:6}}>
                    📷 Take / Upload Photo
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                      const file=e.target.files[0];if(!file)return;
                      setForm(f=>({...f,photoUploading:true}));
                      const r=await uploadPhoto(file);
                      setForm(f=>({...f,photoUploading:false,photo_url:r?r.url:""}));
                      if(!r)toast("Photo upload failed.");
                      e.target.value="";
                    }}/>
                  </label>
                )}
              </div>

              <div className="ma">
                <button className="bs" onClick={()=>setShowModal(false)}>Cancel</button>
                <button className="bg" onClick={doSaveVisit} disabled={saving} style={{opacity:saving?0.6:1}}><I n="ok" s={15}/>{saving?"Saving...":"Save Visit"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const getSaved=()=>{try{const s=localStorage.getItem("shinkore_session");if(!s)return null;const u=JSON.parse(s);if(u&&u.pin!==undefined){const{pin:_,...clean}=u;localStorage.setItem("shinkore_session",JSON.stringify(clean));return clean;}return u;}catch{return null;}};
  const [user,setUser]=useState(getSaved);
  const [page,setPage]=useState(()=>{const u=getSaved();return u?(u.role==="admin"?"dash":u.role==="client"?(u.login_method==="access_code"?"client_portal":"client_dash"):"my-dash"):"dash";});
  
  
  const [data,setData]=useState(initData());
  const [toastMsg,setToastMsg]=useState("");
  const [sideOpen,setSideOpen]=useState(false);
  const [syncState,setSyncState]=useState("synced");
  useEffect(()=>{setSyncStatusCb(setSyncState);},[]);

  // Step 6: Pull fresh data from cloud on startup + every 30s, merge in.
  useEffect(()=>{
    var stop=false;
    var mapTbl={sm_users:"users",sm_stalls:"stalls",sm_allocations:"allocations",sm_attendance:"attendance",sm_client_payments:"client_payments",sm_handovers:"handovers",sm_expenses:"expenses",sm_salary:"salary",sm_documents:"documents",sm_personal:"personal",sm_trainings:"trainings",sm_training_done:"training_done",sm_dtd_clock:"dtd_clock"};
    var pull=async function(){
      var remote=await loadFromSB();
      if(!remote||stop)return;
      var sheetsUrlRow=null;
      try{
        var sr=await SB.from("sm_settings").select("*").eq("id","sheets_url").single();
        if(sr.error&&sr.error.code!=="PGRST116"){console.error("[Pull] sm_settings read failed:",sr.error);}
        sheetsUrlRow=sr.data;
        if(sheetsUrlRow){console.log("[Pull] Loaded sheets_url from Supabase:",sheetsUrlRow.value);}
        else{console.log("[Pull] No sheets_url row found in sm_settings (first use or not saved yet)");}
      }catch(e){console.error("[Pull] sm_settings exception:",e);}
      setData(function(prev){
        var merged={...prev};
        Object.keys(mapTbl).forEach(function(tbl){
          var key=mapTbl[tbl];
          if(Array.isArray(remote[tbl])&&remote[tbl].length>=0){
            merged[key]=remote[tbl];
          }
        });
        // Self-heal: drop allocations whose user no longer exists (only when users are loaded, so it never misfires)
        if(Array.isArray(merged.users)&&merged.users.length>0&&Array.isArray(merged.allocations)){
          var validIds={};
          merged.users.forEach(function(u){validIds[u.id]=true;});
          var before=merged.allocations.length;
          var cleaned=merged.allocations.filter(function(a){return validIds[a.user_id];});
          if(cleaned.length<before){
            var removed=merged.allocations.filter(function(a){return !validIds[a.user_id];});
            removed.forEach(function(a){deleteFromSB("sm_allocations",a.id);});
            merged.allocations=cleaned;
          }
        }
        if(sheetsUrlRow&&sheetsUrlRow.value){merged.sheets_url=sheetsUrlRow.value;}
        localStorage.setItem("shinkore_v2",JSON.stringify(merged));
        return merged;
      });
    };
    pull();
    var iv=setInterval(pull,30000);
    return function(){stop=true;clearInterval(iv);};
  },[]);

  const toast=(m)=>setToastMsg(m);
  const logout=()=>{localStorage.removeItem("shinkore_session");setUser(null);setPage("dash");};
  const doLogin=(u)=>{const d=initData();const fresh=d.users.find(x=>x.id===u.id)||u;const{pin:_,...sessionSafe}=fresh;localStorage.setItem("shinkore_session",JSON.stringify(sessionSafe));setUser(sessionSafe);setPage(sessionSafe.role==="admin"?"dash":sessionSafe.role==="client"?(sessionSafe.login_method==="access_code"?"client_portal":"client_dash"):"my-dash");};

  const titles={dash:"Dashboard","my-dash":"My Dashboard",staff:"Staff & Teams",stalls:"Permission Stalls",alloc:"Allocations",attend:"Attendance",cash:"Cash & Finance",salary:"Salary & Slips",alerts:"Late Alerts",settings:"Settings","clock-in":"Clock In / Out","my-salary":"My Salary",activity:"Activity Reports","my-activity":"My Activities",personal:"Personal Finance",sync:"Google Sheets Sync",apk:"Install APK / PWA",clients:"Clients",products:"Products",campaigns:"Campaigns","dtd-admin":"DTD Reports",careers:"Careers",client_pdf:"Client Report PDF",client_dash:"Client Dashboard",client_portal:"DTD Activity",daily_plan:"Daily Plans",training:"Training",letters:"Letters & Documents",documents:"Document History",ai:"🤖 Ask Shinkore AI"};

  const jobParam=new URLSearchParams(window.location.search).get("job");
  if(jobParam) return <><style>{css}</style><PublicJobPage jobId={jobParam}/></>;
  const urlRole=window.location.pathname.includes("admin")?"admin":window.location.pathname.includes("supervisor")?"supervisor":window.location.pathname.includes("ba")?"ba":""; if(!user) return <><style>{css}</style><Login onLogin={doLogin} urlRole={urlRole}/></>;

  const isAdmin=user.role==="admin";
  const isAllocated=(data.allocations||[]).some(a=>a.user_id===user.id&&a.active);

  const render=()=>{
    if(isAdmin){
      switch(page){
        case "dash": return <AdminDash data={data} toast={toast} setPage={setPage}/>;
        case "staff": return <StaffPage data={data} setData={setData} toast={toast}/>;
        case "stalls": return <StallsPage data={data} setData={setData} toast={toast}/>;
        case "alloc": return <AllocPage data={data} setData={setData} toast={toast}/>;
        case "attend": return <AttendancePage user={user} data={data} setData={setData} toast={toast}/>;
        case "alerts": return <AlertsPage data={data} toast={toast}/>;
        case "personal": return <PersonalPage data={data} setData={setData} toast={toast}/>;
        case "activity": return <ActivityPage user={user} data={data} setData={setData} toast={toast}/>;
        case "daily_plan": return <DailyPlanPage user={user} data={data} setData={setData} toast={toast}/>;
        case "clients": return <ClientsPage user={user} data={data} setData={setData} toast={toast}/>;
        case "control-panel": return <ClientControlPanelPage data={data} setData={setData} toast={toast}/>;
        case "products": return <ProductsPage data={data} toast={toast}/>;
        case "campaigns": return <CampaignsPage data={data} toast={toast}/>;
        case "dtd-admin": return <DTDAdminPage data={data} toast={toast}/>;
        case "careers": return <CareersPage data={data} toast={toast}/>;
        case "sops": return <SOPManagerPage data={data} toast={toast}/>;
        case "client_pdf": return <ClientPDFPage user={user} data={data} toast={toast}/>;
        case "letters": return <LettersPage data={data} toast={toast} setData={setData} save={save}/>;
        case "documents": return <DocumentsPage data={data} user={user} toast={toast}/>;
        case "client_dash": return <ClientDashPage user={user} data={data} toast={toast} setPage={setPage}/>;
        case "settings": return <SettingsPage data={data} setData={setData} toast={toast}/>;
        case "sync": return <SyncPage data={data} setData={setData} toast={toast}/>;
        case "apk": return <ApkPage/>;
        case "cash": return <CashPage data={data} setData={setData} toast={toast}/>;
        case "salary": return <SalaryPage data={data} setData={setData} toast={toast}/>;
        case "training": return <TrainingPage user={user} data={data} setData={setData} toast={toast}/>;
        default: return <AdminDash data={data} toast={toast} setPage={setPage}/>;
      }
    } else if(user.role==="client"){
      switch(page){
        case "client_dash": return <ClientDashPage user={user} data={data} toast={toast}/>;
        case "client_portal": return <ClientPortalPage user={user} data={data} toast={toast}/>;
        default: return <ClientPortalPage user={user} data={data} toast={toast}/>;
      }
    } else {
      switch(page){
        case "my-dash": return <MyDash user={user} data={data} setPage={setPage}/>;
        case "clock-in": return isAllocated?<ClockPage user={user} data={data} setData={setData} toast={toast}/>:<div className="card"><div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}><div style={{fontSize:48}}>🔒</div><div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:16}}>Not Allocated</div><div style={{fontSize:13,marginTop:6}}>Contact admin to assign you to a stall first.</div></div></div>;
        case "my-salary": return <MySalaryPage user={user} data={data}/>;
        case "my-activity": return isAllocated?<ActivityPage user={user} data={data} setData={setData} toast={toast}/>:<div className="card"><div style={{textAlign:"center",padding:"40px",color:"var(--txd)"}}><div style={{fontSize:48}}>🔒</div><div style={{fontFamily:"Rajdhani",fontSize:20,marginTop:16}}>Not Allocated</div><div style={{fontSize:13,marginTop:6}}>Contact admin to assign you to a stall first.</div></div></div>;
        case "attend": return <AttendancePage data={data} setData={setData} toast={toast}/>;
        case "training": return <TrainingPage user={user} data={data} setData={setData} toast={toast}/>;

        case "activity": return <ActivityPage user={user} data={data} setData={setData} toast={toast}/>;
        case "alerts": return <AlertsPage data={data} toast={toast}/>;
        case "documents": return <DocumentsPage data={data} user={user} toast={toast}/>;
        case "dtd-dash": return <DTDDashPage user={user} toast={toast}/>;
        default: return <MyDash user={user} data={data} setPage={setPage}/>;
      }
    }
  };

  return(
    <>
      <style>{css}</style>
      <div className="layout">
        <Sidebar user={user} data={data} page={page} setPage={setPage} open={sideOpen} onClose={()=>setSideOpen(false)}/>
        <main className="main">
          <div className="topbar">
            <button className="mbtn" onClick={()=>setSideOpen(o=>!o)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="tb-title">{titles[page]||page}</div>
            <div className="tb-sub">{COMPANY}</div>
            {syncState==="syncing"&&<span title="Syncing to cloud" style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"rgba(240,165,0,.15)",border:"1px solid rgba(240,165,0,.3)",color:"var(--or)",marginRight:8}}>⏳ Syncing</span>}
            {syncState==="failed"&&<span title="Saved on device but cloud sync failed. Check connection." style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"rgba(231,76,60,.15)",border:"1px solid rgba(231,76,60,.3)",color:"var(--rd)",marginRight:8}}>⚠️ Not synced</span>}
            {syncState==="synced"&&<span title="All changes synced to cloud" style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"rgba(46,204,113,.12)",border:"1px solid rgba(46,204,113,.25)",color:"var(--g)",marginRight:8}}>✅ Synced</span>}
            <button className="bic" onClick={logout} title="Logout"><I n="out" s={15}/></button>
          </div>
          <div className="content">{render()}</div>
        </main>
      </div>
      {toastMsg&&<Toast msg={toastMsg} onDone={()=>setToastMsg("")}/>}
    </>
  );
}
