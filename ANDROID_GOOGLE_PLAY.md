# Minha Evolução — Android / Google Play

## Preparação já realizada
Capacitor Android foi adicionado ao package.json. A aplicação web e a API continuam no Railway.

## Atenção: não publicar ainda
O app atualmente é uma aplicação pessoal: o backend cria apenas o usuário Rafael; a integração Strava usa um token global (strava_tokens id=1). **É obrigatório implementar cadastro, isolamento de dados e autorização Strava individual antes de liberar o app para outras pessoas.** Também é necessário migrar a interface para assets empacotados no Android em vez de depender apenas de uma URL remota, para qualidade e conformidade com as políticas da Play Store.

## Gerar projeto Android
Em ambiente de build com Node 20+, Java 17 e Android SDK:

```bash
npm install
npm run android:add
npm run android:sync
cd android
./gradlew bundleRelease
```

Para Play Store, configurar assinatura de release e Play App Signing. Não salvar keystore nem senhas no repositório. O AAB gerado deve ser testado em faixa interna antes de produção. A configuração de build de release depende de keystore e conta Play Console, ainda não configuradas.

## Publicação
1. Criar conta no Google Play Console (taxa de inscrição única, normalmente US$ 25).
2. Verificar identidade e requisitos de teste aplicáveis à conta.
3. Preparar política de privacidade, exclusão de conta, ficha de segurança dos dados, classificação indicativa e capturas de tela.
4. Implementar contas individuais, consentimento e fluxo de exclusão/exportação de dados pessoais e Strava por usuário.
5. Testar autenticação, renovação de sessão, OAuth Strava, tratamento de falhas, permissões e UX Android.
6. Gerar AAB assinado e publicar primeiro em teste interno/fechado.

A publicação não está concluída: ainda faltam projeto Android gerado, build assinado, testes e conta Google Play Console.
