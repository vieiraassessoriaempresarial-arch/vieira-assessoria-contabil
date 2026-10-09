"""Atualiza a agenda paulista SOMENTE quando houver ato oficial confirmado.
Requer requests, beautifulsoup4; para execução automática configure GitHub Actions.
"""
import json, re, datetime, pathlib, requests
from bs4 import BeautifulSoup
OUT=pathlib.Path(__file__).parent/'assets'/'agenda-sp.json'
months=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO']
today=datetime.date.today();target=months[today.month-1];old=json.loads(OUT.read_text());session=requests.Session();session.headers['User-Agent']='Mozilla/5.0 (compatible; AgendaVieira/1.0)'
# Find candidates in the official legislation portal, then verify the content of each act.
index='https://legislacao.fazenda.sp.gov.br/Paginas/vejamais.aspx'
try:
    html=session.get(index,timeout=25).text
    candidates=re.findall(r'Comunicado-SRE-(\d+)-de-(\d{4})\.aspx',html,re.I)
    # Check recent act numbers without assuming the month-to-number mapping.
    candidates=list(dict.fromkeys([(str(i),str(today.year)) for i in range(1,35)]+candidates))
    for num,year in candidates:
        if int(year)!=today.year:continue
        url=f'https://legislacao.fazenda.sp.gov.br/Paginas/Comunicado-SRE-{num}-de-{year}.aspx'
        r=session.get(url,timeout=18)
        if r.status_code!=200:continue
        txt=BeautifulSoup(r.text,'html.parser').get_text(' ',strip=True).upper()
        if 'AGENDA TRIBUTÁRIA PAULISTA' in txt and re.search(r'MÊS\s+DE\s+'+target+r'\s+DE\s+'+year,txt):
            data={'url':url,'label':f'{target.title()} de {year} · Comunicado SRE {int(num):02d}/{year}','month':f'{year}-{today.month:02d}'}
            OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
            print('Confirmed:',url);break
    else:print('No confirmed new agenda; kept previous:',old['url'])
except requests.RequestException as exc:
    print('Official portal unavailable; kept previous:',old['url'],str(exc))
