import React, { useState } from 'react';
import { TYPE_COLORS, TYPE_NAMES_ZH } from '../lib/dex';
import { battleSpriteChain, artwork } from '../lib/sprites';

export function TypeBadge({ type, lg }: { type: string; lg?: boolean }) {
  return (
    <span className={`type-badge${lg ? ' lg' : ''}`} style={{ background: TYPE_COLORS[type] || '#777' }}>
      {TYPE_NAMES_ZH[type] || type}
    </span>
  );
}

// Image with an ordered fallback chain.
export function Sprite({
  src, fallbacks = [], className = '', alt = '', style,
}: { src: string; fallbacks?: string[]; className?: string; alt?: string; style?: React.CSSProperties }) {
  const [idx, setIdx] = useState(0);
  const chain = [src, ...fallbacks];
  const current = chain[Math.min(idx, chain.length - 1)];
  return (
    <img
      className={className}
      src={current}
      alt={alt}
      style={style}
      loading="lazy"
      onError={() => setIdx(i => Math.min(i + 1, chain.length - 1))}
    />
  );
}

// Battle sprite (front/back animated) with fallbacks.
export function BattleSprite({
  species, back, shiny, className,
}: { species: string; back?: boolean; shiny?: boolean; className?: string }) {
  const chain = battleSpriteChain(species, !!back, !!shiny);
  return <Sprite src={chain[0]} fallbacks={chain.slice(1)} className={`sprite ${className || ''}`} alt={species} />;
}

export function Artwork({ species, shiny, className }: { species: string; shiny?: boolean; className?: string }) {
  const src = artwork(species, shiny);
  return <Sprite src={src} fallbacks={[artwork(species, false)]} className={`sprite art ${className || ''}`} alt={species} />;
}

export function hpColor(percent: number): string {
  if (percent > 50) return '#22c55e';
  if (percent > 20) return '#eab308';
  return '#ef4444';
}

export function StatBar({ label, value, max = 255, color }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const c = color || (value >= 120 ? '#22c55e' : value >= 90 ? '#84cc16' : value >= 60 ? '#eab308' : '#ef4444');
  return (
    <div className="statbar">
      <span className="label">{label}</span>
      <span className="val">{value}</span>
      <div className="track"><div className="fill" style={{ width: `${pct}%`, background: c }} /></div>
    </div>
  );
}

export function GenderIcon({ gender }: { gender: string }) {
  if (gender === 'M') return <span className="gender" style={{ color: '#3b82f6' }}>♂</span>;
  if (gender === 'F') return <span className="gender" style={{ color: '#ec4899' }}>♀</span>;
  return null;
}