export const css = `
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
