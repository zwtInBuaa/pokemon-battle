import { getSpecies } from './dex';

const SD = 'https://play.pokemonshowdown.com/sprites';
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// Showdown sprite id for a species (handles a few special cases).
export function spriteId(nameOrId: string): string {
  const s = getSpecies(nameOrId);
  let id = s.id || String(nameOrId).toLowerCase().replace(/[^a-z0-9]/g, '');
  // Showdown uses specific ids for some formes.
  const special: Record<string, string> = {
    meowsticf: 'meowsticf', indeedeef: 'indeedeef', basculegionf: 'basculegionf',
    oinkolognef: 'oinkolognef', giratinaorigin: 'giratinaorigin',
  };
  return special[id] || id;
}

// Animated front sprite (battle, foe side).
export function frontSprite(nameOrId: string, shiny = false): string {
  const id = spriteId(nameOrId);
  return `${SD}/${shiny ? 'gen5ani-shiny' : 'gen5ani'}/${id}.gif`;
}

// Animated back sprite (battle, player side).
export function backSprite(nameOrId: string, shiny = false): string {
  const id = spriteId(nameOrId);
  return `${SD}/${shiny ? 'gen5ani-back-shiny' : 'gen5ani-back'}/${id}.gif`;
}

// Static fallbacks for when animated sprites are unavailable.
export function staticSprite(nameOrId: string, shiny = false): string {
  const id = spriteId(nameOrId);
  return `${SD}/${shiny ? 'gen5-shiny' : 'gen5'}/${id}.png`;
}

// High-quality official artwork (team builder / pokédex), by national dex number.
export function artwork(nameOrId: string, shiny = false): string {
  const s = getSpecies(nameOrId);
  const num = s.num > 0 ? s.num : 0;
  if (!num) return staticSprite(nameOrId, shiny);
  return `${POKEAPI}/other/official-artwork/${shiny ? 'shiny/' : ''}${num}.png`;
}

// Small icon sprite (team list / switch menu).
export function iconSprite(nameOrId: string): string {
  const id = spriteId(nameOrId);
  return `${SD}/gen5/${id}.png`;
}

// Ordered fallback chain for an <img> onError handler.
export function battleSpriteChain(nameOrId: string, back: boolean, shiny: boolean): string[] {
  const primary = back ? backSprite(nameOrId, shiny) : frontSprite(nameOrId, shiny);
  return [primary, staticSprite(nameOrId, shiny), artwork(nameOrId, shiny)];
}