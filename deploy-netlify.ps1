param(
  [string]$SiteId,
  [string]$SupabaseUrl,
  [string]$SupabaseServiceRoleKey,
  [string]$JwtSecret,
  [switch]$Prod
)

$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "No se encontró '$Name'. Instala Netlify CLI: npm i -g netlify-cli"
  }
}

Require-Command 'netlify'

Write-Host "== Netlify Deploy (OBLEAS) ==" -ForegroundColor Cyan

# 1) Login (si hace falta)
try {
  netlify status | Out-Null
} catch {
  Write-Host "Iniciando login de Netlify..." -ForegroundColor Yellow
  netlify login
}

# 2) Link del sitio
if ($SiteId) {
  Write-Host "Vinculando SiteId: $SiteId" -ForegroundColor Yellow
  netlify link --id $SiteId
} else {
  Write-Host "Vincula el sitio (te mostrará lista o pedirá ID)..." -ForegroundColor Yellow
  netlify link
}

# 3) Variables de entorno
Write-Host "Configurando variables de entorno..." -ForegroundColor Yellow

if ($SupabaseUrl) {
  netlify env:set SUPABASE_URL $SupabaseUrl
} else {
  Write-Host "Pega tu SUPABASE_URL (Project URL)" -ForegroundColor DarkGray
  netlify env:set SUPABASE_URL
}

if ($SupabaseServiceRoleKey) {
  netlify env:set SUPABASE_SERVICE_ROLE_KEY $SupabaseServiceRoleKey
} else {
  Write-Host "Pega tu SUPABASE_SERVICE_ROLE_KEY (service_role key)" -ForegroundColor DarkGray
  netlify env:set SUPABASE_SERVICE_ROLE_KEY
}

if ($JwtSecret) {
  netlify env:set JWT_SECRET $JwtSecret
} else {
  # Generar una por defecto
  $generated = "obleas_" + ([guid]::NewGuid().ToString('N')) + "_" + ([guid]::NewGuid().ToString('N'))
  Write-Host "JWT_SECRET no proporcionada. Generando una automáticamente." -ForegroundColor DarkGray
  netlify env:set JWT_SECRET $generated
}

# 4) Deploy
if ($Prod) {
  Write-Host "Deploy a PRODUCCIÓN..." -ForegroundColor Green
  netlify deploy --prod
} else {
  Write-Host "Deploy PREVIEW (usa -Prod para producción)..." -ForegroundColor Green
  netlify deploy
}

Write-Host "Listo. Prueba: https://TU-DOMINIO/api/health" -ForegroundColor Cyan
