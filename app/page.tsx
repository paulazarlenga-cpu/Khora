"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { code:string; name:string; cost:number; price:number; stock:number; minimum:number };
type Sale = { id:number; date:string; client:string; code:string; product:string; quantity:number; total:number; status:string };
type Purchase = { id:number; date:string; category:string; code:string; item:string; quantity:number; total:number; supplier:string; status:string };
type AppData = { products:Product[]; sales:Sale[]; purchases:Purchase[]; clients:string[]; suppliers:string[] };

const seed: AppData = {
  products: [
    {code:"P05",name:"Difusor Coco",cost:8005,price:12000,stock:3,minimum:10},
    {code:"P04",name:"Difusor Vainilla",cost:4005,price:9000,stock:-4,minimum:10},
    {code:"P01",name:"Aromatizador Coco",cost:8050,price:14000,stock:0,minimum:10},
    {code:"P02",name:"Aromatizador Vainilla",cost:8050,price:14000,stock:-1,minimum:10},
    {code:"P08",name:"Jabón",cost:0,price:2000,stock:0,minimum:10},
    {code:"P10",name:"Bombas",cost:0,price:12000,stock:0,minimum:10},
    {code:"C01",name:"Combo difusor vainilla + aromatizador coco",cost:12055,price:20000,stock:-1,minimum:10},
    {code:"P03",name:"Spray Lavanda y Tilo",cost:1300,price:3000,stock:5,minimum:10},
  ],
  sales: [
    {id:1,date:"30/06/2026",client:"Seba",code:"P02",product:"Aromatizador Vainilla",quantity:1,total:1,status:"PAGO"},
    {id:2,date:"30/06/2026",client:"Cristian",code:"P04",product:"Difusor Vainilla",quantity:5,total:15000,status:"PAGO"},
    {id:3,date:"30/06/2026",client:"Paula",code:"C04",product:"Bonbini",quantity:5,total:20000,status:"PAGO"},
    {id:4,date:"01/07/2026",client:"Paula",code:"C01",product:"Combo difusor vainilla + aromatizador coco",quantity:1,total:10000,status:"PAGO"},
    {id:5,date:"12/07/2026",client:"Pedro",code:"P03",product:"Spray Lavanda y Tilo",quantity:3,total:9000,status:"PAGO"},
  ],
  purchases: [
    {id:1,date:"30/06/2026",category:"Envases",code:"EN01",item:"125 ml",quantity:2000,total:10000,supplier:"Planet Fun",status:"Pagado"},
    {id:2,date:"30/06/2026",category:"Esencias",code:"E01",item:"Vainilla",quantity:2000,total:40000,supplier:"Boca",status:"Pagado"},
    {id:3,date:"30/06/2026",category:"Esencias",code:"E02",item:"Coco",quantity:1000,total:40000,supplier:"Bunge",status:"Pagado"},
    {id:4,date:"12/07/2026",category:"Esencias",code:"E03",item:"Lavanda y Tilo",quantity:1000,total:50000,supplier:"Lynch",status:"Pagado"},
  ],
  clients:["Seba","Paula","Cristian","Juan","Romi","Mariano","Pedro","María","Juana","Roberto","Guillermina"],
  suppliers:["Lynch","Bunge","Planet Fun","Vélez","Boca"]
};

