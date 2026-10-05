// 전용 시트 메타: 캐릭터 키 → 동작 → { n: 프레임 수, hit: 타격(피해가 들어가는) 프레임 번호(0부터) }
// 게임은 일반 공격에서 이 프레임이 화면에 나오는 순간에 피해를 준다. 없으면 애니메이션의 53% 지점.
window.SIDE_META = Object.assign(window.SIDE_META || {}, {
  warrior: { atk: { n: 7, hit: 5 } },
});

// 임시 별칭: 전용 시트가 없는 캐릭터가 다른 캐릭터의 시트를 색만 바꿔 쓴다(화풍을 맞추기 위한 임시 조치).
// 키 → { key: 빌려 쓸 시트 키, filter: CSS 필터 }. 각자의 전용 시트(assets/side/anim/{키}/idle_0.png)가 생기면 그 줄을 지운다.
window.SIDE_ALIAS = Object.assign(window.SIDE_ALIAS || {}, {
  thief:  { key: 'warrior', filter: 'hue-rotate(205deg) saturate(1.15)' },
  elf:    { key: 'warrior', filter: 'hue-rotate(85deg) saturate(1.1)' },
  priest: { key: 'warrior', filter: 'hue-rotate(300deg) saturate(.9) brightness(1.15)' },
  grunt:  { key: 'warrior', filter: 'hue-rotate(-35deg) saturate(1.25) brightness(.95)' },
  archer: { key: 'warrior', filter: 'hue-rotate(120deg) saturate(.9)' },
  brute:  { key: 'warrior', filter: 'hue-rotate(250deg) saturate(.85) brightness(.85)' },
});
