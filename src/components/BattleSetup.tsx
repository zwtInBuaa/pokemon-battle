import React, { useMemo, useState } from 'react';
import { FORMATS, validateTeam } from '../lib/teams';
import { speciesNameZh } from '../lib/names';
import { getSpecies } from '../lib/dex';
import type { PokemonSet } from '../lib/types';
import { TypeBadge, Artwork } from './common';

export function BattleSetup({ team, onStart }: { team: PokemonSet[]; onStart: (formatId: string) => void }) {
  const [formatId, setFormatId] = useState('gen9randombattle');
  const fmt = FORMATS.find(f => f.id === formatId)!;

  const problems = useMemo(() => {
    if (fmt.random || !team.length) return [];
    return validateTeam(team, formatId);
  }, [formatId, team, fmt.random]);

  const canStart = fmt.random || (team.length > 0 && problems.length === 0);

  return (
    <div>
      <h2 className="view-title">对战</h2>
      <p className="view-sub">选择规则开始对战。随机模式使用系统生成的队伍；自定义 / OU / VGC 模式使用你在「组队」中构建的队伍。</p>

      <div className="format-grid mb">
        {FORMATS.map(f => (
          <div key={f.id} className={`format-card${f.id === formatId ? ' selected' : ''}`} onClick={() => setFormatId(f.id)}>
            <div className="fc-name">{f.name}<span className="fc-tag">{f.gameType === 'doubles' ? '双打' : '单打'}</span></div>
            {f.mechanic && <div className="fc-mech">✦ {f.mechanic}</div>}
            <div className="fc-desc">{f.description}</div>
          </div>
        ))}
      </div>

      {!fmt.random && (
        <div className="panel mb">
          <div className="row wrap" style={{ gap: 12 }}>
            <strong>我的队伍（{team.length}/6）</strong>
            {!team.length && <span className="muted small">尚未组队，请先到「组队」标签构建队伍，或使用随机模式。</span>}
          </div>
          {team.length > 0 && (
            <div className="row wrap mt" style={{ gap: 10 }}>
              {team.map((s, i) => (
                <div key={i} className="row" style={{ gap: 6, background: 'var(--bg-2)', padding: '6px 10px', borderRadius: 8 }}>
                  <Artwork species={s.species} className="sprite art" />
                  <span className="small">{s.name || speciesNameZh(s.species)}</span>
                  {getSpecies(s.species).types.map(t => <TypeBadge key={t} type={t} />)}
                </div>
              ))}
            </div>
          )}
          {problems.length > 0 && (
            <div className="banner warn mt">
              <strong>队伍不符合当前规则：</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {team.length > 0 && problems.length === 0 && (
            <div className="banner ok mt">队伍校验通过，可以开始对战。</div>
          )}
        </div>
      )}

      {fmt.random && (
        <div className="banner info mb">随机模式：双方队伍由系统随机生成，无需预先组队。点击开始即可对战。</div>
      )}

      <button className="btn primary lg" disabled={!canStart} onClick={() => onStart(formatId)}>
        ⚔️ 开始对战 · {fmt.name}
      </button>
    </div>
  );
}