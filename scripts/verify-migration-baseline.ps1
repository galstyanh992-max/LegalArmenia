$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$activePath = Join-Path $root 'supabase\migrations'
$legacyPath = Join-Path $root 'supabase\migrations_legacy'
$baselineManifest = Join-Path $root 'supabase\baseline\BASELINE_MANIFEST.md'
$legacyManifest = Join-Path $legacyPath 'LEGACY_MIGRATION_MANIFEST.md'

$active = @(Get-ChildItem -LiteralPath $activePath -File -Filter '*.sql' | Sort-Object Name)
$legacy = @(Get-ChildItem -LiteralPath $legacyPath -File -Filter '*.sql' | Sort-Object Name)
$failures = [System.Collections.Generic.List[string]]::new()

if ($active.Count -ne 5) { $failures.Add("active migration count is $($active.Count), expected 5") }
if ($legacy.Count -ne 237) { $failures.Add("legacy SQL count is $($legacy.Count), expected 237") }
if (-not (Test-Path -LiteralPath $baselineManifest)) { $failures.Add('baseline manifest missing') }
if (-not (Test-Path -LiteralPath $legacyManifest)) { $failures.Add('legacy manifest missing') }

$versions = @($active | ForEach-Object { if ($_.Name -match '^(\d{14})_') { $Matches[1] } else { '' } })
if ($versions -contains '') { $failures.Add('active migration filename without 14-digit version') }
$duplicates = @($versions | Group-Object | Where-Object Count -gt 1)
if ($duplicates.Count -gt 0) { $failures.Add('duplicate active migration version') }
if ($active[0].Name -notlike '*_versioned_baseline_20260712.sql') { $failures.Add('baseline is not first in active order') }

$baselineSql = Get-Content -Raw -LiteralPath $active[0].FullName
$expectedCounts = @{
  'create table' = 68
  'create type' = 5
  'create view' = 7
  'create policy' = 192
}
foreach ($entry in $expectedCounts.GetEnumerator()) {
  $actual = [regex]::Matches(
    $baselineSql,
    "(?im)^$([regex]::Escape($entry.Key))\s+"
  ).Count
  if ($actual -ne $entry.Value) {
    $failures.Add("baseline $($entry.Key) count is $actual, expected $($entry.Value)")
  }
}

$sectionOrder = @(
  '-- Required extensions',
  '-- Application schemas',
  '-- Application enum types',
  '-- Tables and RLS enablement',
  '-- Functions',
  '-- Constraints',
  '-- Non-constraint indexes',
  '-- Compatibility views',
  '-- Triggers',
  '-- Row-level security policies',
  '-- Storage bucket definitions',
  '-- Explicit privilege baseline'
)
$previous = -1
foreach ($section in $sectionOrder) {
  $position = $baselineSql.IndexOf($section, [System.StringComparison]::Ordinal)
  if ($position -lt 0 -or $position -le $previous) {
    $failures.Add("baseline section missing or out of order: $section")
  }
  $previous = $position
}

$legacyManifestRows = @(
  Get-Content -LiteralPath $legacyManifest |
    Where-Object { $_ -match '^\| `\d{14}_.+\.sql` \|' }
)
if ($legacyManifestRows.Count -ne 237) {
  $failures.Add("legacy manifest SQL rows is $($legacyManifestRows.Count), expected 237")
}

$baselineManifestText = Get-Content -Raw -LiteralPath $baselineManifest
foreach ($migration in $active) {
  if ($baselineManifestText -notmatch [regex]::Escape($migration.Name)) {
    $failures.Add("active migration absent from baseline manifest: $($migration.Name)")
  }
}

$secretPatterns = @(
  'sk-[A-Za-z0-9_-]{20,}',
  'sb_secret_[A-Za-z0-9_-]{10,}',
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}',
  'postgres(?:ql)?://[^\s]+:[^\s@]+@'
)
foreach ($file in $active) {
  $content = Get-Content -Raw -LiteralPath $file.FullName
  foreach ($pattern in $secretPatterns) {
    if ($content -match $pattern) {
      $failures.Add("secret indicator in active migration: $($file.Name)")
      break
    }
  }

  $tags = [regex]::Matches($content, '\$[A-Za-z_][A-Za-z0-9_]*\$')
  foreach ($group in ($tags.Value | Group-Object)) {
    if (($group.Count % 2) -ne 0) {
      $failures.Add("unbalanced dollar tag in $($file.Name): $($group.Name)")
    }
  }
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Output "PASS active_migrations=$($active.Count) legacy_sql=$($legacy.Count) duplicate_versions=0 secret_indicators=0"
