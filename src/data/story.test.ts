import { describe, expect, it } from 'vitest';
import { STORY } from './story';

describe('story data', () => {
  it('contains complete first and second chapter sequences', () => {
    expect(Object.keys(STORY)).toEqual(expect.arrayContaining(['firstEncounter','opening','firstCatch','prologueCatchup','chapter1Unlock','tackleShopIntro','streamArrival','yamameCaught','streamMidReport','deepPoolClue','iwanaChallengeCaught','chapter1Finale','shrineUnlock']));
    expect(Object.keys(STORY)).toEqual(expect.arrayContaining(['chapter2Opening','portArrival','firstPortCatch','portMidReport','tournamentStart','tournamentSuzukiCaught','chapter2Finale']));
    expect(Object.keys(STORY)).toHaveLength(20);
    expect(Object.keys(STORY)[0]).toBe('firstEncounter');
    expect(STORY.firstEncounter.presentation).toBe('cinematic');
    expect(STORY.firstEncounter.art).toContain('mikazuki-first-encounter');
    expect(STORY.firstEncounter.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ speaker:'謎の人物', portrait:expect.stringContaining('silhouette') }),
    ]));
    expect(STORY.chapter1Finale.lines.length).toBeGreaterThanOrEqual(8);
    expect(STORY.iwanaChallengeCaught.lines.some((line) => line.text.includes('戻そう'))).toBe(true);
    expect(STORY.chapter1Finale.lines.some((line) => line.text.includes('断定できない'))).toBe(true);
    expect(STORY.shrineUnlock.lines.some((line) => line.text.includes('鱗を三枚'))).toBe(true);
    expect(STORY.shrineUnlock.lines.some((line) => line.text.includes('祠そのもの'))).toBe(true);
    expect(STORY.shrineUnlock.lines.some((line) => line.text.includes('宝函'))).toBe(true);
    expect(STORY.shrineUnlock.lines.some((line) => line.text.includes('水槽へ戻す'))).toBe(true);
    expect(STORY.portMidReport.lines.some((line) => line.text.includes('下げ潮'))).toBe(true);
    expect(STORY.tournamentSuzukiCaught.lines.some((line) => line.text.includes('ミカヅキではない'))).toBe(true);
    expect(Object.values(STORY).every((scene) => scene.lines.length > 0)).toBe(true);
  });

  it('gives every scene a unique archive unlock condition', () => {
    const flags = Object.values(STORY).map((scene) => scene.archive.unlockFlag);
    expect(new Set(flags).size).toBe(flags.length);
    expect(Object.values(STORY).every((scene) => scene.archive.label && scene.archive.summary)).toBe(true);
  });
});
