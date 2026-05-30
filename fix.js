const fs = require("fs");
const p = "src/App.jsx";
let c = fs.readFileSync(p, "utf8");

// Find brand-ic and replace with image
const old = c.slice(c.indexOf('<div className="brand-ic">'), c.indexOf('<div className="brand-ic">') + 35);
console.log("Found:", JSON.stringify(old));

const result = c.replace('<div className="brand-ic">SM</div>', '<img src="https://i.postimg.cc/y6SVx0cx/FB-IMG-1779977314597.jpg" alt="Logo" style={{width:56,height:56,borderRadius:12,objectFit:"cover",border:"2px solid rgba(201,168,76,.5)",boxShadow:"0 4px 16px rgba(201,168,76,.2)",flexShrink:0}}/>');

if(result !== c){
  fs.writeFileSync(p, result);
  console.log("OK logo replaced!");
} else {
  console.log("FAIL - not found");
}