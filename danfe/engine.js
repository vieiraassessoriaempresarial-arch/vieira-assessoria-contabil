/* Vieira Assessoria: NF-e XML reader and local DANFE PDF renderer.
   Dependencies: pdf-lib (MIT) and JsBarcode (MIT), vendored locally. */
(function(root){
'use strict';
const NS='http://www.portalfiscal.inf.br/nfe';
const kids=(n,name)=>Array.from(n?.childNodes||[]).filter(c=>c.nodeType===1&&c.localName===name);
const child=(n,name)=>kids(n,name)[0]||null;
const path=(n,p)=>p.split('/').reduce((v,k)=>child(v,k),n);
const val=(n,p)=>path(n,p)?.textContent?.trim()||'';
const descendants=(n,name)=>Array.from(n?.getElementsByTagNameNS(NS,name)||[]);
function checkKey(key){if(!/^\d{44}$/.test(key))return false;let sum=0,weight=2;for(let i=42;i>=0;i--){sum+=Number(key[i])*weight;weight=weight===9?2:weight+1}const r=sum%11;return Number(key[43])===(r<2?0:11-r)}
function parseXML(text,Parser=root.DOMParser){
 if(typeof text!=='string'||!text.trim())throw Error('Selecione um arquivo XML ou cole seu conteúdo.');
 if(new TextEncoder().encode(text).length>5*1024*1024)throw Error('O limite é de 5 MB por XML.');
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML com declarações externas não é permitido.');
 let doc;try{doc=new Parser().parseFromString(text,'application/xml')}catch{throw Error('O arquivo não contém um XML válido.')}
 if(!doc?.documentElement||doc.getElementsByTagName('parsererror').length)throw Error('XML inválido ou incompleto.');
 const proc=doc.documentElement;
 if(proc.localName!=='nfeProc'||proc.namespaceURI!==NS)throw Error('Selecione o XML processado da NF-e (nfeProc), com protocolo de autorização. CT-e, NFC-e, NFS-e e arquivos de eventos não são suportados nesta ferramenta.');
 const info=path(proc,'NFe/infNFe'),prot=path(proc,'protNFe/infProt');
 if(!info||!prot||info.getAttribute('versao')!=='4.00')throw Error('É necessário um XML de NF-e versão 4.00 com protocolo de autorização.');
 if(val(info,'ide/mod')!=='55')throw Error('Esta ferramenta gera DANFE somente para NF-e modelo 55.');
 if(val(info,'ide/tpImp')!=='1')throw Error('Esta versão atende ao DANFE retrato. O XML indica outro tipo de impressão; utilize o sistema emissor para esse documento.');
 if(val(info,'ide/tpEmis')!=='1')throw Error('NF-e em contingência exige leiaute específico. Utilize o sistema emissor para esse documento.');
 if(!['100','150'].includes(val(prot,'cStat')))throw Error('O protocolo deste XML não indica autorização de uso (cStat 100 ou 150).');
 const key=(info.getAttribute('Id')||'').replace(/^NFe/,'');
 if(!checkKey(key))throw Error('Chave de acesso numérica inválida no XML. Confira o arquivo original.');
 if(val(prot,'chNFe')!==key)throw Error('O protocolo não corresponde à chave da NF-e.');
 if(key.slice(20,22)!=='55'||key.slice(22,25)!==val(info,'ide/serie').padStart(3,'0')||key.slice(25,34)!==val(info,'ide/nNF').padStart(9,'0'))throw Error('Número, série ou modelo da nota não corresponde à chave de acesso.');
 const issuerId=val(info,'emit/CNPJ')||val(info,'emit/CPF');if(!issuerId||key.slice(6,20)!==issuerId.padStart(14,'0'))throw Error('O emitente não corresponde à chave de acesso.');
 if(!/^\d+(\.\d+)?$/.test(val(info,'total/ICMSTot/vNF')))throw Error('Valor total da nota inválido.');
 if(val(prot,'tpAmb')!==val(info,'ide/tpAmb'))throw Error('O ambiente do protocolo difere do ambiente da NF-e.');
 if(!val(prot,'nProt')||!val(prot,'dhRecbto'))throw Error('Protocolo de autorização incompleto.');
 if(!['1','2'].includes(val(info,'ide/tpAmb')))throw Error('Ambiente da NF-e inválido.');
 for(const p of ['emit/xNome','emit/enderEmit/xLgr','dest/xNome','total/ICMSTot/vNF','ide/nNF','ide/serie'])if(!val(info,p))throw Error('XML incompleto: campo obrigatório ausente ('+p+').');
 const items=kids(info,'det');if(!items.length||items.length>990)throw Error('A NF-e deve conter entre 1 e 990 itens.');
 for(const d of items){for(const p of ['prod/cProd','prod/xProd','prod/NCM','prod/CFOP','prod/uCom','prod/qCom','prod/vUnCom','prod/vProd'])if(!val(d,p))throw Error('Item '+d.getAttribute('nItem')+' incompleto: '+p);for(const p of ['prod/qCom','prod/vUnCom','prod/vProd'])if(!/^\d+(\.\d+)?$/.test(val(d,p)))throw Error('Valor numérico inválido no item '+d.getAttribute('nItem'))}
 return {doc,info,prot,key,items,homolog:val(info,'ide/tpAmb')==='2',number:val(info,'ide/nNF'),series:val(info,'ide/serie'),issuer:val(info,'emit/xNome'),recipient:val(info,'dest/xNome'),total:val(info,'total/ICMSTot/vNF')};
}
function decimal(x,min=2,max=2){return x===''||x==null?'':Number(x).toLocaleString('pt-BR',{minimumFractionDigits:min,maximumFractionDigits:max})}
function idFormat(x){return /^\d{14}$/.test(x)?x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):/^\d{11}$/.test(x)?x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):x}
function date(x,time=false){if(!x)return '';const [ymd,clock]=x.split('T');const p=ymd.split('-');return p.length===3?p.reverse().join('/')+(time&&clock?' '+clock.slice(0,8):''):x}
function addr(n){return [val(n,'xLgr'),val(n,'nro'),val(n,'xCpl'),val(n,'xBairro'),[val(n,'xMun'),val(n,'UF')].filter(Boolean).join(' / '),val(n,'CEP')? 'CEP '+val(n,'CEP').replace(/^(\d{5})(\d{3})$/,'$1-$2'):'',val(n,'fone')?'Fone: '+val(n,'fone'):''].filter(Boolean).join(' - ')}
function taxVal(det,group,name){const n=child(child(det,'imposto'),group);if(!n)return '';for(const e of Array.from(n.childNodes||[]).filter(e=>e.nodeType===1)){const v=val(e,name);if(v)return v}return val(n,name)}
async function createPDF(model,dependencies={}){
 const lib=dependencies.PDFLib||root.PDFLib,barcode=dependencies.JsBarcode||root.JsBarcode;if(!lib||!barcode)throw Error('Não foi possível carregar os componentes do PDF. Recarregue a página.');
 const {PDFDocument,StandardFonts,rgb,degrees}=lib,doc=await PDFDocument.create();
 doc.setTitle('DANFE - NF-e '+model.number);doc.setAuthor('Gerado localmente - Vieira Assessoria Contábil');doc.setSubject('Representação do XML fornecido pelo usuário. Situação atual não consultada.');
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const W=595.28,H=841.89,M=12,C=W-M*2,BLACK=rgb(0,0,0),GREY=rgb(.94,.94,.94);let page,y=0;
 const safe=t=>Array.from(String(t??'').replace(/[\r\t]/g,' ')).map(c=>{if(c==='\n')return c;try{font.encodeText(c);return c}catch{return '?'}}).join('');
 const measure=(t,size=7,f=font)=>f.widthOfTextAtSize(safe(t),size);
 function wrap(t,w,size=7,f=font){const result=[];for(const paragraph of safe(t).split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(measure((line?line+' ':'')+word,size,f)<=w){line+=(line?' ':'')+word;continue}if(line){result.push(line);line=''}let part='';for(const char of word){if(measure(part+char,size,f)>w&&part){result.push(part);part=''}part+=char}line=part}result.push(line)}return result.length?result:['']}
 function text(t,x,top,size=7,f=font){page.drawText(safe(t),{x,y:H-top-size,size,font:f,color:BLACK})}
 function box(x,top,w,h,fill){page.drawRectangle({x,y:H-top-h,width:w,height:h,borderColor:BLACK,borderWidth:.45,...(fill?{color:fill}:{})})}
 function lines(t,x,top,w,size=7,f=font){const ls=wrap(t,w,size,f);ls.forEach((l,i)=>text(l,x,top+i*(size+2),size,f));return ls.length*(size+2)}
 function line(x1,top,x2){page.drawLine({start:{x:x1,y:H-top},end:{x:x2,y:H-top},thickness:.4,color:BLACK})}
 const n=model.info,p=model.prot,emit=child(n,'emit'),dest=child(n,'dest'),total=path(n,'total/ICMSTot');
 const groupedKey=model.key.match(/.{4}/g).join(' ');
 const encoded={};barcode(encoded,model.key,{format:'CODE128C',displayValue:false,margin:0});
 const bits=encoded.encodings.map(e=>e.data).join('');
 function barcodeDraw(x,top,w){const quiet=10,module=w/(bits.length+quiet*2);let i=0;while(i<bits.length){if(bits[i]==='1'){let end=i+1;while(bits[end]==='1')end++;page.drawRectangle({x:x+(quiet+i)*module,y:H-top-23,width:(end-i)*module,height:23,color:BLACK});i=end}else i++}}
 function header(first){page=doc.addPage([W,H]);y=M;
  if(first){box(M,y,C-68,25);lines('RECEBEMOS DE '+val(emit,'xNome')+' OS PRODUTOS / SERVIÇOS CONSTANTES DA NF-e INDICADA AO LADO.',M+3,y+2,C-74,6);box(W-M-68,y,68,39);text('NF-e',W-M-63,y+2,9,bold);text('Nº '+model.number,W-M-63,y+15,8,bold);text('SÉRIE '+model.series,W-M-63,y+27,7,bold);box(M,y+25,90,14);text('DATA DE RECEBIMENTO',M+3,y+27,5);box(M+90,y+25,C-158,14);text('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR',M+93,y+27,5);y+=44}
  const top=y,left=205,mid=90,right=C-left-mid;
  box(M,top,left,86);box(M+left,top,mid,86);box(M+left+mid,top,right,86);
  lines(val(emit,'xNome'),M+5,top+5,left-10,10,bold);
  lines(addr(child(emit,'enderEmit')),M+5,top+40,left-10,7);
  const cx=M+left+mid/2;const centered=(v,t,size,f=font)=>text(v,cx-measure(v,size,f)/2,t,size,f);
  centered('DANFE',top+4,15,bold);centered('DOCUMENTO AUXILIAR',top+23,6);centered('DA NOTA FISCAL',top+31,6);centered('ELETRÔNICA',top+39,6);centered((val(n,'ide/tpNF')==='0'?'0 - ENTRADA':'1 - SAÍDA'),top+49,8,bold);centered('Nº '+model.number,top+61,9,bold);centered('SÉRIE '+model.series,top+73,8,bold);
  const rx=M+left+mid;barcodeDraw(rx+3,top+3,right-6);text('CHAVE DE ACESSO',rx+4,top+29,5.5);text(groupedKey,rx+4,top+38,7,bold);
  lines('Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal ou no site da SEFAZ autorizadora',rx+4,top+51,right-8,6);
  y=top+86;row([['NATUREZA DA OPERAÇÃO',val(n,'ide/natOp'),.53],['PROTOCOLO DE AUTORIZAÇÃO DE USO',val(p,'nProt')+' - '+date(val(p,'dhRecbto'),true),.47]],false);
  row([['INSCRIÇÃO ESTADUAL',val(emit,'IE'),.32],['INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.',val(emit,'IEST'),.34],['CNPJ / CPF',idFormat(val(emit,'CNPJ')||val(emit,'CPF')),.34]],false);
  if(!first){text('CONTINUAÇÃO - NF-e '+model.number+' / SÉRIE '+model.series,M,y+4,8,bold);y+=20}
 }
 function ensure(h){if(y+h>H-34)header(false)}
 function section(title){ensure(36);text(title,M,y+4,7,bold);y+=15}
 function row(cells,check=true){const prepared=cells.map(c=>({label:c[0],value:c[1]||'',w:C*c[2]}));let h=27;for(const c of prepared)h=Math.max(h,12+wrap(c.value,c.w-6,7,bold).length*9+3);if(check)ensure(h);let x=M;for(const c of prepared){box(x,y,c.w,h);text(c.label,x+3,y+2,5.2);lines(c.value,x+3,y+12,c.w-6,7,bold);x+=c.w}y+=h}
 function paragraph(label,value){if(!value)return;section(label);const all=wrap(value,C-8,7);while(all.length){ensure(24);const capacity=Math.max(1,Math.floor((H-38-y)/9)-1);const chunk=all.splice(0,capacity);const h=chunk.length*9+8;box(M,y,C,h);chunk.forEach((v,i)=>text(v,M+4,y+4+i*9,7));y+=h;if(all.length)header(false)}}
 header(true);
 section('DESTINATÁRIO / REMETENTE');
 row([['NOME / RAZÃO SOCIAL',model.recipient,.58],['CNPJ / CPF / IDENTIFICAÇÃO',idFormat(val(dest,'CNPJ')||val(dest,'CPF')||val(dest,'idEstrangeiro')),.25],['DATA DA EMISSÃO',date(val(n,'ide/dhEmi')),.17]]);
 const de=child(dest,'enderDest');row([['ENDEREÇO',[val(de,'xLgr'),val(de,'nro'),val(de,'xCpl')].filter(Boolean).join(', '),.58],['BAIRRO / DISTRITO',val(de,'xBairro'),.25],['CEP',val(de,'CEP').replace(/^(\d{5})(\d{3})$/,'$1-$2'),.17]]);
 row([['MUNICÍPIO',val(de,'xMun'),.36],['FONE / FAX',val(de,'fone'),.18],['UF',val(de,'UF'),.05],['INSCRIÇÃO ESTADUAL',val(dest,'IE'),.24],['SAÍDA / ENTRADA',date(val(n,'ide/dhSaiEnt'),true),.17]]);
 for(const [tag,title] of [['retirada','LOCAL DE RETIRADA'],['entrega','LOCAL DE ENTREGA']]){const x=child(n,tag);if(x)paragraph(title,[val(x,'xNome'),idFormat(val(x,'CNPJ')||val(x,'CPF')),addr(x)].filter(Boolean).join(' - '))}
 const cobr=child(n,'cobr');if(cobr){section('FATURA / DUPLICATAS');const fat=child(cobr,'fat');if(fat)row([['NÚMERO DA FATURA',val(fat,'nFat'),.4],['VALOR ORIGINAL',decimal(val(fat,'vOrig')),.2],['DESCONTO',decimal(val(fat,'vDesc')),.2],['VALOR LÍQUIDO',decimal(val(fat,'vLiq')),.2]]);const dup=kids(cobr,'dup');for(let i=0;i<dup.length;i+=3){const cells=dup.slice(i,i+3).map(x=>['DUPLICATA / VENCIMENTO / VALOR',val(x,'nDup')+' | '+date(val(x,'dVenc'))+' | R$ '+decimal(val(x,'vDup')),1/3]);while(cells.length<3)cells.push(['','',1/3]);row(cells)}}
 section('CÁLCULO DO IMPOSTO');
 row([['BASE DE CÁLCULO DO ICMS',decimal(val(total,'vBC')),.2],['VALOR DO ICMS',decimal(val(total,'vICMS')),.2],['BASE DE CÁLCULO ICMS ST',decimal(val(total,'vBCST')),.2],['VALOR DO ICMS ST',decimal(val(total,'vST')),.2],['VALOR TOTAL DOS PRODUTOS',decimal(val(total,'vProd')),.2]]);
 row([['VALOR DO FRETE',decimal(val(total,'vFrete')),.16],['VALOR DO SEGURO',decimal(val(total,'vSeg')),.16],['DESCONTO',decimal(val(total,'vDesc')),.16],['OUTRAS DESPESAS',decimal(val(total,'vOutro')),.16],['VALOR DO IPI',decimal(val(total,'vIPI')),.16],['VALOR TOTAL DA NOTA',decimal(model.total),.2]]);
 const tr=child(n,'transp'),ta=child(tr,'transporta'),ve=child(tr,'veicTransp');section('TRANSPORTADOR / VOLUMES TRANSPORTADOS');
 const modes={'0':'0 - Remetente (CIF)','1':'1 - Destinatário (FOB)','2':'2 - Terceiros','3':'3 - Próprio remetente','4':'4 - Próprio destinatário','9':'9 - Sem transporte'};
 row([['RAZÃO SOCIAL',val(ta,'xNome'),.36],['FRETE POR CONTA',modes[val(tr,'modFrete')]||val(tr,'modFrete'),.25],['CÓDIGO ANTT',val(ve,'RNTC'),.12],['PLACA / UF',[val(ve,'placa'),val(ve,'UF')].filter(Boolean).join('/'),.12],['CNPJ / CPF',idFormat(val(ta,'CNPJ')||val(ta,'CPF')),.15]]);
 row([['ENDEREÇO',val(ta,'xEnder'),.5],['MUNICÍPIO',val(ta,'xMun'),.25],['UF',val(ta,'UF'),.05],['INSCRIÇÃO ESTADUAL',val(ta,'IE'),.2]]);
 for(const v of kids(tr,'vol'))row([['QUANTIDADE',val(v,'qVol'),.12],['ESPÉCIE',val(v,'esp'),.2],['MARCA',val(v,'marca'),.18],['NUMERAÇÃO',val(v,'nVol'),.2],['PESO BRUTO',decimal(val(v,'pesoB'),3,3),.15],['PESO LÍQUIDO',decimal(val(v,'pesoL'),3,3),.15]]);
 section('DADOS DOS PRODUTOS / SERVIÇOS');
 const cols=[['CÓDIGO',.085],['DESCRIÇÃO DO PRODUTO / SERVIÇO',.265],['NCM / SH',.06],['O/CST / CSOSN',.055],['CFOP',.045],['UN.',.035],['QUANT.',.065],['V. UNIT.',.075],['V. TOTAL',.07],['B.C. ICMS',.065],['V. ICMS',.055],['V. IPI',.045],['ALIQ. ICMS',.04],['ALIQ. IPI',.04]];
 function tableHead(){ensure(35);let x=M;cols.forEach(([label,f])=>{box(x,y,C*f,23,GREY);lines(label,x+2,y+3,C*f-4,5.2,bold);x+=C*f});y+=23}tableHead();
 for(const det of model.items){const pr=child(det,'prod');const desc=[val(pr,'xProd'),val(det,'infAdProd'),val(pr,'qTrib')&&val(pr,'uTrib')!==val(pr,'uCom')?'Un. tributável: '+val(pr,'uTrib')+' | Quant.: '+decimal(val(pr,'qTrib'),0,4)+' | V. unit.: '+decimal(val(pr,'vUnTrib'),2,10):''].filter(Boolean).join('\n');
  const orig=taxVal(det,'ICMS','orig'),status=taxVal(det,'ICMS','CSOSN')||taxVal(det,'ICMS','CST');
  const values=[val(pr,'cProd'),desc,val(pr,'NCM'),orig+(status?'/'+status:''),val(pr,'CFOP'),val(pr,'uCom'),decimal(val(pr,'qCom'),0,4),decimal(val(pr,'vUnCom'),2,10),decimal(val(pr,'vProd')),decimal(taxVal(det,'ICMS','vBC')),decimal(taxVal(det,'ICMS','vICMS')),decimal(taxVal(det,'IPI','vIPI')),decimal(taxVal(det,'ICMS','pICMS')),decimal(taxVal(det,'IPI','pIPI'))];
  const wrapped=values.map((v,i)=>wrap(v,C*cols[i][1]-4,6));let offset=0;const totalLines=Math.max(...wrapped.map(x=>x.length));
  while(offset<totalLines){if(y+20>H-34){header(false);section('DADOS DOS PRODUTOS / SERVIÇOS - CONTINUAÇÃO');tableHead()}
   const capacity=Math.max(1,Math.floor((H-38-y)/8));const take=Math.min(totalLines-offset,capacity);const h=Math.max(18,take*8+6);let x=M;
   wrapped.forEach((ls,i)=>{const w=C*cols[i][1];box(x,y,w,h);ls.slice(offset,offset+take).forEach((v,j)=>text(v,x+2,y+3+j*8,6));x+=w});y+=h;offset+=take;
  }
 }
 const iss=path(n,'total/ISSQNtot');if(iss){section('CÁLCULO DO ISSQN');row([['INSCRIÇÃO MUNICIPAL',val(emit,'IM'),.25],['VALOR TOTAL DOS SERVIÇOS',decimal(val(iss,'vServ')),.25],['BASE DE CÁLCULO DO ISSQN',decimal(val(iss,'vBC')),.25],['VALOR DO ISSQN',decimal(val(iss,'vISS')),.25]])}
 const extra=[];for(const det of model.items){const pr=child(det,'prod'),imp=child(det,'imposto');const discounts=val(pr,'vDesc');if(discounts)extra.push('Item '+det.getAttribute('nItem')+' - Desconto: R$ '+decimal(discounts));for(const group of ['IBSCBS','IS']){const g=child(imp,group);if(g){const leaves=Array.from(g.getElementsByTagName('*')).filter(x=>!Array.from(x.childNodes).some(c=>c.nodeType===1));extra.push('Item '+det.getAttribute('nItem')+' - '+group+': '+leaves.map(x=>x.localName+'='+x.textContent.trim()).join('; '))}}}
 const refs=kids(child(n,'ide'),'NFref').map(x=>x.textContent.trim()).filter(Boolean);if(refs.length)extra.push('Documentos referenciados: '+refs.join('; '));
 const totalsAdditional=[];for(const tag of ['vII','vPIS','vCOFINS','vFCP','vFCPUFDest','vICMSUFDest','vICMSUFRemet','vICMSDeson','vFCPST','vFCPSTRet','vIPIDevol','vTotTrib']){const value=val(total,tag);if(value&&Number(value)!==0)totalsAdditional.push(tag+': R$ '+decimal(value))}if(totalsAdditional.length)extra.push('Outros totais do XML: '+totalsAdditional.join(' | '));
 const ibs=path(n,'total/IBSCBSTot');if(ibs){const leaves=Array.from(ibs.getElementsByTagName('*')).filter(x=>!Array.from(x.childNodes).some(c=>c.nodeType===1));extra.push('Totais IBS/CBS: '+leaves.map(x=>x.localName+'='+x.textContent.trim()).join('; '))}
 paragraph('DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES',[val(n,'infAdic/infCpl'),...extra].filter(Boolean).join('\n'));
 paragraph('INFORMAÇÕES DE INTERESSE DO FISCO',val(n,'infAdic/infAdFisco'));
 const pag=child(n,'pag');if(pag)paragraph('PAGAMENTOS INFORMADOS NO XML',kids(pag,'detPag').map(x=>'Meio '+val(x,'tPag')+(val(x,'xPag')?' ('+val(x,'xPag')+')':'')+': R$ '+decimal(val(x,'vPag'))).join(' | ')+(val(pag,'vTroco')?' | Troco: R$ '+decimal(val(pag,'vTroco')):''));
 for(const pg of doc.getPages()){page=pg;const i=doc.getPages().indexOf(pg);text('DANFE gerado a partir do XML fornecido. Situação atual não consultada na SEFAZ.',M,H-23,5.6);text('Folha '+(i+1)+' / '+doc.getPageCount(),W-M-64,H-23,6,bold);if(model.homolog){page.drawText('SEM VALOR FISCAL - HOMOLOGAÇÃO',{x:65,y:380,size:23,font:bold,color:rgb(.65,.1,.1),opacity:.26,rotate:degrees(24)})}}
 return doc.save();
}
root.VieiraDanfe={parseXML,createPDF,checkKey,decimal};
if(typeof module==='object'&&module.exports)module.exports=root.VieiraDanfe;
})(typeof window==='object'?window:globalThis);
