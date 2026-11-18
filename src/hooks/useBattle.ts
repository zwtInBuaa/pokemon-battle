import { useEffect, useState } from 'react';
import type { BattleController } from '../lib/battle';
import type { BattleState, PlayerRequest } from '../lib/types';

// Subscribes to a BattleController and re-renders on every engine update.
export function useBattle(ctrl: BattleController | null): { state: BattleState | null; request: PlayerRequest | null } {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ctrl) return;
    const unsub = ctrl.subscribe(() => setTick(t => t + 1));
    setTick(t => t + 1);
    return unsub;
  }, [ctrl]);
  return { state: ctrl ? ctrl.getState() : null, request: ctrl ? ctrl.getRequest() : null };
}