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
  baitStock: { '練り餌':6, 'ミミズ':4, '川虫':0 },
  storyFlags: [],
  stageCatchCounts: {},
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createNewSave();
    const parsed = JSON.parse(raw) as SaveData;
    if (parsed.version !== 1) return createNewSave();
    const defaults = createNewSave();
    return { ...defaults, ...parsed, baitStock:{ ...defaults.baitStock, ...parsed.baitStock } };
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
