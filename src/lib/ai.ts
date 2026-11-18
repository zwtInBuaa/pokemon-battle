import { RandomPlayerAI } from '@pkmn/sim';
import { dex, typeEffectiveness } from './dex';

export interface FoeInfo {
  types: string[];
  def: number;
  spd: number;
  hpFraction: number;
  lastMoveType?: string;
}

// A heuristic AI: scores moves by expected damage and picks the best (with a
// little randomness so it isn't perfectly predictable). Falls back to the
// base random behaviour for switching / team preview.
export class SmartAI extends RandomPlayerAI {
  private getFoes: () => FoeInfo[];
  private aggression: number;

  constructor(getFoes: () => FoeInfo[], aggression = 0.85) {
    // We override receiveRequest for the active branch to manage mechanics
    // ourselves (the base class can Dynamax both doubles slots, which is illegal).
    super({ write() {} } as any, { mega: 1 });
    this.getFoes = getFoes;
    this.aggression = aggression;
  }

  receiveRequest(request: any) {
    if (!request || request.wait) return;
    if (request.forceSwitch || request.teamPreview || !request.active) {
      super.receiveRequest(request);
      return;
    }
    const pokemon = request.side.pokemon;
    const doubles = request.active.length > 1;
    const chosen: number[] = [];
    let dynamaxUsed = false;   // only one Dynamax per turn (doubles rule)
    let zUsed = false;         // only one Z-Move per turn
    let megaUsed = false;      // only one Mega Evolution per turn
    let teraUsed = false;      // only one Terastallize per turn
    const choices = request.active.map((active: any, i: number) => {
      const p = pokemon[i];
      if (p.condition.endsWith(' fnt') || p.commanding) return 'pass';

      const canDynamax = !!active.canDynamax && !dynamaxUsed;
      const canMega = !!active.canMegaEvo && !megaUsed;
      const canTera = !!active.canTerastallize && !teraUsed;
      const canZ = !zUsed && !!active.canZMove && active.canZMove.some((z: any) => z);
      // Decide whether to Dynamax this slot (prefer it; it lasts 3 turns).
      const willDynamax = canDynamax && Math.random() < 0.9;
      const useMax = willDynamax || (!active.canDynamax && !!active.maxMoves);

      const source = useMax ? active.maxMoves.maxMoves : active.moves;
      let options = source
        .map((m: any, j: number) => ({ slot: j + 1, move: m.move, target: m.target, disabled: m.disabled, zMove: false }))
        .filter((m: any) => !m.disabled);
      if (!useMax && canZ) {
        active.canZMove.forEach((z: any, j: number) => {
          if (z) options.push({ slot: j + 1, move: z.move, target: z.target, disabled: false, zMove: true });
        });
      }
      const hasAlly = pokemon.length > 1 && pokemon[i ^ 1] && !pokemon[i ^ 1].condition.endsWith(' fnt');
      const filtered = options.filter((m: any) => m.target !== 'adjacentAlly' || hasAlly);
      if (filtered.length) options = filtered;

      // Switching option.
      const canSwitch = [1, 2, 3, 4, 5, 6].filter(j => pokemon[j - 1] && !pokemon[j - 1].active && !chosen.includes(j) && !pokemon[j - 1].condition.endsWith(' fnt'));
      const switches = active.trapped ? [] : canSwitch;
      if (switches.length && (!options.length || Math.random() > this.aggression)) {
        const target = this.chooseSwitch(active, switches.map(slot => ({ slot, pokemon: pokemon[slot - 1] })));
        chosen.push(target);
        return `switch ${target}`;
      }
      if (!options.length) return 'pass';

      const picked = this.chooseMove(active, options.map((m: any) => ({ choice: `move ${m.slot}`, move: m })));
      const slot = parseInt(picked.split(' ')[1], 10) || 1;
      const opt = options.find((m: any) => m.slot === slot) || options[0];
      let choice = `move ${opt.slot}`;
      if (doubles) {
        if (['normal', 'any', 'adjacentFoe'].includes(opt.target)) choice += ` ${1 + Math.floor(Math.random() * 2)}`;
        else if (opt.target === 'adjacentAlly') choice += ` -${(i ^ 1) + 1}`;
        else if (opt.target === 'adjacentAllyOrSelf') choice += hasAlly ? ` -${1 + Math.floor(Math.random() * 2)}` : ` -${i + 1}`;
      }
      if (opt.zMove) { choice += ' zmove'; zUsed = true; }
      else if (willDynamax) { choice += ' dynamax'; dynamaxUsed = true; }
      else if (canMega && Math.random() < 0.9) { choice += ' mega'; megaUsed = true; }
      else if (canTera && Math.random() < 0.8) { choice += ' terastallize'; teraUsed = true; }
      return choice;
    });
    this.choose(choices.join(', '));
  }

