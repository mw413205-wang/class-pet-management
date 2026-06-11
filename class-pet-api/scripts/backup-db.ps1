param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups')
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv {
  $values = @{}
  $envFile = Join-Path $PSScriptRoot '..\.env'
  if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
      if ($line -match '^\s*([^#][^=]*)=(.*)$') {
        $values[$matches[1].Trim()] = $matches[2].Trim()
      }
    }
  }
  return $values
}

$config = Read-DotEnv
function Get-ConfigValue([string]$Name, [string]$Fallback) {
  $environmentValue = [Environment]::GetEnvironmentVariable($Name)
  if ($environmentValue) { return $environmentValue }
  if ($config[$Name]) { return $config[$Name] }
  return $Fallback
}

$hostName = Get-ConfigValue 'MYSQL_HOST' 'localhost'
$port = Get-ConfigValue 'MYSQL_PORT' '3306'
$user = Get-ConfigValue 'MYSQL_USER' 'root'
$database = Get-ConfigValue 'MYSQL_DATABASE' 'class_pet_management'
$password = Get-ConfigValue 'MYSQL_PASSWORD' ''
if ($database -notmatch '^[a-zA-Z0-9_]+$') {
  throw 'MYSQL_DATABASE can only contain letters, numbers, and underscores.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$absoluteOutputDirectory = (Resolve-Path $OutputDirectory).Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $absoluteOutputDirectory "$database-$timestamp.sql"

$previousPassword = $env:MYSQL_PWD
try {
  $env:MYSQL_PWD = $password
  & mysqldump --host=$hostName --port=$port --user=$user --single-transaction --routines --triggers --default-character-set=utf8mb4 --result-file=$backupFile $database
  if ($LASTEXITCODE -ne 0) {
    throw "mysqldump failed with exit code $LASTEXITCODE."
  }
} finally {
  $env:MYSQL_PWD = $previousPassword
}

Write-Host "Backup created: $backupFile"
