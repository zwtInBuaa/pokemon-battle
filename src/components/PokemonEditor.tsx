import React, { useMemo, useState } from 'react';
import {
  getSpecies, speciesAbilities, learnableMoves, heldItems, allNatures,
  calcAllStats, evTotal, MAX_EV_SINGLE, MAX_EV_TOTAL, CATEGORY_ZH, dex,
} from '../lib/dex';
import { speciesNameZh, moveNameZh, abilityNameZh, itemNameZh, natureNameZh, STAT_ZH } from '../lib/names';
import { STAT_KEYS, type PokemonSet, type StatKey } from '../lib/types';
import { TypeBadge, Artwork, StatBar } from './common';
import { SpeciesSearch } from './SpeciesSearch';

export function PokemonEditor({
  initial, onSave, onClose,
}: { initial: PokemonSet; onSave: (s: PokemonSet) => void; onClose: () => void }) {
  const [set, setSet] = useState<PokemonSet>(initial);
  const [showSpecies, setShowSpecies] = useState(false);
  const [moveSlot, setMoveSlot] = useState<number | null>(null);
  const [moveQuery, setMoveQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');

  const species = getSpecies(set.species);
  const abilities = useMemo(() => speciesAbilities(species), [species.id]);
  const moves = useMemo(() => learnableMoves(species), [species.id]);
  const natures = useMemo(() => allNatures(), []);
  const items = useMemo(() => heldItems(), []);

  const stats = useMemo(
    () => calcAllStats(species, set.level, set.evs, set.ivs, set.nature),
    [species.id, set.level, set.evs, set.ivs, set.nature],
  );
  const total = evTotal(set.evs);

  const update = (patch: Partial<PokemonSet>) => setSet(s => ({ ...s, ...patch }));
  const updateStat = (kind: 'evs' | 'ivs', key: StatKey, val: number) => {
    setSet(s => {
      const max = kind === 'evs' ? MAX_EV_SINGLE : 31;
      const next = { ...s[kind], [key]: Math.max(0, Math.min(max, val)) };
      if (kind === 'evs') {
        // enforce total cap by trimming this stat if needed
        const others = STAT_KEYS.filter(k => k !== key).reduce((a, k) => a + next[k], 0);
        if (others + next[key] > MAX_EV_TOTAL) next[key] = Math.max(0, MAX_EV_TOTAL - others);
      }
      return { ...s, [kind]: next };
    });
  };

  const filteredMoves = useMemo(() => {
    const q = moveQuery.trim().toLowerCase();
    if (!q) return moves;
    return moves.filter(m => m.name.toLowerCase().includes(q) || moveNameZh(m.id).includes(moveQuery.trim()) || m.type.toLowerCase().includes(q));
  }, [moves, moveQuery]);

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items.slice(0, 100);
    return items.filter(i => i.name.toLowerCase().includes(q) || itemNameZh(i.id).includes(itemQuery.trim())).slice(0, 100);
  }, [items, itemQuery]);

  const pickSpecies = (s: any) => {
    const abs = speciesAbilities(s);
    const lm = learnableMoves(s);
    const stab = lm.filter(m => s.types.includes(m.type) && m.category !== 'Status');
    const picked = [...stab, ...lm].slice(0, 4).map(m => m.id);
    setSet(prev => ({
      ...prev, species: s.name, ability: abs[0]?.name || '',
      moves: picked, teraType: s.types[0] || 'Normal',
      gender: '', name: '',
    }));
    setShowSpecies(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 960 }}>
        <div className="modal-head">
          <Artwork species={set.species} shiny={set.shiny} className="sprite art" />
          <div className="title">
            {speciesNameZh(set.species)}
            <span className="muted small" style={{ marginLeft: 8 }}>{set.species}</span>
          </div>
          <button className="btn sm ghost" onClick={() => setShowSpecies(true)}>更换宝可梦</button>
          <button className="btn sm ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {showSpecies ? (
            <SpeciesSearch autoFocus onSelect={pickSpecies} />
          ) : (
            <div className="editor-grid">
              <div className="editor-left">
                <Artwork species={set.species} shiny={set.shiny} className="art" />
                <div className="row" style={{ gap: 4 }}>{species.types.map(t => <TypeBadge key={t} type={t} lg />)}</div>
                <div style={{ width: '100%' }}>
                  <div className="small muted mb">种族值</div>
                  {STAT_KEYS.map(k => (
                    <StatBar key={k} label={STAT_ZH[k]} value={species.baseStats[k]} />
                  ))}
                  <div className="small faint mt">合计 {Object.values(species.baseStats).reduce((a, b) => a + b, 0)}</div>
                </div>
              </div>

              <div>
                <div className="editor-section">
                  <h4>基础</h4>
                  <div className="form-grid">
                    <label className="field"><span>昵称</span>
                      <input type="text" value={set.name} placeholder={speciesNameZh(set.species)} onChange={e => update({ name: e.target.value })} />
                    </label>
                    <label className="field"><span>等级</span>
                      <input type="number" min={1} max={100} value={set.level} onChange={e => update({ level: Math.max(1, Math.min(100, +e.target.value || 1)) })} />
                    </label>
                    <label className="field"><span>性格</span>
                      <select value={set.nature} onChange={e => update({ nature: e.target.value })}>
                        {natures.map(n => (
                          <option key={n.name} value={n.name}>
                            {natureNameZh(n.name)}{n.plus ? `（+${STAT_ZH[n.plus]} -${STAT_ZH[n.minus!]}）` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field"><span>太晶属性</span>
                      <select value={set.teraType} onChange={e => update({ teraType: e.target.value })}>
                        {dex.types.all().filter(t => t.exists).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </select>
                    </label>
                    <label className="field"><span>性别</span>
                      <select value={set.gender} onChange={e => update({ gender: e.target.value as any })}>
                        <option value="">默认</option><option value="M">♂ 雄</option><option value="F">♀ 雌</option>
                      </select>
                    </label>
                    <label className="field"><span>异色（闪光）</span>
                      <select value={set.shiny ? '1' : '0'} onChange={e => update({ shiny: e.target.value === '1' })}>
                        <option value="0">普通</option><option value="1">闪光 ✨</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="editor-section">
                  <h4>特性 & 道具</h4>
                  <div className="form-grid">
                    <label className="field"><span>特性</span>
                      <select value={set.ability} onChange={e => update({ ability: e.target.value })}>
                        {abilities.map(a => <option key={a.id} value={a.name}>{abilityNameZh(a.id)}（{a.name}）</option>)}
                      </select>
                    </label>
                    <label className="field"><span>携带道具</span>
                      <select value={set.item} onChange={e => update({ item: e.target.value })}>
                        <option value="">无道具</option>
                        {items.map(i => <option key={i.id} value={i.name}>{itemNameZh(i.id)}（{i.name}）</option>)}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="editor-section">
                  <h4>技能（{set.moves.filter(Boolean).length}/4）</h4>
                  <div className="move-picker">
                    {[0, 1, 2, 3].map(i => {
                      const mv = set.moves[i] ? dex.moves.get(set.moves[i]) : null;
                      return (
                        <div key={i} className={`move-slot${mv ? '' : ' empty'}`} onClick={() => { setMoveSlot(i); setMoveQuery(''); }}>
                          {mv ? (
                            <>
                              <TypeBadge type={mv.type} />
                              <span className="mv-name">{moveNameZh(mv.id)}</span>
                              <span className="mv-meta">{CATEGORY_ZH[mv.category]} {mv.basePower || '—'}</span>
                            </>
                          ) : '＋ 选择技能'}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="editor-section">
                  <h4>努力值（{total}/{MAX_EV_TOTAL}）</h4>
                  {STAT_KEYS.map(k => (
                    <div className="ev-row" key={k}>
                      <span className="lbl">{STAT_ZH[k]}</span>
                      <input type="range" min={0} max={MAX_EV_SINGLE} step={4} value={set.evs[k]} onChange={e => updateStat('evs', k, +e.target.value)} />
                      <input className="num" type="number" min={0} max={MAX_EV_SINGLE} value={set.evs[k]} onChange={e => updateStat('evs', k, +e.target.value || 0)} />
                      <span className="stat-val">{stats[k]}</span>
                    </div>
                  ))}
                </div>

                <div className="editor-section">
                  <h4>个体值</h4>
                  {STAT_KEYS.map(k => (
                    <div className="ev-row" key={k}>
                      <span className="lbl">{STAT_ZH[k]}</span>
                      <input type="range" min={0} max={31} value={set.ivs[k]} onChange={e => updateStat('ivs', k, +e.target.value)} />
                      <input className="num" type="number" min={0} max={31} value={set.ivs[k]} onChange={e => updateStat('ivs', k, +e.target.value || 0)} />
                      <span className="stat-val">{stats[k]}</span>
                    </div>
                  ))}
                  <div className="row mt" style={{ gap: 8 }}>
                    <button className="btn sm" onClick={() => update({ ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } })}>全部 31</button>
                    <button className="btn sm" onClick={() => update({ ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 0 } })}>特攻手 0攻0速</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={() => onSave(set)}>保存</button>
        </div>
      </div>

      {moveSlot !== null && (
        <div className="modal-overlay" style={{ zIndex: 110 }} onClick={() => setMoveSlot(null)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="title">选择技能 · 槽位 {moveSlot + 1}</div>
              <button className="btn sm ghost" onClick={() => setMoveSlot(null)}>✕</button>
            </div>
            <div className="modal-body">
              <input type="text" autoFocus placeholder="搜索技能…" value={moveQuery} onChange={e => setMoveQuery(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
              <div className="search-list" style={{ maxHeight: 400 }}>
                {set.moves[moveSlot] && (
                  <div className="search-item" onClick={() => { const m = [...set.moves]; m[moveSlot] = ''; update({ moves: m }); setMoveSlot(null); }}>
                    <span className="nm"><div className="zh" style={{ color: '#ff8080' }}>清除此技能</div></span>
                  </div>
                )}
                {filteredMoves.map(m => (
                  <div key={m.id} className="search-item" onClick={() => {
                    const mvs = [...set.moves]; mvs[moveSlot] = m.id; update({ moves: mvs }); setMoveSlot(null);
                  }}>
                    <TypeBadge type={m.type} />
                    <span className="nm">
                      <div className="zh">{moveNameZh(m.id)}</div>
                      <div className="en">{m.name} · {CATEGORY_ZH[m.category]} · 威力 {m.basePower || '—'} · 命中 {m.accuracy === true ? '必中' : m.accuracy} · PP {m.pp}</div>
                    </span>
                  </div>
                ))}
                {!filteredMoves.length && <div className="empty-state small">没有匹配的技能</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}