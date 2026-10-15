import { describe, expect, it } from 'vitest';
import { createNewSave } from './save';
import { baitAvailable, buyBait, buyOrEquip, consumeBait } from './shop';
import { GEAR } from '../data/equipment';

describe('shop rules', () => {
  it('respects story locks and available money', () => {
    const save = createNewSave();
    expect(buyOrEquip(save, 'hook-2')).toBe('locked');
    save.chapter = 1;
    expect(buyOrEquip(save, 'hook-2')).toBe('poor');
    save.money = 600;
    expect(buyOrEquip(save, 'hook-2')).toBe('bought');
    expect(save.money).toBe(220);
    expect(save.equipped.hook).toBe('hook-2');
    expect(buyOrEquip(save, 'hook-2')).toBe('equipped');
  });

  it('provides dedicated artwork for every first-chapter tool', () => {
    const firstChapterGear = GEAR.filter((gear) => gear.unlockChapter <= 1);
    const chapterReward = GEAR.find((gear) => gear.id === 'float-2');
    expect(firstChapterGear).toHaveLength(4);
    expect(firstChapterGear.every((gear) => gear.asset?.startsWith('/assets/gear/'))).toBe(true);
    expect(chapterReward).toMatchObject({ price:0, unlockChapter:2 });
    expect(chapterReward?.asset).toMatch('/assets/gear/');
    expect(GEAR.find((gear) => gear.id === 'rod-2')).toMatchObject({ price:0, unlockChapter:3 });
  });

  it('sells bait in affordable bundles and consumes one item per cast', () => {
    const save = createNewSave();
    expect(save.baitStock['練り餌']).toBe(6);
    expect(buyBait(save, '練り餌')).toBe('bought');
    expect(save.money).toBe(155);
    expect(save.baitStock['練り餌']).toBe(11);
    expect(consumeBait(save, '練り餌')).toBe(true);
    expect(save.baitStock['練り餌']).toBe(10);
  });

  it('keeps the lure reusable and respects bait story locks', () => {
    const save = createNewSave();
    expect(baitAvailable(save, '川虫')).toBe(false);
    expect(buyBait(save, '川虫')).toBe('locked');
    expect(consumeBait(save, 'ルアー')).toBe(true);
    expect(consumeBait(save, 'ルアー')).toBe(true);
    expect(buyBait(save, 'ルアー')).toBe('reusable');
  });
});
