# Requiere token de cuenta: https://supabase.com/dashboard/account/tokens
# Uso: $env:SUPABASE_ACCESS_TOKEN = "..." ; .\scripts\push-magic-link-email-template.ps1
$ErrorActionPreference = "Stop"
$ProjectRef = "hegtvsuscaaifqqhbbxq"
$Token = $env:SUPABASE_ACCESS_TOKEN
if (-not $Token) {
  Write-Error "Define SUPABASE_ACCESS_TOKEN (token de Supabase Cloud, no la anon key)."
}
$Root = Split-Path $PSScriptRoot -Parent
$HtmlPath = Join-Path $Root "supabase\templates\magic_link.html"
if (-not (Test-Path $HtmlPath)) {
  Write-Error "No se encuentra $HtmlPath"
}
$Content = [System.IO.File]::ReadAllText($HtmlPath, [System.Text.Encoding]::UTF8)
$BodyObj = @{
  mailer_subjects_magic_link            = "Tu codigo de acceso - Inventario patrimonial"
  mailer_templates_magic_link_content   = $Content
}
$Body = $BodyObj | ConvertTo-Json -Depth 5 -Compress
$Uri = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"
Invoke-RestMethod -Uri $Uri -Method Patch -Headers @{
  Authorization = "Bearer $Token"
} -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($Body)) | Out-Null
Write-Host "Plantilla Magic link actualizada en el proyecto $ProjectRef."