const money = (n:number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
const today = () => new Date().toLocaleDateString("es-AR");

export default function Home(){
  const [data,setData]=useState<AppData>(seed); const [section,setSection]=useState("Resumen");
  const [search,setSearch]=useState(""); const [modal,setModal]=useState<"sale"|"purchase"|"product"|null>(null);
  const [notice,setNotice]=useState("");
  useEffect(()=>{ fetch("/api/data").then(r=>r.ok?r.json():Promise.reject()).then(x=>{if(x.data)setData(x.data)}).catch(()=>{}); },[]);
  const save=(next:AppData)=>{setData(next);fetch("/api/data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(next)}).catch(()=>{});setNotice("Movimiento guardado correctamente");setTimeout(()=>setNotice(""),2500)};
  const metrics=useMemo(()=>({sales:data.sales.reduce((a,v)=>a+v.total,0),cost:data.purchases.reduce((a,v)=>a+v.total,0),low:data.products.filter(p=>p.stock<=p.minimum).length}),[data]);
  const filtered=data.products.filter(p=>(p.name+p.code).toLowerCase().includes(search.toLowerCase()));
  const nav=["Resumen","Productos","Ventas","Compras","Contactos"];
  return <main className="shell">
    <aside><div className="brand"><span>AC</span><div><b>Alma & Casa</b><small>Gestión del emprendimiento</small></div></div><nav>{nav.map(n=><button className={section===n?"active":""} onClick={()=>setSection(n)} key={n}><i>{({Resumen:"⌂",Productos:"◇",Ventas:"$",Compras:"↓",Contactos:"◎"} as Record<string,string>)[n]}</i>{n}</button>)}</nav><div className="side-note"><b>Todo en orden</b><p>Los datos quedan guardados automáticamente.</p></div></aside>
    <section className="content"><header><div><p className="eyebrow">DOMINGO, 12 DE JULIO</p><h1>{section}</h1><p>{section==="Resumen"?"Una mirada rápida a tu negocio":`Administrá ${section.toLowerCase()} desde un solo lugar`}</p></div><button className="primary" onClick={()=>setModal(section==="Compras"?"purchase":section==="Productos"?"product":"sale")}>＋ {section==="Compras"?"Nueva compra":section==="Productos"?"Nuevo producto":"Nueva venta"}</button></header>
      {notice&&<div className="toast">✓ {notice}</div>}
      {section==="Resumen"&&<><div className="cards"><article><span className="green">VENTAS ACUMULADAS</span><strong>{money(metrics.sales)}</strong><small>{data.sales.length} ventas registradas</small></article><article><span className="terracotta">GASTOS EN INSUMOS</span><strong>{money(metrics.cost)}</strong><small>{data.purchases.length} compras registradas</small></article><article><span className="purple">RESULTADO ESTIMADO</span><strong>{money(metrics.sales-metrics.cost)}</strong><small>Ventas menos compras</small></article><article className="warning"><span>ATENCIÓN DE STOCK</span><strong>{metrics.low}</strong><small>productos necesitan revisión</small></article></div><div className="two"><Panel title="Productos con poco stock" action="Ver productos" onAction={()=>setSection("Productos")}><ProductTable items={data.products.filter(p=>p.stock<=p.minimum).slice(0,5)}/></Panel><Panel title="Últimas ventas"><div className="sales-list">{data.sales.slice(-4).reverse().map(s=><div key={s.id}><span>{s.client.slice(0,1)}</span><p><b>{s.client}</b><small>{s.product} · {s.quantity} u.</small></p><strong>{money(s.total)}</strong></div>)}</div></Panel></div></>}
      {section==="Productos"&&<><div className="toolbar"><input placeholder="Buscar por nombre o código..." value={search} onChange={e=>setSearch(e.target.value)}/><span>{filtered.length} productos</span></div><Panel title="Catálogo y stock"><ProductTable items={filtered}/></Panel></>}
      {section==="Ventas"&&<Panel title="Historial de ventas"><table><thead><tr><th>FECHA</th><th>CLIENTE</th><th>PRODUCTO</th><th>CANT.</th><th>ESTADO</th><th>TOTAL</th></tr></thead><tbody>{data.sales.slice().reverse().map(s=><tr key={s.id}><td>{s.date}</td><td><b>{s.client}</b></td><td>{s.product}</td><td>{s.quantity}</td><td><em className="paid">{s.status}</em></td><td><b>{money(s.total)}</b></td></tr>)}</tbody></table></Panel>}
      {section==="Compras"&&<Panel title="Compras de insumos"><table><thead><tr><th>FECHA</th><th>INSUMO</th><th>CATEGORÍA</th><th>PROVEEDOR</th><th>CANT.</th><th>TOTAL</th></tr></thead><tbody>{data.purchases.slice().reverse().map(p=><tr key={p.id}><td>{p.date}</td><td><b>{p.item}</b><small className="block">{p.code}</small></td><td>{p.category}</td><td>{p.supplier}</td><td>{p.quantity}</td><td><b>{money(p.total)}</b></td></tr>)}</tbody></table></Panel>}
      {section==="Contactos"&&<div className="two"><Panel title={`Clientes (${data.clients.length})`}><div className="contact-grid">{data.clients.map(c=><div key={c}><span>{c[0]}</span><b>{c}</b></div>)}</div></Panel><Panel title={`Proveedores (${data.suppliers.length})`}><div className="contact-grid">{data.suppliers.map(c=><div key={c}><span>{c[0]}</span><b>{c}</b></div>)}</div></Panel></div>}
    </section>{modal&&<Modal type={modal} data={data} close={()=>setModal(null)} save={save}/>}</main>
}

function Panel({title,children,action,onAction}:{title:string;children:React.ReactNode;action?:string;onAction?:()=>void}){return <article className="panel"><div className="panel-head"><h2>{title}</h2>{action&&<button onClick={onAction}>{action} →</button>}</div>{children}</article>}
function ProductTable({items}:{items:Product[]}){return <table><thead><tr><th>PRODUCTO</th><th>CÓDIGO</th><th>STOCK</th><th>MÍNIMO</th><th>PRECIO</th><th>ESTADO</th></tr></thead><tbody>{items.map(p=><tr key={p.code}><td><b>{p.name}</b></td><td>{p.code}</td><td><b>{p.stock}</b></td><td>{p.minimum}</td><td>{money(p.price)}</td><td><em className={p.stock<=0?"out":"low"}>{p.stock<=0?"Sin stock":"Poco stock"}</em></td></tr>)}</tbody></table>}

function Modal({type,data,close,save}:{type:"sale"|"purchase"|"product";data:AppData;close:()=>void;save:(d:AppData)=>void}){
  const submit=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);
    if(type==="sale"){const code=String(f.get("code"));const p=data.products.find(x=>x.code===code)!;const q=Number(f.get("quantity"));save({...data,products:data.products.map(x=>x.code===code?{...x,stock:x.stock-q}:x),sales:[...data.sales,{id:Date.now(),date:today(),client:String(f.get("client")),code,product:p.name,quantity:q,total:q*p.price,status:String(f.get("status"))}]});}
    if(type==="purchase")save({...data,purchases:[...data.purchases,{id:Date.now(),date:today(),category:String(f.get("category")),code:String(f.get("code")),item:String(f.get("item")),quantity:Number(f.get("quantity")),total:Number(f.get("total")),supplier:String(f.get("supplier")),status:"Pagado"}]});
    if(type==="product")save({...data,products:[...data.products,{code:String(f.get("code")).toUpperCase(),name:String(f.get("item")),cost:Number(f.get("cost")),price:Number(f.get("price")),stock:Number(f.get("quantity")),minimum:Number(f.get("minimum"))}]});close()};
  return <div className="overlay" onMouseDown={close}><form className="modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}><button type="button" className="x" onClick={close}>×</button><p className="eyebrow">NUEVO MOVIMIENTO</p><h2>{type==="sale"?"Registrar venta":type==="purchase"?"Registrar compra":"Agregar producto"}</h2>
    {type==="sale"?<><label>Cliente<input name="client" list="clients" required/><datalist id="clients">{data.clients.map(c=><option key={c}>{c}</option>)}</datalist></label><label>Producto<select name="code">{data.products.map(p=><option value={p.code} key={p.code}>{p.name} · {money(p.price)}</option>)}</select></label><div className="form-row"><label>Cantidad<input name="quantity" type="number" min="1" defaultValue="1" required/></label><label>Estado<select name="status"><option>PAGO</option><option>PENDIENTE</option></select></label></div></>:<><label>{type==="product"?"Nombre del producto":"Insumo"}<input name="item" required/></label><div className="form-row"><label>Código<input name="code" required/></label><label>{type==="product"?"Stock inicial":"Cantidad"}<input name="quantity" type="number" min="0" required/></label></div>{type==="purchase"?<><label>Categoría<select name="category"><option>Esencias</option><option>Envases</option><option>Varillas</option><option>Alcohol</option><option>Otros</option></select></label><label>Proveedor<select name="supplier">{data.suppliers.map(s=><option key={s}>{s}</option>)}</select></label><label>Total pagado<input name="total" type="number" min="0" required/></label></>:<><div className="form-row"><label>Costo<input name="cost" type="number" min="0" required/></label><label>Precio<input name="price" type="number" min="0" required/></label></div><label>Stock mínimo<input name="minimum" type="number" min="0" defaultValue="10" required/></label></>}</>}
    <div className="modal-actions"><button type="button" onClick={close}>Cancelar</button><button className="primary">Guardar</button></div></form></div>
}
