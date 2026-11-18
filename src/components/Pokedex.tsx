import React, { useMemo, useState } from 'react';
import type { Species, Move, Ability, Item } from '@pkmn/dex';
import {
  allSpecies, getSpecies, learnableMoves, speciesAbilities, defensiveMatchups,
  regularMoves, allAbilities, allItems, zMoves, maxMoves, itemCategory,
  zMoveCrystal, zMoveBase, gmaxSpecies, dex,
  CATEGORY_ZH, TYPE_NAMES_ZH, TYPE_COLORS,
} from '../lib/dex';
import { speciesNameZh, abilityNameZh, moveNameZh, itemNameZh } from '../lib/names';
import { STAT_KEYS, STAT_LABELS } from '../lib/types';
import { iconSprite, staticSprite } from '../lib/sprites';
import { TypeBadge, Artwork, Sprite, StatBar } from './common';

type Cat = 'species' | 'moves' | 'items' | 'abilities' | 'z' | 'max';

const CATS: { id: Cat; label: string; icon: string }[] = [
  { id: 'species', label: '宝可梦', icon: '🐾' },
  { id: 'moves', label: '招式', icon: '⚔️' },
  { id: 'items', label: '道具', icon: '🎒' },
  { id: 'abilities', label: '特性', icon: '🧠' },
  { id: 'z', label: 'Z招式', icon: '💎' },
  { id: 'max', label: '极巨招式', icon: '🔥' },
];

interface Entry { id: string; zh: string; en: string; data: any; }

const CAT_SUB: Record<Cat, string> = {
  species: '覆盖全部 9 个世代的宝可梦（含形态）。查看种族值、特性、可学技能与属性克制。',
  moves: '全部常规招式，含属性、分类、威力、命中、PP 与效果说明。',
  items: '全部携带道具，含超级石、Z纯晶、树果与各类对战道具，按类别筛选。',
  abilities: '全部特性，含效果说明与登场世代。',
  z: '第七世代 Z 招式：通用属性 Z 招式与专属 Z 招式，含所需纯晶与基础招式。',
  max: '第八世代极巨招式与超极巨招式，含属性、效果与对应超极巨宝可梦。',
};

