# 횡스크롤 캐릭터 시트 제작 안내

게임(`side.js`)이 `assets/side/anim/{키}/{동작}_{방향}.png` 를 읽는다. 파일이 있으면 그 캐릭터는 전용 시트를 쓰고, 없으면 기사 시트(쿼터뷰용 3D 렌더)로 대체한다.
확인은 `tools/side_preview.html` 에 파일을 끌어다 놓으면 된다(발 위치·크기·프레임 수를 점검).

## 화풍 (사용자 확정)
별이 되어라 · 드래곤즈 크라운 · 브라운더스트 · 던전 앤 드래곤: 섀도 오브 미스트라 계열 — **진한 파스텔 톤, 굵은 외곽선, 손으로 칠한 듯한 2D**. 큼직한 무기와 손발, 과장된 실루엣.
특정 게임의 캐릭터·그림을 그대로 베끼지 말고 분위기만 참고한다(원작 에셋은 저장소에 넣지 않는 규칙).

## 규격
- **시점**: 순수한 **옆모습**, 캐릭터가 **오른쪽**을 본다. 왼쪽 시트는 만들지 않아도 된다(게임이 좌우 반전). 왼쪽을 따로 만들면 `{동작}_1.png`(오른쪽은 `_0.png`).
- **칸**: 정사각, 권장 **256×256**. 시트는 한 동작의 프레임을 **가로로 한 줄**로 이어 붙인 PNG(투명 배경). 칸 크기 = 시트 높이, 프레임 수 = 가로 길이 ÷ 높이(게임이 자동 계산).
- **발바닥 기준선**: 칸 높이의 **80%** 지점(256px 칸이면 위에서 205px). 서 있는 모든 프레임에서 발바닥이 이 선에 닿아야 한다(달리기에서 공중에 뜨는 프레임은 그만큼 위로).
- **가로 중심**: 몸의 중심(발 사이)이 칸 가로 중앙(128px)에 오게. 공격 때 앞으로 뻗는 무기·몸은 칸 안에서 자유(잘리지 않게 여유 20px 이상).
- **크기**: 캐릭터 키(머리~발)는 칸 높이의 **약 55~65%**(256px 칸에서 140~165px). 거한 같은 큰 적은 더 크게 그려도 된다.
- **프레임 수와 길이**: 프레임 수가 달라도 동작 길이에 맞춰 재생된다. 아래는 권장.

| 동작 파일 | 프레임 | 설명 |
|---|---|---|
| `idle_0.png` | 4~6 | 숨쉬는 대기. **이게 있어야 전용 시트로 인식된다** |
| `walk_0.png` | 6~8 | 걷기(오른쪽으로 전진). 한 바퀴가 칸 한 개 이동 |
| `atk_0.png` | 6~8 | 일반 공격. 타격 순간이 **약 절반 지점**(전체의 8/15 근처) |
| `hurt_0.png` | 2~3 | 피격 |
| `die_0.png` | 5~6 | 쓰러짐(마지막 프레임이 바닥에 누운 모습) |
| `heavy_0.png` | 8~10 | 오의(강한 일격). 없으면 atk 로 대체 |
| `sweep_0.png` `combo_0.png` `shoot_0.png` `cast_0.png` | 선택 | 오의 연출 동작. 없으면 heavy → atk → idle 순으로 대체 |

## 만드는 순서 (캐릭터 일관성이 가장 중요)
1. **기준 그림 1장**(오른쪽 옆모습, 전신, 서 있는 자세)을 먼저 확정한다. 이후 모든 프레임은 이 그림을 참조해 만든다.
2. 동작마다 **핵심 포즈**부터 정한다(걷기: 접촉·내려감·통과·올라감 4포즈, 공격: 준비·휘두름·타격·마무리).
3. AI 도구를 쓴다면 **같은 프롬프트와 같은 기준 그림**을 계속 넣고, 동작 설명만 바꾼다.
4. 프레임을 같은 크기 칸에 놓아 가로로 잇는다(`tools/asset_tool.html` "횡스크롤 전투" 프로필로 가공 가능).
5. `tools/side_preview.html` 에서 발이 80% 선에 닿는지, 흔들림이 없는지 확인한 뒤 `assets/side/anim/warrior/` 에 넣는다.

