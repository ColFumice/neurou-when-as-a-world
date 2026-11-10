# 临时 R3.5 立体 Demo 素材生成器。
# 生成 left.mp4 / right.mp4：白方块、左 440Hz、右 660Hz。
# 真正的 media_import_stereo 由 Stereo3DDemoScreen 的 “Import stereo” 按钮触发。
param(
  [string]$Ffmpeg = "ffmpeg"
)

$ErrorActionPreference = "Stop"

$v4 = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$demo = Join-Path $v4 ".stereo-demo"
$source = Join-Path $demo "source"
$project = Join-Path $demo "project"
New-Item -ItemType Directory -Force -Path $source, $project | Out-Null

function New-LayerVideo {
  param(
    [string]$Path,
    [int]$Frequency,
    [string]$Color,
    [string]$Filter
  )
  & $Ffmpeg `
    -nostdin -hide_banner -loglevel error `
    -f lavfi -i "color=c=${Color}:s=1280x720:r=24:d=8" `
    -f lavfi -i "sine=frequency=${Frequency}:duration=8" `
    -vf $Filter `
    -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p `
    -c:a aac -b:a 192k -shortest -movflags +faststart -y $Path
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed for $Path"
  }
}

# left = 背景层（网格/地平线），right = 前景层（黑底白方块）。
$backgroundFilter = @(
  "drawgrid=w=120:h=120:t=2:c=0x2a5c6c@0.65"
  "drawbox=x=0:y=500:w=1280:h=3:color=0x4f8fa8@0.8:t=fill"
  "drawbox=x=80:y=120:w=220:h=5:color=0x2f6c80@0.8:t=fill"
  "drawbox=x=980:y=200:w=180:h=5:color=0x2f6c80@0.8:t=fill"
) -join ","
$foregroundFilter = "drawbox=x=420:y=280:w=160:h=160:color=white:t=fill"

New-LayerVideo -Path (Join-Path $source "left.mp4") -Frequency 440 -Color "0x07131c" -Filter $backgroundFilter
New-LayerVideo -Path (Join-Path $source "right.mp4") -Frequency 660 -Color "black" -Filter $foregroundFilter

Write-Host "Stereo demo source ready:"
Write-Host "  left  = $(Join-Path $source 'left.mp4')"
Write-Host "  right = $(Join-Path $source 'right.mp4')"
Write-Host "  project root = $project"
Write-Host "Open the app, click 'Stereo3D Demo', then 'Import layers'."
