# TRADECRAFT on Windows: serve the game and open the browser (play.cmd runs this).
#
#   play.cmd                   the play copy (.play\, a release) on :8100; made from the latest
#                              release the first time
#   play.cmd --dev             the working tree, as it is right now, on :8101
#   play.cmd --promote [vX.Y.Z]  move the play copy to a release (the latest when none is given),
#                              then play it
#   play.cmd --status          where the play copy is, and the latest release
#
# The same as play.sh and tools/promote.sh on a Mac: two copies on two ports, so the browser keeps
# the play copy's saves apart from the working tree's, and the play copy only moves when promoted.
# Needs Git and Python 3 (from python.org, or the Microsoft Store). Ctrl+C stops the server.
$ErrorActionPreference = 'Continue'                              # (native commands: their exit codes are checked)
$Root = Split-Path -Parent $PSScriptRoot
$Play = Join-Path $Root '.play'
$mode = 'play'; $ref = $null
for ($i = 0; $i -lt $args.Count; $i++) {
  switch ($args[$i]) {
    '--dev' { $mode = 'dev' }
    '--status' { $mode = 'status' }
    '--promote' { $mode = 'promote'; if ($i + 1 -lt $args.Count -and $args[$i + 1] -notlike '--*') { $ref = $args[$i + 1]; $i++ } }
    default { Write-Host "Unknown option: $($args[$i])"; exit 1 }
  }
}

function RunGit { & git -C $Root @args; if ($LASTEXITCODE) { Write-Host "git $args failed"; exit 1 } }
function Latest { (& git -C $Root -c versionsort.suffix=-rc tag -l 'v*' --sort=-v:refname | Select-Object -First 1) }
function Current {
  if (-not (Test-Path (Join-Path $Play '.git'))) { return 'none' }
  $t = & git -C $Play describe --tags --exact-match 2>$null
  if ($LASTEXITCODE) { $t = & git -C $Play rev-parse --short HEAD }
  return $t
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host 'Git is needed (https://git-scm.com).'; exit 1 }
& git -C $Root fetch --tags --quiet 2>$null                      # (the releases, if there's a remote to ask)

if ($mode -eq 'status') {
  Write-Host "play copy: $(Current)"
  Write-Host "latest release: $(Latest)"
  exit 0
}

# The play copy: made on first play, moved on --promote.
if ($mode -eq 'promote' -or ($mode -eq 'play' -and -not (Test-Path (Join-Path $Play '.git')))) {
  if (-not $ref) { $ref = Latest }
  if (-not $ref) { Write-Host 'No release tags yet.'; exit 1 }
  if (Test-Path (Join-Path $Play '.git')) {
    if (& git -C $Play status --porcelain) { Write-Host 'The play copy has local changes; it should never have any. Look before promoting.'; exit 1 }
    & git -C $Play checkout --quiet --detach $ref
    if ($LASTEXITCODE) { Write-Host "No such release: $ref"; exit 1 }
  } else {
    RunGit worktree add --quiet --detach $Play $ref
  }
  Write-Host "play copy: $ref"
  $mode = 'play'
}

if ($mode -eq 'dev') { $Serve = $Root; $Port = 8101; $What = 'working tree' } else { $Serve = $Play; $Port = 8100; $What = 'play copy' }
$Version = (Get-Content (Join-Path $Serve 'VERSION') -ErrorAction SilentlyContinue | Select-Object -First 1)

# Python: the launcher (python.org installs it), or python on the PATH.
$pyExe = $null; $pyArgs = @()
foreach ($cand in 'py -3', 'python', 'python3') {
  $parts = $cand -split ' '
  if (-not (Get-Command $parts[0] -ErrorAction SilentlyContinue)) { continue }
  $rest = @($parts | Select-Object -Skip 1)
  & $parts[0] @rest --version *> $null
  if ($LASTEXITCODE -eq 0) { $pyExe = $parts[0]; $pyArgs = $rest; break }
}
if (-not $pyExe) { Write-Host 'Python 3 is needed (https://www.python.org: tick "Add python.exe to PATH" when installing).'; exit 1 }

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "Port $Port is taken by something else (an earlier server still running? Close its window, or end it in Task Manager)."
  exit 1
}

# (one string, the paths quoted: Windows PowerShell joins an argument list without quoting, and a
# folder with a space in it would split)
$argLine = (@($pyArgs) + @("`"$(Join-Path $Root 'tools\serve.py')`"", $Port, "`"$Serve`"")) -join ' '
$server = Start-Process -FilePath $pyExe -ArgumentList $argLine -NoNewWindow -PassThru
Write-Host "TRADECRAFT v$Version ($What) on http://localhost:$Port  (Ctrl+C to stop)"
Start-Sleep -Milliseconds 700
Start-Process "http://localhost:$Port"
try { Wait-Process -Id $server.Id }
finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
  Write-Host 'Server stopped.'
}
