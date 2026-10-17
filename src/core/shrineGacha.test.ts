import { describe, expect, it } from 'vitest';
import { createNewSave } from './save';
import { awardGiantScales, pullShrineReward, shrinePullAvailable, SHRINE_PULL_COST } from './shrineGacha';
import type { CatchItem, ShrineRewardId } from '../types';

const giant: CatchItem = { uid:'giant-1', fishId:'koi', size:78, weight:1200, rank:'巨大', value:500 };

describe('submerged shrine draw', () => {
  it('awards a bonus scale for the first giant rank of each species', () => {
    const save = createNewSave();
    expect(awardGiantScales(save, giant, false)).toBe(2);
    expect(awardGiantScales(save, { ...giant, uid:'giant-2' }, true)).toBe(1);
    expect(save.giantScales).toBe(3);
  });

  it('keeps the first draw free and charges three scales afterwards', () => {
    const save = createNewSave();
    save.storyFlags.push('shrine-unlocked');
    expect(shrinePullAvailable(save)).toBe(true);
    const first = pullShrineReward(save, () => 0);
    expect(typeof first).not.toBe('string');
    expect(save.shrineFreePullUsed).toBe(true);
    expect(save.giantScales).toBe(0);
    expect(shrinePullAvailable(save)).toBe(false);
    save.giantScales = SHRINE_PULL_COST;
    expect(pullShrineReward(save, () => .5)).not.toBe('poor');
    expect(save.giantScales).toBe(0);
  });

  it('prioritizes unowned permanent decorations before duplicates', () => {
    const save = createNewSave();
    save.storyFlags.push('shrine-unlocked');
    const owned = new Set<ShrineRewardId>();
    for (let index = 0; index < 6; index++) {
      save.giantScales = 99;
      const result = pullShrineReward(save, () => 0);
      if (typeof result === 'string') throw new Error(result);
      expect(result.duplicate).toBe(false);
      owned.add(result.reward.id);
    }
    expect(owned.size).toBe(6);
    save.giantScales = 99;
    const duplicate = pullShrineReward(save, () => 0);
    if (typeof duplicate === 'string') throw new Error(duplicate);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.dustGained).toBeGreaterThan(0);
  });
});
