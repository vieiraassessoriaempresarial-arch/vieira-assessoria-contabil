import {readSession} from "../_lib/session.js";
import {getInstallationToken} from "../_lib/github-app.js";

const owner="vieiraassessoriaempresarial-arch",repo="vieira-assessoria-contabil",branch="painel-clientes-prototipo";
const json=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
const headers=token=>({"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"Vieira-Clientes-Admin"});
const formats={"image/png":{ext:"png",magic:b=>b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71},"image/jpeg":{ext:"jpg",magic:b=>b[0]===255&&b[1]===216&&b[2]===255},"image/webp":{ext:"webp",magic:b=>String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP"}};
export async function onRequestPost({request,env}){
  if(!await readSession(request,env))return json({error:"Acesso não autorizado"},401);
  if(request.headers.get("Origin")!==new URL(request.url).origin)return json({error:"Origem inválida"},403);
  if(!request.headers.get("Content-Type")?.startsWith("application/json"))return json({error:"Formato inválido"},415);
  const body=await request.text();
  if(body.length>2100000)return json({error:"Imagem muito grande (limite 1 MB)"},413);
  let data;try{data=JSON.parse(body)}catch{return json({error:"JSON inválido"},400)}
  const format=formats[data?.mime];
  if(!format||typeof data?.base64!=="string"||data.base64.length>1400000||!(/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64)))return json({error:"Envie PNG, JPG ou WebP com até 1 MB"},400);
  let bytes;try{bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))}catch{return json({error:"Imagem inválida"},400)}
  if(bytes.length<16||bytes.length>1048576||!format.magic(bytes))return json({error:"Imagem inválida ou maior que 1 MB"},400);
  const path="clientes/painel-"+crypto.randomUUID()+"."+format.ext;
  try{
    const token=await getInstallationToken(env);
    const url="https://api.github.com/repos/"+owner+"/"+repo+"/contents/"+path;
    const result=await fetch(url,{method:"PUT",headers:{...headers(token),"Content-Type":"application/json"},body:JSON.stringify({message:"Adicionar logotipo no painel de testes",branch,content:data.base64})});
    if(!result.ok)return json({error:"GitHub recusou o envio ("+result.status+")"},502);
    return json({ok:true,path});
  }catch{return json({error:"Não foi possível enviar o logotipo"},502)}
}
