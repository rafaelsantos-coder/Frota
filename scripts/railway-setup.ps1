# Sulnet Gestão de Frota — setup Railway (produção)
# Uso: $env:RAILWAY_TOKEN = "seu-project-token"; .\scripts\railway-setup.ps1

$ErrorActionPreference = "Stop"
$ProjectId = "c258ab6b-db4d-44b6-89dc-e21f6ee533b2"
$Env = "production"

if (-not $env:RAILWAY_TOKEN) {
  Write-Error "Defina RAILWAY_TOKEN antes de executar."
}

$jwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
$internal = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
$adminPass = "Sulnet@" + (-join ((48..57) | Get-Random -Count 8 | ForEach-Object { [char]$_ }))

Write-Host "=== API variables ==="
npx @railway/cli variable set `
  "RAILWAY_DOCKERFILE_PATH=Dockerfile.api" `
  "DATABASE_URL=`${{Postgres.DATABASE_URL}}" `
  "JWT_SECRET=$jwt" `
  "INTERNAL_API_SECRET=$internal" `
  "ADMIN_EMAIL=admin@sulnet.com" `
  "ADMIN_PASSWORD=$adminPass" `
  "ADMIN_NAME=Administrador" `
  "API_HOST=0.0.0.0" `
  "PORT=3001" `
  --service api --environment $Env --skip-deploys

Write-Host "=== GT06 variables ==="
npx @railway/cli variable set `
  "RAILWAY_DOCKERFILE_PATH=Dockerfile.gt06" `
  "GT06_HOST=0.0.0.0" `
  "GT06_PORT=5023" `
  "API_INTERNAL_URL=http://api.railway.internal:3001" `
  "INTERNAL_API_SECRET=$internal" `
  --service gt06-ingest --environment $Env --skip-deploys

Write-Host "=== Gerar domínio API ==="
npx @railway/cli domain --service api --port 3001 --environment $Env

Write-Host "=== Deploy API ==="
npx @railway/cli up -s api -e $Env -d -y

Write-Host "=== Deploy GT06 ==="
npx @railway/cli up -s gt06-ingest -e $Env -d -y

Write-Host "=== TCP Proxy GT06 :5023 ==="
npx @railway/cli tcp-proxy create --port 5023 --service gt06-ingest --environment $Env

Write-Host ""
Write-Host "=== CREDENCIAIS ADMIN (salve agora) ==="
Write-Host "Email: admin@sulnet.com"
Write-Host "Senha: $adminPass"
Write-Host ""
Write-Host "Após obter URL da API, configure no serviço Frota (web):"
Write-Host '  NEXT_PUBLIC_API_URL=https://SUA-API.up.railway.app'
Write-Host "  railway variable set NEXT_PUBLIC_API_URL=... --service Frota"
Write-Host "  railway up -s Frota -d -y"
