import React, { useEffect, useRef, useState } from 'react';
import type { PokemonSet } from './lib/types';
import { BattleController } from './lib/battle';
import { getFormat, packTeam, randomTeam, presetTeam } from './lib/teams';
import { initLearnsets } from './lib/dex';
import { TeamBuilder } from './components/TeamBuilder';
import { BattleSetup } from './components/BattleSetup';
import { BattleView } from './components/BattleView';
import { TypeChart } from './components/TypeChart';
import { Pokedex } from './components/Pokedex';

type Tab = 'team' | 'battle' | 'chart' | 'dex';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'team', label: '组队', icon: '🧩' },
  { id: 'battle', label: '对战', icon: '⚔️' },
  { id: 'chart', label: '属性克制', icon: '🎯' },
  { id: 'dex', label: '图鉴', icon: '📖' },
];

const STORAGE_KEY = 'pkmn-battle-team';
const PLAYER_NAME = '你';
const AI_NAME = '电脑';

function loadTeam(): PokemonSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('battle');
  const [ready, setReady] = useState(false);
  const [team, setTeamState] = useState<PokemonSet[]>(loadTeam);
  const [ctrl, setCtrl] = useState<BattleController | null>(null);
  const lastFormat = useRef<string>('gen9randombattle');

  // Preload the learnset table once (async in @pkmn/dex) before rendering views.
  useEffect(() => {
    let alive = true;
    initLearnsets().then(() => { if (alive) setReady(true); }).catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  // Persist team to localStorage on every change.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(team)); } catch { /* ignore quota */ }
  }, [team]);

  const setTeam = (t: PokemonSet[]) => setTeamState(t);

  const startBattle = (formatId: string) => {
    lastFormat.current = formatId;
    const fmt = getFormat(formatId);
    // Dispose any previous battle before starting a new one.
    if (ctrl) ctrl.dispose();

    let p1Team: string;
    let p2Team: string;
    if (fmt.random) {
      p1Team = packTeam(randomTeam(formatId));
      p2Team = packTeam(randomTeam(formatId));
    } else {
      p1Team = packTeam(team);
      p2Team = packTeam(presetTeam(formatId));
    }

    const next = new BattleController({
      formatId,
      p1Name: PLAYER_NAME,
      p2Name: AI_NAME,
      p1Team,
      p2Team,
    });
    setCtrl(next);
    setTab('battle');
  };

  const exitBattle = () => {
    if (ctrl) ctrl.dispose();
    setCtrl(null);
  };

  const rematch = () => startBattle(lastFormat.current);

  // Clean up the controller when the app unmounts.
  useEffect(() => () => { if (ctrl) ctrl.dispose(); }, [ctrl]);

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="ball" />
          <span>宝可梦<span className="accent">对战</span></span>
        </div>
        <nav className="nav">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        <span className="hint">全 9 世代 · 单打 / 双打 · Showdown 引擎</span>
      </header>

      <main className="main">
        {!ready ? (
          <div className="empty-state">
            <div className="big">⏳</div>
            <div>正在加载对战数据（宝可梦 / 技能 / 特性 / 学习面）…</div>
          </div>
        ) : (
          <>
            {tab === 'team' && <TeamBuilder team={team} setTeam={setTeam} />}
            {tab === 'battle' && (
              ctrl
                ? <BattleView ctrl={ctrl} onExit={exitBattle} onRematch={rematch} />
                : <BattleSetup team={team} onStart={startBattle} />
            )}
            {tab === 'chart' && <TypeChart />}
            {tab === 'dex' && <Pokedex />}
          </>
        )}
      </main>
    </div>
  );
}