## 프롬프트 예시 (영문 권장, 도구에 맞게 고쳐 쓴다)
기준 그림:
> 2D hand-painted game character, a knight in heavy plate armor with a large shield and sword, strict side view facing right, full body, standing pose, thick dark-brown outlines, deep saturated pastel color palette, painterly cel shading with soft gradients, exaggerated heroic proportions (large hands, boots and weapon), clean silhouette, transparent background, no text

동작 덧붙이는 문장(위 기준 문구 뒤에):
- 걷기: `walking cycle, 8 frames, mid-stride poses: contact, down, passing, up, same character and outfit in every frame, feet on the same ground line`
- 공격: `sword slash animation, 7 frames: wind-up, swing, impact with extended arm, follow-through, same character in every frame`
- 피격: `hit reaction, 3 frames, recoiling backwards with head thrown back`
- 쓰러짐: `defeat animation, 6 frames, collapsing to the ground, last frame lying flat`

피할 것: 프레임마다 장비·색이 달라지는 것, 발 위치가 들쭉날쭉한 것, 배경이 불투명한 것, 칸 가장자리가 잘리는 것.

## 나머지 캐릭터 키
`warrior`(레온) `thief`(핀) `elf`(실비아) `priest`(루나) / 적 `grunt`(잡병) `archer`(궁수) `brute`(거한). 기사 한 명을 시범으로 만든 뒤 같은 방식으로 늘린다.

## 가공 스크립트 (AI 시트 → 전용 시트): `tools/slice_sheet.js`
Morphic 같은 도구가 **줄마다 동작이 늘어선 한 장짜리 시트(평평한 회색 배경)**를 주면 이 스크립트가 자동으로 자른다.
```
node tools/slice_sheet.js 입력.png 설정.json
```
- 하는 일: 배경색 제거(가장자리와 이어진 영역만 → 갑옷 속 회색은 보존, 경계는 디프린지), 발밑 가로선 제거, 줄별로 프레임 분리(발 위치 기준 + 연결된 덩어리 소속), **모든 프레임을 같은 배율로 256 칸에 놓고 줄의 지면선을 칸 높이 80%에 맞춤**, 동작별 가로 스트립 PNG 저장, idle 이 없으면 걷기 첫 프레임으로 숨쉬는 흉내를 만든다.
- 설정 예: `tools/slice_example_warrior.json` (줄 순서대로 `{act, n}`, 자동 분할이 어긋나면 `cuts`에 프레임 사이 경계 x 좌표를 직접 준다. 경계 후보는 `SLICE_DEBUG=1` 로 보거나 세로 투영의 골짜기에서 찾는다)
- 결과는 `tools/side_preview.html` 의 "불러오기"로 점검한다.
- 한계: 줄 수가 설정과 다르면 중단한다. 프레임이 서로 맞닿으면 `cuts` 가 필요할 수 있다. 시트가 정면에 가까운 3/4 시점이면 그 모습 그대로 들어간다.
- 설정 옵션 추가: 줄마다 `"cuts":"auto"`(프레임 사이 빈 틈을 찾아 자동 분할), `"act":"skip"`(그 줄은 쓰지 않음), 최상위 `"standRow"`(서 있는 키를 재는 기준 줄 번호), `"cell"`(칸 크기: 칼이 길게 뻗는 공격 시트는 384처럼 키울 수 있다 — 캐릭터 크기는 칸과 상관없이 targetH 로 일정하다). 여러 시트에서 동작을 골라 한 캐릭터로 조합할 때는 시트마다 설정을 두고 같은 `out` 폴더에 차례로 실행한다.

## 타격 프레임 메타 (`assets/side/anim/meta.js`)
`window.SIDE_META = { 키: { atk: { n: 프레임 수, hit: 타격 프레임 번호(0부터) } } }` — 일반 공격에서 **그 프레임이 화면에 나오는 순간** 피해가 들어간다(없으면 애니메이션의 약 53% 지점). 예: 레온 공격 시트는 7프레임 중 칼이 뻗는 6번째(번호 5).

