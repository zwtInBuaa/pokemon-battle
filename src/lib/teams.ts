import { Teams as SimTeams, TeamValidator, Dex } from '@pkmn/sim';
import { TeamGenerators } from '@pkmn/randoms';
import { Sets } from '@pkmn/sets';
import { dex, getSpecies, learnableMoves, speciesAbilities, emptyStats, MAX_EV_SINGLE, MAX_EV_TOTAL } from './dex';
import { moveNameZh } from './names';
import type { PokemonSet, BattleFormat, Stats } from './types';
import { STAT_KEYS } from './types';

// Register the random team generator factory (required by sim.Teams.generate).
SimTeams.setGeneratorFactory(TeamGenerators);

export const FORMATS: BattleFormat[] = [
  { id: 'gen9randombattle', name: '随机单打', gameType: 'singles', gen: 9, random: true, mechanic: '太晶化', description: '6v6 单打，双方随机队伍，含太晶化' },
  { id: 'gen9randomdoublesbattle', name: '随机双打', gameType: 'doubles', gen: 9, random: true, mechanic: '太晶化', description: '6v6 双打，双方随机队伍' },
  { id: 'gen8randombattle', name: '随机·极巨化', gameType: 'singles', gen: 8, random: true, mechanic: '极巨化', description: '6v6 单打，随机队伍，可极巨化 / 超极巨化' },
  { id: 'gen7randombattle', name: '随机·超级进化/Z', gameType: 'singles', gen: 7, random: true, mechanic: '超级进化·Z招式', description: '6v6 单打，随机队伍，含超级进化与 Z 招式' },
  { id: 'gen9customgame', name: '自定义单打', gameType: 'singles', gen: 9, teamPreview: true, mechanic: '太晶化', description: '使用你的队伍对战 AI，无限制规则，含太晶化' },
  { id: 'gen9doublescustomgame', name: '自定义双打', gameType: 'doubles', gen: 9, teamPreview: true, mechanic: '太晶化', description: '使用你的队伍进行双打对战' },
  { id: 'gen8customgame', name: '极巨化·单打', gameType: 'singles', gen: 8, teamPreview: true, mechanic: '极巨化', description: '使用你的队伍，可极巨化 / 超极巨化（建议加载「极巨化队」）' },
  { id: 'gen8doublescustomgame', name: '极巨化·双打', gameType: 'doubles', gen: 8, teamPreview: true, mechanic: '极巨化', description: '极巨化双打对战（建议加载「极巨化队」）' },
  { id: 'gen7customgame', name: '超级进化/Z·单打', gameType: 'singles', gen: 7, teamPreview: true, mechanic: '超级进化·Z招式', description: '使用你的队伍，可超级进化与 Z 招式（建议加载「超级进化/Z队」）' },
  { id: 'gen9ou', name: 'OU 单打', gameType: 'singles', gen: 9, teamPreview: true, mechanic: '太晶化', description: '标准 OU 规则，含队伍预览与条款' },
  { id: 'gen9vgc2025regi', name: 'VGC 双打', gameType: 'doubles', gen: 9, teamPreview: true, pickedTeamSize: 4, mechanic: '太晶化', description: 'VGC 规则，6 选 4 双打，含队伍预览' },
];

export function getFormat(id: string): BattleFormat {
  return FORMATS.find(f => f.id === id) || FORMATS[0];
}

// Create a sensible default set for a species.
export function createDefaultSet(speciesName: string, level = 50): PokemonSet {
  const s = getSpecies(speciesName);
  const abilities = speciesAbilities(s);
  const moves = learnableMoves(s);
  // Prefer attacking moves of the species' types, then coverage.
  const stab = moves.filter(m => s.types.includes(m.type) && m.category !== 'Status');
  const other = moves.filter(m => !stab.includes(m));
  const picked = [...stab, ...other].slice(0, 4).map(m => m.id);
  while (picked.length < 4 && moves.length) {
    const m = moves[picked.length % moves.length];
    if (!picked.includes(m.id)) picked.push(m.id);
    else break;
  }
  const nature = s.baseStats.spa >= s.baseStats.atk ? 'Modest' : 'Adamant';
  return {
    name: '',
    species: s.name,
    level,
    gender: '',
    shiny: false,
    ability: abilities[0]?.name || '',
    item: '',
    nature,
    moves: picked.slice(0, 4),
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: emptyStats(31),
    teraType: s.types[0] || 'Normal',
    happiness: 255,
  };
}

// Generate a random team for a random-battle format.
export function randomTeam(formatId: string): PokemonSet[] {
  const raw = SimTeams.generate(formatId);
  return raw.map(normalizeSimSet);
}

