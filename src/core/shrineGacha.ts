import { SHRINE_REWARDS } from '../data/shrineRewards';
import type { CatchItem, SaveData, ShrineRewardData } from '../types';

export const SHRINE_PULL_COST = 3;

export interface ShrinePullResult {
  reward: ShrineRewardData;
  duplicate: boolean;
  dustGained: number;
  free: boolean;
}

export function awardGiantScales(save: SaveData, item: CatchItem, hadGiantRank: boolean): number {
  if (item.rank !== '巨大') return 0;
  const gained = hadGiantRank ? 1 : 2;
  save.giantScales += gained;
  return gained;
}

export function shrinePullAvailable(save: SaveData): boolean {
  return save.storyFlags.includes('shrine-unlocked') && (!save.shrineFreePullUsed || save.giantScales >= SHRINE_PULL_COST);
}

export function pullShrineReward(save: SaveData, random = Math.random): ShrinePullResult | 'locked' | 'poor' {
  if (!save.storyFlags.includes('shrine-unlocked')) return 'locked';
  const free = !save.shrineFreePullUsed;
  if (!free && save.giantScales < SHRINE_PULL_COST) return 'poor';
  if (free) save.shrineFreePullUsed = true;
  else save.giantScales -= SHRINE_PULL_COST;

  const unseen = SHRINE_REWARDS.filter((reward) => !save.shrineRewards.includes(reward.id));
  const pool = unseen.length ? unseen : SHRINE_REWARDS;
  const total = pool.reduce((sum, reward) => sum + reward.weight, 0);
  let roll = Math.max(0, Math.min(.999999, random())) * total;
  let reward = pool[pool.length - 1];
  for (const candidate of pool) {
    roll -= candidate.weight;
    if (roll < 0) { reward = candidate; break; }
  }
  const duplicate = save.shrineRewards.includes(reward.id);
  const dustGained = duplicate ? reward.rarity : 0;
  if (duplicate) save.shrineDust += dustGained;
  else save.shrineRewards.push(reward.id);
  return { reward, duplicate, dustGained, free };
}
