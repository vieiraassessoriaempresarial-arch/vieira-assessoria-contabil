"""Atualiza manchetes oficiais; preserva o último arquivo em falhas de rede."""
import concurrent.futures
import email.utils
import json
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

SOURCES = [
    ('Receita Federal', 'https://www.gov.br/receitafederal/search_rss?SearchableText=Simples%20Nacional&sort_on=effective&sort_order=reverse&portal_type=News%20Item'),
    ('Receita Federal', 'https://www.gov.br/receitafederal/search_rss?SearchableText=MEI&sort_on=effective&sort_order=reverse&portal_type=News%20Item'),
    ('PGFN', 'https://www.gov.br/pgfn/search_rss?SearchableText=MEI&sort_on=effective&sort_order=reverse&portal_type=News%20Item'),
]
TARGET = Path(__file__).parent / 'assets/noticias.json'

def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower()) if unicodedata.category(c) != 'Mn')

def relevant(title):
    return bool(re.search(r'\bmei\b|\bsimei\b|microempreendedor|simples nacional|microempresa|pequenos negocios|pequenas empresas|pronampe|procred|dasn', fold(title)))

def read_source(source):
    name, url = source
    request = urllib.request.Request(url, headers={'User-Agent': 'VieiraNoticias/1.0 (official public RSS reader)'})
    with urllib.request.urlopen(request, timeout=35) as response:
        root = ET.fromstring(response.read(3_000_000))
    items = []
    local = lambda tag: tag.rsplit('}', 1)[-1]
    for item in (node for node in root.iter() if local(node.tag) in ('item', 'entry')):
        fields = {local(child.tag): child for child in item}
        value = lambda key: fields[key].text if key in fields else None
        title = ' '.join((value('title') or '').split())
        link = (value('link') or '').strip()
        if not link and 'link' in fields:
            link = fields['link'].get('href', '')
        parsed = urlparse(link)
        if not relevant(title) or parsed.scheme != 'https' or parsed.hostname != 'www.gov.br':
            continue
        raw = value('pubDate') or value('date') or value('published') or value('updated')
        try:
            if raw and re.match(r'^\d{4}/\d{2}/\d{2}', raw):
                stamp, _, zone = raw.partition(' GMT')
                date = datetime.strptime(stamp, '%Y/%m/%d %H:%M:%S').replace(tzinfo=timezone(timedelta(hours=int(zone or '0'))))
            else:
                date = email.utils.parsedate_to_datetime(raw) if raw and not re.match(r'^\d{4}-', raw) else datetime.fromisoformat(raw.replace('Z', '+00:00'))
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError, AttributeError):
            continue
        if date > datetime.now(timezone.utc):
            continue
        items.append({'title': title, 'url': link, 'source': name, 'date': date.date().isoformat()})
    return items

def main():
    previous = json.loads(TARGET.read_text()) if TARGET.exists() else {'items': []}
    collected = []
    successes = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for source, future in zip(SOURCES, [executor.submit(read_source, source) for source in SOURCES]):
            try:
                collected.extend(future.result())
                successes += 1
            except Exception as error:
                print(f'Fonte indisponível: {source[0]} ({type(error).__name__})')
    if not successes or not collected:
        print('Sem novas manchetes válidas; arquivo anterior preservado.')
        return
    unique = {item['url']: item for item in previous['items']}
    unique.update({item['url']: item for item in collected})
    items = sorted(unique.values(), key=lambda item: item['date'], reverse=True)[:12]
    data = {'checked_at': datetime.now(timezone.utc).isoformat(), 'items': items}
    TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(items)} manchetes oficiais salvas.')

if __name__ == '__main__':
    main()
