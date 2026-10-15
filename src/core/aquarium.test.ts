import { describe, expect, it } from 'vitest';
import { FISH } from '../data/fish';
import { makeCatch, recordCatch } from './fishing';
import { AQUARIUM_CAPACITY, aquariumKindForFish, aquariumResidents, moveCatchToAquarium, returnResidentToBasket } from './aquarium';
import { createNewSave } from './save';

describe('observation aquarium', () => {
  it('separates river fish from port fish', () => {
    expect(aquariumKindForFish('yamame')).toBe('freshwater');
    expect(aquariumKindForFish('aji')).toBe('brackish');
  });

  it('moves an exact catch out of the sell basket and can return it', () => {
    const save = createNewSave();
    const item = makeCatch(FISH.oikawa, () => .5);
    recordCatch(save, item, 'campus-river');
    expect(moveCatchToAquarium(save, item.uid, 'campus-river', new Date('2026-01-02'))).toBe('added');
    expect(save.basket).toHaveLength(0);
    expect(aquariumResidents(save, 'freshwater')[0]).toMatchObject({ uid:item.uid, stage:'campus-river' });
    expect(returnResidentToBasket(save, item.uid)).toBe(true);
    expect(save.aquarium).toHaveLength(0);
    expect(save.basket[0]).toMatchObject({ uid:item.uid, fishId:'oikawa' });
  });

  it('caps each water system independently', () => {
    const save = createNewSave();
    for (let index = 0; index < AQUARIUM_CAPACITY; index++) {
      const item = { ...makeCatch(FISH.funa, () => .4), uid:`funa-${index}` };
      recordCatch(save, item, 'campus-river');
      expect(moveCatchToAquarium(save, item.uid, 'campus-river')).toBe('added');
    }
    const extra = makeCatch(FISH.oikawa, () => .4);
    recordCatch(save, extra, 'campus-river');
    expect(moveCatchToAquarium(save, extra.uid, 'campus-river')).toBe('full');
    const portFish = makeCatch(FISH.haze, () => .4);
    recordCatch(save, portFish, 'tsukinami-port');
    expect(moveCatchToAquarium(save, portFish.uid, 'tsukinami-port')).toBe('added');
  });
});
