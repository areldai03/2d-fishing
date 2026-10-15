import { describe, expect, it } from 'vitest';
import { createNewSave } from './save';
import { buyOrEquip } from './shop';
import { GEAR } from '../data/equipment';

describe('shop rules', () => {
  it('respects story locks and available money', () => {
    const save = createNewSave();
    expect(buyOrEquip(save, 'rod-2')).toBe('locked');
    save.chapter = 1;
    expect(buyOrEquip(save, 'rod-2')).toBe('poor');
    save.money = 600;
    expect(buyOrEquip(save, 'rod-2')).toBe('bought');
    expect(save.money).toBe(80);
    expect(save.equipped.rod).toBe('rod-2');
    expect(buyOrEquip(save, 'rod-2')).toBe('equipped');
  });

  it('provides dedicated artwork for every first-chapter tool', () => {
    const firstChapterGear = GEAR.filter((gear) => gear.unlockChapter <= 1);
    const chapterReward = GEAR.find((gear) => gear.id === 'float-2');
    expect(firstChapterGear).toHaveLength(5);
    expect(firstChapterGear.every((gear) => gear.asset?.startsWith('/assets/gear/'))).toBe(true);
    expect(chapterReward).toMatchObject({ price:0, unlockChapter:2 });
    expect(chapterReward?.asset).toMatch('/assets/gear/');
  });
});
