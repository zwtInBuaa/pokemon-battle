import { Battle, extractChannelMessages } from '@pkmn/sim';
import { dex, getSpecies } from './dex';
import { SmartAI, type FoeInfo } from './ai';
import {
  moveNameZh, speciesNameZh, abilityNameZh, itemNameZh, statusNameZh,
  weatherNameZh, terrainNameZh,
} from './names';
import type {
  BattleState, ActivePokemon, SideState, SidePokemon, PlayerRequest,
  LogLine, BattleEvent, SideID, GameType, FieldState,
} from './types';

export interface BattleConfig {
  formatId: string;
  p1Name: string;
  p2Name: string;
  p1Team: string;   // packed
  p2Team: string;   // packed
}

type Listener = () => void;

let EVENT_ID = 1;

function emptySide(id: SideID, name: string): SideState {
  return { id, name, total: 0, pokemon: [], hazards: {}, screens: {}, conditions: [] };
}

function emptyField(): FieldState {
  return { weather: '', weatherTurns: 0, terrain: '', terrainTurns: 0, pseudoWeather: [] };
}

export function initialState(): BattleState {
  return {
    started: false, ended: false, winner: null, gameType: 'singles', gen: 9,
    formatName: '', turn: 0, active: {},
    sides: { p1: emptySide('p1', ''), p2: emptySide('p2', '') },
    field: emptyField(), log: [], lastEvent: null,
  };
}

// Parse a condition string like "268/268", "100/100 brn", "0 fnt".
function parseCondition(cond: string) {
  const parts = cond.trim().split(' ');
  const hpPart = parts[0];
  let status = '';
  let fainted = false;
  for (const p of parts.slice(1)) {
    if (p === 'fnt') fainted = true;
    else if (['brn', 'par', 'slp', 'psn', 'tox', 'frz'].includes(p)) status = p;
  }
  let hp = 0, maxhp = 0;
  const m = hpPart.match(/^(\d+)\/(\d+)$/);
  if (m) { hp = +m[1]; maxhp = +m[2]; }
  if (fainted) hp = 0;
  return { hp, maxhp, status, fainted };
}

function parseDetails(details: string) {
  const parts = details.split(',').map(s => s.trim());
  const speciesName = parts[0];
  let level = 100, gender = '', shiny = false;
  for (const p of parts.slice(1)) {
    if (p.startsWith('L')) level = +p.slice(1) || 100;
    else if (p === 'M' || p === 'F') gender = p;
    else if (p === 'shiny') shiny = true;
  }
  const species = getSpecies(speciesName);
  return { speciesName, speciesId: species.id, level, gender, shiny, types: species.types };
}

function slotOf(ident: string): string {
  return ident.split(':')[0].trim();
}
function sideOf(slot: string): SideID {
  return slot.startsWith('p1') ? 'p1' : 'p2';
}

export class BattleController {
  battle: any;
  state: BattleState = initialState();
  request: PlayerRequest | null = null;
  private ai: SmartAI;
  private listeners = new Set<Listener>();
  private config: BattleConfig;
  private pendingRequest: PlayerRequest | null = null;
  private foeLastMoveType: Record<string, string> = {};
  private aiTimer: any = null;
  private disposed = false;

  constructor(config: BattleConfig) {
    this.config = config;
    this.ai = new SmartAI(() => this.foeInfo());
    this.ai.choose = (choice: string) => {
      if (this.disposed) return;
      this.battle.choose('p2', choice);
      this.pump();
    };
    this.ai.receiveError = (e: Error) => {
      if (!e.message.startsWith('[Unavailable choice]')) {
        // eslint-disable-next-line no-console
        console.warn('AI error:', e.message);
      }
    };

    this.battle = new Battle({
      formatid: config.formatId as any,
      send: (type: string, data: any) => this.onSend(type, data),
    });
    this.battle.setPlayer('p1', { name: config.p1Name, team: config.p1Team });
    this.battle.setPlayer('p2', { name: config.p2Name, team: config.p2Team });
    this.pump();
  }

  // ---- public API ----
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { for (const fn of this.listeners) fn(); }

