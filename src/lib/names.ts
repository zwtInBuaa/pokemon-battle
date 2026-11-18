import zh from '../data/zh.json';
import { dex, getSpecies } from './dex';
import type { StatKey } from './types';

const speciesZh = zh.species as Record<string, string>;
const movesZh = zh.moves as Record<string, string>;
const abilitiesZh = zh.abilities as Record<string, string>;
const itemsZh = zh.items as Record<string, string>;

// Chinese name for a species (by display name or id). Forms fall back to base + form suffix.
export function speciesNameZh(nameOrId: string): string {
  const s = getSpecies(nameOrId);
  if (!s.exists) return nameOrId;
  const base = speciesZh[String(s.num)];
  if (!base) return s.name;
  // If this is a form, append a translated form hint when possible.
  if (s.forme && s.baseSpecies && s.forme !== '') {
    const formeZh = FORME_ZH[s.forme] || s.forme;
    return `${base}（${formeZh}）`;
  }
  return base;
}

const FORME_ZH: Record<string, string> = {
  Alola: '阿罗拉', Galar: '伽勒尔', Hisui: '洗翠', Paldea: '帕底亚',
  Mega: '超级', 'Mega-X': '超级X', 'Mega-Y': '超级Y', Primal: '原始',
  Origin: '起源', Altered: '别种', Sky: '天空', Land: '大地', Therian: '灵兽',
  Incarnate: '化身', Black: '暗黑', White: '焰白', Kyurem: '酋雷姆',
  Crowned: '苍响', Dusk: '黄昏', Dawn: '拂晓', Ultra: '究极',
  'Gmax': '超极巨', Gigantamax: '超极巨', 'Low-Key': '低调', 'Amped': '高调',
  'Rapid-Strike': '连击', 'Single-Strike': '一击', 'Ice': '冰雪', 'Shadow': '暗影',
  'Dusk-Mane': '黄昏之鬃', 'Dawn-Wings': '拂晓之翼', 'Bloodmoon': '血月',
  'Cornerstone': '础石', 'Wellspring': '水井', 'Hearthflame': '火灶', 'Teal': '碧草',
};

export function moveNameZh(idOrName: string): string {
  const m = dex.moves.get(idOrName);
  if (movesZh[m.id]) return movesZh[m.id];
  // Z-Moves are stored under legacy physical/special variant keys.
  if (m.isZ) {
    const v = movesZh[m.id + 'physical'] || movesZh[m.id + 'special'];
    if (v) return v;
  }
  return m.name || idOrName;
}

export function abilityNameZh(idOrName: string): string {
  const a = dex.abilities.get(idOrName);
  return abilitiesZh[a.id] || a.name || idOrName;
}

export function itemNameZh(idOrName: string): string {
  if (!idOrName) return '';
  const i = dex.items.get(idOrName);
  if (itemsZh[i.id]) return itemsZh[i.id];
  // Z-Crystals are stored under legacy "held" keys.
  if (i.zMove && itemsZh[i.id + 'held']) return itemsZh[i.id + 'held'];
  return i.name || idOrName;
}

// Nature Chinese names.
export const NATURE_ZH: Record<string, string> = {
  Hardy: '勤奋', Lonely: '怕寂寞', Brave: '勇敢', Adamant: '固执', Naughty: '顽皮',
  Bold: '大胆', Docile: '坦率', Relaxed: '悠闲', Impish: '淘气', Lax: '乐天',
  Timid: '胆小', Hasty: '急躁', Serious: '认真', Jolly: '爽朗', Naive: '天真',
  Modest: '内敛', Mild: '慢吞吞', Quiet: '冷静', Bashful: '害羞', Rash: '马虎',
  Calm: '温和', Gentle: '温顺', Sassy: '自大', Careful: '慎重', Quirky: '浮躁',
};

export function natureNameZh(name: string): string {
  return NATURE_ZH[name] || name;
}

export const STAT_ZH: Record<StatKey, string> = {
  hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度',
};

// Status condition Chinese names.
export const STATUS_ZH: Record<string, string> = {
  brn: '灼伤', par: '麻痹', slp: '睡眠', psn: '中毒', tox: '剧毒', frz: '冰冻',
};

export function statusNameZh(s: string): string {
  return STATUS_ZH[s] || s;
}

// Weather / terrain / common field conditions.
export const WEATHER_ZH: Record<string, string> = {
  RainDance: '下雨', PrimordialSea: '大雨', SunnyDay: '大晴天', DesolateLand: '大日照',
  Sandstorm: '沙暴', Hail: '冰雹', Snow: '下雪', DeltaStream: '德尔塔气流',
  Fog: '雾', HarshSunshine: '大日照', HeavyRain: '大雨', StrongWinds: '强风',
};
export const TERRAIN_ZH: Record<string, string> = {
  ElectricTerrain: '电气场地', GrassyTerrain: '青草场地', MistyTerrain: '薄雾场地', PsychicTerrain: '精神场地',
};
export function weatherNameZh(w: string): string { return WEATHER_ZH[w] || w; }
export function terrainNameZh(t: string): string { return TERRAIN_ZH[t] || t; }