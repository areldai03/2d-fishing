import { GEAR } from '../data/equipment';
import { BAITS } from '../data/baits';
import type { BaitId, ConsumableBaitId, SaveData } from '../types';

export function buyOrEquip(save: SaveData, gearId: string): 'bought' | 'equipped' | 'locked' | 'poor' | 'missing' {
  const gear = GEAR.find((item) => item.id === gearId);
  if (!gear) return 'missing';
  if (save.chapter < gear.unlockChapter) return 'locked';
  if (save.ownedGear.includes(gear.id)) {
    save.equipped[gear.category] = gear.id;
    return 'equipped';
  }
  if (save.money < gear.price) return 'poor';
  save.money -= gear.price;
  save.ownedGear.push(gear.id);
  save.equipped[gear.category] = gear.id;
  return 'bought';
}

export function baitAvailable(save: SaveData, baitId: BaitId): boolean {
  const bait = BAITS[baitId];
  if (save.chapter < bait.unlockChapter) return false;
  return bait.reusable || save.baitStock[baitId as ConsumableBaitId] > 0;
}

export function consumeBait(save: SaveData, baitId: BaitId): boolean {
  const bait = BAITS[baitId];
  if (bait.reusable) return true;
  if (!baitAvailable(save, baitId)) return false;
  save.baitStock[baitId as ConsumableBaitId] -= 1;
  return true;
}

export function buyBait(save: SaveData, baitId: BaitId): 'bought' | 'reusable' | 'locked' | 'poor' {
  const bait = BAITS[baitId];
  if (save.chapter < bait.unlockChapter) return 'locked';
  if (bait.reusable) return 'reusable';
  if (save.money < bait.price) return 'poor';
  save.money -= bait.price;
  save.baitStock[baitId as ConsumableBaitId] += bait.bundle;
  return 'bought';
}
