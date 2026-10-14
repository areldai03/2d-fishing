import { GEAR } from '../data/equipment';
import type { SaveData } from '../types';

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
