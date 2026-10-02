/* 디자인 에셋 매니페스트
 * 에셋 파일을 올린 뒤 아래 경로를 채우면 게임이 자동으로 이미지를 사용합니다.
 * 값이 비어 있거나 파일을 못 찾으면 기존 이모지/도형 표현으로 대체됩니다 (게임은 항상 동작).
 * 상세 규격은 assets/README.md 참고.
 */
window.ASSET_MANIFEST = {
  // 용병 초상화 — 직업별(기본) 또는 용병 이름별(우선). 권장 256x256 PNG(투명 배경)
  portraits: {
    warrior: '', knight: '', monk: '', elf: '', mage: '', priest: '', thief: '',
    // 이름별 예: '레온': 'assets/portraits/leon.png'
  },
  // 전투 스프라이트 — 용병(직업별/이름별), 적(적 id), 보스(boss10~boss50). 권장 128x128 PNG, 발 중앙 기준
  sprites: {
    warrior: '', knight: '', monk: '', elf: '', mage: '', priest: '', thief: '',
    slime: '', goblin: '', gobarch: '', bat: '', skel: '', ghost: '', spider: '', orc: '', golem: '',
    shaman: '', vamp: '', demon: '', wyvern: '', succ: '', dragon: '', dknight: '', lich: '',
    ggob: '', gbat: '',   // 황금 고블린 / 황금 박쥐 (이벤트 몹)
    boss10: '', boss20: '', boss30: '', boss40: '', boss50: '',
  },
  // 미궁 타일 (쿼터뷰 2:1 마름모). 권장 폭 64px, 높이는 자유(바닥 중심 기준 하단 정렬)
  tiles: {
    wall: '', floor_room: '', floor_corridor: '', door: '', lock: '', stairs_down: '', stairs_up: '',
  },
  // 미궁 오브젝트 아이콘. 권장 64x64 PNG
  objects: {
    chest: '', chest_big: '', chest_open: '', trap: '', spring: '', monster_mark: '', boss_mark: '',
  },
  // 배경 이미지. 권장 1800x1040 (화면은 900x520 기준, 2x)
  backgrounds: {
    maze: '',       // 탐사 중 미궁 뒤 풍경
    arena: '',      // 전투 무대
    camp: '',       // 캠프/편성
  },
  // UI 요소
  ui: {
    logo: '',       // 헤더 로고 (높이 40px 권장)
  },
};
