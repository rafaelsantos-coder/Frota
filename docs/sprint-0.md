# Sprint 0 — Entregas

## Objetivo

POC funcional: rastreador GT06 recebendo posições + webhooks Jimi JC371 + painel para cadastrar veículos e configurar integrações manualmente.

## Entregue

- [x] Monorepo npm workspaces
- [x] PostgreSQL + Prisma schema (Vehicle, JimiIntegration, Gt06Integration, Position, Alert)
- [x] Servidor TCP GT06 com decoder protocolo 0x01/0x12/0x13 + ACK
- [x] API REST + webhooks Jimi (`/pushgps`, `/pushalarm`, etc.)
- [x] Painel web: Dashboard, Veículos, Integrações
- [x] Vínculo veículo ↔ rastreador IMEI ↔ câmera JC371 device ID
- [x] Credenciais Jimi configuráveis manualmente no painel (sem hardcode)

## Decisões de produto

| Item | Decisão |
|------|---------|
| Câmera | Jimi **JC371** |
| Credenciais Jimi | Manual no painel Integrações |
| Migração GT06 | Paralelo com SmartGPS |

## Como testar

1. Cadastrar veículo com IMEI do rastreador
2. Apontar rastreador para servidor local/porta 5023
3. Ver posição no dashboard quando pacote 0x12 chegar
4. Simular webhook Jimi:

```bash
curl -X POST http://localhost:3001/integrations/jimi/pushalarm \
  -H "Content-Type: application/json" \
  -d '{"deviceImei":"SEU_DEVICE_ID","alarmLabel":"PHONECALLING"}'
```

## Pendências Sprint 1

- Mapa geográfico
- Cercas eletrônicas
- Autenticação
- Deploy produção com IP público para GT06 e webhooks Jimi