export function Pokedex() {
  const [cat, setCat] = useState<Cat>('species');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [selId, setSelId] = useState('charizard');

  const speciesList = useMemo(() => allSpecies(), []);
  const moveList = useMemo(() => regularMoves(), []);
  const abilityList = useMemo(() => allAbilities(), []);
  const itemList = useMemo(() => allItems(), []);
  const zList = useMemo(() => zMoves(), []);
  const maxList = useMemo(() => maxMoves(), []);

  const itemCats = useMemo(() => {
    const set = new Set<string>();
    itemList.forEach(i => set.add(itemCategory(i)));
    return ['超级石', 'Z纯晶', '树果', '回复道具', '攻击道具', '防御道具', '功能道具', '属性道具', '专属道具', '其他道具'].filter(c => set.has(c));
  }, [itemList]);

  const entries: Entry[] = useMemo(() => {
    switch (cat) {
      case 'species': return speciesList.map(s => ({ id: s.id, zh: speciesNameZh(s.name), en: s.name, data: s }));
      case 'moves': return moveList.map(m => ({ id: m.id, zh: moveNameZh(m.id), en: m.name, data: m }));
      case 'abilities': return abilityList.map(a => ({ id: a.id, zh: abilityNameZh(a.id), en: a.name, data: a }));
      case 'items': return itemList.map(i => ({ id: i.id, zh: itemNameZh(i.id), en: i.name, data: i }));
      case 'z': return zList.map(m => ({ id: m.id, zh: moveNameZh(m.id), en: m.name, data: m }));
      case 'max': return maxList.map(m => ({ id: m.id, zh: moveNameZh(m.id), en: m.name, data: m }));
    }
  }, [cat, speciesList, moveList, abilityList, itemList, zList, maxList]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = entries;
    if (cat === 'items' && filter) list = list.filter(e => itemCategory(e.data) === filter);
    if (cat === 'moves' && filter) list = list.filter(e => e.data.type === filter);
    if (cat === 'z' && filter) list = list.filter(e => e.data.type === filter);
    if (cat === 'max' && filter) list = list.filter(e => (filter === 'G-Max' ? !!gmaxSpecies(e.data) : !gmaxSpecies(e.data)));
    if (!query) return list;
    const out: Entry[] = [];
    for (const e of list) {
      if (
        e.en.toLowerCase().includes(query) ||
        e.zh.includes(q.trim()) ||
        e.id.includes(query.replace(/[^a-z0-9]/g, '')) ||
        (cat === 'species' && String(e.data.num) === query)
      ) out.push(e);
      if (out.length >= 400) break;
    }
    return out;
  }, [entries, q, filter, cat]);

  const selected = useMemo(() => entries.find(e => e.id === selId) || results[0] || entries[0], [entries, selId, results]);

  const switchCat = (c: Cat) => {
    setCat(c); setQ(''); setFilter('');
    const first = c === 'species' ? 'charizard' : c === 'moves' ? 'flamethrower' : c === 'items' ? 'leftovers' : c === 'abilities' ? 'intimidate' : c === 'z' ? 'gigavolthavoc' : 'maxflare';
    setSelId(first);
  };

  return (
    <div>
      <h2 className="view-title">宝可梦图鉴</h2>
      <p className="view-sub">{CAT_SUB[cat]}</p>

      <div className="dex-tabs">
        {CATS.map(c => (
          <button key={c.id} className={`dex-tab${cat === c.id ? ' active' : ''}`} onClick={() => switchCat(c.id)}>
            <span className="ic">{c.icon}</span>{c.label}
            <span className="ct">{countFor(c.id, { speciesList, moveList, abilityList, itemList, zList, maxList })}</span>
          </button>
        ))}
      </div>

      <div className="dex-layout">
        <div>
          <input
            type="text" value={q} placeholder="搜索中文名 / 英文名 / 编号…"
            onChange={e => setQ(e.target.value)} style={{ width: '100%', marginBottom: 10 }}
          />
          <FilterBar cat={cat} filter={filter} setFilter={setFilter} itemCats={itemCats} />
          <div className="dex-list">
            {results.map(e => (
              <div key={e.id} className={`search-item${selected && e.id === selected.id ? ' active' : ''}`} onClick={() => setSelId(e.id)}>
                <ListIcon cat={cat} entry={e} />
                <span className="nm">
                  <div className="zh">{e.zh}</div>
                  <div className="en">{e.en}</div>
                </span>
                <ListTag cat={cat} entry={e} />
              </div>
            ))}
            {!results.length && <div className="empty-state small">没有匹配的结果</div>}
          </div>
        </div>

        <div className="dex-detail" key={(selected?.id || '') + cat}>
          {selected ? <Detail cat={cat} entry={selected} /> : <div className="panel muted">请选择左侧条目查看详情。</div>}
        </div>
      </div>
    </div>
  );
}

function countFor(c: Cat, lists: Record<string, any[]>): number {
  return (lists[c === 'species' ? 'speciesList' : c === 'moves' ? 'moveList' : c === 'abilities' ? 'abilityList' : c === 'items' ? 'itemList' : c === 'z' ? 'zList' : 'maxList'] || []).length;
}

const TYPE_OPTIONS = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

function FilterBar({ cat, filter, setFilter, itemCats }: { cat: Cat; filter: string; setFilter: (s: string) => void; itemCats: string[] }) {
  if (cat === 'items') {
    return (
      <div className="dex-filter">
        <button className={`chip${!filter ? ' on' : ''}`} onClick={() => setFilter('')}>全部</button>
        {itemCats.map(c => <button key={c} className={`chip${filter === c ? ' on' : ''}`} onClick={() => setFilter(c)}>{c}</button>)}
      </div>
    );
  }
  if (cat === 'moves' || cat === 'z') {
    return (
      <div className="dex-filter">
        <button className={`chip${!filter ? ' on' : ''}`} onClick={() => setFilter('')}>全部</button>
        {TYPE_OPTIONS.map(t => (
          <button key={t} className={`chip type${filter === t ? ' on' : ''}`} style={{ borderColor: TYPE_COLORS[t] }} onClick={() => setFilter(filter === t ? '' : t)}>
            {TYPE_NAMES_ZH[t]}
          </button>
        ))}
      </div>
    );
  }
  if (cat === 'max') {
    return (
      <div className="dex-filter">
        <button className={`chip${!filter ? ' on' : ''}`} onClick={() => setFilter('')}>全部</button>
        <button className={`chip${filter === 'Max' ? ' on' : ''}`} onClick={() => setFilter('Max')}>极巨招式</button>
        <button className={`chip${filter === 'G-Max' ? ' on' : ''}`} onClick={() => setFilter('G-Max')}>超极巨招式</button>
      </div>
    );
  }
  return null;
}

