const fs = require("fs");
let c = fs.readFileSync("src/App.jsx", "utf8");

const anchor = `      var remote=await loadFromSB();
      if(!remote||stop)return;`;

const replacement = `      var remote=await loadFromSB();
      if(!remote||stop)return;
      var sheetsUrlRow=null;
      try{var sr=await SB.from("sm_settings").select("*").eq("id","sheets_url").single();sheetsUrlRow=sr.data;}catch(e){}`;

if(c.includes(anchor)){
  c = c.replace(anchor, replacement);
  fs.writeFileSync("src/App.jsx", c);
  console.log("EDIT 2 SUCCESS");
} else {
  console.log("EDIT 2 FAIL - pattern not found");
}
