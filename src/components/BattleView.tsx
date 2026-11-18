import React, { useEffect, useRef, useState } from 'react';
import type { BattleController } from '../lib/battle';
import { useBattle } from '../hooks/useBattle';
import { dex, CATEGORY_ZH, TYPE_COLORS } from '../lib/dex';
import { moveNameZh, speciesNameZh, statusNameZh, weatherNameZh, terrainNameZh, itemNameZh, abilityNameZh } from '../lib/names';
import { iconSprite } from '../lib/sprites';
import type { ActivePokemon, ActiveRequest, BattleState, PlayerRequest, MoveRequest, SidePokemon } from '../lib/types';
import { TypeBadge, BattleSprite, GenderIcon, hpColor, Sprite } from './common';

export function BattleView({ ctrl, onExit, onRematch }: { ctrl: BattleController; onExit: () => void; onRematch: () => void }) {
  const { state, request } = useBattle(ctrl);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [state?.log.length]);
  if (!state) return null;

  const weatherClass = state.field.weather.includes('Rain') ? 'weather-rain'
    : state.field.weather.includes('Sun') || state.field.weather.includes('Desolate') ? 'weather-sun'
    : state.field.weather.includes('Sand') ? 'weather-sand'
    : state.field.weather.includes('Snow') || state.field.weather.includes('Hail') ? 'weather-snow' : '';

  const foeSlots = state.gameType === 'doubles' ? ['p2a', 'p2b'] : ['p2a'];
  const mySlots = state.gameType === 'doubles' ? ['p1a', 'p1b'] : ['p1a'];

  return (
    <div>
      <div className="row mb" style={{ gap: 10 }}>
        <h2 className="view-title" style={{ margin: 0 }}>对战 · {state.formatName}</h2>
        <span className="grow" />
        <button className="btn sm" onClick={onRematch}>🔄 重新开始</button>
        <button className="btn sm danger ghost" onClick={() => { ctrl.forfeit(); }}>🏳️ 认输</button>
        <button className="btn sm ghost" onClick={onExit}>退出对战</button>
      </div>

      <div className="battle-layout">
        <div>
          <div className={`battle-field ${weatherClass}`}>
            <div className="field-info">
              {state.field.weather && <span className="field-chip">🌦 {weatherNameZh(state.field.weather)}</span>}
              {state.field.terrain && <span className="field-chip">🌐 {terrainNameZh(state.field.terrain)}</span>}
              {state.field.pseudoWeather.map(p => <span key={p} className="field-chip">{p}</span>)}
              {Object.entries(state.sides.p2.hazards).map(([k, v]) => <span key={k} className="field-chip">对方: {k}{v > 1 ? `×${v}` : ''}</span>)}
              {Object.entries(state.sides.p1.hazards).map(([k, v]) => <span key={k} className="field-chip">我方: {k}{v > 1 ? `×${v}` : ''}</span>)}
            </div>
            <div className="turn-chip">回合 {state.turn}</div>

            <div className="field-side foe">
              {foeSlots.map(slot => <FieldMon key={slot} mon={state.active[slot]} side="p2" event={state.lastEvent} />)}
            </div>
            <div className="field-side player">
              {mySlots.map(slot => <FieldMon key={slot} mon={state.active[slot]} side="p1" event={state.lastEvent} />)}
            </div>

            {state.ended && (
              <div className="win-overlay">
                <div className="result">{state.winner === ctrl.getState().sides.p1.name ? '🏆 胜利！' : state.winner ? '💀 战败' : '🤝 平局'}</div>
                <div className="sub">{state.winner ? `${state.winner} 赢得了对战` : '双方战平'}</div>
                <div className="row mt" style={{ gap: 10 }}>
                  <button className="btn primary" onClick={onRematch}>再来一局</button>
                  <button className="btn" onClick={onExit}>返回</button>
                </div>
              </div>
            )}
          </div>

          <div className="battle-controls">
            <Controls ctrl={ctrl} state={state} request={request} />
          </div>
        </div>

        <div className="battle-log">
          <div className="log-head">📜 对战日志</div>
          <div className="log-body" ref={logRef}>
            {state.log.map((l, i) => <div key={i} className={`log-line ${l.kind}`}>{l.text}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldMon({ mon, side, event }: { mon?: ActivePokemon; side: 'p1' | 'p2'; event: BattleState['lastEvent'] }) {
  if (!mon) return <div className="field-mon" />;
  const hit = event && (event.type === 'damage' || event.type === 'crit') && event.slot === mon.slot;
  const attacking = event && event.type === 'move' && event.slot === mon.slot;
  const eff = event && event.type === 'effectiveness' && event.slot === mon.slot ? event.effectiveness : null;
  return (
    <div className={`field-mon${mon.fainted ? ' fainted' : ''}${hit ? ' hit' : ''}${attacking ? ' attacking' : ''}`}>
      <div className="hp-box">
        <div className="top">
          <span className="nm">{speciesNameZh(mon.speciesId)}</span>
          <GenderIcon gender={mon.gender} />
          <span className="lv">Lv.{mon.level}</span>
        </div>
        <div className="hp-track">
          <div className="hp-fill" style={{ width: `${mon.hpPercent}%`, background: hpColor(mon.hpPercent) }} />
        </div>
        <div className="hp-text">{mon.fainted ? '濒死' : `${mon.hp}/${mon.maxhp}`}</div>
        <div className="status-row">
          {mon.mega && <span className="status-chip mech-mega">超级进化</span>}
          {mon.dynamax && <span className="status-chip mech-dyna">{mon.gigantamax ? '超极巨化' : '极巨化'}</span>}
          {mon.status && <span className="status-chip" style={{ background: statusColor(mon.status) }}>{statusNameZh(mon.status)}</span>}
          {mon.terastallized && <span className="status-chip" style={{ background: TYPE_COLORS[mon.terastallized] }}>太晶{mon.terastallized}</span>}
          {Object.entries(mon.boosts).filter(([, v]) => v).map(([k, v]) => (
            <span key={k} className="boost-chip">{k}{v! > 0 ? `+${v}` : v}</span>
          ))}
        </div>
      </div>
      <div className={`sprite-wrap${mon.dynamax ? ' dynamax' : ''}${mon.mega ? ' mega' : ''}`}>
        <BattleSprite species={mon.speciesId} back={side === 'p1'} shiny={mon.shiny} />
        {eff !== null && <div style={{ position: 'absolute', top: -6, fontWeight: 800, color: eff === 2 ? '#7ee787' : eff === 0 ? '#888' : '#ff8080', fontSize: 13 }}>{eff === 2 ? '效果绝佳!' : eff === 0 ? '无效' : '效果不佳'}</div>}
      </div>
      <div className="platform" />
    </div>
  );
}

function statusColor(s: string): string {
  return { brn: '#f0883e', par: '#eab308', slp: '#9aa7b4', psn: '#a855f7', tox: '#9333ea', frz: '#38bdf8' }[s] || '#777';
}

// ---- Controls ----
function Controls({ ctrl, state, request }: { ctrl: BattleController; state: BattleState; request: PlayerRequest | null }) {
  if (state.ended) return <div className="panel center muted">对战已结束。</div>;
  if (!request) return <div className="panel center muted">⏳ 等待对方行动…</div>;
  if (request.wait) return <div className="panel center muted">⏳ 等待对方行动…</div>;
  if (request.teamPreview) return <TeamPreview ctrl={ctrl} request={request} />;
  if (request.forceSwitch) return <SwitchPanel ctrl={ctrl} request={request} forced />;
  if (request.active) return <ActionPanel ctrl={ctrl} state={state} request={request} />;
  return <div className="panel center muted">⏳ 等待…</div>;
}

function TeamPreview({ ctrl, request }: { ctrl: BattleController; request: PlayerRequest }) {
  const need = request.maxChosenTeamSize || request.side.pokemon.length;
  const [order, setOrder] = useState<number[]>([]);
  const toggle = (i: number) => {
    setOrder(o => o.includes(i) ? o.filter(x => x !== i) : (o.length < need ? [...o, i] : o));
  };
  const ready = order.length === need;
  return (
    <div className="panel">
      <div className="row mb"><strong>队伍预览</strong><span className="muted small">选择 {need} 只出场顺序（点击选择，先选的先出场）</span></div>
      <div className="preview-grid">
        {request.side.pokemon.map((p, i) => {
          const det = p.details.split(',')[0];
          const sel = order.indexOf(i);
          return (
            <div key={i} className={`preview-card${sel >= 0 ? ' selected' : ''}`} onClick={() => toggle(i)}>
              {sel >= 0 && <div className="order">{sel + 1}</div>}
              <Sprite src={iconSprite(det)} alt={det} />
              <div className="nm">{speciesNameZh(det)}</div>
            </div>
          );
        })}
      </div>
      <div className="row mt" style={{ gap: 10 }}>
        <button className="btn primary" disabled={!ready} onClick={() => ctrl.choose('team ' + order.map(i => i + 1).join(''))}>确认出场</button>
        <button className="btn ghost" onClick={() => setOrder([])}>重置</button>
        <button className="btn ghost" onClick={() => ctrl.choose('team ' + Array.from({ length: need }, (_, i) => i + 1).join(''))}>默认顺序</button>
      </div>
    </div>
  );
}

function SwitchPanel({ ctrl, request, forced, onPick, slotIndex = 0 }: {
  ctrl: BattleController; request: PlayerRequest; forced?: boolean; onPick?: (slot: number) => void; slotIndex?: number;
}) {
  const mustSwitch = forced ? request.forceSwitch! : request.active!.map(() => true);
  const active = request.side.pokemon;
  const options = active.map((p, i) => ({ p, i })).filter(({ p, i }) =>
    !p.active && !p.condition.includes('fnt') && (forced ? i >= (request.forceSwitch?.length || 0) || p.reviving : true));

  const pick = (i: number) => {
    if (forced) {
      // build full forced-switch choice
      const used = new Set<number>();
      const parts = request.forceSwitch!.map((must, idx) => {
        if (!must) return 'pass';
        if (idx === slotIndex) { used.add(i); return 'switch ' + (i + 1); }
        const avail = active.map((p, j) => ({ p, j })).filter(({ p, j }) => !p.active && !p.condition.includes('fnt') && !used.has(j) && j !== i);
        if (!avail.length) return 'pass';
        used.add(avail[0].j); return 'switch ' + (avail[0].j + 1);
      });
      ctrl.choose(parts.join(', '));
    } else if (onPick) {
      onPick(i + 1);
    } else {
      ctrl.choose('switch ' + (i + 1));
    }
  };

  return (
    <div className="panel">
      <div className="row mb"><strong>{forced ? '必须换人（有宝可梦倒下）' : '选择上场的宝可梦'}</strong></div>
      <div className="switch-list">
        {options.map(({ p, i }) => {
          const cond = parseCond(p.condition);
          const det = p.details.split(',')[0];
          return (
            <div key={i} className="switch-item" onClick={() => pick(i)}>
              <Sprite src={iconSprite(det)} alt={det} />
              <div className="info">
                <div className="nm">{speciesNameZh(det)} <span className="muted small">Lv.{p.details.match(/L(\d+)/)?.[1] || '?'}</span></div>
                <div className="mini-hp"><div style={{ width: `${cond.percent}%`, background: hpColor(cond.percent) }} /></div>
                <div className="small faint">{cond.percent}% {p.item ? '· ' + itemNameZh(p.item) : ''}</div>
              </div>
            </div>
          );
        })}
        {!options.length && <div className="muted small">没有可上场的宝可梦。</div>}
      </div>
    </div>
  );
}

function parseCond(cond: string) {
  const m = cond.match(/^(\d+)\/(\d+)/);
  if (!m) return { percent: cond.includes('fnt') ? 0 : 100 };
  return { percent: Math.round(+m[1] / +m[2] * 100) };
}

type Mechanic = 'mega' | 'zmove' | 'dynamax' | 'tera';

function ActionPanel({ ctrl, state, request }: { ctrl: BattleController; state: BattleState; request: PlayerRequest }) {
  const doubles = request.active!.length > 1;
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [targeting, setTargeting] = useState<{ slot: number; moveIdx: number; move: MoveRequest } | null>(null);
  const [switchFor, setSwitchFor] = useState<number | null>(null);
  const [mech, setMech] = useState<Record<number, Mechanic | null>>({});

  // reset when a new request arrives (turn change)
  const reqKey = JSON.stringify(request.active?.map(a => a.moves.map(m => m.pp))) + state.turn;
  useEffect(() => { setChoices({}); setTargeting(null); setSwitchFor(null); setMech({}); }, [reqKey]);

  const active = request.active!;
  const sidePokemon = request.side.pokemon;

  const slotNeedsChoice = (i: number) => {
    const p = sidePokemon[i];
    return !(p.condition.includes('fnt') || p.commanding);
  };

  const toggleMech = (slotIdx: number, m: Mechanic) => {
    setMech(prev => ({ ...prev, [slotIdx]: prev[slotIdx] === m ? null : m }));
    setTargeting(null);
  };

  const buildAndSubmit = (next: Record<number, string>) => {
    const parts = active.map((a, i) => slotNeedsChoice(i) ? (next[i] || 'move 1') : 'pass');
    ctrl.choose(parts.join(', '));
  };

  const chooseMove = (slotIdx: number, moveIdx: number, move: MoveRequest, targetCode?: number) => {
    const a = active[slotIdx];
    const m = mech[slotIdx];
    let choice = `move ${moveIdx + 1}`;
    if (targetCode !== undefined) choice += ` ${targetCode}`;
    if (m === 'tera' && a.canTerastallize) choice += ' terastallize';
    else if (m === 'mega' && a.canMegaEvo) choice += ' mega';
    else if (m === 'dynamax' && a.canDynamax) choice += ' dynamax';
    else if (m === 'zmove' && a.canZMove?.[moveIdx]) choice += ' zmove';
    if (doubles) {
      const next = { ...choices, [slotIdx]: choice };
      setChoices(next);
      setTargeting(null);
      // auto-submit when all decided
      if (active.every((_, i) => !slotNeedsChoice(i) || next[i])) buildAndSubmit(next);
    } else {
      ctrl.choose(choice);
    }
  };

  const onMoveClick = (slotIdx: number, moveIdx: number, move: MoveRequest) => {
    if (move.disabled || move.pp <= 0) return;
    const opts = targetOptions(move, slotIdx, state, active[slotIdx], mech[slotIdx]);
    if (opts.length > 1) {
      setTargeting({ slot: slotIdx, moveIdx, move });
    } else if (opts.length === 1) {
      chooseMove(slotIdx, moveIdx, move, opts[0].code);
    } else {
      chooseMove(slotIdx, moveIdx, move);
    }
  };

  const doSwitch = (slotIdx: number, switchTo: number) => {
    const choice = `switch ${switchTo}`;
    if (doubles) {
      const next = { ...choices, [slotIdx]: choice };
      setChoices(next); setSwitchFor(null);
      if (active.every((_, i) => !slotNeedsChoice(i) || next[i])) buildAndSubmit(next);
    } else {
      ctrl.choose(choice);
    }
  };

  if (switchFor !== null) {
    return <SwitchPanel ctrl={ctrl} request={request} slotIndex={switchFor} onPick={(n) => doSwitch(switchFor, n)} />;
  }

  return (
    <div>
      {active.map((a, slotIdx) => {
        const p = sidePokemon[slotIdx];
        const det = p.details.split(',')[0];
        const needs = slotNeedsChoice(slotIdx);
        const decided = choices[slotIdx];
        if (!needs) return null;
        const m = mech[slotIdx] || null;
        const gmaxName = a.maxMoves?.gigantamax;
        // Only one Dynamax per turn in doubles: block it on the other slot.
        const dynamaxTaken = doubles && Object.entries(mech).some(([k, v]) => v === 'dynamax' && +k !== slotIdx);
        return (
          <div key={slotIdx} className="panel mb">
            <div className="row mb" style={{ gap: 8 }}>
              <Sprite src={iconSprite(det)} alt={det} style={{ width: 36, height: 36 }} />
              <strong>{speciesNameZh(det)}</strong>
              {doubles && <span className="muted small">（位置 {slotIdx === 0 ? 'A' : 'B'}）</span>}
              <span className="grow" />
              {decided && <span className="small" style={{ color: '#7ee787' }}>已选择</span>}
              {a.trapped && <span className="small faint">无法换人</span>}
            </div>

            <MechanicBar a={a} selected={m} dynamaxTaken={dynamaxTaken} onToggle={(mm) => toggleMech(slotIdx, mm)} />

            <div className="move-grid">
              {a.moves.map((mv, mi) => {
                const disp = displayMove(a, m, mi);
                const disabled = disp.kind === 'z' ? !disp.z : (mv.disabled || mv.pp <= 0);
                const tc = TYPE_COLORS[disp.type] || '#777';
                return (
                  <button key={mi} className={`move-btn${disp.kind !== 'normal' ? ' mech-' + disp.kind : ''}`} disabled={disabled}
                    style={{ background: `linear-gradient(135deg, ${tc}cc, ${tc}66)` }}
                    onClick={() => onMoveClick(slotIdx, mi, mv)}>
                    <div className="mv-top">
                      <span className="mv-name">{disp.name}</span>
                      <TypeBadge type={disp.type} />
                    </div>
                    <div className="mv-bottom">
                      <span>{disp.category}</span>
                      <span>威力 {disp.power}</span>
                      <span>命中 {disp.accuracy}</span>
                      <span className="pp">{disp.ppText}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="action-bar">
              {!a.trapped && <button className="btn" onClick={() => setSwitchFor(slotIdx)}>🔄 换人</button>}
              {m && <span className="small mech-hint">{mechHint(m, gmaxName)}</span>}
            </div>
          </div>
        );
      })}

      {doubles && (
        <button className="btn primary lg" style={{ width: '100%' }}
          disabled={!active.every((_, i) => !slotNeedsChoice(i) || choices[i])}
          onClick={() => buildAndSubmit(choices)}>
          确认本回合行动
        </button>
      )}

      {targeting && (
        <div className="target-prompt">
          <strong>为「{displayMove(active[targeting.slot], mech[targeting.slot] || null, targeting.moveIdx).name}」选择目标</strong>
          <div className="target-options">
            {targetOptions(targeting.move, targeting.slot, state, active[targeting.slot], mech[targeting.slot] || null).map(o => (
              <button key={o.code} className="btn blue" onClick={() => chooseMove(targeting.slot, targeting.moveIdx, targeting.move, o.code)}>
                {o.label}
              </button>
            ))}
            <button className="btn ghost" onClick={() => setTargeting(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mechanic toggle buttons (mutually exclusive per slot).
function MechanicBar({ a, selected, dynamaxTaken, onToggle }: { a: ActiveRequest; selected: Mechanic | null; dynamaxTaken?: boolean; onToggle: (m: Mechanic) => void }) {
  const hasZ = !!a.canZMove?.some(Boolean);
  const buttons: { m: Mechanic; label: string; cls: string; show: boolean; disabled?: boolean }[] = [
    { m: 'mega', label: '🧬 超级进化', cls: 'mega', show: !!a.canMegaEvo },
    { m: 'zmove', label: '💎 Z招式', cls: 'z', show: hasZ },
    { m: 'dynamax', label: a.maxMoves?.gigantamax ? '🔥 超极巨化' : '⬆️ 极巨化', cls: 'dyna', show: !!a.canDynamax, disabled: dynamaxTaken },
    { m: 'tera', label: `✨ 太晶化${a.canTerastallize ? '·' + a.canTerastallize : ''}`, cls: 'tera', show: !!a.canTerastallize },
  ];
  const visible = buttons.filter(b => b.show);
  if (!visible.length) return null;
  return (
    <div className="mech-bar">
      {visible.map(b => (
        <button key={b.m} className={`mech-btn ${b.cls}${selected === b.m ? ' on' : ''}`} disabled={b.disabled}
          title={b.disabled ? '本回合已有其他宝可梦极巨化' : undefined} onClick={() => onToggle(b.m)}>
          {b.label}{selected === b.m ? ' ✓' : ''}
        </button>
      ))}
    </div>
  );
}

function mechHint(m: Mechanic, gmaxName?: string): string {
  if (m === 'mega') return '本回合出招时将超级进化（每场一次）。';
  if (m === 'zmove') return '点击招式释放对应的 Z 招式（每场一次）。';
  if (m === 'dynamax') return gmaxName ? `极巨化为超极巨形态，招式变为极巨招式（持续 3 回合）。` : '极巨化后招式变为极巨招式（持续 3 回合）。';
  return '本回合出招时将太晶化（每场一次）。';
}

interface DisplayMove {
  name: string; type: string; category: string; power: string; accuracy: string;
  ppText: string; kind: 'normal' | 'z' | 'max'; z?: { move: string; target: string } | null;
}

// Resolve the move shown on a button given the active mechanic for that slot.
function displayMove(a: ActiveRequest, mech: Mechanic | null, mi: number): DisplayMove {
  const base = a.moves[mi];
  const move = dex.moves.get(base.id);
  const acc = move.accuracy === true ? '必中' : String(move.accuracy);
  if (mech === 'zmove') {
    const z = a.canZMove?.[mi] || null;
    if (z) {
      const zm = dex.moves.get(z.move);
      const power = zm.basePower > 1 ? zm.basePower : Math.max(move.basePower || 0, 100);
      return { name: moveNameZh(zm.id), type: zm.type, category: CATEGORY_ZH[zm.category] || zm.category, power: String(power), accuracy: '必中', ppText: 'Z招式', kind: 'z', z };
    }
    return { name: moveNameZh(move.id), type: move.type, category: CATEGORY_ZH[move.category], power: String(move.basePower || '—'), accuracy: acc, ppText: '无Z', kind: 'z', z: null };
  }
  if (mech === 'dynamax' && a.maxMoves) {
    const mm = a.maxMoves.maxMoves[mi];
    if (mm) {
      const xm = dex.moves.get(mm.move);
      return { name: moveNameZh(xm.id), type: xm.type, category: CATEGORY_ZH[xm.category] || xm.category, power: String(xm.basePower || '—'), accuracy: '必中', ppText: '极巨', kind: 'max' };
    }
  }
  return { name: moveNameZh(move.id), type: move.type, category: CATEGORY_ZH[move.category], power: String(move.basePower || '—'), accuracy: acc, ppText: `PP ${base.pp}/${base.maxpp}`, kind: 'normal' };
}

// Compute valid target options for a move in doubles. Returns [] when no explicit
// target is needed (auto-target), or a single option when forced.
function targetOptions(move: MoveRequest, slotIdx: number, state: BattleState, a?: ActiveRequest, mech?: Mechanic | null): { code: number; label: string }[] {
  if (state.gameType !== 'doubles') return [];
  let target: string = dex.moves.get(move.id).target;
  // Z-Move / Max Move variants may have a different target than the base move.
  if (a && mech === 'zmove') {
    const z = a.canZMove?.[moveIndex(move, a)];
    if (z) target = z.target;
  } else if (a && mech === 'dynamax' && a.maxMoves) {
    const mm = a.maxMoves.maxMoves[moveIndex(move, a)];
    if (mm) target = mm.target;
  }
  const foeAlive = (['p2a', 'p2b'] as const).map((s, i) => ({ s, i, mon: state.active[s] })).filter(x => x.mon && !x.mon.fainted);
  const myAlive = (['p1a', 'p1b'] as const).map((s, i) => ({ s, i, mon: state.active[s] })).filter(x => x.mon && !x.mon.fainted);
  const foeOpts = foeAlive.map(x => ({ code: x.i + 1, label: `对方 ${speciesNameZh(x.mon!.speciesId)} (${x.i === 0 ? 'A' : 'B'})` }));
  const myOpts = myAlive.map(x => ({ code: -(x.i + 1), label: `我方 ${speciesNameZh(x.mon!.speciesId)} (${x.i === 0 ? 'A' : 'B'})` }));

  switch (target) {
    case 'normal':
    case 'adjacentFoe':
      return foeOpts.length > 1 ? foeOpts : [];
    case 'any':
      const all = [...foeOpts, ...myOpts];
      return all.length > 1 ? all : [];
    case 'adjacentAlly': {
      const ally = myAlive.find(x => x.i !== slotIdx);
      return ally ? [{ code: -(ally.i + 1), label: `我方 ${speciesNameZh(ally.mon!.speciesId)}` }] : [];
    }
    case 'adjacentAllyOrSelf': {
      const opts = myOpts;
      return opts.length > 1 ? opts : [];
    }
    default:
      return []; // self / foeSide / allySide / all -> auto
  }
}

// Find the slot index of a move within the active request's move list.
function moveIndex(move: MoveRequest, a: ActiveRequest): number {
  const i = a.moves.findIndex(m => m.id === move.id);
  return i >= 0 ? i : 0;
}