function ListIcon({ cat, entry }: { cat: Cat; entry: Entry }) {
  if (cat === 'species') return <Sprite src={iconSprite(entry.data.name)} alt={entry.en} />;
  if (cat === 'items') {
    const i: Item = entry.data;
    if (i.megaStone) {
      const sp = Object.keys(i.megaStone)[0];
      return <Sprite src={iconSprite(sp)} alt={entry.en} className="item-mega-icon" />;
    }
    return <span className="item-glyph" style={{ background: itemGlyphColor(i) }}>{itemGlyph(i)}</span>;
  }
  if (cat === 'moves' || cat === 'z' || cat === 'max') {
    return <span className="move-glyph" style={{ background: TYPE_COLORS[entry.data.type] || '#777' }}>{(entry.data.type || '?').slice(0, 1)}</span>;
  }
  return <span className="ability-glyph">🧠</span>;
}

function ListTag({ cat, entry }: { cat: Cat; entry: Entry }) {
  if (cat === 'species') return <span className="num">#{String(entry.data.num).padStart(4, '0')}</span>;
  if (cat === 'moves' || cat === 'z' || cat === 'max') return <TypeBadge type={entry.data.type} />;
  if (cat === 'items') return <span className="item-cat-tag">{itemCategory(entry.data)}</span>;
  if (cat === 'abilities') return <span className="num">Gen{entry.data.gen}</span>;
  return null;
}

function itemGlyph(i: Item): string {
  if (i.zMove) return '💎';
  if (i.isBerry) return '🍒';
  if (i.id === 'leftovers' || i.id === 'blacksludge' || i.id === 'shellbell') return '❤️';
  if (i.id.startsWith('choice')) return '🎯';
  if (i.id === 'lifeorb') return '🔮';
  if (i.id === 'eviolite' || i.id === 'assaultvest') return '🛡️';
  if (i.id === 'heavydutyboots') return '👢';
  if (i.id.includes('plate') || i.id.includes('memory') || i.id.includes('drive')) return '🧩';
  return '🎒';
}
function itemGlyphColor(i: Item): string {
  if (i.megaStone) return 'linear-gradient(135deg,#8b5cf6,#6d28d9)';
  if (i.zMove) return 'linear-gradient(135deg,#fbbf24,#d97706)';
  if (i.isBerry) return 'linear-gradient(135deg,#22c55e,#15803d)';
  return 'linear-gradient(135deg,#3a4553,#222a35)';
}

// ---- Detail router ----
function Detail({ cat, entry }: { cat: Cat; entry: Entry }) {
  switch (cat) {
    case 'species': return <SpeciesDetail species={entry.data} />;
    case 'moves': return <MoveDetail move={entry.data} />;
    case 'z': return <ZMoveDetail move={entry.data} />;
    case 'max': return <MaxMoveDetail move={entry.data} />;
    case 'items': return <ItemDetail item={entry.data} />;
    case 'abilities': return <AbilityDetail ability={entry.data} />;
  }
}

