const fs = require("fs");
const p = "src/App.jsx";
let c = fs.readFileSync(p, "utf8");

const old = '<div style={{fontFamily:"Rajdhani",fontSize:20,fontWeight:700,color:"var(--g)",letterSpacing:.5,lineHeight:1}}>SHINKORE MARKETING</div>\r\n            <div style={{fontSize:11,color:"var(--txd)",letterSpacing:2,textTransform:"uppercase",marginTop:3}}>Marketing Operations Platform</div>\r\n            <div style={{fontSize:11,color:"var(--txd)",marginTop:5,display:"flex",gap:14,flexWrap:"wrap"}}>\r\n              <span>CEO: Khalid Orakzai</span>\r\n              <span>Civil Officer Col Office 28, Abbottabad</span>\r\n            </div>';

const neu = '<div style={{fontFamily:"Rajdhani",fontSize:18,fontWeight:700,color:"var(--g)",letterSpacing:.5,lineHeight:1,whiteSpace:"nowrap"}}>SHINKORE MARKETING</div>\r\n            <div style={{fontSize:10,color:"var(--txd)",letterSpacing:1.5,textTransform:"uppercase",marginTop:2,whiteSpace:"nowrap"}}>Marketing Operations</div>\r\n            <div style={{fontSize:10,color:"var(--txd)",marginTop:4,display:"flex",flexDirection:"column",gap:2}}>\r\n              <span>👤 CEO: Khalid Orakzai</span>\r\n              <span>📍 Civil Officer Col Office 28, Abbottabad</span>\r\n            </div>';

if(c.includes(old)){
  c = c.replace(old, neu);
  fs.writeFileSync(p, c);
  console.log("OK layout fixed!");
} else {
  console.log("FAIL");
}