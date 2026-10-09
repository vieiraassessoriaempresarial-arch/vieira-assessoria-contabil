export async function onRequestGet({request,env}) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET || !env.ALLOWED_GITHUB_LOGIN) return new Response("Autenticação não configurada.",{status:503});
  const state=crypto.randomUUID();
  const url=new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id",env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri",new URL("/api/auth/callback",request.url).href);
  url.searchParams.set("scope","repo");
  url.searchParams.set("state",state);
  return new Response(null,{status:302,headers:{"Location":url.href,"Set-Cookie":`oauth_state=${state}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,"Cache-Control":"no-store"}});
}
