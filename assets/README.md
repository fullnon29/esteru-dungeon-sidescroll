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

## 적용 예
```js
portraits: { warrior: 'assets/portraits/warrior.png', '레온': 'assets/portraits/leon.png' },
sprites:   { slime: 'assets/sprites/slime.png' },
```