  getState(): BattleState { return this.state; }
  getRequest(): PlayerRequest | null { return this.request; }

  // Human player makes a choice (e.g. "move 1", "switch 3", "team 1234").
  choose(choice: string) {
    if (this.state.ended) return;
    this.request = null;
    this.battle.choose('p1', choice);
    this.pump();
    this.emit();
  }

  undo() {
    this.battle.undoChoice('p1');
    this.pump();
    this.emit();
  }

  forfeit() {
    this.battle.win('p2');
    this.pump();
    this.emit();
  }

  dispose() {
    this.disposed = true;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.listeners.clear();
  }

  // ---- engine plumbing ----
  private pump() {
    if (this.disposed) return;
    this.battle.sendUpdates();
  }

  private foeInfo(): FoeInfo[] {
    const side = this.battle.sides[0];
    if (!side) return [];
    return side.active.filter((p: any) => p && !p.fainted).map((p: any) => ({
      types: p.types as string[],
      def: p.stats?.def ?? 150,
      spd: p.stats?.spd ?? 150,
      hpFraction: p.maxhp ? p.hp / p.maxhp : 1,
      lastMoveType: this.foeLastMoveType[p.slot ?? ''] || p.lastMove?.type,
    }));
  }

  private onSend(type: string, data: any) {
    if (this.disposed) return;
    if (type === 'update') {
      const raw = Array.isArray(data) ? data.join('\n') : String(data);
      const clean = extractChannelMessages(raw, [-1])[-1];
      this.handleUpdate(clean);
    } else if (type === 'sideupdate') {
      const str = String(data);
      const nl = str.indexOf('\n');
      const side = str.slice(0, nl);
      const msg = str.slice(nl + 1);
      this.handleSideUpdate(side as SideID, msg);
    }
  }

  private handleSideUpdate(side: SideID, msg: string) {
    if (msg.startsWith('|request|')) {
      const req = JSON.parse(msg.slice(9)) as PlayerRequest;
      if (side === 'p1') {
        this.pendingRequest = req;
        this.request = req;
        this.syncSideFromRequest(req);
        this.emit();
      } else if (side === 'p2') {
        // Defer AI decision to avoid synchronous re-entrancy / stack growth.
        if (this.aiTimer) clearTimeout(this.aiTimer);
        this.aiTimer = setTimeout(() => {
          if (this.disposed) return;
          try { this.ai.receiveRequest(req as any); }
          catch (e) { console.warn('AI throw', e); }
        }, 30);
      }
    } else if (msg.startsWith('|error|')) {
      if (side === 'p1') {
        this.pushLog(msg.slice(7), 'misc');
        this.emit();
      }
    }
  }

  // Build p1 team overview from the authoritative request JSON.
  private syncSideFromRequest(req: PlayerRequest) {
    const side = this.state.sides.p1;
    side.name = req.side.name;
    side.total = req.side.pokemon.length;
    side.pokemon = req.side.pokemon.map(p => {
      const det = parseDetails(p.details);
      const cond = parseCondition(p.condition);
      return {
        ident: p.ident, speciesId: det.speciesId, speciesName: det.speciesName,
        details: p.details, level: det.level, gender: det.gender, shiny: det.shiny,
        hp: cond.hp, maxhp: cond.maxhp, hpPercent: cond.maxhp ? Math.round(cond.hp / cond.maxhp * 100) : 0,
        exactHP: true, status: cond.status, fainted: cond.fainted || p.condition.includes('fnt'),
        active: p.active, item: p.item, ability: p.ability || p.baseAbility,
        moves: p.moves, teraType: p.teraType,
      } as SidePokemon;
    });
  }

  private pushLog(text: string, kind: LogLine['kind']) {
    this.state.log.push({ turn: this.state.turn, text, kind });
    if (this.state.log.length > 400) this.state.log.splice(0, this.state.log.length - 400);
  }

  private event(ev: Omit<BattleEvent, 'id'>) {
    this.state.lastEvent = { ...ev, id: EVENT_ID++ };
  }

  private getActive(slot: string): ActivePokemon | undefined {
    return this.state.active[slot];
  }

