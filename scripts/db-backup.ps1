# ==============================================================================
# Smart Kirana - Daily PostgreSQL Database Backup Script (PowerShell)
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\db-backup.ps1
# ==============================================================================

param(
    [string]$BackupDir = ".\backups"
)

# Load DATABASE_URL from backend\.env if present
if (Test-Path "backend\.env") {
    Get-Content "backend\.env" | ForEach-Object {
        if ($_ -match "^\s*DATABASE_URL\s*=\s*`"?(.*?)`"?\s*$") {
            $env:DATABASE_URL = $matches[1]
        }
    }
}

if (-not $env:DATABASE_URL) {
    Write-Error "Error: DATABASE_URL is not set in environment or backend\.env."
    exit 1
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "kirana_backup_$timestamp.sql"

Write-Host "=========================================================="
Write-Host "Starting Smart Kirana PostgreSQL Backup: $timestamp"
Write-Host "Target File: $backupFile"
Write-Host "=========================================================="

try {
    & pg_dump $env:DATABASE_URL --no-owner --clean --if-exists -f $backupFile
    Write-Host "Backup completed successfully: $backupFile"
    
    # Delete backups older than 30 days
    $cutoff = (Get-Date).AddDays(-30)
    Get-ChildItem -Path $BackupDir -Filter "kirana_backup_*.sql" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
    Write-Host "Retention rotation complete."
} catch {
    Write-Error "pg_dump failed: $_"
    exit 1
}
