# Painel administrativo — desenvolvimento (não publicado)
Este ramo contém um protótipo e uma primeira camada de autenticação OAuth do GitHub em Cloudflare Pages Functions. **Não mesclar com main antes de testes e revisão de segurança.**
## Pré-requisitos (Cloudflare Pages > Settings > Variables and Secrets)
- `GITHUB_CLIENT_ID`: ID de um GitHub OAuth App criado pelo proprietário.
- `GITHUB_CLIENT_SECRET`: segredo do app (secret, nunca no repositório).
- `SESSION_SECRET`: segredo aleatório forte, pelo menos 32 bytes (secret).
- `ALLOWED_GITHUB_LOGIN`: nome exato da conta GitHub autorizada.
- Callback URL do OAuth App: `https://vieira-assessoria-contabil.pages.dev/api/auth/callback`.
- A aplicação OAuth solicita escopo `repo` para futuros commits no repositório. **Antes de ativar, avaliar alternativa de menor privilégio (GitHub App com acesso apenas a um repositório).**
## Status
- Criados endpoints de login, callback com proteção state, sessão cifrada HttpOnly, verificação de identidade e logout.
- **Não implementados**: autorização para operações de edição, API de escrita, upload de imagens, integração do formulário com a API, renovação de sessão e testes em ambiente Cloudflare.
- O arquivo `admin-prototipo.html` ainda funciona apenas como rascunho local; NÃO é uma área administrativa protegida.
- Não ativar a autenticação no site oficial sem validação dos endpoints e configuração segura.
