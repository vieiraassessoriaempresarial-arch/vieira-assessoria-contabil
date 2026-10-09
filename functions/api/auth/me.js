import {readSession} from "../../_lib/session.js";
export async function onRequestGet({request,env}){const s=await readSession(request,env);return Response.json({authenticated:!!s,login:s?.login||null},{status:s?200:401,headers:{"Cache-Control":"no-store"}})}
