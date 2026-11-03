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

## Busca pela chave — configuração protegida

Implementada com Pages Functions em `/api/nfe` e API v2 do Meu Danfe. A função usa exclusivamente as rotas documentadas `/fd/get/xml/{chave}` (GET) e `/fd/add/{chave}` (PUT). A chave do fornecedor não faz parte do código nem é devolvida ao navegador.

### Antes de ativar

1. No Cloudflare, abrir o projeto Pages `vieira-assessoria-contabil`.
2. Criar um banco D1 no plano disponível da conta (nome sugerido: `vieira-danfe-usage`). Vinculá-lo ao projeto Pages no ambiente de produção com o nome **DANFE_DB**. As duas tabelas são criadas automaticamente na primeira consulta.
3. Em **Variables and Secrets / Variáveis e segredos**, ambiente **Production**, cadastrar como **Secret**:
   - `MEUDANFE_API_KEY`: chave obtida no Meu Danfe.
   - `DANFE_ACCESS_CODE`: código de acesso a ser compartilhado somente com usuários autorizados pelo escritório.
4. Cadastrar `DANFE_DAILY_LIMIT=20` como variável. Este é um limite global de novas consultas por dia (horário de São Paulo), aplicado atomicamente no D1, não por navegador. Até consultas encontradas na base já existente contam conservadoramente para o limite, embora possam não gerar cobrança no fornecedor.
5. Somente após aprovar os custos e as condições de tratamento dos documentos pelo fornecedor, configurar `DANFE_LOOKUP_ENABLED=true` como variável. Enquanto não houver todas as configurações, nenhum pedido é enviado ao Meu Danfe.
6. Fazer uma nova implantação do projeto para aplicar as variáveis e a vinculação do banco.

### Controles

- Solicitação POST de mesma origem, código do escritório, confirmação de autorização do consulente e validação da chave numérica de NF-e modelo 55 antes de qualquer contato com o fornecedor.
- Limite diário global persistente no D1; consultas em andamento da mesma chave são reaproveitadas.
- Intervalo mínimo de 3 segundos entre consultas de status, no máximo 12 tentativas; falhas têm espera de 5 minutos antes de uma nova busca.
- O D1 não armazena XML, PDF, chave da API nem chave de acesso em texto aberto: apenas hash da chave, token temporário, estado, contagem e datas para controle.
- Sem logs do XML ou da credencial no código da aplicação. Respostas marcadas como `no-store`.
- O Meu Danfe recebe a chave e armazena documentos na conta do fornecedor conforme suas condições; a tela informa esse tratamento. A geração por XML selecionado continua integralmente local.
- Funcionalidade independente: o conversor local permanece disponível mesmo com a consulta pela chave desativada.

### Teste da integração

Testes com respostas simuladas, sem credenciais reais e sem cobranças: configuração ausente, autenticação inválida, origem diferente, consentimento ausente, chave inválida, fila, intervalo entre tentativas, retorno do XML, token de consulta inválido e limite diário persistente. Não houve consulta real à conta do fornecedor nesta implementação.
