// Consulta paga desativada: nenhuma chamada ao provedor é realizada.
export function onRequest() {
 return new Response(JSON.stringify({configured:false,error:'Consulta pela chave desativada. Obtenha o XML no portal oficial da NF-e.'}),{status:410,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
