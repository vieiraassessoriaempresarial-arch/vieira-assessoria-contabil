import {sealSession} from "../../_lib/session.js";
export async function onRequestGet({request,env}) {
  const u=new URL(request.url),code=u.searchParams.get("code"),state=u.searchParams.get("state");
  const cookies=Object.fromEntries((request.headers.get("Cookie")||"").split(";").map(x=>x.trim().split("=")).filter(x=>x.length===2));
  const clear="oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  if(!code||!state||state!==cookies.oauth_state)return new Response("Autenticação recusada: estado inválido.",{status:403,headers:{"Set-Cookie":clear}});
  const tokenResponse=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:new URL("/api/auth/callback",request.url).href})});
  if(!tokenResponse.ok)return new Response("Falha na autenticação.",{status:502});
  const tokenData=await tokenResponse.json();
  if(!tokenData.access_token)return new Response("GitHub não autorizou o acesso.",{status:403});
  const profileResponse=await fetch("https://api.github.com/user",{headers:{"Authorization":`Bearer ${tokenData.access_token}`,"Accept":"application/vnd.github+json","User-Agent":"Vieira-Admin"}});
  if(!profileResponse.ok)return new Response("Não foi possível verificar o usuário.",{status:502});
  const profile=await profileResponse.json();
  if(profile.login?.toLowerCase()!==env.ALLOWED_GITHUB_LOGIN?.toLowerCase())return new Response("Esta conta GitHub não tem permissão.",{status:403,headers:{"Set-Cookie":clear}});
  const session=await sealSession({login:profile.login,token:tokenData.access_token,exp:Date.now()+3600*1000},env.SESSION_SECRET);
  const headers=new Headers({"Location":"/admin-prototipo.html","Cache-Control":"no-store"});
  headers.append("Set-Cookie",clear);
  headers.append("Set-Cookie",`vieira_session=${session}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`);
  return new Response(null,{status:302,headers});
}
