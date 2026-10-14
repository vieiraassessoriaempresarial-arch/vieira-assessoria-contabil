import {readSession} from "../_lib/session.js";
import {getInstallationToken} from "../_lib/github-app.js";

const owner="vieiraassessoriaempresarial-arch";
const repo="vieira-assessoria-contabil";
const branch="painel-clientes-prototipo";
const path="data/clientes-painel.json";
const github="https://api.github.com/repos/"+owner+"/"+repo+"/contents/"+path;
const headers=token=>({"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"Vieira-Clientes-Admin"});
const noStore={"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:noStore});
function validClient(c){
  if(!c||typeof c!=="object"||Array.isArray(c))return false;
  const limits={name:140,image:240,address:350,email:180,instagram:250,whatsapp:250,description:1500};
  if(typeof c.name!=="string"||!c.name.trim())return false;
  return Object.entries(limits).every(([k,n])=>c[k]===undefined||(typeof c[k]==="string"&&c[k].length<=n));
}
async function load(token){
  const r=await fetch(github+"?ref="+encodeURIComponent(branch),{headers:headers(token)});
  if(r.status===404)return {sha:null,clients:[]};
  if(!r.ok)throw Error("Falha ao consultar arquivo no GitHub: "+r.status);
  const file=await r.json();
  const raw=atob(file.content.replace(/\\s/g,""));
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const clients=JSON.parse(new TextDecoder().decode(bytes));
  if(!Array.isArray(clients))throw Error("Formato de arquivo inválido");
  return {sha:file.sha,clients};
}
export async function onRequestGet({request,env}){
  if(!await readSession(request,env))return reply({error:"Acesso não autorizado"},401);
  try{
    const token=await getInstallationToken(env);
    const data=await load(token);
    return reply({clients:data.clients,sha:data.sha});
  }catch(e){return reply({error:"Não foi possível consultar os cadastros."},502)}
}
export async function onRequestPut({request,env}){
  if(!await readSession(request,env))return reply({error:"Acesso não autorizado"},401);
  if(request.headers.get("Origin")!==new URL(request.url).origin)return reply({error:"Origem inválida"},403);
  if(!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))return reply({error:"Envie JSON"},415);
  const bodyText=await request.text();
  if(bodyText.length>120000)return reply({error:"Arquivo muito grande"},413);
  let data;
  try{data=JSON.parse(bodyText)}catch{return reply({error:"JSON inválido"},400)}
  if(!data||!Array.isArray(data.clients)||data.clients.length>250||!data.clients.every(validClient))return reply({error:"Cadastro inválido"},400);
  if(typeof data.sha!=="string"||!(/^[a-f0-9]{40}$/.test(data.sha)))return reply({error:"Primeiro consulte a versão atual dos dados"},409);
  try{
    const token=await getInstallationToken(env);
    const current=await load(token);
    if(current.sha!==data.sha)return reply({error:"Os dados foram alterados. Atualize antes de salvar."},409);
    const bytes=new TextEncoder().encode(JSON.stringify(data.clients,null,2)+"\n");
    let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
    const r=await fetch(github,{method:"PUT",headers:{...headers(token),"Content-Type":"application/json"},body:JSON.stringify({message:"Atualizar cadastros de clientes no painel de testes",branch,sha:current.sha,content:btoa(binary)})});
    if(r.status===409||r.status===422)return reply({error:"Conflito ao salvar. Atualize os dados."},409);
    if(!r.ok)return reply({error:"GitHub recusou a gravação"},502);
    const result=await r.json();
    return reply({ok:true,sha:result.content?.sha});
  }catch(e){return reply({error:"Não foi possível salvar os cadastros."},502)}
}
