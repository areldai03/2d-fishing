import { FISH } from '../data/fish';
import type { AquariumKind, SaveData, StageId } from '../types';

export const AQUARIUM_CAPACITY = 5;

export function aquariumKindForFish(fishId: keyof typeof FISH): AquariumKind {
  return FISH[fishId].habitat.includes('tsukinami-port') ? 'brackish' : 'freshwater';
}

export function aquariumResidents(save: SaveData, kind: AquariumKind) {
  return save.aquarium.filter((resident) => aquariumKindForFish(resident.fishId) === kind);
}

export function moveCatchToAquarium(save: SaveData, uid: string, stage: StageId, now = new Date()): 'added' | 'full' | 'missing' {
  const item = save.basket.find((catchItem) => catchItem.uid === uid);
  if (!item) return 'missing';
  const kind = aquariumKindForFish(item.fishId);
  if (aquariumResidents(save, kind).length >= AQUARIUM_CAPACITY) return 'full';
  save.basket = save.basket.filter((catchItem) => catchItem.uid !== uid);
  save.aquarium.push({ ...item, stage, addedAt:now.toISOString() });
  return 'added';
}

export function returnResidentToBasket(save: SaveData, uid: string): boolean {
  const resident = save.aquarium.find((item) => item.uid === uid);
  if (!resident) return false;
  save.aquarium = save.aquarium.filter((item) => item.uid !== uid);
  const { stage: _stage, addedAt: _addedAt, ...catchItem } = resident;
  save.basket.push(catchItem);
  return true;
}
