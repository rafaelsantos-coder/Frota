# Deploy completo no Railway (produção)

Sistema **100% na nuvem** — sem necessidade de rodar localmente.

## Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  PostgreSQL │────▶│     API      │◀────│ gt06-ingest │
│  (Railway)  │     │  Fastify+JWT │     │  TCP :5023  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  Web Next.js │
                    │  Login/Senha │
                    └──────────────┘
```

| Serviço | Função |
|---------|--------|
| **postgres** | Banco de dados (usuários, veículos, posições, alertas) |
| **api** | Backend autenticado + webhooks Jimi |
| **gt06-ingest** | Rastreadores GT06 via TCP proxy |
| **web** | Painel com login e senha |

## Passo 1 — Criar projeto no Railway

1. Acesse [railway.com/new](https://railway.com/new)
2. **Deploy from GitHub** → `rafaelsantos-coder/Frota`
3. Adicione **PostgreSQL** (New → Database → PostgreSQL)

## Passo 2 — Serviço `api`

**Settings → Build:**
- Builder: Dockerfile
- Dockerfile path: `services/api/Dockerfile`

**Variables:**

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<gere-32-chars-aleatorios>
INTERNAL_API_SECRET=<gere-32-chars-aleatorios>
ADMIN_EMAIL=admin@suaempresa.com
ADMIN_PASSWORD=<senha-forte-do-admin>
ADMIN_NAME=Administrador
GT06_PUBLIC_HOST=<host-do-tcp-proxy>
```

**Networking:** Generate Domain → ex. `frota-api-production.up.railway.app`

## Passo 3 — Serviço `gt06-ingest`

**Dockerfile:** `services/gt06-ingest/Dockerfile`

**Variables:**

```env
GT06_HOST=0.0.0.0
GT06_PORT=5023
API_INTERNAL_URL=http://api.railway.internal:3001
INTERNAL_API_SECRET=<mesmo-da-api>
```

**Networking → TCP Proxy → porta 5023**

Anote: `xxxx.proxy.rlwy.net:PORTA` → use no rastreador:
```
#ip#123456#xxxx.proxy.rlwy.net#PORTA#
```

## Passo 4 — Serviço `web`

**Dockerfile:** `apps/web/Dockerfile`

**Variables (build + runtime):**

```env
NEXT_PUBLIC_API_URL=https://frota-api-production.up.railway.app
PORT=3000
```

**Networking:** Generate Domain → ex. `frota-web-production.up.railway.app`

> **Importante:** `NEXT_PUBLIC_API_URL` precisa ser definida **antes** do build. No Railway, adicione a variável e faça redeploy.

## Passo 5 — Primeiro acesso

1. Aguarde deploy da **api** (cria tabelas + usuário admin automaticamente)
2. Acesse o domínio do **web**: `https://frota-web-production.up.railway.app/login`
3. Entre com:
   - **E-mail:** valor de `ADMIN_EMAIL`
   - **Senha:** valor de `ADMIN_PASSWORD`

## Funcionalidades após login

| Tela | O que faz |
|------|-----------|
| **Dashboard** | Veículos online, alertas DMS, últimas posições |
| **Veículos** | Cadastrar placa + IMEI GT06 + câmera JC371 |
| **Integrações** | appKey/appSecret Jimi (manual) + host GT06 |

## Webhooks Jimi (JC371)

Configure no Jimi IoT Hub apontando para a API pública:

```
https://SUA-API.up.railway.app/integrations/jimi/pushgps
https://SUA-API.up.railway.app/integrations/jimi/pushalarm
https://SUA-API.up.railway.app/integrations/jimi/pushIothubEvent
```

## Segurança

- Todas as rotas do painel exigem **JWT** (login)
- Webhooks Jimi e GT06 interno usam endpoints públicos separados
- **Troque** `ADMIN_PASSWORD` e `JWT_SECRET` imediatamente após primeiro deploy
- Credenciais Jimi ficam no banco, preenchidas via painel Integrações

## Checklist de variáveis obrigatórias

| Variável | Serviço | Obrigatório |
|----------|---------|-------------|
| `DATABASE_URL` | api | Sim |
| `JWT_SECRET` | api | Sim |
| `INTERNAL_API_SECRET` | api + gt06 | Sim |
| `ADMIN_EMAIL` | api | Sim |
| `ADMIN_PASSWORD` | api | Sim |
| `NEXT_PUBLIC_API_URL` | web | Sim |
| `API_INTERNAL_URL` | gt06 | Sim |

## Migração GT06 paralela

- Legado: `smartconn.mine.nu:5023`
- Novo (Railway): `proxy.rlwy.net:PORTA`
- Rollback: `#ip#123456#smartconn.mine.nu#5023#`
