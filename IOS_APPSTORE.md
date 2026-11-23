# Minha Evolução — iOS / App Store

## Situação

Preparação inicial do Capacitor. Este projeto usa temporariamente `server.url` para abrir o app web já hospedado no Railway. **Não está pronto para submissão à App Store:** um simples invólucro de website pode ser rejeitado pela diretriz 4.2 da Apple. A versão de distribuição deve empacotar a interface localmente, oferecer recursos próprios de iOS e validar a autenticação e o fluxo OAuth do Strava no app.

## Criar o projeto nativo

Em um Mac com Xcode e Node 20+:

```bash
npm install
npm run ios:add
npm run ios:sync
npm run ios:open
```

O projeto nativo é gerado em `ios/`. Definir Team/Bundle Identifier e Signing no Xcode. Usar simulador e iPhone real para testar login, sessões, Strava e armazenamento.

## Antes de enviar à Apple

- Migrar de `server.url` para assets locais em `www/` com API HTTPS remota e sessão segura.
- Implementar OAuth Strava com retorno por universal link ou custom URL scheme, sem expor segredos no aplicativo.
- Adicionar funcionalidades nativas úteis (ex.: notificações configuráveis e integração HealthKit somente com consentimento), estados offline e acessibilidade.
- Gerar ícones, splash screen, screenshots, descrição, suporte e política de privacidade.
- Testar conta de demonstração e exclusão de conta dentro do aplicativo, quando aplicável.
- Configurar Apple Developer/App Store Connect, arquivar, distribuir por TestFlight e só depois solicitar revisão.

## Segurança

Não incluir dados de saúde, senhas ou tokens no GitHub. `STRAVA_CLIENT_SECRET` e tokens continuam exclusivamente no backend Railway.