  private ensureActive(ident: string, details?: string, cond?: string): ActivePokemon {
    const slot = slotOf(ident);
    let a = this.state.active[slot];
    const det = details ? parseDetails(details) : null;
    if (!a || (det && det.speciesId !== a.speciesId)) {
      const d = det || parseDetails(ident.split(':')[1] || '');
      a = {
        ident, slot, side: sideOf(slot), position: slot.endsWith('b') ? 1 : 0,
        speciesId: d.speciesId, speciesName: d.speciesName, details: details || ident,
        level: d.level, gender: d.gender, shiny: d.shiny,
        hp: 0, maxhp: 0, hpPercent: 100, exactHP: true, status: '', fainted: false,
        boosts: {}, item: '', ability: '', terastallized: '', types: d.types,
        volatiles: [], lastMove: '', mega: false, dynamax: false, gigantamax: false,
      };
      this.state.active[slot] = a;
    }
    a.ident = ident;
    if (cond) this.applyCondition(a, cond);
    return a;
  }

  private applyCondition(a: ActivePokemon, cond: string) {
    const c = parseCondition(cond);
    if (c.maxhp) { a.hp = c.hp; a.maxhp = c.maxhp; a.hpPercent = Math.round(c.hp / c.maxhp * 100); }
    else if (cond.includes('fnt')) { a.hp = 0; a.hpPercent = 0; }
    a.status = c.status;
    a.fainted = c.fainted || cond.includes('fnt');
  }

  // ---- protocol parsing ----
  private handleUpdate(lines: string[]) {
    for (const line of lines) {
      if (!line || !line.startsWith('|')) continue;
      this.parseLine(line);
    }
    this.emit();
  }

