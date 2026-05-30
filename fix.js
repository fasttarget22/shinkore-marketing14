const fs = require("fs");
const p = "src/App.jsx";
let c = fs.readFileSync(p, "utf8");

// Add View on Map button to each allocation card in ClockPage
const old = 'const dist=haversine(gps.lat,gps.lng,Number(stall.lat),Number(stall.lng));';
const neu = 'const dist=haversine(gps.lat,gps.lng,Number(stall.lat),Number(stall.lng));';

// Find the stall info line in ClockPage and add map button after GPS target line
const old2 = '              <div style={{fontSize:12,color:"var(--txd)",marginBottom:12}}>GPS Target: {Number(stall.lat).toFixed(5)}, {Number(stall.lng).toFixed(5)} · Within {GPS_RADIUS_M}m required</div>';
const neu2 = '              <div style={{fontSize:12,color:"var(--txd)",marginBottom:8}}>GPS Target: {Number(stall.lat).toFixed(5)}, {Number(stall.lng).toFixed(5)} · Within {GPS_RADIUS_M}m required</div>\r\n              <a href={"https://maps.google.com/?q="+stall.lat+","+stall.lng} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(58,155,213,.12)",border:"1px solid rgba(58,155,213,.3)",borderRadius:8,padding:"7px 14px",fontSize:13,color:"var(--bl)",fontWeight:600,textDecoration:"none",marginBottom:12}}>📍 View Store on Map</a>';

if(c.includes(old2)){
  c = c.replace(old2, neu2);
  fs.writeFileSync(p, c);
  console.log("OK map button added!");
} else {
  console.log("FAIL");
}