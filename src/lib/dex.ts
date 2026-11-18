import { Dex } from '@pkmn/dex';
import type { Species, Move, Ability, Item } from '@pkmn/dex';
import { STAT_KEYS, type StatKey, type Stats } from './types';

export const dex = Dex;

// ---- Type metadata ----
export const TYPE_NAMES_ZH: Record<string, string> = {
  Normal: '一般', Fire: '火', Water: '水', Electric: '电', Grass: '草', Ice: '冰',
  Fighting: '格斗', Poison: '毒', Ground: '地面', Flying: '飞行', Psychic: '超能力',
  Bug: '虫', Rock: '岩石', Ghost: '幽灵', Dragon: '龙', Dark: '恶', Steel: '钢',
  Fairy: '妖精', Stellar: '星晶',
};

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#fac000',
  Grass: '#3fa129', Ice: '#3dcef3', Fighting: '#ff8000', Poison: '#9141cb',
  Ground: '#915121', Flying: '#81b9ef', Psychic: '#ef4179', Bug: '#91a119',
  Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1', Dark: '#50413f',
  Steel: '#60a1b8', Fairy: '#ef70ef', Stellar: '#40b5a5',
};

// The 18 standard types (exclude Stellar for the classic chart by default).
export const STANDARD_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
  'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

// damageTaken encoding: 0 = 1x, 1 = 2x, 2 = 0.5x, 3 = 0x
const DMG_MAP: Record<number, number> = { 0: 1, 1: 2, 2: 0.5, 3: 0 };

// Single attacking type vs single defending type.
export function typeEffectiveness(atk: string, def: string): number {
  const t = dex.types.get(def);
  if (!t.exists) return 1;
  const v = (t.damageTaken as Record<string, number>)[atk];
  return DMG_MAP[v ?? 0] ?? 1;
}

// Attacking type vs a defender's combined types.
export function multiplierVs(atk: string, defTypes: string[]): number {
  return defTypes.reduce((acc, d) => acc * typeEffectiveness(atk, d), 1);
}

// Full 18x18 attacking chart: chart[atk][def] = multiplier.
export function buildTypeChart(types: string[] = STANDARD_TYPES): Record<string, Record<string, number>> {
  const chart: Record<string, Record<string, number>> = {};
  for (const a of types) {
    chart[a] = {};
    for (const d of types) chart[a][d] = typeEffectiveness(a, d);
  }
  return chart;
}

// Defensive matchup for a Pokémon: incoming type -> multiplier.
export function defensiveMatchups(defTypes: string[], types: string[] = STANDARD_TYPES): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of types) out[a] = multiplierVs(a, defTypes);
  return out;
}

// ---- Natures ----
export interface NatureInfo { name: string; plus?: StatKey; minus?: StatKey; }
export function allNatures(): NatureInfo[] {
  return dex.natures.all().map(n => ({
    name: n.name,
    plus: n.plus as StatKey | undefined,
    minus: n.minus as StatKey | undefined,
  }));
}

export function natureMultiplier(natureName: string, stat: StatKey): number {
  const n = dex.natures.get(natureName);
  if (!n.exists || stat === 'hp') return 1;
  if (n.plus === stat) return 1.1;
  if (n.minus === stat) return 0.9;
  return 1;
}