// Convert a sim-generated set into our PokemonSet shape.
function normalizeSimSet(set: any): PokemonSet {
  const s = getSpecies(set.species);
  return {
    name: set.name || '',
    species: s.name,
    level: set.level || 50,
    gender: set.gender || '',
    shiny: !!set.shiny,
    ability: set.ability || speciesAbilities(s)[0]?.name || '',
    item: set.item || '',
    nature: set.nature || 'Hardy',
    moves: (set.moves || []).map((m: string) => dex.moves.get(m).id),
    evs: { ...emptyStats(0), ...(set.evs || {}) },
    ivs: { ...emptyStats(31), ...(set.ivs || {}) },
    teraType: set.teraType || s.types[0] || 'Normal',
    happiness: set.happiness ?? 255,
    gigantamax: !!set.gigantamax,
  };
}

// Pack our sets into the packed string the simulator expects.
export function packTeam(sets: PokemonSet[]): string {
  const simSets = sets.map(set => ({
    name: set.name || '',
    species: set.species,
    item: set.item,
    ability: set.ability,
    moves: set.moves.map(id => dex.moves.get(id).name),
    nature: set.nature,
    evs: set.evs,
    ivs: set.ivs,
    level: set.level,
    gender: set.gender,
    shiny: set.shiny,
    happiness: set.happiness,
    teraType: set.teraType,
    gigantamax: set.gigantamax,
  }));
  return SimTeams.pack(simSets as any);
}

// ---- Import / Export (Showdown text format) ----
export function exportSet(set: PokemonSet): string {
  const simSet = {
    name: set.name, species: set.species, item: set.item, ability: set.ability,
    moves: set.moves.map(id => dex.moves.get(id).name),
    nature: set.nature, evs: set.evs, ivs: set.ivs, level: set.level,
    gender: set.gender, shiny: set.shiny, happiness: set.happiness, teraType: set.teraType,
  };
  return Sets.exportSet(simSet as any);
}

export function exportTeam(sets: PokemonSet[]): string {
  return sets.map(exportSet).join('\n\n');
}

export function importSet(text: string): PokemonSet | null {
  try {
    const raw = Sets.importSet(text);
    if (!raw || !raw.species) return null;
    return normalizeSimSet(raw);
  } catch {
    return null;
  }
}

export function importTeam(text: string): PokemonSet[] {
  // Split on blank lines separating sets.
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const out: PokemonSet[] = [];
  for (const b of blocks) {
    const s = importSet(b);
    if (s) out.push(s);
  }
  return out.slice(0, 6);
}

// ---- Validation ----
export function validateTeam(sets: PokemonSet[], formatId: string): string[] {
  const validator = new TeamValidator(formatId);
  const problems = validator.validateTeam(sets.map(set => ({
    name: set.name, species: set.species, item: set.item, ability: set.ability,
    moves: set.moves.map(id => dex.moves.get(id).name),
    nature: set.nature, evs: set.evs, ivs: set.ivs, level: set.level,
    gender: set.gender, shiny: set.shiny, happiness: set.happiness, teraType: set.teraType,
  })) as any);
  return problems || [];
}

// Clamp EVs to legal limits, returning a corrected copy.
export function clampEVs(evs: Stats): Stats {
  const out = { ...evs };
  let total = 0;
  for (const k of STAT_KEYS) {
    out[k] = Math.max(0, Math.min(MAX_EV_SINGLE, Math.round(out[k])));
    total += out[k];
  }
  // Reduce from the last stats if over the total cap.
  if (total > MAX_EV_TOTAL) {
    let excess = total - MAX_EV_TOTAL;
    for (let i = STAT_KEYS.length - 1; i >= 0 && excess > 0; i--) {
      const k = STAT_KEYS[i];
      const take = Math.min(out[k], excess);
      out[k] -= take;
      excess -= take;
    }
  }
  return out;
}