function DetailHero({ title, en, sub, badges, children }: { title: string; en: string; sub?: string; badges?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="enc-hero">
        <div className="enc-hero-text">
          {sub && <div className="num">{sub}</div>}
          <div className="zh-name">{title}</div>
          <div className="en-name">{en}</div>
          {badges && <div className="row wrap mt" style={{ gap: 6 }}>{badges}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function StatGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="enc-stats">
      {rows.map(([k, v], i) => (
        <div key={i} className="enc-stat"><span className="k">{k}</span><span className="v">{v}</span></div>
      ))}
    </div>
  );
}

// ---- Species ----
function SpeciesDetail({ species }: { species: Species }) {
  const abilities = useMemo(() => speciesAbilities(species), [species]);
  const moves = useMemo(() => learnableMoves(species), [species]);
  const matchups = useMemo(() => defensiveMatchups(species.types), [species]);
  const [moveQuery, setMoveQuery] = useState('');
  const total = STAT_KEYS.reduce((a, k) => a + species.baseStats[k], 0);

  const filteredMoves = useMemo(() => {
    const query = moveQuery.trim().toLowerCase();
    if (!query) return moves;
    return moves.filter(m => m.name.toLowerCase().includes(query) || moveNameZh(m.id).includes(moveQuery.trim()));
  }, [moves, moveQuery]);

  const weak = Object.entries(matchups).filter(([, m]) => m >= 2).sort((a, b) => b[1] - a[1]);
  const resist = Object.entries(matchups).filter(([, m]) => m > 0 && m < 1).sort((a, b) => a[1] - b[1]);
  const immune = Object.entries(matchups).filter(([, m]) => m === 0);

  return (
    <>
      <div className="panel">
        <div className="hero">
          <Artwork species={species.name} />
          <div className="info">
            <div className="num">#{String(species.num).padStart(4, '0')} · 第 {species.gen} 世代</div>
            <div className="zh-name">{speciesNameZh(species.name)}</div>
            <div className="en-name">{species.name}</div>
            <div className="row mt" style={{ gap: 6 }}>
              {species.types.map(t => <TypeBadge key={t} type={t} lg />)}
            </div>
            <div className="row wrap mt small muted" style={{ gap: 14 }}>
              <span>体重 {(species.weightkg || 0).toFixed(1)} kg</span>
              {species.baseSpecies && species.forme && <span>形态：{species.forme}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="row mb"><strong>种族值</strong><span className="grow" /><span className="muted small">合计 {total}</span></div>
        {STAT_KEYS.map(k => <StatBar key={k} label={STAT_LABELS[k]} value={species.baseStats[k]} />)}
      </div>

      <div className="panel">
        <div className="row mb"><strong>特性</strong></div>
        <div className="row wrap" style={{ gap: 10 }}>
          {abilities.map(a => (
            <div key={a.id} className="ability-card" style={{ flex: '1 1 220px' }}>
              <div className="ab-name">{abilityNameZh(a.id)}{a.id === (species.abilities as any).H ? <span className="muted small"> · 隐藏特性</span> : null}</div>
              <div className="ab-desc">{a.shortDesc || a.desc}</div>
            </div>
          ))}
          {!abilities.length && <span className="muted small">无可用特性数据</span>}
        </div>
      </div>

      <div className="panel">
        <div className="row mb"><strong>属性克制（防御视角）</strong></div>
        <MatchupRow title="弱点" entries={weak} />
        <MatchupRow title="抗性" entries={resist} />
        <MatchupRow title="免疫" entries={immune} />
      </div>

      <div className="panel">
        <div className="row mb" style={{ gap: 10 }}>
          <strong>可学技能</strong>
          <span className="muted small">{moves.length} 个</span>
          <span className="grow" />
          <input type="text" value={moveQuery} placeholder="筛选技能…" onChange={e => setMoveQuery(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table className="move-table">
            <thead><tr><th>技能</th><th>属性</th><th>分类</th><th>威力</th><th>命中</th><th>PP</th></tr></thead>
            <tbody>
              {filteredMoves.map(m => (
                <tr key={m.id}>
                  <td>{moveNameZh(m.id)}<div className="muted" style={{ fontSize: 10 }}>{m.name}</div></td>
                  <td><TypeBadge type={m.type} /></td>
                  <td>{CATEGORY_ZH[m.category]}</td>
                  <td>{m.basePower || '—'}</td>
                  <td>{m.accuracy === true ? '必中' : m.accuracy}</td>
                  <td>{m.pp}</td>
                </tr>
              ))}
              {!filteredMoves.length && <tr><td colSpan={6} className="muted small">无匹配技能</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function MatchupRow({ title, entries }: { title: string; entries: [string, number][] }) {
  if (!entries.length) return null;
  return (
    <div className="row wrap mb" style={{ gap: 6, alignItems: 'center' }}>
      <span className="small muted" style={{ minWidth: 40 }}>{title}</span>
      {entries.map(([t, m]) => (
        <span key={t} className="row" style={{ gap: 2, alignItems: 'center' }}>
          <TypeBadge type={t} />
          <span className="small" style={{ fontWeight: 700, color: m >= 2 ? '#7ee787' : m === 0 ? '#9aa7b4' : '#ff8080' }}>
            {m === 0.25 ? '¼' : m === 0.5 ? '½' : m}×
          </span>
        </span>
      ))}
    </div>
  );
}

// ---- Move ----
function MoveDetail({ move }: { move: Move }) {
  const priority = move.priority || 0;
  return (
    <>
      <DetailHero title={moveNameZh(move.id)} en={move.name} sub={`第 ${move.gen} 世代 · ${CATEGORY_ZH[move.category]}招式`}
        badges={<><TypeBadge type={move.type} lg /><span className="enc-pill">{CATEGORY_ZH[move.category]}</span>{move.isZ && <span className="enc-pill z">Z招式</span>}{move.isMax && <span className="enc-pill max">极巨招式</span>}</>} />
      <div className="panel">
        <div className="row mb"><strong>招式数据</strong></div>
        <StatGrid rows={[
          ['威力', move.basePower || '—'],
          ['命中', move.accuracy === true ? '必中' : `${move.accuracy}%`],
          ['PP', `${move.pp}（最大 ${move.pp * 1.6 | 0}）`],
          ['优先度', priority > 0 ? `+${priority}` : String(priority)],
          ['目标', targetZh(move.target)],
          ['接触', move.flags?.contact ? '是' : '否'],
        ]} />
      </div>
      <div className="panel">
        <div className="row mb"><strong>效果说明</strong></div>
        <p className="enc-desc">{move.desc || move.shortDesc || '无额外效果说明。'}</p>
        {move.secondary && <p className="enc-desc muted small">追加效果：{(move.secondary as any).shortDesc || (move.secondary as any).desc || ''}</p>}
      </div>
    </>
  );
}

function targetZh(t: string): string {
  const map: Record<string, string> = {
    normal: '邻近对手', adjacentFoe: '邻近对手', adjacentAlly: '邻近同伴', adjacentAllyOrSelf: '同伴或自身',
    any: '任意位置', all: '全场', foeSide: '对方场地', allySide: '我方场地', allies: '我方全体',
    allAdjacent: '邻近全体', allAdjacentFoes: '邻近对手全体', self: '自身', randomNormal: '随机对手',
    scripted: '特殊',
  };
  return map[t] || t;
}

// ---- Z-Move ----
function ZMoveDetail({ move }: { move: Move }) {
  const crystalId = zMoveCrystal(move);
  const crystal = crystalId ? dex.items.get(crystalId) : null;
  const baseId = zMoveBase(move);
  const baseMove = baseId ? dex.moves.get(baseId) : null;
  const isSignature = !!baseMove;
  const power = move.basePower > 1 ? move.basePower : '依基础招式';
  return (
    <>
      <DetailHero title={moveNameZh(move.id)} en={move.name} sub="第七世代 · Z招式"
        badges={<><TypeBadge type={move.type} lg /><span className="enc-pill z">{isSignature ? '专属 Z 招式' : '通用 Z 招式'}</span></>} />
      <div className="panel">
        <div className="row mb"><strong>Z 招式数据</strong></div>
        <StatGrid rows={[
          ['属性', <TypeBadge type={move.type} />],
          ['分类', CATEGORY_ZH[move.category] || move.category],
          ['威力', power],
          ['命中', '必中'],
          ['所需纯晶', crystal ? itemNameZh(crystal.id) : '—'],
          ['基础招式', baseMove ? moveNameZh(baseMove.id) : (isSignature ? '—' : '同属性攻击招式')],
        ]} />
      </div>
      <div className="panel">
        <div className="row mb"><strong>使用说明</strong></div>
        <p className="enc-desc">
          {isSignature
            ? `携带「${crystal ? itemNameZh(crystal.id) : ''}」且学会「${baseMove ? moveNameZh(baseMove.id) : ''}」的特定宝可梦，可将该招式升级为专属 Z 招式「${moveNameZh(move.id)}」，每场对战限用一次。`
            : `携带对应属性的 Z 纯晶「${crystal ? itemNameZh(crystal.id) : ''}」，可将任意该属性的攻击招式升级为「${moveNameZh(move.id)}」。威力随基础招式提升，Z 招式必定命中且可击穿守住，每场对战限用一次。`}
        </p>
        {move.shortDesc && <p className="enc-desc muted small">{move.shortDesc}</p>}
      </div>
    </>
  );
}

// ---- Max Move ----
function MaxMoveDetail({ move }: { move: Move }) {
  const gmax = gmaxSpecies(move);
  const gmaxSp = gmax ? getSpecies(gmax) : null;
  return (
    <>
      <DetailHero title={moveNameZh(move.id)} en={move.name} sub={`第八世代 · ${gmax ? '超极巨招式' : '极巨招式'}`}
        badges={<><TypeBadge type={move.type} lg /><span className="enc-pill max">{gmax ? '超极巨' : '极巨'}</span></>}>
        {gmaxSp && gmaxSp.exists && <Artwork species={gmaxSp.name} className="enc-gmax-art" />}
      </DetailHero>
      <div className="panel">
        <div className="row mb"><strong>极巨招式数据</strong></div>
        <StatGrid rows={[
          ['属性', <TypeBadge type={move.type} />],
          ['分类', CATEGORY_ZH[move.category] || move.category],
          ['威力', move.basePower || '依基础招式'],
          ['命中', '必中'],
          ['类型', gmax ? '超极巨招式（G-Max）' : '极巨招式（Max）'],
          ['对应宝可梦', gmaxSp && gmaxSp.exists ? speciesNameZh(gmaxSp.name) : '任意可极巨化宝可梦'],
        ]} />
      </div>
      <div className="panel">
        <div className="row mb"><strong>效果说明</strong></div>
        <p className="enc-desc">{move.desc || move.shortDesc || '极巨化后由基础招式转化而来，威力依基础招式提升。'}</p>
        <p className="enc-desc muted small">极巨化持续 3 回合，期间所有招式变为极巨招式；超极巨招式由特定超极巨化宝可梦使用，附带独特追加效果。</p>
      </div>
    </>
  );
}

// ---- Item ----
function ItemDetail({ item }: { item: Item }) {
  const cat = itemCategory(item);
  const mega = item.megaStone ? Object.entries(item.megaStone)[0] : null;
  const megaFrom = mega ? getSpecies(mega[0]) : null;
  const megaTo = mega ? getSpecies(mega[1]) : null;
  const zCrystalMove = typeof item.zMove === 'string' ? dex.moves.get(item.zMove) : null;
  const zFrom = (item as any).zMoveFrom ? dex.moves.get((item as any).zMoveFrom) : null;
  const zUser = (item as any).zMoveUser as string[] | undefined;
  return (
    <>
      <DetailHero title={itemNameZh(item.id)} en={item.name} sub={`第 ${item.gen} 世代 · ${cat}`}
        badges={<><span className="enc-pill">{cat}</span>{item.megaStone && <span className="enc-pill mega">超级石</span>}{item.zMove && <span className="enc-pill z">Z纯晶</span>}{item.isBerry && <span className="enc-pill berry">树果</span>}</>}>
        {megaTo && megaTo.exists && <Artwork species={megaTo.name} className="enc-gmax-art" />}
      </DetailHero>
      <div className="panel">
        <div className="row mb"><strong>道具说明</strong></div>
        <p className="enc-desc">{item.desc || item.shortDesc || '无额外说明。'}</p>
      </div>
      {item.megaStone && megaFrom && megaTo && (
        <div className="panel">
          <div className="row mb"><strong>超级进化</strong></div>
          <div className="mega-row">
            <div className="mega-mon"><Sprite src={staticSprite(megaFrom.name)} alt={megaFrom.name} /><div>{speciesNameZh(megaFrom.name)}</div></div>
            <div className="mega-arrow">➜</div>
            <div className="mega-mon"><Sprite src={staticSprite(megaTo.name)} alt={megaTo.name} /><div>{speciesNameZh(megaTo.name)}</div></div>
          </div>
          <p className="enc-desc muted small mt">{megaFrom.name} 携带「{itemNameZh(item.id)}」时，可在对战中超级进化为 {megaTo.name}（每场一次）。</p>
        </div>
      )}
      {item.zMove && (
        <div className="panel">
          <div className="row mb"><strong>Z 招式</strong></div>
          <StatGrid rows={[
            ['转化招式', zCrystalMove ? moveNameZh(zCrystalMove.id) : '同属性攻击招式'],
            ['基础招式', zFrom ? moveNameZh(zFrom.id) : '任意同属性攻击招式'],
            ['适用宝可梦', zUser && zUser.length ? zUser.map(u => speciesNameZh(u)).join('、') : '任意携带者'],
          ]} />
        </div>
      )}
      {(item.fling || item.naturalGift) && (
        <div className="panel">
          <div className="row mb"><strong>其他数据</strong></div>
          <StatGrid rows={[
            ...(item.fling ? [['投掷威力', item.fling.basePower] as [string, React.ReactNode]] : []),
            ...(item.naturalGift ? [['自然之恩属性', <TypeBadge type={item.naturalGift.type} />] as [string, React.ReactNode], ['自然之恩威力', item.naturalGift.basePower] as [string, React.ReactNode]] : []),
          ]} />
        </div>
      )}
    </>
  );
}

// ---- Ability ----
function AbilityDetail({ ability }: { ability: Ability }) {
  return (
    <>
      <DetailHero title={abilityNameZh(ability.id)} en={ability.name} sub={`第 ${ability.gen} 世代 · 特性`}
        badges={<span className="enc-pill">特性</span>} />
      <div className="panel">
        <div className="row mb"><strong>特性效果</strong></div>
        <p className="enc-desc">{ability.desc || ability.shortDesc || '无额外说明。'}</p>
      </div>
    </>
  );
}