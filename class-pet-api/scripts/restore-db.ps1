param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
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
$absoluteBackupFile = (Resolve-Path $BackupFile).Path

$previousPassword = $env:MYSQL_PWD
try {
  $env:MYSQL_PWD = $password
  $process = Start-Process -FilePath mysql -ArgumentList @(
    "--host=$hostName",
    "--port=$port",
    "--user=$user",
    '--default-character-set=utf8mb4',
    $database
  ) -RedirectStandardInput $absoluteBackupFile -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "mysql restore failed with exit code $($process.ExitCode)."
  }
} finally {
  $env:MYSQL_PWD = $previousPassword
}

Write-Host "Database restored from: $absoluteBackupFile"