  chooseMove(active: any, moves: { choice: string; move: any }[]): string {
    if (!moves.length) return super.chooseMove(active, moves);
    const foes = this.getFoes();
    const foe = foes[0];
    const scored = moves.map(m => ({ ...m, score: this.scoreMove(m.move, foe, active) }));
    scored.sort((a, b) => b.score - a.score);
    // Usually pick the best; occasionally pick among the top options.
    if (Math.random() < this.aggression || scored.length === 1) return scored[0].choice;
    const top = scored.slice(0, Math.min(2, scored.length));
    return top[Math.floor(Math.random() * top.length)].choice;
  }

  private scoreMove(moveRef: any, foe: FoeInfo | undefined, active: any): number {
    const move = dex.moves.get(moveRef.move);
    if (!move.exists) return 0;
    let score = 0;
    if (move.category === 'Status') {
      // Value setup / status modestly; boost moves better when healthy.
      score = 30;
      if (move.boosts) score += 25;
      if (move.status && foe && foe.hpFraction > 0.5) score += 20;
      if (move.heal) score += 40 * (1 - (active?.hpFraction ?? 1));
      return score + Math.random() * 15;
    }
    const power = moveRef.zMove ? Math.max(move.basePower, 175) : (move.basePower || 0);
    if (!power) return 10 + Math.random() * 10;
    let eff = 1;
    if (foe) {
      eff = foe.types.reduce((acc, t) => acc * typeEffectiveness(move.type, t), 1);
    }
    // STAB approximation: assume the user matches its own move type often.
    const stab = 1.3;
    const accuracy = (typeof move.accuracy === 'number' ? move.accuracy : 100) / 100;
    // Category vs foe defensive stat (rough).
    const defStat = foe ? (move.category === 'Physical' ? foe.def : foe.spd) : 150;
    const defenseFactor = 150 / Math.max(50, defStat);
    score = power * eff * stab * accuracy * defenseFactor;
    // Prefer finishing low-HP foes.
    if (foe && foe.hpFraction < 0.3) score *= 1.2;
    // Multi-hit / recoil adjustments are minor; add noise.
    return score + Math.random() * 12;
  }

  chooseSwitch(active: any, switches: { slot: number; pokemon: any }[]): number {
    if (!switches.length) return super.chooseSwitch(active, switches);
    const foes = this.getFoes();
    const foeType = foes[0]?.lastMoveType;
    if (foeType) {
      // Prefer a switch-in that resists the foe's last move type.
      const scored = switches.map(sw => {
        const species = dex.species.get(sw.pokemon.species || sw.pokemon.ident);
        const eff = species.exists
          ? species.types.reduce((acc, t) => acc * typeEffectiveness(foeType, t), 1)
          : 1;
        return { slot: sw.slot, score: (eff <= 0.5 ? 2 : eff >= 2 ? 0 : 1) + Math.random() };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored[0].slot;
    }
    return super.chooseSwitch(active, switches);
  }
}