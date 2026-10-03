# SmallScaleInt 계열 8방향 스프라이트 시트(1920x1024, 128px 칸 15열x8행)에서 동작별 가로 스트립을 뽑는다.
#   powershell -File tools\extract_anim.ps1 -Src "<With shadows 폴더>" -Name knight -Dirs 6,1
# 결과: assets/anim/<Name>/<동작>_<방향>.png (프레임 15장 x 128px 가로 스트립, 그림자 제거)
# 방향 번호는 시트의 행 번호(0~7). 그림자는 반투명(알파<255)이라 알파가 255 미만인 픽셀을 지운다.
# 마지막 줄의 foot 값(칸 안 발 위치 y)은 manifest 의 anims.<이름>.foot 에 넣는다.
param([string]$Src, [string]$Name = 'knight', [string]$Dirs = '6,1', [string]$Out)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging;
public static class StripCut {
  // 시트(sheet)의 row 행에서 15프레임을 잘라 그림자(알파<255)를 지운 가로 스트립 PNG로 저장. 반환: 맨 아래 불투명 픽셀 y(첫 프레임 기준)
  public static int Cut(string sheet, int row, string dst) {
    using (var b = new Bitmap(sheet)) {
      int W = 128 * 15; var o = new Bitmap(W, 128, PixelFormat.Format32bppArgb); int foot = 0;
      var rs = new Rectangle(0, row * 128, W, 128); var sd = b.LockBits(rs, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var od = o.LockBits(new Rectangle(0, 0, W, 128), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      var src = new byte[sd.Stride * 128]; System.Runtime.InteropServices.Marshal.Copy(sd.Scan0, src, 0, src.Length);
      var dstB = new byte[od.Stride * 128];
      for (int y = 0; y < 128; y++) for (int x = 0; x < W; x++) {
        int i = y * sd.Stride + x * 4, j = y * od.Stride + x * 4;
        if (src[i + 3] == 255) { dstB[j] = src[i]; dstB[j + 1] = src[i + 1]; dstB[j + 2] = src[i + 2]; dstB[j + 3] = 255; if (x < 128 && y > foot) foot = y; }
      }
      System.Runtime.InteropServices.Marshal.Copy(dstB, 0, od.Scan0, dstB.Length);
      b.UnlockBits(sd); o.UnlockBits(od); o.Save(dst, ImageFormat.Png); o.Dispose(); return foot;
    }
  }
}
'@ -ReferencedAssemblies System.Drawing
$rows = [int[]]($Dirs -split '[,\s]+')   # powershell -File 로 실행하면 6,1 이 "6 1" 문자열로 오므로 쉼표·공백으로 쪼갠다
if (-not $Out) { $Out = Join-Path (Split-Path $PSScriptRoot -Parent) "assets\anim\$Name" }
New-Item -ItemType Directory -Force $Out | Out-Null
$sheets = [ordered]@{ idle = 'Idle'; walk = 'Walk'; atk = 'Melee'; cast = 'CastSpell'; hurt = 'TakeDamage'; die = 'Die' }
$foot = 0
foreach ($k in $sheets.Keys) { foreach ($row in $rows) {
  $f = [StripCut]::Cut((Join-Path $Src ($sheets[$k] + '.png')), $row, (Join-Path $Out "${k}_$row.png"))
  if ($k -eq 'idle' -and $row -eq $rows[0]) { $foot = $f }
} }
"foot=$foot  out=$Out"
