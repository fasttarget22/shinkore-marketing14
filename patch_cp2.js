const fs = require("fs");
let c = fs.readFileSync("src/App.jsx", "utf8");

const old = `<thead><tr><th>Activity</th><th>Stall</th><th>Amount</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead>`;
const neu = `<thead><tr><th>Activity</th><th>Stall</th><th>Amount</th><th>Date</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>`;

let ok1 = false, ok2 = false;
if(c.includes(old)){ c = c.replace(old, neu); ok1 = true; }

const oldSpan = `<tr><td colSpan={6} style={{textAlign:"center",color:"var(--txd)",padding:30}}>No client payments recorded yet.</td></tr>`;
const neuSpan = `<tr><td colSpan={7} style={{textAlign:"center",color:"var(--txd)",padding:30}}>No client payments recorded yet.</td></tr>`;
if(c.includes(oldSpan)){ c = c.replace(oldSpan, neuSpan); ok2 = true; }

fs.writeFileSync("src/App.jsx", c);
console.log("Header: "+(ok1?"OK":"FAIL")+" | ColSpan: "+(ok2?"OK":"FAIL"));
