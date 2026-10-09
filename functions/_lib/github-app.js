// Server-side GitHub App authentication. Never import this module in browser code.
// Required secrets: GITHUB_APP_ID, GITHUB_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY.
// Installation is restricted to one repository in GitHub settings.
const encoder=new TextEncoder();
function base64url(data){const bytes=data instanceof Uint8Array?data:new Uint8Array(data);return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"")}
function pemBytes(pem){const body=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");return Uint8Array.from(atob(body),x=>x.charCodeAt(0))}
async function appJwt(env){
  if(!env.GITHUB_APP_ID||!env.GITHUB_APP_PRIVATE_KEY)throw Error("GitHub App não configurada");
  const now=Math.floor(Date.now()/1000);
  const header=base64url(encoder.encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const payload=base64url(encoder.encode(JSON.stringify({iat:now-60,exp:now+540,iss:String(env.GITHUB_APP_ID)})));
  const unsigned=header+"."+payload;
  const key=await crypto.subtle.importKey("pkcs8",pemBytes(env.GITHUB_APP_PRIVATE_KEY),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,encoder.encode(unsigned));
  return unsigned+"."+base64url(signature);
}
export async function getInstallationToken(env){
  if(!/^\d+$/.test(String(env.GITHUB_INSTALLATION_ID||"")))throw Error("Instalação GitHub inválida");
  const jwt=await appJwt(env);
  const response=await fetch("https://api.github.com/app/installations/"+env.GITHUB_INSTALLATION_ID+"/access_tokens",{
    method:"POST",
    headers:{"Authorization":"Bearer "+jwt,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"Vieira-Clientes-Admin"},
    body:JSON.stringify({repositories:["vieira-assessoria-contabil"],permissions:{contents:"write"}})
  });
  if(!response.ok)throw Error("Não foi possível obter autorização restrita da GitHub App ("+response.status+")");
  const data=await response.json();
  if(!data.token)throw Error("GitHub não retornou token de instalação");
  return data.token;
}
