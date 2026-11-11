# Run by Kona when it starts the terminal's PowerShell (after the user's own profile). It does two things:
# the prompt becomes a short ">" and, before each prompt, the shell tells Kona how the last command ended, where it is, and what Git says
# about that folder. The tell is one private escape sequence (number 7777) holding base64 of a small JSON text.
$global:KonaGit = [bool](Get-Command git -ErrorAction SilentlyContinue)
function global:prompt {
  $ok = $?
  $code = 0
  if (-not $ok) { $code = 1; if ($global:LASTEXITCODE) { $code = $global:LASTEXITCODE } }
  $global:LASTEXITCODE = 0
  $cwd = (Get-Location).Path
  $branch = ''
  $dirty = $false
  if ($global:KonaGit) {
    $branch = "$(git branch --show-current 2>$null)"
    if ($branch) { $dirty = [bool](git status --porcelain 2>$null | Select-Object -First 1) }
  }
  $json = ConvertTo-Json -Compress -InputObject @{ code = $code; cwd = $cwd; branch = $branch; dirty = $dirty }
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  $esc = [char]27
  [Console]::Write("$esc]7777;$b64$([char]7)")
  $global:LASTEXITCODE = 0
  "`r`n$esc[90m>$esc[0m "
}
