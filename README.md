# Minha Evolução

Aplicação pessoal de acompanhamento de hábitos, alimentação e orçamento semanal. Versão 0.1 demonstrativa.

## Executar

Node.js 20+: `npm start`. Acesse http://localhost:3000. Healthcheck: `/health`.

## Segurança

A versão inicial não possui login nem banco de dados. Não registrar dados reais de saúde nesta versão. Próximas etapas: autenticação, PostgreSQL privado, controle de acesso, histórico de peso/exames e integração Strava OAuth. Não armazenar segredos no GitHub.

## Deploy

Railway, branch `main`, serviço web com `npm start` e variável PORT fornecida pela plataforma.
