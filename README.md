# Frota — Plataforma de Gestão de Frotas

Sprint 0: ingestão GT06 + webhooks Jimi JC371 + painel de integração manual.

## Stack

- **API** (`services/api`) — Fastify + Prisma + PostgreSQL
- **GT06 ingest** (`services/gt06-ingest`) — servidor TCP porta 5023
- **Web** (`apps/web`) — Next.js painel admin

## Hardware suportado (Sprint 0)

| Dispositivo | Modelo | Integração |
|-------------|--------|------------|
| Rastreador | WIC Smart GPS GT06 | TCP binário :5023 |
| Câmera | Jimi JC371 | Jimi IoT Hub webhooks |

Cada **veículo** possui um rastreador (IMEI) e uma câmera (device ID) vinculados no painel.

## Pré-requisitos

- Node.js 20+
- Docker (PostgreSQL/PostGIS)
- Git

## Setup local

```bash
# 1. Clonar e instalar
git clone https://github.com/rafaelsantos-coder/Frota.git
cd Frota
cp .env.example .env

# 2. Subir banco
docker compose up -d

# 3. Instalar dependências
npm install

# 4. Gerar client Prisma e criar tabelas
npm run db:generate
npm run db:push

# 5. Rodar serviços (3 terminais)
npm run dev:api      # http://localhost:3001
npm run dev:gt06     # TCP :5023
npm run dev:web      # http://localhost:3000
```

## Painel web

| Rota | Função |
|------|--------|
| `/` | Dashboard — posições e alertas |
| `/vehicles` | Cadastro veículo + rastreador + câmera JC371 |
| `/integrations` | Credenciais Jimi (appKey/appSecret) e config GT06 |

## Configurar rastreador GT06 (migração paralela)

Mantenha SmartGPS para frota legada. Para veículos piloto na plataforma Frota:

```
#ip#123456#SEU_HOST_PUBLICO#5023#
```

Rollback para SmartGPS:

```
#ip#123456#smartconn.mine.nu#5023#
```

## Configurar Jimi JC371 (quando tiver credenciais)

1. Painel **Integrações** → preencher appKey e appSecret
2. No Jimi IoT Hub, configurar push URL:
   - `http://SEU_SERVIDOR:3001/integrations/jimi/pushgps`
   - `http://SEU_SERVIDOR:3001/integrations/jimi/pushalarm`
   - `http://SEU_SERVIDOR:3001/integrations/jimi/pushIothubEvent`
3. Cadastrar veículo com **ID da câmera** igual ao device ID/IMEI Jimi

## API endpoints principais

```
GET  /health
GET  /vehicles
POST /vehicles
GET  /integrations/jimi
PUT  /integrations/jimi
GET  /integrations/gt06
PUT  /integrations/gt06
GET  /positions/latest
GET  /alerts
POST /integrations/jimi/pushgps
POST /integrations/jimi/pushalarm
```

## Estrutura do monorepo

```
Frota/
├── apps/web/              # Painel Next.js
├── services/
│   ├── api/               # REST + webhooks + Prisma
│   └── gt06-ingest/       # Servidor TCP GT06
├── packages/shared/       # Tipos compartilhados
└── docker-compose.yml
```

## Próximos passos (Sprint 1)

- Mapa live (MapLibre)
- Cercas eletrônicas (PostGIS)
- Autenticação multi-tenant
- OAuth Jimi automático quando credenciais estiverem ativas
- Deploy cloud (API + GT06 TCP + webhooks públicos)

## Deploy no Railway

Guia completo: [`docs/railway-deploy.md`](docs/railway-deploy.md)

Serviços: **postgres** + **api** (HTTP) + **gt06-ingest** (TCP proxy :5023) + **web** (painel).

```powershell
$env:RAILWAY_TOKEN = "seu-project-token"
npm run railway:whoami
npm run railway:link
npm run railway:deploy:api
npm run railway:deploy:gt06
npm run railway:deploy:web
```

Credenciais Jimi continuam no painel **Integrações** — não vão para variáveis Railway.

## Licença

Projeto privado — uso interno.
