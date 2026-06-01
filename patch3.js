const fs = require("fs");
let c = fs.readFileSync("src/App.jsx", "utf8");

const anchor = `        localStorage.setItem("shinkore_v2",JSON.stringify(merged));
        return merged;`;

const replacement = `        if(sheetsUrlRow&&sheetsUrlRow.value){merged.sheets_url=sheetsUrlRow.value;}
        localStorage.setItem("shinkore_v2",JSON.stringify(merged));
        return merged;`;

if(c.includes(anchor)){
  c = c.replace(anchor, replacement);
  fs.writeFileSync("src/App.jsx", c);
  console.log("EDIT 3 SUCCESS");
} else {
  console.log("EDIT 3 FAIL - pattern not found");
}
