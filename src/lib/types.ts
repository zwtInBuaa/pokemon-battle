// Shared type definitions for the Pokémon battle app.

export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type Stats = Record<StatKey, number>;

export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度',
};

export const STAT_SHORT: Record<StatKey, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

// A single Pokémon configuration (team builder / battle set).
export interface PokemonSet {
  name: string;          // nickname (empty = use species name)
  species: string;       // species display name, e.g. "Charizard"
  level: number;
  gender: 'M' | 'F' | '';
  shiny: boolean;
  ability: string;       // ability display name
  item: string;          // item display name
  nature: string;        // nature display name
  moves: string[];       // move IDs
  evs: Stats;
  ivs: Stats;
  teraType: string;      // Tera type name
  happiness: number;
  gigantamax?: boolean;  // Gigantamax factor (gen8)
}

export type GameType = 'singles' | 'doubles';

export interface BattleFormat {
  id: string;
  name: string;
  gameType: GameType;
  gen: number;
  random?: boolean;      // uses random team generator
  teamPreview?: boolean;
  pickedTeamSize?: number;
  description: string;
  mechanic?: string;     // showcase mechanic label (太晶化/极巨化/超级进化/Z招式)
}

// ---- Battle rendering state (parsed from the sim protocol) ----

export type SideID = 'p1' | 'p2';

export interface ActivePokemon {
  ident: string;         // e.g. "p1a: Charizard"
  slot: string;          // e.g. "p1a"
  side: SideID;
  position: number;      // 0 = a, 1 = b
  speciesId: string;
  speciesName: string;
  details: string;
  level: number;
  gender: string;
  shiny: boolean;
  hp: number;
  maxhp: number;
  hpPercent: number;     // for foe (percentage mode)
  exactHP: boolean;
  status: string;        // brn/par/slp/psn/frz/tox or ''
  fainted: boolean;
  boosts: Partial<Record<StatKey | 'accuracy' | 'evasion', number>>;
  item: string;
  ability: string;
  terastallized: string;
  types: string[];
  volatiles: string[];   // active volatile statuses / effects
  lastMove: string;
  mega: boolean;         // mega evolved this battle
  dynamax: boolean;      // currently dynamaxed
  gigantamax: boolean;   // currently gigantamax
}

export interface SideState {
  id: SideID;
  name: string;
  total: number;         // team size
  pokemon: SidePokemon[];
  hazards: Record<string, number>;  // stealthrock/spikes layer/etc
  screens: Record<string, number>;  // reflect/lightscreen/auroraveil turns
  conditions: string[];
}

export interface SidePokemon {
  ident: string;
  speciesId: string;
  speciesName: string;
  details: string;
  level: number;
  gender: string;
  shiny: boolean;
  hp: number;
  maxhp: number;
  hpPercent: number;
  exactHP: boolean;
  status: string;
  fainted: boolean;
  active: boolean;
  item: string;
  ability: string;
  moves: string[];
  teraType: string;
}

export interface FieldState {
  weather: string;
  weatherTurns: number;
  terrain: string;
  terrainTurns: number;
  pseudoWeather: string[];
}

export interface BattleState {
  started: boolean;
  ended: boolean;
  winner: string | null;
  gameType: GameType;
  gen: number;
  formatName: string;
  turn: number;
  active: Record<string, ActivePokemon>;  // keyed by slot "p1a"
  sides: Record<SideID, SideState>;
  field: FieldState;
  log: LogLine[];
  lastEvent: BattleEvent | null;
}

export interface LogLine {
  turn: number;
  text: string;
  kind: 'info' | 'move' | 'damage' | 'heal' | 'status' | 'faint' | 'switch' | 'boost' | 'weather' | 'ability' | 'win' | 'misc';
}

// A transient event used to drive animations.
export interface BattleEvent {
  type: string;
  slot?: string;
  target?: string;
  move?: string;
  amount?: number;
  crit?: boolean;
  effectiveness?: number;  // 2 super, 0.5 resist, 0 immune
  id: number;
}

// The request JSON sent to the human player (subset we care about).
export interface MoveRequest {
  move: string;
  id: string;
  pp: number;
  maxpp: number;
  target: string;
  disabled?: boolean;
}

export interface ActiveRequest {
  moves: MoveRequest[];
  canTerastallize?: string;
  canMegaEvo?: boolean;
  canUltraBurst?: boolean;
  canDynamax?: boolean;
  canGigantamax?: string;
  canZMove?: ({ move: string; target: string } | null)[];
  maxMoves?: MaxMovesRequest;
  trapped?: boolean;
}

export interface MaxMoveRequest { move: string; target: string; }
export interface MaxMovesRequest { maxMoves: MaxMoveRequest[]; gigantamax?: string; }

export interface SideRequestPokemon {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
  stats: Stats;
  moves: string[];
  baseAbility: string;
  ability: string;
  item: string;
  teraType: string;
  terastallized: string;
  commanding?: boolean;
  reviving?: boolean;
}

export interface PlayerRequest {
  wait?: boolean;
  teamPreview?: boolean;
  maxChosenTeamSize?: number;
  forceSwitch?: boolean[];
  active?: ActiveRequest[];
  side: {
    name: string;
    id: SideID;
    pokemon: SideRequestPokemon[];
  };
  noCancel?: boolean;
}