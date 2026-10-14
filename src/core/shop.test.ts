import { describe, expect, it } from 'vitest';
import { createNewSave } from './save';
import { buyOrEquip } from './shop';

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
});
