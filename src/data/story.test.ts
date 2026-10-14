import { describe, expect, it } from 'vitest';
import { STORY } from './story';

describe('first chapter story data', () => {
  it('contains a complete prologue-to-finale sequence', () => {
    expect(Object.keys(STORY)).toEqual(expect.arrayContaining(['opening','chapter1Unlock','streamArrival','yamameCaught','chapter1Finale']));
    expect(STORY.chapter1Finale.lines.length).toBeGreaterThanOrEqual(8);
    expect(Object.values(STORY).every((scene) => scene.lines.length > 0)).toBe(true);
  });

  it('gives every scene a unique archive unlock condition', () => {
    const flags = Object.values(STORY).map((scene) => scene.archive.unlockFlag);
    expect(new Set(flags).size).toBe(flags.length);
    expect(Object.values(STORY).every((scene) => scene.archive.label && scene.archive.summary)).toBe(true);
  });
});
