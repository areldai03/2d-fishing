import { FISH } from '../data/fish';
import type { BaitId, CatchItem, FishData, SaveData, SizeRank, StageId } from '../types';

const RARITY_POINTS = { 1:70, 2:40, 3:18, 4:5 } as const;

function distancePoints(fish: FishData, cast: number): number {
  const power = Math.max(0, Math.min(1, cast));
  if (fish.distancePreference === 'any') return 12;
  const ideal = fish.distancePreference === 'near' ? .15 : fish.distancePreference === 'middle' ? .55 : .88;
  const difference = Math.abs(power - ideal);
  return difference <= .2 ? 18 : difference <= .42 ? 8 : 0;
}

export interface EncounterBreakdown {
  stage: number;
  rarity: number;
  localDensity: number;
  bait: number;
  distance: number;
  tackle: number;
  total: number;
}

export function recommendedTackleLevel(rarity: FishData['rarity']): 1 | 2 | 3 {
  if (rarity === 1) return 1;
  if (rarity <= 3) return 2;
  return 3;
}

const TACKLE_MATCH_POINTS = { 1:12, 2:22, 3:30, 4:40 } as const;

export function encounterBreakdown(fish: FishData, stage: StageId, bait: BaitId, cast: number, tackleLevel = 1): EncounterBreakdown {
  if (!fish.habitat.includes(stage)) return { stage:0, rarity:0, localDensity:0, bait:0, distance:0, tackle:0, total:0 };
  const tackleMatches = tackleLevel >= recommendedTackleLevel(fish.rarity);
  const breakdown = {
    stage:22,
    rarity:RARITY_POINTS[fish.rarity],
    localDensity:Math.round(fish.encounterWeight * 22),
    bait:fish.preferredBaits.includes(bait) ? 34 : fish.toleratedBaits.includes(bait) ? 14 : 0,
    distance:distancePoints(fish, cast),
    tackle:tackleMatches ? TACKLE_MATCH_POINTS[fish.rarity] : 0,
  };
  return { ...breakdown, total:Object.values(breakdown).reduce((sum, points) => sum + points, 0) };
}

export function encounterScore(fish: FishData, stage: StageId, bait: BaitId, cast: number, tackleLevel = 1): number {
  return encounterBreakdown(fish, stage, bait, cast, tackleLevel).total;
}

export function encounterChances(stage: StageId, bait: BaitId, cast: number, tackleLevel = 1): Partial<Record<FishData['id'], number>> {
  const candidates = Object.values(FISH).filter((fish) => fish.habitat.includes(stage));
  const total = candidates.reduce((sum, fish) => sum + encounterScore(fish, stage, bait, cast, tackleLevel), 0);
  return Object.fromEntries(candidates.map((fish) => [fish.id, encounterScore(fish, stage, bait, cast, tackleLevel) / total]));
}

export function sizeRank(fish: FishData, size: number): SizeRank {
  if (size >= fish.thresholds[2]) return '巨大';
  if (size >= fish.thresholds[1]) return '大';
  if (size >= fish.thresholds[0]) return '中';
  return '小';
}

export function chooseFish(stage: StageId, bait: BaitId, cast: number, random = Math.random, tackleLevel = 1): FishData {
  const candidates = Object.values(FISH).filter((fish) => fish.habitat.includes(stage));
  const weighted = candidates.map((fish) => ({ fish, weight: encounterScore(fish, stage, bait, cast, tackleLevel) }));
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

export function portSurveyReady(save: SaveData): boolean {
  const portSpecies = Object.values(FISH).filter((fish) => fish.habitat.includes('tsukinami-port') && save.records[fish.id]).length;
  return Boolean(save.records.haze && save.records.aji) && portSpecies >= 2 && (save.stageCatchCounts['tsukinami-port'] ?? 0) >= 3;
}

export function completeTackleShopVisit(save: SaveData): void {
  if (!save.storyFlags.includes('uzawa-intro-seen')) save.storyFlags.push('uzawa-intro-seen');
  if (!save.unlockedStages.includes('mountain-stream')) save.unlockedStages.push('mountain-stream');
  save.baitStock['川虫'] += 5;
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
