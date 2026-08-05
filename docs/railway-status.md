# Railway — Status do deploy Sulnet Gestão de Frota

**Projeto:** amiable-mindfulness (`c258ab6b-db4d-44b6-89dc-e21f6ee533b2`)  
**Ambiente:** production

## Serviços

| Serviço | ID | Status | URL |
|---------|-----|--------|-----|
| **Frota** (web) | `0524a655-fee9-4878-b388-0a85d1b0453a` | SUCCESS | https://frota-production-25d8.up.railway.app |
| **Postgres** | `cd049cdb-4abd-4ee2-96a7-26b4ecc1ea5d` | SUCCESS | interno `postgres.railway.internal:5432` |
| **api** | `20b01311-9875-4269-89f4-0ec9f74f0617` | pendente config | — |
| **gt06-ingest** | `2cd6dbad-b795-429a-8547-072cd6769b1b` | pendente config | — |

## O que já funciona

- PostgreSQL rodando
- Web (Frota) buildou com `Dockerfile` na raiz — deploy SUCCESS
- Login em `/login` (precisa `NEXT_PUBLIC_API_URL` apontando para API)

## O que falta (executar script)

```powershell
cd C:\Users\rafael.santos\Projects\Frota
$env:RAILWAY_TOKEN = "seu-project-token"
.\scripts\railway-setup.ps1
```

Ou manualmente no Railway Dashboard:

### Serviço `api`

- **Config file path:** `railway.api.toml`
- **Variables:**
  ```
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  JWT_SECRET=<gerar>
  INTERNAL_API_SECRET=<gerar>
  ADMIN_EMAIL=admin@sulnet.com
  ADMIN_PASSWORD=<senha-forte>
  ADMIN_NAME=Administrador
  PORT=3001
  ```
- **Networking:** Generate Domain, port **3001**

### Serviço `gt06-ingest`

- **Config file path:** `railway.gt06.toml`
- **Variables:** `GT06_PORT=5023`, `API_INTERNAL_URL=http://api.railway.internal:3001`, `INTERNAL_API_SECRET=<mesmo da api>`
- **Networking → TCP Proxy:** porta **5023**

### Serviço `Frota` (web)

- **Variable:** `NEXT_PUBLIC_API_URL=https://<dominio-api>.up.railway.app`
- Redeploy após definir a URL da API

## Token Railway

O Project Token precisa permissão de **escrita** para `variable set`, `up`, `tcp-proxy create`.  
Leitura (`status`, `variables`, `logs`) funciona; `link` e `source connect` podem retornar Unauthorized.

## GT06 no rastreador

Após TCP proxy:
```
#ip#123456#HOST.proxy.rlwy.net#PORTA#
```
