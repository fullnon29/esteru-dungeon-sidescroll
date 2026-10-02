# 에스테르의 미궁 (50층 자동 탐사 시뮬레이션)

바닐라 JS, 빌드 없음. 컴파일 「지오컨플릭트 3·4」를 참고한 3+4 하이브리드 웹게임.

## 실행/검증
- 로컬: `python -m http.server 8123` → http://localhost:8123 (`.claude/launch.json`의 `dungeon-game`)
- 밸런스 봇: `node sim_test.js` (클리어까지 약 43~63회가 정상 범위), `node tune.js` 계열(격자 튜닝), `node map_test.js` (맵 500층 유효성)
- 엑셀 목록 재생성: `node ref/dump_data.js` → `python ref/make_xlsx.py` (ref/ 는 이 저장소에 없음)

## 구조
- `core.js` 게임 로직(DOM 비의존, Node/브라우저 공용, `module.exports`/`window.Core`). `TUNE`으로 밸런스 조정.
- `render.js` 캔버스(쿼터뷰 미로·9×9 전투판, 고저차). `game.js` UI/입력/저장(localStorage, 세이브 v2).
- `assets.js` + `assets/manifest.js` 교체 가능한 아트(없으면 이모지/도형). 규격은 `assets/README.md`.

## 규칙
- 원작(컴파일) 에셋·추출 데이터는 게임/저장소에 포함하지 않는다 (수치·구조 "참고"만).
- 7z 비밀번호는 모르며 무차별 대입 금지. Geo4 TEST.exe 는 실행하지 않는다.
- 원작 참조(화면 연출 등)는 텍스트 자료가 아니라 영상으로 확인한다.
- 사정거리: 직업 기본 + 장비 보정(활 +3), 적은 특정 몹 외 3칸 이하.

## 진행 상황
- 완료: 50층, 5층마다 보스(계단 차단), 배회 정예, 조건부 특수 몹(미믹·원혼·도적단), 황금 몹, 고저차 0~3.
- 다음: `DEVNOTE.md` 의 Phase 1~4 (장비 등급/직업 제한/자동장비, 피로·식량·지형, 대장간·전직, 분대). 코멘트를 받아 확정 후 진행.