// ---- Stat calculation ----
export function calcStat(
  species: Species, stat: StatKey, level: number, ev: number, iv: number, natureName: string,
): number {
  const base = species.baseStats[stat];
  if (stat === 'hp') {
    if (species.id === 'shedinja') return 1;
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  return Math.floor(raw * natureMultiplier(natureName, stat));
}

export function calcAllStats(species: Species, level: number, evs: Stats, ivs: Stats, nature: string): Stats {
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = calcStat(species, k, level, evs[k], ivs[k], nature);
  return out;
}

export function emptyStats(v = 0): Stats {
  return { hp: v, atk: v, def: v, spa: v, spd: v, spe: v };
}

export const MAX_EV_TOTAL = 510;
export const MAX_EV_SINGLE = 252;

export function evTotal(evs: Stats): number {
  return STAT_KEYS.reduce((a, k) => a + evs[k], 0);
}

// ---- Species helpers ----
export function getSpecies(nameOrId: string): Species {
  return dex.species.get(nameOrId);
}

// All base + form species, sorted by national dex number then name.
let _speciesCache: Species[] | null = null;
export function allSpecies(): Species[] {
  if (_speciesCache) return _speciesCache;
  _speciesCache = dex.species.all()
    .filter(s => s.exists && !s.isNonstandard)
    .sort((a, b) => (a.num ?? 9999) - (b.num ?? 9999) || a.name.localeCompare(b.name));
  return _speciesCache;
}

// Learnsets load asynchronously in @pkmn/dex; preload the whole table once so
// subsequent reads can be synchronous (the UI renders synchronously).
let _learnsetsReady = false;
export async function initLearnsets(): Promise<void> {
  if (_learnsetsReady) return;
  await dex.learnsets.get('bulbasaur');
  _learnsetsReady = true;
}
export function learnsetsReady(): boolean { return _learnsetsReady; }

// Learnable moves for a species (current gen learnset), returns Move[].
// Reads from the preloaded raw data table; forms fall back to their base species.
export function learnableMoves(species: Species): Move[] {
  const table = (dex as any).data?.Learnsets as Record<string, { learnset?: Record<string, unknown> }> | undefined;
  if (!table) return [];
  const baseId = species.baseSpecies ? getSpecies(species.baseSpecies).id : species.id;
  const entry = table[species.id] || table[baseId];
  if (!entry?.learnset) return [];
  const ids = Object.keys(entry.learnset);
  const moves = ids
    .map(id => dex.moves.get(id))
    .filter(m => m.exists && !m.isNonstandard && !m.isZ && !m.isMax);
  // dedupe by id
  const seen = new Set<string>();
  const out: Move[] = [];
  for (const m of moves) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function speciesAbilities(species: Species): Ability[] {
  const list = Object.values(species.abilities).filter(Boolean) as string[];
  return list.map(a => dex.abilities.get(a)).filter(a => a.exists);
}

export function getMove(id: string): Move { return dex.moves.get(id); }
export function getAbility(id: string): Ability { return dex.abilities.get(id); }
export function getItem(id: string): Item { return dex.items.get(id); }

// Items usable in battle (held items), sorted. Includes past-gen Mega Stones
// and Z-Crystals so mechanic teams can be built.
let _itemCache: Item[] | null = null;
export function heldItems(): Item[] {
  if (_itemCache) return _itemCache;
  _itemCache = dex.items.all()
    .filter(i => i.exists && i.gen >= 3 && (!i.isNonstandard || i.megaStone || i.zMove))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _itemCache;
}

// ---- Encyclopedia data helpers ----
let _moveCache: Move[] | null = null;
export function allMoves(): Move[] {
  if (_moveCache) return _moveCache;
  _moveCache = dex.moves.all()
    .filter(m => m.exists && !m.isNonstandard)
    .sort((a, b) => a.name.localeCompare(b.name));
  return _moveCache;
}

let _abilityCache: Ability[] | null = null;
export function allAbilities(): Ability[] {
  if (_abilityCache) return _abilityCache;
  _abilityCache = dex.abilities.all()
    .filter(a => a.exists && !a.isNonstandard)
    .sort((a, b) => a.name.localeCompare(b.name));
  return _abilityCache;
}

let _allItemCache: Item[] | null = null;
export function allItems(): Item[] {
  if (_allItemCache) return _allItemCache;
  _allItemCache = dex.items.all()
    .filter(i => i.exists && i.gen >= 2 && (!i.isNonstandard || i.megaStone || i.zMove))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _allItemCache;
}

// Regular (non-Z, non-Max) moves for the move encyclopedia tab.
let _regularMoveCache: Move[] | null = null;
export function regularMoves(): Move[] {
  if (_regularMoveCache) return _regularMoveCache;
  _regularMoveCache = dex.moves.all()
    .filter(m => m.exists && !m.isNonstandard && !m.isZ && !m.isMax)
    .sort((a, b) => a.name.localeCompare(b.name));
  return _regularMoveCache;
}

// The crystal item id a Z-Move requires (isZ holds the crystal id).
export function zMoveCrystal(move: Move): string {
  return typeof move.isZ === 'string' ? move.isZ : '';
}
// The G-Max species a Max Move belongs to (isMax holds species name or true).
export function gmaxSpecies(move: Move): string {
  return typeof move.isMax === 'string' ? move.isMax : '';
}
// Base move a signature Z-Move upgrades from.
export function zMoveBase(move: Move): string {
  return (move as any).zMoveFrom || '';
}

// Z-Moves (isZ holds the crystal id) and Max Moves (isMax holds the gmax species or true).
export function zMoves(): Move[] {
  return dex.moves.all().filter(m => m.exists && m.isZ).sort((a, b) => a.name.localeCompare(b.name));
}
export function maxMoves(): Move[] {
  return dex.moves.all().filter(m => m.exists && m.isMax).sort((a, b) => a.name.localeCompare(b.name));
}
export function megaStones(): Item[] {
  return dex.items.all().filter(i => i.exists && i.megaStone).sort((a, b) => a.name.localeCompare(b.name));
}
export function zCrystals(): Item[] {
  return dex.items.all().filter(i => i.exists && i.zMove).sort((a, b) => a.name.localeCompare(b.name));
}

// Classify an item into a Chinese category for the encyclopedia.
export function itemCategory(item: Item): string {
  if (item.megaStone) return '超级石';
  if (item.zMove) return 'Z纯晶';
  if (item.isBerry) return '树果';
  if (item.id === 'leftovers' || item.id === 'blacksludge' || item.id === 'shellbell') return '回复道具';
  if (item.id.startsWith('choice') || item.id === 'lifeorb' || item.id === 'expertbelt' || item.id === 'muscleband' || item.id === 'wiseglasses') return '攻击道具';
  if (item.id === 'eviolite' || item.id === 'assaultvest' || item.id === 'rockyhelmet' || item.id === 'airballoon') return '防御道具';
  if (item.id === 'heavydutyboots' || item.id === 'protectivepads' || item.id === 'utilityumbrella') return '功能道具';
  if (item.id.includes('plate') || item.id.includes('memory') || item.id.includes('drive')) return '属性道具';
  if (item.id === 'lightball' || item.id === 'thickclub' || item.id === 'metalpowder' || item.id === 'quickpowder') return '专属道具';
  return '其他道具';
}

export const CATEGORY_ZH: Record<string, string> = {
  Physical: '物理', Special: '特殊', Status: '变化',
};