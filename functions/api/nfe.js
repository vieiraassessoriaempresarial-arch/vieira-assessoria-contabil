// Cloudflare Pages Function. The provider key is read only from an encrypted binding.
const API='https://api.meudanfe.com.br/v2';
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const configured=env=>Boolean(env.MEUDANFE_API_KEY&&env.DANFE_ACCESS_CODE&&env.DANFE_DB&&env.DANFE_LOOKUP_ENABLED==='true');
function validKey(key){if(!/^\d{44}$/.test(key)||key.slice(20,22)!=='55')return false;let s=0,w=2;for(let i=42;i>=0;i--){s+=Number(key[i])*w;w=w===9?2:w+1}const r=s%11;return Number(key[43])===(r<2?0:11-r)}
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function sameSecret(a,b){return await digest(a)===await digest(b)}
async function readLimited(response,limit){if(Number(response.headers.get('Content-Length')||0)>limit)throw Error('SIZE');const reader=response.body?.getReader();if(!reader)return '';const parts=[];let n=0;while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>limit){await reader.cancel();throw Error('SIZE')}parts.push(value)}const bytes=new Uint8Array(n);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}return new TextDecoder().decode(bytes)}
async function provider(env,path,method='GET'){
 const response=await fetch(API+path,{method,headers:{'Api-Key':env.MEUDANFE_API_KEY,'Accept':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok){const e=Error('PROVIDER');e.status=response.status;throw e}
 let data;try{data=JSON.parse(await readLimited(response,7*1024*1024))}catch{throw Error('INVALID_RESPONSE')}
 return data;
}
function providerError(error){if(error.status===402)return reply({error:'O serviço está sem saldo para novas consultas. Entre em contato com o escritório.'},503);if([401,403].includes(error.status))return reply({error:'A credencial de consulta precisa ser revisada pelo escritório.'},503);if(error.status===429)return reply({error:'O serviço atingiu seu limite temporário. Aguarde antes de tentar novamente.'},429);return reply({error:'Não foi possível concluir a consulta agora. Aguarde e tente mais tarde.'},502)}
async function init(db){await db.batch([db.prepare('CREATE TABLE IF NOT EXISTS danfe_daily (day TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0)'),db.prepare('CREATE TABLE IF NOT EXISTS danfe_jobs (id TEXT PRIMARY KEY, token TEXT NOT NULL, state TEXT NOT NULL, next_poll INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL)')])}
async function documentXML(env,key){const result=await provider(env,'/fd/get/xml/'+key);if(result.format!=='XML'||result.type!=='NFE'||typeof result.data!=='string'||!result.data.includes('<')||result.data.length>5*1024*1024)throw Error('INVALID_RESPONSE');return result.data}
async function finish(env,id,key,token){const xml=await documentXML(env,key);await env.DANFE_DB.prepare("UPDATE danfe_jobs SET state='OK', expires=? WHERE id=?").bind(Date.now()+1800000,id).run();return reply({status:'OK',xml,token})}
export async function onRequest(context){
 const {request,env}=context;const limit=Math.max(1,Math.min(1000,parseInt(env.DANFE_DAILY_LIMIT||'20',10)||20));
 if(request.method==='GET')return reply({configured:configured(env),dailyLimit:limit});
 if(request.method!=='POST')return reply({error:'Método não permitido.'},405);
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(origin!==url.origin)return reply({error:'A consulta deve ser iniciada pelo site do escritório.'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'Formato de requisição inválido.'},415);
 if(!configured(env))return reply({error:'A busca pela chave ainda está em configuração. A geração pelo XML continua disponível.'},503);
 let body;try{body=JSON.parse(await readLimited(request,2048))}catch{return reply({error:'Solicitação inválida.'},400)}
 if(typeof body.accessCode!=='string'||body.accessCode.length>200||!await sameSecret(body.accessCode,String(env.DANFE_ACCESS_CODE)))return reply({error:'Código de acesso inválido. Solicite o código ao escritório.'},403);
 if(body.consent!==true)return reply({error:'Confirme sua autorização para consultar esta nota.'},400);
 const key=String(body.key||'').replace(/[\s.\-]/g,'');if(!validKey(key))return reply({error:'Informe uma chave numérica válida de NF-e modelo 55, com 44 dígitos.'},400);
 if(!['start','poll'].includes(body.action))return reply({error:'Operação inválida.'},400);
 const now=Date.now(),id=await digest(key);const db=env.DANFE_DB;
 try{
  await init(db);
  let job=await db.prepare('SELECT * FROM danfe_jobs WHERE id=?').bind(id).first();
  if(job&&job.expires<now){await db.prepare('DELETE FROM danfe_jobs WHERE id=? AND expires<?').bind(id,now).run();job=null}
  if(body.action==='poll'){
   if(!job||typeof body.token!=='string'||body.token!==job.token)return reply({error:'Consulta expirada. Inicie uma nova busca.'},400);
   if(job.state==='OK')return await finish(env,id,key,job.token);
   if(['ERROR','NOT_FOUND'].includes(job.state))return reply({error:job.state==='NOT_FOUND'?'Nota não encontrada pelo serviço. Confira a chave e solicite o XML ao emitente.':'Esta consulta não pôde ser concluída. Tente novamente mais tarde.'},404);
   if(job.attempts>=12)return reply({error:'O serviço ainda não concluiu a busca. Aguarde alguns minutos antes de tentar novamente.'},504);
   if(job.next_poll>now)return reply({status:'WAITING',token:job.token,retryAfter:Math.max(2,Math.ceil((job.next_poll-now)/1000))},202);
   const lock=await db.prepare('UPDATE danfe_jobs SET next_poll=?, attempts=attempts+1 WHERE id=? AND next_poll<=? AND attempts<12 RETURNING id').bind(now+3000,id,now).first();
   if(!lock)return reply({status:'WAITING',token:job.token,retryAfter:3},202);
  }else{
   if(job){if(job.state==='OK')return await finish(env,id,key,job.token);if(['ERROR','NOT_FOUND'].includes(job.state))return reply({error:'Esta chave foi consultada recentemente sem sucesso. Aguarde alguns minutos antes de tentar novamente.'},429);return reply({status:'WAITING',token:job.token,retryAfter:3},202)}
   const token=crypto.randomUUID();const inserted=await db.prepare("INSERT INTO danfe_jobs(id,token,state,next_poll,attempts,expires) VALUES(?,?,'WAITING',?,0,?) ON CONFLICT(id) DO NOTHING RETURNING id").bind(id,token,now+3000,now+1800000).first();
   if(!inserted)return reply({error:'Já existe uma consulta em andamento. Aguarde alguns segundos.'},409);
   const day=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
   const reserved=await db.prepare('INSERT INTO danfe_daily(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used<? RETURNING used').bind(day,limit).first();
   if(!reserved){await db.prepare('DELETE FROM danfe_jobs WHERE id=? AND token=?').bind(id,token).run();return reply({error:'O limite diário de consultas foi atingido. Tente no próximo dia ou fale com o escritório.'},429)}
   job={token,attempts:0};
   context.waitUntil(db.batch([db.prepare('DELETE FROM danfe_jobs WHERE expires<?').bind(now-3600000),db.prepare('DELETE FROM danfe_daily WHERE day<?').bind(new Date(now-45*86400000).toISOString().slice(0,10))]).catch(()=>{}));
   // A document already in this provider account is downloaded without starting a paid search.
   try{return await finish(env,id,key,token)}catch(error){if(error.status!==404){await db.prepare("UPDATE danfe_jobs SET state='ERROR', expires=? WHERE id=?").bind(now+300000,id).run();return providerError(error)}}
  }
  const result=await provider(env,'/fd/add/'+key,'PUT');
  if(result.value!==key||result.type!=='NFE')throw Error('INVALID_RESPONSE');
  if(result.status==='OK')return await finish(env,id,key,job.token);
  if(['WAITING','SEARCHING'].includes(result.status)){await db.prepare('UPDATE danfe_jobs SET next_poll=? WHERE id=?').bind(Date.now()+3000,id).run();return reply({status:result.status,token:job.token,retryAfter:3},202)}
  await db.prepare("UPDATE danfe_jobs SET state=?, expires=? WHERE id=?").bind(result.status==='NOT_FOUND'?'NOT_FOUND':'ERROR',now+300000,id).run();return reply({error:result.status==='NOT_FOUND'?'Nota não encontrada pelo serviço. Confira a chave ou solicite o XML ao emitente.':'O serviço não conseguiu localizar o XML desta nota.'},404);
 }catch(error){try{await db.prepare("UPDATE danfe_jobs SET state='ERROR', expires=? WHERE id=? AND state!='OK'").bind(now+300000,id).run()}catch{}return providerError(error)}
}
