// 오의(필살기) 연출 데이터 — 스킬 id 를 키로 한다. 편집: tools/cine_tool.html (규격은 cine.js 머리 주석). 같은 이름은 덮어쓰고 나머지는 유지한다
window.CINE_MANIFEST = Object.assign(window.CINE_MANIFEST || {}, /*DATA*/{
 "kenki": {
  "name": "검기 난무",
  "dur": 1.55,
  "hit": 0.6,
  "steps": [
   {
    "t": 0,
    "type": "dim",
    "to": 0.55,
    "dur": 0.2
   },
   {
    "t": 0,
    "type": "banner",
    "text": "{skill}",
    "dur": 1.1,
    "pos": "top"
   },
   {
    "t": 0,
    "type": "zoom",
    "to": 1.2,
    "dur": 0.5,
    "focus": "caster"
   },
   {
    "t": 0.25,
    "type": "anim",
    "act": "sweep",
    "dur": 0.45
   },
   {
    "t": 0.3,
    "type": "fx",
    "name": "slash",
    "at": "caster",
    "oy": -40
   },
   {
    "t": 0.45,
    "type": "fx",
    "name": "slash",
    "at": "caster",
    "oy": -40,
    "scale": 1.5
   },
   {
    "t": 0.55,
    "type": "fx",
    "name": "shockwave",
    "at": "caster"
   },
   {
    "t": 0.6,
    "type": "flash",
    "alpha": 0.3,
    "dur": 0.15,
    "color": "#ffffff"
   },
   {
    "t": 0.6,
    "type": "shake",
    "amp": 9,
    "dur": 0.35
   },
   {
    "t": 0.6,
    "type": "freeze",
    "dur": 0.1
   },
   {
    "t": 0.95,
    "type": "zoom",
    "to": 1,
    "dur": 0.5,
    "focus": "caster"
   },
   {
    "t": 0.95,
    "type": "dim",
    "to": 0,
    "dur": 0.3
   }
  ]
 },
 "sacred": {
  "name": "성스러운 일격",
  "dur": 1.6,
  "hit": 0.7,
  "steps": [
   {
    "t": 0,
    "type": "dim",
    "to": 0.5,
    "dur": 0.2
   },
   {
    "t": 0,
    "type": "banner",
    "text": "{skill}",
    "dur": 1.2,
    "pos": "top"
   },
   {
    "t": 0,
    "type": "zoom",
    "to": 1.2,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 0.1,
    "type": "fx",
    "name": "buff",
    "at": "caster"
   },
   {
    "t": 0.35,
    "type": "anim",
    "act": "heavy",
    "dur": 0.4
   },
   {
    "t": 0.5,
    "type": "fx",
    "name": "lightning",
    "at": "target"
   },
   {
    "t": 0.6,
    "type": "fx",
    "name": "buff",
    "at": "target",
    "scale": 1.3
   },
   {
    "t": 0.7,
    "type": "flash",
    "alpha": 0.42,
    "dur": 0.2,
    "color": "#fff3b0"
   },
   {
    "t": 0.7,
    "type": "shake",
    "amp": 8,
    "dur": 0.3
   },
   {
    "t": 0.7,
    "type": "freeze",
    "dur": 0.12
   },
   {
    "t": 1.0,
    "type": "zoom",
    "to": 1,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 1.0,
    "type": "dim",
    "to": 0,
    "dur": 0.3
   }
  ]
 },
 "renkan": {
  "name": "연환권",
  "dur": 1.6,
  "hit": 0.7,
  "steps": [
   {
    "t": 0,
    "type": "dim",
    "to": 0.4,
    "dur": 0.2
   },
   {
    "t": 0,
    "type": "banner",
    "text": "{skill}",
    "dur": 1.0,
    "pos": "top"
   },
   {
    "t": 0,
    "type": "zoom",
    "to": 1.2,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 0.2,
    "type": "anim",
    "act": "combo",
    "dur": 0.6
   },
   {
    "t": 0.25,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "ox": -18,
    "oy": -40
   },
   {
    "t": 0.4,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "ox": 16,
    "oy": -40
   },
   {
    "t": 0.55,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "ox": -10,
    "oy": -40
   },
   {
    "t": 0.7,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "ox": 0,
    "oy": -40
   },
   {
    "t": 0.25,
    "type": "shake",
    "amp": 4,
    "dur": 0.12
   },
   {
    "t": 0.4,
    "type": "shake",
    "amp": 4,
    "dur": 0.12
   },
   {
    "t": 0.55,
    "type": "shake",
    "amp": 4,
    "dur": 0.12
   },
   {
    "t": 0.7,
    "type": "shake",
    "amp": 9,
    "dur": 0.3
   },
   {
    "t": 0.72,
    "type": "flash",
    "alpha": 0.36,
    "dur": 0.18,
    "color": "#ffffff"
   },
   {
    "t": 0.7,
    "type": "freeze",
    "dur": 0.08
   },
   {
    "t": 1.0,
    "type": "zoom",
    "to": 1,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 1.0,
    "type": "dim",
    "to": 0,
    "dur": 0.3
   }
  ]
 },
 "pierce": {
  "name": "관통 사격",
  "dur": 1.5,
  "hit": 0.5,
  "steps": [
   {
    "t": 0,
    "type": "dim",
    "to": 0.45,
    "dur": 0.2
   },
   {
    "t": 0,
    "type": "banner",
    "text": "{skill}",
    "dur": 1.0,
    "pos": "top"
   },
   {
    "t": 0,
    "type": "zoom",
    "to": 1.2,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 0.2,
    "type": "anim",
    "act": "shoot",
    "dur": 0.35
   },
   {
    "t": 0.45,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "scale": 1.4,
    "oy": -40
   },
   {
    "t": 0.5,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "ox": -30,
    "oy": -40
   },
   {
    "t": 0.55,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "ox": 30,
    "oy": -40
   },
   {
    "t": 0.5,
    "type": "flash",
    "alpha": 0.3,
    "dur": 0.15,
    "color": "#ffffff"
   },
   {
    "t": 0.5,
    "type": "shake",
    "amp": 7,
    "dur": 0.3
   },
   {
    "t": 0.5,
    "type": "freeze",
    "dur": 0.1
   },
   {
    "t": 0.9,
    "type": "zoom",
    "to": 1,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 0.9,
    "type": "dim",
    "to": 0,
    "dur": 0.3
   }
  ]
 },
 "meteor": {
  "name": "메테오",
  "dur": 2.0,
  "hit": 1.0,
  "steps": [
   {
    "t": 0,
    "type": "dim",
    "to": 0.65,
    "dur": 0.3
   },
   {
    "t": 0,
    "type": "banner",
    "text": "{skill}",
    "dur": 1.2,
    "pos": "top"
   },
   {
    "t": 0,
    "type": "zoom",
    "to": 1.15,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 0.6,
    "type": "fx",
    "name": "fire",
    "at": "target",
    "scale": 2,
    "oy": -60
   },
   {
    "t": 0.75,
    "type": "fx",
    "name": "fire",
    "at": "target",
    "ox": -40,
    "scale": 1.4,
    "oy": -50
   },
   {
    "t": 0.9,
    "type": "timescale",
    "to": 0.4,
    "dur": 0.1
   },
   {
    "t": 0.95,
    "type": "fx",
    "name": "shockwave",
    "at": "target",
    "scale": 1.6
   },
   {
    "t": 0.95,
    "type": "fx",
    "name": "fire",
    "at": "target",
    "scale": 1.8,
    "oy": -40
   },
   {
    "t": 1.0,
    "type": "flash",
    "alpha": 0.48,
    "dur": 0.25,
    "color": "#ffd9a0"
   },
   {
    "t": 1.0,
    "type": "shake",
    "amp": 14,
    "dur": 0.5
   },
   {
    "t": 1.0,
    "type": "freeze",
    "dur": 0.14
   },
   {
    "t": 1.15,
    "type": "timescale",
    "to": 1,
    "dur": 0.2
   },
   {
    "t": 1.4,
    "type": "zoom",
    "to": 1,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 1.4,
    "type": "dim",
    "to": 0,
    "dur": 0.3
   }
  ]
 },
 "sanctuary": {
  "name": "성역",
  "dur": 1.7,
  "hit": 0.6,
  "steps": [
   {
    "t": 0,
    "type": "dim",
    "to": 0.4,
    "dur": 0.2
   },
   {
    "t": 0,
    "type": "banner",
    "text": "{skill}",
    "dur": 1.2,
    "pos": "top"
   },
   {
    "t": 0,
    "type": "zoom",
    "to": 1.15,
    "dur": 0.5,
    "focus": "caster"
   },
   {
    "t": 0.2,
    "type": "fx",
    "name": "buff",
    "at": "caster",
    "scale": 1.6
   },
   {
    "t": 0.5,
    "type": "fx",
    "name": "heal",
    "at": "caster",
    "scale": 1.4
   },
   {
    "t": 0.6,
    "type": "fx",
    "name": "heal",
    "at": "caster",
    "ox": -30
   },
   {
    "t": 0.55,
    "type": "flash",
    "alpha": 0.24,
    "dur": 0.3,
    "color": "#d6ffe0"
   },
   {
    "t": 1.1,
    "type": "zoom",
    "to": 1,
    "dur": 0.5,
    "focus": "caster"
   },
   {
    "t": 1.1,
    "type": "dim",
    "to": 0,
    "dur": 0.3
   }
  ]
 },
 "assassinate": {
  "name": "암살",
  "dur": 1.8,
  "hit": 0.8,
  "steps": [
   {
    "t": 0,
    "type": "dim",
    "to": 0.75,
    "dur": 0.15
   },
   {
    "t": 0,
    "type": "banner",
    "text": "{skill}",
    "dur": 1.2,
    "pos": "top"
   },
   {
    "t": 0,
    "type": "zoom",
    "to": 1.3,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 0.3,
    "type": "timescale",
    "to": 0.35,
    "dur": 0.15
   },
   {
    "t": 0.5,
    "type": "anim",
    "act": "heavy",
    "dur": 0.3
   },
   {
    "t": 0.65,
    "type": "fx",
    "name": "slash",
    "at": "target",
    "scale": 1.5,
    "oy": -40
   },
   {
    "t": 0.8,
    "type": "fx",
    "name": "hit",
    "at": "target",
    "scale": 1.4,
    "oy": -40
   },
   {
    "t": 0.8,
    "type": "timescale",
    "to": 1,
    "dur": 0.1
   },
   {
    "t": 0.8,
    "type": "flash",
    "alpha": 0.5,
    "dur": 0.2,
    "color": "#ffffff"
   },
   {
    "t": 0.8,
    "type": "shake",
    "amp": 12,
    "dur": 0.4
   },
   {
    "t": 0.8,
    "type": "freeze",
    "dur": 0.15
   },
   {
    "t": 1.2,
    "type": "zoom",
    "to": 1,
    "dur": 0.5,
    "focus": "mid"
   },
   {
    "t": 1.2,
    "type": "dim",
    "to": 0,
    "dur": 0.3
   }
  ]
 }
}/*END*/);
