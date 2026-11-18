import React, { useState } from 'react';
import { createDefaultSet, randomTeam, exportTeam, importTeam, presetTeam, PRESET_OU_TEAM, PRESET_MEGA_Z_TEAM, PRESET_DYNAMAX_TEAM } from '../lib/teams';
import { speciesNameZh, itemNameZh, abilityNameZh } from '../lib/names';
import { getSpecies } from '../lib/dex';
import type { PokemonSet } from '../lib/types';
import { TypeBadge, Artwork, GenderIcon } from './common';
import { PokemonEditor } from './PokemonEditor';
import { SpeciesSearch } from './SpeciesSearch';

export function TeamBuilder({ team, setTeam }: { team: PokemonSet[]; setTeam: (t: PokemonSet[]) => void }) {
  const [editor, setEditor] = useState<{ index: number; set: PokemonSet } | null>(null);
  const [adding, setAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [showExport, setShowExport] = useState(false);

  const saveSet = (s: PokemonSet) => {
    if (!editor) return;
    const next = [...team];
    if (editor.index < next.length) next[editor.index] = s;
    else next.push(s);
    setTeam(next.slice(0, 6));
    setEditor(null);
  };

  const remove = (i: number) => setTeam(team.filter((_, idx) => idx !== i));

  return (
    <div>
      <h2 className="view-title">组队</h2>
      <p className="view-sub">构建你的队伍（最多 6 只）。点击卡片编辑技能、特性、道具、性格、努力值与个体值。</p>

      <div className="row wrap mb" style={{ gap: 8 }}>
        <button className="btn primary" disabled={team.length >= 6} onClick={() => setAdding(true)}>＋ 添加宝可梦</button>
        <button className="btn" onClick={() => setTeam(randomTeam('gen9randombattle'))}>🎲 随机队伍</button>
        <button className="btn" onClick={() => setTeam(PRESET_OU_TEAM.map(s => ({ ...s })))}>📋 示例 OU 队</button>
        <button className="btn" title="第七世代：超级进化 + Z 招式" onClick={() => setTeam(PRESET_MEGA_Z_TEAM.map(s => ({ ...s })))}>🧬 超级进化/Z队</button>
        <button className="btn" title="第八世代：极巨化 / 超极巨化" onClick={() => setTeam(PRESET_DYNAMAX_TEAM.map(s => ({ ...s })))}>🔥 极巨化队</button>
        <button className="btn" onClick={() => setShowImport(true)}>导入</button>
        <button className="btn" disabled={!team.length} onClick={() => setShowExport(true)}>导出</button>
        <button className="btn danger ghost" disabled={!team.length} onClick={() => setTeam([])}>清空</button>
        <span className="grow" />
        <span className="muted small">{team.length}/6 只</span>
      </div>

      <div className="team-grid">
        {team.map((s, i) => {
          const sp = getSpecies(s.species);
          return (
            <div key={i} className="team-card" onClick={() => setEditor({ index: i, set: s })}>
              <button className="btn sm danger remove" onClick={e => { e.stopPropagation(); remove(i); }}>✕</button>
              <Artwork species={s.species} shiny={s.shiny} className="art" />
              <div className="name">{s.name || speciesNameZh(s.species)} <GenderIcon gender={s.gender} /></div>
              <div className="types">{sp.types.map(t => <TypeBadge key={t} type={t} />)}</div>
              <div className="meta">
                <span>Lv.{s.level}</span>
                <span>{abilityNameZh(s.ability)}</span>
              </div>
              <div className="meta">
                <span>{s.item ? itemNameZh(s.item) : '无道具'}</span>
                <span>{s.moves.filter(Boolean).length} 技能</span>
              </div>
            </div>
          );
        })}
        {team.length < 6 && (
          <div className="team-card empty" onClick={() => setAdding(true)}>
            <div style={{ fontSize: 36 }}>＋</div>
            <div>添加宝可梦</div>
          </div>
        )}
      </div>

      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="title">选择宝可梦</div>
              <button className="btn sm ghost" onClick={() => setAdding(false)}>✕</button>
            </div>
            <div className="modal-body">
              <SpeciesSearch autoFocus onSelect={s => { setAdding(false); setEditor({ index: team.length, set: createDefaultSet(s.name) }); }} />
            </div>
          </div>
        </div>
      )}

      {editor && <PokemonEditor initial={editor.set} onSave={saveSet} onClose={() => setEditor(null)} />}

      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="title">导入队伍（Showdown 格式）</div>
              <button className="btn sm ghost" onClick={() => setShowImport(false)}>✕</button></div>
            <div className="modal-body">
              <textarea rows={14} style={{ width: '100%' }} value={importText} onChange={e => setImportText(e.target.value)}
                placeholder={'粘贴 Showdown 队伍文本，例如：\n\nCharizard @ Heavy-Duty Boots\nAbility: Blaze\nLevel: 50\nEVs: 252 SpA / 4 SpD / 252 Spe\nModest Nature\n- Flamethrower\n- Air Slash\n- Roost\n- Will-O-Wisp'} />
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowImport(false)}>取消</button>
              <button className="btn primary" onClick={() => { const t = importTeam(importText); if (t.length) setTeam(t); setShowImport(false); }}>导入</button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="title">导出队伍</div>
              <button className="btn sm ghost" onClick={() => setShowExport(false)}>✕</button></div>
            <div className="modal-body">
              <textarea rows={16} readOnly style={{ width: '100%' }} value={exportTeam(team)} />
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => navigator.clipboard?.writeText(exportTeam(team))}>复制到剪贴板</button>
              <button className="btn primary" onClick={() => setShowExport(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}