  private parseLine(line: string) {
    const parts = line.split('|');
    const cmd = parts[1];
    const s = this.state;
    switch (cmd) {
      case 'gametype': s.gameType = parts[2] as GameType; break;
      case 'gen': s.gen = +parts[2]; break;
      case 'tier': s.formatName = parts[2]; break;
      case 'player': {
        const side = parts[2] as SideID;
        if (s.sides[side]) s.sides[side].name = parts[3];
        break;
      }
      case 'teamsize': {
        const side = parts[2] as SideID;
        if (s.sides[side]) s.sides[side].total = +parts[3];
        break;
      }
      case 'start': s.started = true; this.pushLog('对战开始！', 'info'); break;
      case 'turn':
        s.turn = +parts[2];
        this.pushLog(`—— 第 ${s.turn} 回合 ——`, 'info');
        break;
      case 'switch': case 'drag': {
        const a = this.ensureActive(parts[2], parts[3], parts[4]);
        a.boosts = {}; a.volatiles = []; a.fainted = false;
        a.mega = false; a.dynamax = false; a.gigantamax = false;
        this.upsertFoe(a);
        this.pushLog(`${sideLabel(a.side)} 派出了 ${speciesNameZh(a.speciesId)}！`, 'switch');
        this.event({ type: 'switch', slot: a.slot });
        break;
      }
      case 'replace': {
        const a = this.ensureActive(parts[2], parts[3], parts[4]);
        this.upsertFoe(a);
        break;
      }
      case 'detailschange': {
        const a = this.ensureActive(parts[2], parts[3], parts[4]);
        const det = parseDetails(parts[3]);
        a.speciesId = det.speciesId; a.speciesName = det.speciesName; a.types = det.types;
        this.upsertFoe(a);
        break;
      }
      case 'swap': {
        // doubles position swap: |swap|p1a: Name|0
        const slot = slotOf(parts[2]);
        const a = this.state.active[slot];
        if (a) a.position = +parts[3];
        break;
      }
      case 'move': {
        const user = this.ensureActive(parts[2]);
        const moveName = parts[3];
        const targetIdent = parts[4];
        user.lastMove = moveName;
        const move = dex.moves.get(moveName);
        this.foeLastMoveType[user.slot] = move.type;
        const targetSlot = targetIdent ? slotOf(targetIdent) : undefined;
        let targetText = '';
        if (targetSlot && this.state.active[targetSlot] && targetSlot !== user.slot) {
          targetText = ` 对 ${speciesNameZh(this.state.active[targetSlot].speciesId)}`;
        }
        let prefix = '';
        if (move.isZ) prefix = '【Z招式】';
        else if (move.isMax) { prefix = move.name.startsWith('G-Max') ? '【超极巨】' : '【极巨】'; if (move.name.startsWith('G-Max')) user.gigantamax = true; }
        this.pushLog(`${prefix}${speciesNameZh(user.speciesId)} 使用了 ${moveNameZh(moveName)}${targetText}！`, 'move');
        this.event({ type: 'move', slot: user.slot, target: targetSlot, move: move.id });
        break;
      }
      case '-mega': {
        const a = this.ensureActive(parts[2]);
        a.mega = true;
        const baseName = speciesNameZh(a.speciesId);
        this.pushLog(`${baseName} 超级进化了！`, 'ability');
        this.event({ type: 'mega', slot: a.slot });
        break;
      }
      case '-zbroken': {
        const a = this.ensureActive(parts[2]);
        this.pushLog(`${speciesNameZh(a.speciesId)} 的Z招式击穿了保护！`, 'damage');
        break;
      }
      case 'cant': {
        const a = this.ensureActive(parts[2]);
        this.pushLog(`${speciesNameZh(a.speciesId)} 无法行动（${parts[3]}）`, 'misc');
        break;
      }
      case '-damage': {
        const a = this.ensureActive(parts[2], undefined, parts[3]);
        const from = parts.find(p => p.startsWith('[from]'));
        const prev = a.hpPercent;
        this.applyCondition(a, parts[3]);
        const delta = prev - a.hpPercent;
        this.pushLog(`${speciesNameZh(a.speciesId)} 损失了 ${Math.max(0, delta)}% HP${from ? '（' + from.slice(6).trim() + '）' : ''}`, 'damage');
        this.event({ type: 'damage', slot: a.slot, amount: delta });
        this.upsertFoe(a);
        break;
      }
      case '-heal': {
        const a = this.ensureActive(parts[2], undefined, parts[3]);
        const prev = a.hpPercent;
        this.applyCondition(a, parts[3]);
        const delta = a.hpPercent - prev;
        this.pushLog(`${speciesNameZh(a.speciesId)} 回复了 ${Math.max(0, delta)}% HP`, 'heal');
        this.event({ type: 'heal', slot: a.slot, amount: delta });
        this.upsertFoe(a);
        break;
      }
      case 'faint': {
        const a = this.ensureActive(parts[2]);
        a.fainted = true; a.hp = 0; a.hpPercent = 0;
        this.pushLog(`${speciesNameZh(a.speciesId)} 倒下了！`, 'faint');
        this.event({ type: 'faint', slot: a.slot });
        this.upsertFoe(a);
        break;
      }
      case '-supereffective': {
        const slot = parts[2] ? slotOf(parts[2]) : undefined;
        this.pushLog('效果绝佳！', 'damage');
        this.event({ type: 'effectiveness', slot, effectiveness: 2 });
        break;
      }
      case '-resisted': {
        const slot = parts[2] ? slotOf(parts[2]) : undefined;
        this.pushLog('效果不太好……', 'damage');
        this.event({ type: 'effectiveness', slot, effectiveness: 0.5 });
        break;
      }
      case '-immune': {
        const slot = parts[2] ? slotOf(parts[2]) : undefined;
        this.pushLog('没有效果……', 'damage');
        this.event({ type: 'effectiveness', slot, effectiveness: 0 });
        break;
      }
      case '-crit': {
        const slot = parts[2] ? slotOf(parts[2]) : undefined;
        this.pushLog('击中要害！', 'damage');
        this.event({ type: 'crit', slot });
        break;
      }
      case '-miss': {
        this.pushLog('攻击没有命中！', 'misc');
        break;
      }
      case '-fail': {
        this.pushLog('攻击失败了！', 'misc');
        break;
      }
      case '-status': {
        const a = this.ensureActive(parts[2]);
        a.status = parts[3];
        this.pushLog(`${speciesNameZh(a.speciesId)} 陷入了${statusNameZh(parts[3])}状态！`, 'status');
        this.event({ type: 'status', slot: a.slot });
        this.upsertFoe(a);
        break;
      }
      case '-curestatus': {
        const a = this.ensureActive(parts[2]);
        a.status = '';
        this.pushLog(`${speciesNameZh(a.speciesId)} 的异常状态恢复了！`, 'status');
        this.upsertFoe(a);
        break;
      }
      case '-cureteam': {
        this.pushLog('队伍状态恢复了！', 'status');
        break;
      }
      case '-boost': case '-unboost': {
        const a = this.ensureActive(parts[2]);
        const stat = parts[3] as keyof ActivePokemon['boosts'];
        const amt = +parts[4] * (cmd === '-unboost' ? -1 : 1);
        a.boosts[stat] = (a.boosts[stat] || 0) + amt;
        const zh = statZh(stat);
        this.pushLog(`${speciesNameZh(a.speciesId)} 的${zh}${amt > 0 ? '提升' : '降低'}了${Math.abs(amt)}级！`, 'boost');
        this.event({ type: cmd === '-boost' ? 'boost' : 'unboost', slot: a.slot });
        break;
      }
      case '-setboost': {
        const a = this.ensureActive(parts[2]);
        a.boosts[parts[3] as keyof ActivePokemon['boosts']] = +parts[4];
        break;
      }
      case '-clearboost': {
        const a = this.ensureActive(parts[2]);
        a.boosts = {};
        this.pushLog(`${speciesNameZh(a.speciesId)} 的能力变化被消除了！`, 'boost');
        break;
      }
      case '-weather': {
        const w = parts[2];
        if (w === 'none') { s.field.weather = ''; this.pushLog('天气恢复了正常。', 'weather'); }
        else {
          s.field.weather = w;
          if (!parts.includes('[upkeep]')) this.pushLog(`天气变为${weatherNameZh(w)}！`, 'weather');
          this.event({ type: 'weather', move: w });
        }
        break;
      }
      case '-fieldstart': {
        const cond = parts[2].replace('move: ', '');
        if (cond.includes('Terrain')) { s.field.terrain = cond; this.pushLog(`${terrainNameZh(cond)}展开了！`, 'weather'); }
        else { s.field.pseudoWeather.push(cond); this.pushLog(`${cond} 生效了！`, 'weather'); }
        break;
      }
      case '-fieldend': {
        const cond = parts[2].replace('move: ', '');
        if (cond.includes('Terrain')) { s.field.terrain = ''; this.pushLog(`${terrainNameZh(cond)}消失了。`, 'weather'); }
        else { s.field.pseudoWeather = s.field.pseudoWeather.filter(c => c !== cond); }
        break;
      }
      case '-sidestart': {
        const side = parts[2].split(':')[0] as SideID;
        const cond = parts[3].replace('move: ', '');
        const sd = s.sides[side];
        if (sd) {
          if (['reflect', 'lightscreen', 'auroraveil'].includes(cond)) sd.screens[cond] = 5;
          else if (cond === 'spikes') sd.hazards.spikes = (sd.hazards.spikes || 0) + 1;
          else if (cond === 'toxicspikes') sd.hazards.toxicspikes = (sd.hazards.toxicspikes || 0) + 1;
          else sd.hazards[cond] = (sd.hazards[cond] || 0) + 1;
          this.pushLog(`${sideLabel(side)} 场地：${condZh(cond)}`, 'weather');
        }
        break;
      }
      case '-sideend': {
        const side = parts[2].split(':')[0] as SideID;
        const cond = parts[3].replace('move: ', '');
        const sd = s.sides[side];
        if (sd) { delete sd.screens[cond]; delete sd.hazards[cond]; }
        break;
      }
      case '-ability': {
        const a = this.ensureActive(parts[2]);
        a.ability = parts[3];
        this.pushLog(`${speciesNameZh(a.speciesId)} 的特性：${abilityNameZh(parts[3])}`, 'ability');
        this.upsertFoe(a);
        break;
      }
      case '-item': {
        const a = this.ensureActive(parts[2]);
        a.item = parts[3];
        this.upsertFoe(a);
        break;
      }
      case '-enditem': {
        const a = this.ensureActive(parts[2]);
        this.pushLog(`${speciesNameZh(a.speciesId)} 失去了 ${itemNameZh(parts[3])}`, 'misc');
        a.item = '';
        this.upsertFoe(a);
        break;
      }
      case '-start': {
        const a = this.ensureActive(parts[2]);
        const cond = parts[3];
        if (cond === 'Dynamax') {
          a.dynamax = true;
          this.pushLog(`${speciesNameZh(a.speciesId)} 极巨化了！`, 'ability');
          this.event({ type: 'dynamax', slot: a.slot });
          break;
        }
        if (!a.volatiles.includes(cond)) a.volatiles.push(cond);
        this.pushLog(`${speciesNameZh(a.speciesId)}：${condZh(cond)}`, 'status');
        break;
      }
      case '-end': {
        const a = this.ensureActive(parts[2]);
        if (parts[3] === 'Dynamax') {
          a.dynamax = false; a.gigantamax = false;
          this.pushLog(`${speciesNameZh(a.speciesId)} 的极巨化结束了。`, 'misc');
          break;
        }
        a.volatiles = a.volatiles.filter(v => v !== parts[3]);
        break;
      }
      case '-activate': {
        // generic activation; log a few notable ones
        break;
      }
      case '-terastallize': {
        const a = this.ensureActive(parts[2]);
        a.terastallized = parts[3];
        this.pushLog(`${speciesNameZh(a.speciesId)} 太晶化为${parts[3]}属性！`, 'ability');
        this.event({ type: 'tera', slot: a.slot });
        break;
      }
      case 'win': {
        s.ended = true; s.winner = parts[2];
        this.pushLog(`${parts[2]} 获胜！`, 'win');
        this.event({ type: 'win' });
        break;
      }
      case 'tie': {
        s.ended = true; s.winner = null;
        this.pushLog('平局！', 'win');
        break;
      }
      case 'message': {
        this.pushLog(parts[2], 'misc');
        break;
      }
      default:
        break;
    }
  }

