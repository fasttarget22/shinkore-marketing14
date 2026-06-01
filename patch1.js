const fs = require("fs");
let c = fs.readFileSync("src/App.jsx", "utf8");

const oldSave = `  const saveUrl=()=>{
    const d={...data,sheets_url:url};
    setData(d);save(d);toast("Sheets URL saved!");
  };`;

const newSave = `  const saveUrl=async()=>{
    const d={...data,sheets_url:url};
    setData(d);save(d);
    try{await SB.from("sm_settings").upsert({id:"sheets_url",value:url},{onConflict:"id"});}catch(e){}
    toast("Sheets URL saved!");
  };`;

if(c.includes(oldSave)){
  c = c.replace(oldSave, newSave);
  fs.writeFileSync("src/App.jsx", c);
  console.log("EDIT 1 SUCCESS");
} else {
  console.log("EDIT 1 FAIL - pattern not found");
}
