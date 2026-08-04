# Sulnet Gestão de Frota

Sistema completo na nuvem: **login com usuário e senha**, banco PostgreSQL, rastreador GT06, câmera Jimi JC371.

**Deploy:** [Railway](https://railway.com) — guia em [`docs/railway-deploy.md`](docs/railway-deploy.md)

Repositório: [github.com/rafaelsantos-coder/Frota](https://github.com/rafaelsantos-coder/Frota)

## O que o sistema inclui

- Autenticação JWT (e-mail + senha)
- Usuário admin criado automaticamente no primeiro deploy
- Cadastro de veículos (1 rastreador + 1 câmera por veículo)
- Painel de integrações (Jimi appKey/appSecret manual)
- Servidor GT06 TCP + webhooks Jimi
- PostgreSQL persistente

## Deploy rápido no Railway

1. Conecte o repo `rafaelsantos-coder/Frota` no Railway
2. Adicione **PostgreSQL**
3. Crie 3 serviços: **api**, **gt06-ingest**, **web** (Dockerfiles no repo)
4. Configure variáveis (ver `docs/railway-deploy.md`)
5. Acesse `/login` no domínio do web

## Variáveis essenciais (API)

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<secret-forte>
ADMIN_EMAIL=admin@sulnet.com
ADMIN_PASSWORD=<senha-forte>
INTERNAL_API_SECRET=<secret-forte>
```

## Variáveis essenciais (Web)

```env
NEXT_PUBLIC_API_URL=https://sua-api.up.railway.app
```

## Hardware

| Dispositivo | Modelo | Protocolo |
|-------------|--------|-----------|
| Rastreador | WIC Smart GPS GT06 | TCP :5023 |
| Câmera | Jimi JC371 | IoT Hub webhooks |

## Estrutura

```
Frota/
├── apps/web/              # Painel Sulnet + login
├── services/api/          # API + auth + Prisma
├── services/gt06-ingest/  # TCP GT06
├── packages/shared/
└── docs/railway-deploy.md
```

## Licença

Projeto privado — Sulnet.