  // Track revealed foe pokemon for the team overview.
  private upsertFoe(a: ActivePokemon) {
    if (a.side !== 'p2') return;
    const side = this.state.sides.p2;
    let entry = side.pokemon.find(p => p.ident === a.ident || p.speciesId === a.speciesId);
    if (!entry) {
      entry = {
        ident: a.ident, speciesId: a.speciesId, speciesName: a.speciesName, details: a.details,
        level: a.level, gender: a.gender, shiny: a.shiny, hp: a.hp, maxhp: a.maxhp,
        hpPercent: a.hpPercent, exactHP: true, status: a.status, fainted: a.fainted,
        active: true, item: a.item, ability: a.ability, moves: [], teraType: '',
      };
      side.pokemon.push(entry);
    }
    entry.hp = a.hp; entry.maxhp = a.maxhp; entry.hpPercent = a.hpPercent;
    entry.status = a.status; entry.fainted = a.fainted; entry.active = !a.fainted;
    if (a.item) entry.item = a.item;
    if (a.ability) entry.ability = a.ability;
  }
}

function sideLabel(side: SideID): string {
  return side === 'p1' ? '我方' : '对方';
}

function statZh(stat: string): string {
  const map: Record<string, string> = {
    atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度',
    accuracy: '命中率', evasion: '闪避率',
  };
  return map[stat] || stat;
}

function condZh(cond: string): string {
  const map: Record<string, string> = {
    stealthrock: '隐形岩', spikes: '撒菱', toxicspikes: '毒菱', stickyweb: '黏黏网',
    reflect: '反射壁', lightscreen: '光墙', auroraveil: '极光幕',
    confusion: '混乱', substitute: '替身', protect: '守住', detect: '看穿',
    taunt: '挑衅', encore: '再来一次', disable: '定身法', torment: '无理取闹',
    leechseed: '寄生种子', perishsong: '灭亡之歌', curse: '诅咒',
    partiallytrapped: '被束缚', trapped: '被束缚',
  };
  return map[cond] || cond;
}