import { describe, expect, it } from 'vitest';
import { STORY } from './story';

describe('first chapter story data', () => {
  it('contains a complete prologue-to-finale sequence', () => {
    expect(Object.keys(STORY)).toEqual(expect.arrayContaining(['firstEncounter','opening','firstCatch','prologueCatchup','chapter1Unlock','tackleShopIntro','streamArrival','yamameCaught','streamMidReport','deepPoolClue','iwanaChallengeCaught','chapter1Finale']));
    expect(Object.keys(STORY)).toHaveLength(12);
    expect(Object.keys(STORY)[0]).toBe('firstEncounter');
    expect(STORY.firstEncounter.presentation).toBe('cinematic');
    expect(STORY.firstEncounter.art).toContain('mikazuki-first-encounter');
    expect(STORY.firstEncounter.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ speaker:'謎の人物', portrait:expect.stringContaining('silhouette') }),
    ]));
    expect(STORY.chapter1Finale.lines.length).toBeGreaterThanOrEqual(8);
    expect(STORY.iwanaChallengeCaught.lines.some((line) => line.text.includes('戻そう'))).toBe(true);
    expect(STORY.chapter1Finale.lines.some((line) => line.text.includes('断定できない'))).toBe(true);
    expect(Object.values(STORY).every((scene) => scene.lines.length > 0)).toBe(true);
  });

  it('gives every scene a unique archive unlock condition', () => {
    const flags = Object.values(STORY).map((scene) => scene.archive.unlockFlag);
    expect(new Set(flags).size).toBe(flags.length);
    expect(Object.values(STORY).every((scene) => scene.archive.label && scene.archive.summary)).toBe(true);
  });
});
