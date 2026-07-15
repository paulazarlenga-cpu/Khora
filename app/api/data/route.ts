import { env } from "cloudflare:workers";

async function ready(){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
}
export async function GET(){
  try{await ready();const row=await env.DB.prepare("SELECT data FROM app_state WHERE id = 1").first<{data:string}>();return Response.json({data:row?JSON.parse(row.data):null});}
  catch{return Response.json({data:null},{status:200});}
}
export async function POST(request:Request){
  const data=await request.json(); await ready();
  await env.DB.prepare("INSERT INTO app_state (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at").bind(JSON.stringify(data),new Date().toISOString()).run();
  return Response.json({ok:true});
}
