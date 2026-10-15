import { FISH } from '../data/fish';
import type { BaitId, CatchItem, FishData, SaveData, SizeRank, StageId } from '../types';

const RARITY_FACTOR = { 1:1, 2:.68, 3:.36, 4:.14 } as const;

function distanceFactor(fish: FishData, cast: number): number {
  const power = Math.max(0, Math.min(1, cast));
  if (fish.distancePreference === 'near') return 1.35 - power * .55;
  if (fish.distancePreference === 'middle') return .82 + Math.max(0, 1 - Math.abs(power - .55) * 2) * .58;
  if (fish.distancePreference === 'far') return .72 + power * .88;
  return 1;
}

export function encounterScore(fish: FishData, bait: BaitId, cast: number): number {
  const baitFactor = fish.preferredBaits.includes(bait) ? 1.9 : fish.toleratedBaits.includes(bait) ? 1 : .42;
  return fish.encounterWeight * RARITY_FACTOR[fish.rarity] * baitFactor * distanceFactor(fish, cast);
}

export function encounterChances(stage: StageId, bait: BaitId, cast: number): Partial<Record<FishData['id'], number>> {
  const candidates = Object.values(FISH).filter((fish) => fish.habitat.includes(stage));
  const total = candidates.reduce((sum, fish) => sum + encounterScore(fish, bait, cast), 0);
  return Object.fromEntries(candidates.map((fish) => [fish.id, encounterScore(fish, bait, cast) / total]));
}

export function sizeRank(fish: FishData, size: number): SizeRank {
  if (size >= fish.thresholds[2]) return '巨大';
  if (size >= fish.thresholds[1]) return '大';
  if (size >= fish.thresholds[0]) return '中';
  return '小';
}

export function chooseFish(stage: StageId, bait: BaitId, cast: number, random = Math.random): FishData {
  const candidates = Object.values(FISH).filter((fish) => fish.habitat.includes(stage));
  const weighted = candidates.map((fish) => ({ fish, weight: encounterScore(fish, bait, cast) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.fish;
  }
  return weighted[0].fish;
}

export function makeCatch(fish: FishData, random = Math.random, castPower = .5): CatchItem {
  const castSizeBonus = (Math.max(0, Math.min(1, castPower)) - .5) * .1;
  const biased = Math.max(0, Math.min(1, (random() + random()) / 2 + castSizeBonus));
  const size = Math.round((fish.minSize + (fish.maxSize - fish.minSize) * biased) * 10) / 10;
  const normalized = size / fish.maxSize;
  const weight = Math.round(size * size * fish.difficulty * .075) / 10;
  const rank = sizeRank(fish, size);
  const multiplier = rank === '巨大' ? 2.5 : rank === '大' ? 1.6 : rank === '中' ? 1.2 : 1;
  return { uid:`${fish.id}-${Date.now()}-${Math.floor(random()*9999)}`, fishId:fish.id, size, weight, rank, value:Math.round(fish.basePrice * multiplier * (.7 + normalized * .6)) };
}

export function recordCatch(save: SaveData, item: CatchItem, stage: StageId, now = new Date()): { isNew: boolean; isRecord: boolean } {
  const old = save.records[item.fishId];
  const isNew = !old;
  const isRecord = !old || item.size > old.maxSize;
  if (!old) {
    save.records[item.fishId] = { firstCaughtAt:now.toISOString(), firstStage:stage, count:1, maxSize:item.size, maxWeight:item.weight, ranks:[item.rank] };
  } else {
    old.count += 1;
    old.maxSize = Math.max(old.maxSize, item.size);
    old.maxWeight = Math.max(old.maxWeight, item.weight);
    if (!old.ranks.includes(item.rank)) old.ranks.push(item.rank);
  }
  save.basket.push(item);
  save.totalCaught += 1;
  save.stageCatchCounts[stage] = (save.stageCatchCounts[stage] ?? 0) + 1;
  const species = Object.keys(save.records).length;
  if (save.chapter === 0 && save.totalCaught >= 3 && species >= 2) {
    save.chapter = 1;
    if (!save.storyFlags.includes('chapter1-unlocked')) save.storyFlags.push('chapter1-unlocked');
  }
  return { isNew, isRecord };
}

export function streamSurveyReady(save: SaveData): boolean {
  const streamSpecies = Object.values(FISH).filter((fish) => fish.habitat.includes('mountain-stream') && save.records[fish.id]).length;
  return Boolean(save.records.yamame) && streamSpecies >= 2 && (save.stageCatchCounts['mountain-stream'] ?? 0) >= 3;
}

export function completeTackleShopVisit(save: SaveData): void {
  if (!save.storyFlags.includes('uzawa-intro-seen')) save.storyFlags.push('uzawa-intro-seen');
  if (!save.unlockedStages.includes('mountain-stream')) save.unlockedStages.push('mountain-stream');
  save.bait = '川虫';
}

export function releaseCatch(save: SaveData, uid: string): void {
  save.basket = save.basket.filter((item) => item.uid !== uid);
}

export function sellBasket(save: SaveData): number {
  const total = save.basket.reduce((sum, item) => sum + item.value, 0);
  save.money += total;
  save.basket = [];
  return total;
}
