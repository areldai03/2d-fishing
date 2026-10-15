import type { SaveData } from '../types';

const KEY = 'kenkyuchu-tsurichu-save-v1';

export const createNewSave = (): SaveData => ({
  version: 1,
  money: 180,
  chapter: 0,
  openingSeen: false,
  totalCaught: 0,
  records: {},
  basket: [],
  aquarium: [],
  ownedGear: ['rod-1', 'float-1', 'hook-1'],
  equipped: { rod:'rod-1', float:'float-1', hook:'hook-1' },
  unlockedStages: ['campus-river'],
  activeStage: 'campus-river',
  bait: '練り餌',
  storyFlags: [],
  stageCatchCounts: {},
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createNewSave();
    const parsed = JSON.parse(raw) as SaveData;
    return parsed.version === 1 ? { ...createNewSave(), ...parsed } : createNewSave();
  } catch {
    return createNewSave();
  }
}

export function persistSave(save: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function eraseSave(): void {
  localStorage.removeItem(KEY);
}
