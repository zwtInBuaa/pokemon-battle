import React, { useMemo, useState } from 'react';
import {
  STANDARD_TYPES, TYPE_NAMES_ZH, buildTypeChart, defensiveMatchups,
} from '../lib/dex';
import { TypeBadge } from './common';

// CSS class + label for an effectiveness multiplier.
function effClass(m: number): string {
  if (m === 0) return 'eff-0';
  if (m === 0.5 || m === 0.25) return 'eff-05';
  if (m >= 2) return 'eff-2';
  return 'eff-1';
}
function effLabel(m: number): string {
  if (m === 0) return '0';
  if (m === 0.25) return '¼';
  if (m === 0.5) return '½';
  if (m === 1) return '';
  if (m === 2) return '2';
  if (m === 4) return '4';
  return String(m);
}

export function TypeChart() {
  const chart = useMemo(() => buildTypeChart(), []);
  const [mode, setMode] = useState<'attack' | 'defense'>('attack');

  return (
    <div>
      <h2 className="view-title">属性克制表</h2>
      <p className="view-sub">
        18 种属性的完整克制关系。攻击表：行 = 攻击属性，列 = 防御属性；数值为该属性招式打在对方属性上的倍率。
      </p>

      <div className="row mb" style={{ gap: 8 }}>
        <button className={`btn sm${mode === 'attack' ? ' primary' : ''}`} onClick={() => setMode('attack')}>攻击克制表</button>
        <button className={`btn sm${mode === 'defense' ? ' primary' : ''}`} onClick={() => setMode('defense')}>双属性防御计算器</button>
      </div>

      {mode === 'attack' ? <AttackChart chart={chart} /> : <DefenseCalc />}
    </div>
  );
}

function AttackChart({ chart }: { chart: Record<string, Record<string, number>> }) {
  return (
    <div className="panel">
      <div className="chart-scroll">
        <table className="chart-table">
          <thead>
            <tr>
              <th className="corner">攻＼防</th>
              {STANDARD_TYPES.map(d => (
                <th key={d} title={TYPE_NAMES_ZH[d]}>
                  <span className="type-badge" style={{ background: 'transparent', padding: 0, fontSize: 10 }}>{TYPE_NAMES_ZH[d]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STANDARD_TYPES.map(a => (
              <tr key={a}>
                <td className="row-head"><TypeBadge type={a} /></td>
                {STANDARD_TYPES.map(d => {
                  const m = chart[a][d];
                  return (
                    <td key={d} className={effClass(m)} title={`${TYPE_NAMES_ZH[a]} → ${TYPE_NAMES_ZH[d]}：${m}×`}>
                      {effLabel(m)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chart-legend">
        <div className="item"><span className="swatch eff-2" /> 2× 效果绝佳</div>
        <div className="item"><span className="swatch eff-1" /> 1× 普通</div>
        <div className="item"><span className="swatch eff-05" /> ½× 效果不佳</div>
        <div className="item"><span className="swatch eff-0" /> 0× 无效</div>
      </div>
    </div>
  );
}

function DefenseCalc() {
  const [types, setTypes] = useState<string[]>(['Fire', 'Flying']);
  const matchups = useMemo(() => defensiveMatchups(types), [types]);

  const toggle = (t: string) => {
    setTypes(prev => {
      if (prev.includes(t)) return prev.filter(x => x !== t);
      if (prev.length >= 2) return [prev[1], t];
      return [...prev, t];
    });
  };

  // Group incoming types by multiplier for a quick summary.
  const groups: Record<string, string[]> = { '4': [], '2': [], '1': [], '0.5': [], '0.25': [], '0': [] };
  for (const [atk, m] of Object.entries(matchups)) {
    const key = String(m);
    (groups[key] || (groups[key] = [])).push(atk);
  }

  return (
    <div className="panel">
      <div className="row mb"><strong>选择防御方属性（1~2 个）</strong></div>
      <div className="row wrap mb" style={{ gap: 6 }}>
        {STANDARD_TYPES.map(t => (
          <button key={t} className={`btn sm${types.includes(t) ? ' primary' : ' ghost'}`} onClick={() => toggle(t)}>
            {TYPE_NAMES_ZH[t]}
          </button>
        ))}
      </div>

      <div className="row mb" style={{ gap: 8, alignItems: 'center' }}>
        <span className="muted small">当前防御属性：</span>
        {types.length ? types.map(t => <TypeBadge key={t} type={t} lg />) : <span className="muted small">未选择（视为无属性，全部 1×）</span>}
      </div>

      <div className="matchup-grid mb">
        {STANDARD_TYPES.map(atk => {
          const m = matchups[atk];
          return (
            <div key={atk} className="matchup-cell">
              <TypeBadge type={atk} />
              <div className="mult" style={{ color: m >= 2 ? '#7ee787' : m === 0 ? '#888' : m < 1 ? '#ff8080' : 'var(--text-dim)' }}>
                {m === 0 ? '0' : m === 0.25 ? '¼' : m === 0.5 ? '½' : m}×
              </div>
            </div>
          );
        })}
      </div>

      <div className="row wrap" style={{ gap: 16 }}>
        <Summary title="4× 弱点" types={groups['4']} color="#7ee787" />
        <Summary title="2× 弱点" types={groups['2']} color="#a3e635" />
        <Summary title="½× 抗性" types={groups['0.5']} color="#ff9b9b" />
        <Summary title="¼× 抗性" types={groups['0.25']} color="#ff8080" />
        <Summary title="0× 免疫" types={groups['0']} color="#9aa7b4" />
      </div>
    </div>
  );
}

function Summary({ title, types, color }: { title: string; types: string[]; color: string }) {
  if (!types.length) return null;
  return (
    <div>
      <div className="small" style={{ color, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div className="row wrap" style={{ gap: 4 }}>{types.map(t => <TypeBadge key={t} type={t} />)}</div>
    </div>
  );
}