// A legal preset team used by the AI in constructed formats (OU).
export const PRESET_OU_TEAM: PokemonSet[] = [
  preset('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Knock Off', 'Rapid Spin'], 'Jolly', { hp: 252, atk: 4, def: 0, spa: 0, spd: 0, spe: 252 }, 'Ground'),
  preset('Gholdengo', 'Air Balloon', 'Good as Gold', ['Make It Rain', 'Shadow Ball', 'Recover', 'Nasty Plot'], 'Modest', { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 }, 'Steel'),
  preset('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Dragon'),
  preset('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, 'Dark'),
  preset('Garganacl', 'Leftovers', 'Purifying Salt', ['Salt Cure', 'Recover', 'Stealth Rock', 'Protect'], 'Careful', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, 'Rock'),
  preset('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Aura Sphere', 'Psyshock', 'Calm Mind'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Fairy'),
].map(s => ({ ...s, level: 100 }));

export const PRESET_VGC_TEAM: PokemonSet[] = [
  preset('Flutter Mane', 'Booster Energy', 'Protosynthesis', ['Moonblast', 'Shadow Ball', 'Dazzling Gleam', 'Protect'], 'Timid', { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 }, 'Fairy'),
  preset('Iron Hands', 'Assault Vest', 'Quark Drive', ['Drain Punch', 'Wild Charge', 'Ice Punch', 'Fake Out'], 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, 'Fighting'),
  preset('Amoonguss', 'Rocky Helmet', 'Regenerator', ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect'], 'Bold', { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 }, 'Grass'),
  preset('Urshifu-Rapid-Strike', 'Choice Scarf', 'Unseen Fist', ['Surging Strikes', 'Close Combat', 'U-turn', 'Aqua Jet'], 'Jolly', { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 }, 'Water'),
  preset('Landorus-Therian', 'Leftovers', 'Intimidate', ['Earth Power', 'U-turn', 'Stealth Rock', 'Taunt'], 'Timid', { hp: 252, atk: 0, def: 4, spa: 0, spd: 0, spe: 252 }, 'Ground'),
  preset('Heatran', 'Air Balloon', 'Flash Fire', ['Magma Storm', 'Flash Cannon', 'Earth Power', 'Protect'], 'Modest', { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 }, 'Fire'),
];

function preset(species: string, item: string, ability: string, moves: string[], nature: string, evs: Stats, tera: string, gigantamax = false): PokemonSet {
  return {
    name: '', species, level: 50, gender: '', shiny: false, ability, item, nature,
    moves: moves.map(m => dex.moves.get(m).id),
    evs, ivs: emptyStats(31), teraType: tera, happiness: 255, gigantamax,
  };
}

// Gen7 showcase team: Mega Evolution + Z-Moves (level 100).
export const PRESET_MEGA_Z_TEAM: PokemonSet[] = [
  preset('Charizard', 'Charizardite X', 'Blaze', ['Flare Blitz', 'Dragon Claw', 'Roost', 'Swords Dance'], 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 0, spe: 4 }, 'Fire'),
  preset('Alakazam', 'Alakazite', 'Magic Guard', ['Psychic', 'Shadow Ball', 'Focus Blast', 'Recover'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Psychic'),
  preset('Garchomp', 'Garchompite', 'Rough Skin', ['Earthquake', 'Outrage', 'Fire Fang', 'Swords Dance'], 'Jolly', { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 }, 'Ground'),
  preset('Pikachu', 'Electrium Z', 'Static', ['Thunderbolt', 'Quick Attack', 'Surf', 'Grass Knot'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Electric'),
  preset('Snorlax', 'Snorlium Z', 'Thick Fat', ['Giga Impact', 'Body Slam', 'Crunch', 'Rest'], 'Careful', { hp: 252, atk: 4, def: 0, spa: 0, spd: 252, spe: 0 }, 'Normal'),
  preset('Tapu Koko', 'Electrium Z', 'Electric Surge', ['Thunderbolt', 'Dazzling Gleam', 'U-turn', 'Roost'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Electric'),
].map(s => ({ ...s, level: 100 }));

// Gen8 showcase team: Dynamax / Gigantamax (level 50).
export const PRESET_DYNAMAX_TEAM: PokemonSet[] = [
  preset('Charizard', 'Heavy-Duty Boots', 'Blaze', ['Flamethrower', 'Air Slash', 'Roost', 'Will-O-Wisp'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Fire', true),
  preset('Gengar', 'Life Orb', 'Cursed Body', ['Shadow Ball', 'Sludge Bomb', 'Thunderbolt', 'Focus Blast'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Ghost', true),
  preset('Lapras', 'Light Clay', 'Water Absorb', ['Ice Beam', 'Thunderbolt', 'Hydro Pump', 'Freeze-Dry'], 'Modest', { hp: 252, atk: 0, def: 0, spa: 252, spd: 4, spe: 0 }, 'Ice', true),
  preset('Cinderace', 'Heavy-Duty Boots', 'Libero', ['Pyro Ball', 'High Jump Kick', 'U-turn', 'Sucker Punch'], 'Jolly', { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 }, 'Fire', true),
  preset('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'], 'Timid', { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 }, 'Dragon'),
  preset('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'Defog', 'U-turn'], 'Impish', { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 }, 'Flying'),
];

export function presetTeam(formatId: string): PokemonSet[] {
  if (formatId === 'gen9vgc2025regi') return PRESET_VGC_TEAM.map(s => ({ ...s }));
  if (formatId === 'gen7customgame') return PRESET_MEGA_Z_TEAM.map(s => ({ ...s }));
  if (formatId.startsWith('gen8')) return PRESET_DYNAMAX_TEAM.map(s => ({ ...s }));
  return PRESET_OU_TEAM.map(s => ({ ...s }));
}

// Move display helper.
export function moveLabel(id: string): string {
  return moveNameZh(id);
}