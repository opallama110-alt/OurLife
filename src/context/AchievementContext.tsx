import React, { createContext, useCallback, useContext, useState } from 'react';
import { AchievementUnlock } from '../services/achievementService';
import { AchievementNotificationStack } from '../components/AchievementNotification';

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT CONTEXT (Phase 5C)
//
// Holds the unlock-notification queue. Triggers (workout save, habit toggle,
// boot check) push unlocks via addUnlocks(); the stack renders them and
// removes each on dismiss / 5s auto-timer.
// ═══════════════════════════════════════════════════════════════════════════

interface AchievementContextValue {
  queue: AchievementUnlock[];
  addUnlocks: (unlocks: AchievementUnlock[]) => void;
  removeUnlock: (id: string) => void;
}

const AchievementContext = createContext<AchievementContextValue>({
  queue: [],
  addUnlocks: () => {},
  removeUnlock: () => {},
});

export const AchievementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<AchievementUnlock[]>([]);

  const addUnlocks = useCallback((unlocks: AchievementUnlock[]) => {
    if (!unlocks || unlocks.length === 0) return;
    setQueue(prev => {
      // De-dupe by id in case a trigger fires twice in quick succession.
      const seen = new Set(prev.map(u => u.achievement.id));
      const fresh = unlocks.filter(u => !seen.has(u.achievement.id));
      return [...prev, ...fresh];
    });
  }, []);

  const removeUnlock = useCallback((id: string) => {
    setQueue(prev => prev.filter(u => u.achievement.id !== id));
  }, []);

  return (
    <AchievementContext.Provider value={{ queue, addUnlocks, removeUnlock }}>
      {children}
      <AchievementNotificationStack queue={queue} onDismiss={removeUnlock} />
    </AchievementContext.Provider>
  );
};

export const useAchievements = (): AchievementContextValue => useContext(AchievementContext);
