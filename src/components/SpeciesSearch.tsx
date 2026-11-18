import React, { useMemo, useState } from 'react';
import { allSpecies } from '../lib/dex';
import { speciesNameZh } from '../lib/names';
import { iconSprite } from '../lib/sprites';
import { TypeBadge, Sprite } from './common';
import type { Species } from '@pkmn/dex';

export function SpeciesSearch({
  onSelect, placeholder = '搜索宝可梦（中文名 / 英文名 / 图鉴编号）…', autoFocus,
}: { onSelect: (s: Species) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const all = useMemo(() => allSpecies(), []);
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return all.slice(0, 60);
    const out: Species[] = [];
    for (const s of all) {
      const zh = speciesNameZh(s.name);
      if (
        s.name.toLowerCase().includes(query) ||
        zh.includes(q.trim()) ||
        String(s.num) === query ||
        s.id.includes(query.replace(/[^a-z0-9]/g, ''))
      ) {
        out.push(s);
        if (out.length >= 80) break;
      }
    }
    return out;
  }, [q, all]);

  return (
    <div className="search-box">
      <input
        type="text" value={q} autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => setQ(e.target.value)}
        style={{ width: '100%' }}
      />
      <div className="search-list">
        {results.map(s => (
          <div key={s.id} className="search-item" onClick={() => onSelect(s)}>
            <span className="num">#{String(s.num).padStart(4, '0')}</span>
            <Sprite src={iconSprite(s.name)} alt={s.name} />
            <span className="nm">
              <div className="zh">{speciesNameZh(s.name)}</div>
              <div className="en">{s.name}</div>
            </span>
            <span className="row" style={{ gap: 3 }}>
              {s.types.map(t => <TypeBadge key={t} type={t} />)}
            </span>
          </div>
        ))}
        {!results.length && <div className="empty-state small">没有匹配的宝可梦</div>}
      </div>
    </div>
  );
}