export type FishId = 'oikawa' | 'funa' | 'ugui' | 'dojou' | 'koi' | 'bass' | 'namazu' | 'yamame' | 'ayu' | 'kajika' | 'nijimasu' | 'iwana';
export type StageId = 'campus-river' | 'mountain-stream';
export type Rarity = 1 | 2 | 3 | 4;
export type SizeRank = '小' | '中' | '大' | '巨大';
export type GearCategory = 'rod' | 'float' | 'hook';
export type FishBehavior = 'calm' | 'sprinter' | 'diver' | 'trickster' | 'power';
export type BaitId = '練り餌' | 'ミミズ' | '川虫' | 'ルアー';
export type DistancePreference = 'near' | 'middle' | 'far' | 'any';

export interface FishData {
  id: FishId;
  name: string;
  description: string;
  habitat: StageId[];
  rarity: Rarity;
  preferredBaits: BaitId[];
  toleratedBaits: BaitId[];
  distancePreference: DistancePreference;
  minSize: number;
  maxSize: number;
  thresholds: [number, number, number];
  basePrice: number;
  difficulty: number;
  behavior: FishBehavior;
  encounterWeight: number;
  svg: string;
  sprite: string;
}

export interface StageData {
  id: StageId;
  name: string;
  subtitle: string;
  description: string;
  accent: string;
  unlockedAtChapter: number;
}

export interface GearData {
  id: string;
  category: GearCategory;
  level: number;
  name: string;
  description: string;
  price: number;
  unlockChapter: number;
  control: number;
}

export interface FishRecord {
  firstCaughtAt: string;
  firstStage: StageId;
  count: number;
  maxSize: number;
  maxWeight: number;
  ranks: SizeRank[];
}

export interface CatchItem {
  uid: string;
  fishId: FishId;
  size: number;
  weight: number;
  rank: SizeRank;
  value: number;
}

export interface SaveData {
  version: 1;
  money: number;
  chapter: number;
  openingSeen: boolean;
  totalCaught: number;
  records: Partial<Record<FishId, FishRecord>>;
  basket: CatchItem[];
  ownedGear: string[];
  equipped: Record<GearCategory, string>;
  unlockedStages: StageId[];
  activeStage: StageId;
  bait: BaitId;
  storyFlags: string[];
  stageCatchCounts: Partial<Record<StageId, number>>;
}

export interface StoryLine {
  speaker: string;
  text: string;
  tone?: 'normal' | 'thought' | 'important';
}

export interface StorySceneData {
  id: string;
  title: string;
  backdrop: 'lab' | 'river' | 'stream' | 'night-lab';
  archive: {
    unlockFlag: string;
    label: string;
    summary: string;
  };
  lines: StoryLine[];
}
