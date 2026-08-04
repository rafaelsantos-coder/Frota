# Deploy no Railway

Este guia configura a plataforma Frota no [Railway](https://railway.com) com 4 serviços:

| Serviço | Função | Exposição |
|---------|--------|-----------|
| **postgres** | Banco PostgreSQL | Privado |
| **api** | REST + webhooks Jimi | HTTP público |
| **gt06-ingest** | Servidor TCP GT06 :5023 | TCP proxy público |
| **web** | Painel admin Next.js | HTTP público |

## Token Railway

**Nunca commite o token no Git.** Use apenas localmente ou no CI:

```powershell
$env:RAILWAY_TOKEN = "seu-token-aqui"
```

O token é um **Project Token** — dá acesso ao projeto Frota no Railway.

## Setup via CLI (npx, sem instalar global)

```powershell
cd C:\Users\rafael.santos\Projects\Frota
$env:RAILWAY_TOKEN = "seu-token"

# Verificar acesso
npx @railway/cli whoami

# Vincular ao projeto (se ainda não vinculado)
npx @railway/cli link
```

## Criar serviços no Railway Dashboard

1. Acesse [railway.com](https://railway.com) → projeto **Frota**
2. **New** → **Database** → **PostgreSQL**
3. **New** → **GitHub Repo** → `rafaelsantos-coder/Frota` (ou Empty Service + Dockerfile)

Crie **3 serviços** a partir do mesmo repo, cada um com **Root Directory** diferente:

### Serviço `api`

- Root Directory: `/` (raiz do repo — Dockerfile em `services/api/Dockerfile`)
- Config file: `services/api/railway.toml`
- Variáveis:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
API_PORT=3001
API_HOST=0.0.0.0
INTERNAL_API_SECRET=<gere-um-secret-forte>
```

- Domínio público: gerar em **Networking** → ex. `frota-api-production.up.railway.app`

### Serviço `gt06-ingest`

- Dockerfile: `services/gt06-ingest/Dockerfile`
- Variáveis:

```
GT06_HOST=0.0.0.0
GT06_PORT=5023
API_INTERNAL_URL=http://api.railway.internal:3001
INTERNAL_API_SECRET=<mesmo-secret-da-api>
```

- **Networking** → **TCP Proxy** → porta interna **5023**
- Anote o domínio gerado: ex. `shuttle.proxy.rlwy.net:15140`
- Use no SMS do rastreador: `#ip#123456#shuttle.proxy.rlwy.net#15140#`

### Serviço `web`

- Dockerfile: `apps/web/Dockerfile`
- Variáveis:

```
NEXT_PUBLIC_API_URL=https://frota-api-production.up.railway.app
PORT=3000
```

- Domínio público para o painel

## Variáveis compartilhadas

| Variável | Onde | Descrição |
|----------|------|-----------|
| `DATABASE_URL` | api | Referência ao Postgres Railway |
| `INTERNAL_API_SECRET` | api + gt06 | Autenticação entre serviços |
| `API_INTERNAL_URL` | gt06 | URL privada da API (`*.railway.internal`) |
| `NEXT_PUBLIC_API_URL` | web (build) | URL pública da API |

## Webhooks Jimi (JC371)

Após deploy da API, configure no painel **Integrações** (ou direto no Jimi IoT Hub):

```
https://SUA-API.up.railway.app/integrations/jimi/pushgps
https://SUA-API.up.railway.app/integrations/jimi/pushalarm
https://SUA-API.up.railway.app/integrations/jimi/pushIothubEvent
```

Credenciais **appKey/appSecret** continuam sendo preenchidas manualmente no painel web.

## Deploy via CLI

```powershell
$env:RAILWAY_TOKEN = "seu-token"

# Deploy API
npx @railway/cli up --service api

# Deploy GT06
npx @railway/cli up --service gt06-ingest

# Deploy Web
npx @railway/cli up --service web
```

## TCP Proxy via CLI

```powershell
npx @railway/cli tcp-proxy create --port 5023 --service gt06-ingest
```

## Migração paralela GT06

- Frota legada: `smartconn.mine.nu:5023`
- Piloto Railway: `proxy.rlwy.net:PORTA` (do TCP proxy)
- Rollback: `#ip#123456#smartconn.mine.nu#5023#`

## Segurança

- Rotacione o token se ele foi exposto em chat ou commit
- Gere `INTERNAL_API_SECRET` com pelo menos 32 caracteres aleatórios
- Não armazene appSecret Jimi no código — apenas no banco via painel Integrações
