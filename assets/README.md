# 디자인 에셋 규격

에셋을 이 폴더(`assets/`)에 넣고 `assets/manifest.js`에 경로를 적으면 게임이 자동으로 사용합니다.
비워 두거나 파일이 없으면 기존 이모지/도형 표현으로 대체되므로 **일부만 먼저 넣어도 됩니다.**
(게임 안 `⚙ 설정 → 에셋 상태`에서 로딩 결과를 확인할 수 있습니다.)

## 공통
- 형식: PNG(투명 배경 권장), WebP 가능
- 해상도: 표시 크기의 2배 권장 (고해상도 화면 대응)
- 원작(컴파일) 에셋은 사용하지 않는 것을 권장합니다 (권리 문제 방지)

## 목록

| 그룹 | 키 | 권장 크기 | 설명 |
|---|---|---|---|
| portraits | warrior, knight, monk, elf, mage, priest, thief | 256×256 | 용병 초상화(편성·HUD). 이름별(`레온` 등)로 지정하면 직업별보다 우선 |
| sprites | 직업 7종 + 적 17종 + boss10/20/30/40/50 | 128×128 | 전투 스프라이트. 발 위치가 이미지 하단 중앙 |
| tiles | wall, floor_room, floor_corridor, door, lock, stairs_down, stairs_up | 폭 64px | 미궁 쿼터뷰 타일(2:1 마름모). 바닥 중심 기준 하단 정렬 |
| objects | chest, chest_big, chest_open, trap, spring, monster_mark, boss_mark | 64×64 | 미궁 오브젝트 |
| backgrounds | maze, arena, camp | 1800×1040 | 배경 |
| ui | logo | 높이 40px | 헤더 로고 |

## 적 id 목록
slime(슬라임), goblin(고블린), gobarch(고블린 궁수), bat(큰박쥐), skel(스켈레톤), ghost(유령), spider(독거미), orc(오크), golem(골렘), shaman(오크 주술사), vamp(뱀파이어), demon(악마), wyvern(와이번), succ(서큐버스), dragon(드래곤), dknight(흑기사), lich(리치)

황금 이벤트 몹: ggob(황금 고블린), gbat(황금 박쥐)

보스: boss10(다크 엘프 군주), boss20(지하의 히드라), boss30(리치 왕), boss40(마룡 라프닐), boss50(흑왕)

## 애니메이션 (선택)
- 용병은 정지 이미지 대신 가로 스트립 애니메이션을 쓸 수 있다. `manifest.js` 의 `anims.<용병 이름 또는 직업>` = `{ size, foot, fps:{동작}, path:'assets/anim/이름/{act}_{dir}.png' }`. 방향 `{dir}` 0~7(시계 방향: 0=E 1=SE 2=정면 3=SW 4=W 5=NW 6=뒷모습 7=NE)을 모두 갖춘다. 이동 중이면 가는 쪽, 공격·시전이면 대상 쪽을 바라본다.
- 동작: `idle`(대기) `walk`(이동) `atk`(기본 공격) `cast`(스킬·시전) `hurt`(피격) `die`(사망). 스트립은 프레임 15장을 가로로 이어 붙인 PNG(프레임 128×128, 그림자 없음). `foot` 은 칸 안 발 위치(y). 선언이 없거나 못 불러오면 정지 이미지/이모지로 대체된다.
- 전투판(캠프 포함)·주점·미로 행렬에서 재생된다. 쓰러진 대원은 `die` 를 재생한 뒤 사라진다.
- **변환 도구(권장): `tools/anim_tool.html`** — 서버를 켠 뒤 `http://localhost:8123/tools/anim_tool.html` 을 크롬/엣지로 연다. ①원본 폴더(캐릭터 여러 개가 든 상위 폴더도 가능) ②게임의 `assets` 폴더를 고르고, 방향 확인 칸에서 방향별 행을 맞추면(프로필로 저장되어 다음 캐릭터에도 적용) 선택한 캐릭터를 한꺼번에 내보낸다. 결과는 `assets/anim/<이름>/` PNG 와 `assets/anim/anims.js`(manifest 항목, 자동 생성·병합)이며 `index.html` 이 `anims.js` 를 불러온다. 이름은 직업(`knight`)·용병 이름·몬스터 id(`goblin`)·보스(`boss10`)이고, 동작별 프레임 수는 `n` 으로 기록된다. 몬스터·보스도 같은 방식으로 애니메이션이 적용된다.
- 도구 없이 쓰려면 SmallScaleInt 계열 시트(1920×1024, 15열×8행)를 `powershell -File tools\extract_anim.ps1 -Src <시트 폴더> -Name <이름> -Dirs 0,1,2,3,4,5,6,7 -Out <assets\anim\이름 절대경로>` 로 변환한다(방향 = 시트 행 번호, 출력의 `foot` 값을 manifest 에 적는다).
- 현재 기사(knight)만 적용되어 있다. 라이선스상 원본 시트·재배포는 금지이므로 저장소를 공개할 때는 `assets/anim` 을 빼거나 라이선스를 다시 확인할 것.

## 적용 예
```js
portraits: { warrior: 'assets/portraits/warrior.png', '레온': 'assets/portraits/leon.png' },
sprites:   { slime: 'assets/sprites/slime.png' },
```

### 장비 외형(시트 이름 규칙)
- 시트 이름 `직업@무기-갑옷` (예 `knight@sword-plate`). 무기: `sword great spear bow staff mace dagger fist cook`, 갑옷: `cloth leather mail plate mythic`.
- 조회 순서: 이름 → 직업 → 기본 직업 각각에서 `@무기-갑옷` → `@무기` → `@갑옷` → 기본(`knight`). `mythic` 은 없으면 `plate`. 없는 조합은 자동으로 다음 후보로 대체되므로 일부만 만들어도 된다.

- 매니페스트 `cell`(시트 칸 크기, 기본 128): 64px 시트는 `cell: 64` 로 두면 게임이 도트 그대로 `size` 크기로 확대해 그린다. 변환 도구의 `확대` 옵션으로 미리 2배로 키워 128 규격에 맞출 수도 있다(픽셀 그대로 / Scale2x).
