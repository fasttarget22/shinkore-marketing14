const fs = require("fs");
let c = fs.readFileSync("src/App.jsx", "utf8");

const old = `                      <td style={{color:"var(--txd)",fontSize:12}}>{p.notes||"—"}</td>
                    </tr>
                  ))}
                </tbody>`;

const neu = `                      <td style={{color:"var(--txd)",fontSize:12}}>{p.notes||"—"}</td>
                      <td style={{display:"flex",gap:6}}>
                        {p.status!=="received"&&<button onClick={()=>{var d={...data,client_payments:data.client_payments.map(x=>x.id===p.id?{...x,status:"received"}:x)};setData(d);save(d);toast("Marked as received!");}} style={{background:"var(--gr)",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✓ Received</button>}
                        <button onClick={()=>{if(!confirm("Delete this payment?"))return;var d={...data,client_payments:data.client_payments.filter(x=>x.id!==p.id)};setData(d);save(d);deleteFromSB("sm_client_payments",p.id);toast("Payment deleted.");}} style={{background:"#e53",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑 Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>`;

const count = c.split(old).length - 1;
if(count===1){
  c = c.replace(old, neu);
  fs.writeFileSync("src/App.jsx", c);
  console.log("SUCCESS");
} else {
  console.log("FAIL - found "+count+" matches (need exactly 1)");
}
