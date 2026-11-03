# Gerador de DANFE pelo XML — Vieira Assessoria Contábil

Ferramenta estática em `/danfe/`, com processamento exclusivamente local no navegador.

## Escopo

- XML `nfeProc` da NF-e modelo 55, versão 4.00, `tpImp=1`, `tpEmis=1`.
- Protocolo `cStat=100` ou `150`, chave numérica com DV válido, emitente, número, série e ambiente coerentes.
- PDF A4 retrato, código CODE128C vetorial, dados de emitente/destinatário, impostos, transportador, produtos, duplicatas e informações adicionais.
- Continuação automática em páginas adicionais; sem corte silencioso de descrições e informações complementares.
- Aviso e marca-d'água para ambiente de homologação.
- Sem emissão, assinatura, consulta de situação atual, verificação criptográfica da assinatura ou captura de XML pela chave.
- XML com DTD/entidades é recusado. Limite de 5 MB e 990 itens.
- Não guarda XML/PDF em servidor, cookies, localStorage ou ferramentas de analytics. Recursos JavaScript são locais.

## Dependências locais

- pdf-lib 1.17.1, licença MIT.
- JsBarcode 3.12.3, licença MIT (utilizado apenas CODE128C).

Licenças completas em `vendor/`.

## Verificação realizada

- Leitura no navegador, geração real do PDF e prévia pelo visualizador de PDF.
- Teste de nota fictícia de homologação e nota com 120 itens de descrição longa, com extração textual para conferir todos os itens e a última informação complementar.
- Testes de ICMS51, IPI, rejeição de protocolo ausente, chave divergente, outro modelo, contingência e DTD.
- Inspeção visual do PDF A4 renderizado.

O processamento reproduz o arquivo recebido; cabe ao usuário confirmar autenticidade e situação atual junto à SEFAZ.
