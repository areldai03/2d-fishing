import { describe, expect, it } from 'vitest';
import { FISH } from '../data/fish';
import { createNewSave } from './save';
import { chooseFish, completeTackleShopVisit, encounterBreakdown, encounterChances, encounterScore, makeCatch, portSurveyReady, recordCatch, releaseCatch, sellBasket, sizeRank, streamSurveyReady } from './fishing';
import { biteWindowMs, canLandFish, createFightState, fightDifficultyRating, getFightBeat, landingTolerance, specimenPower, stepFight } from './fight';

describe('fishing rules', () => {
  it('uses species-specific size thresholds', () => {
    expect(sizeRank(FISH.oikawa, 17)).toBe('巨大');
    expect(sizeRank(FISH.koi, 17)).toBe('小');
    expect(sizeRank(FISH.koi, 76)).toBe('巨大');
  });

  it('only selects fish found at the active stage', () => {
    for (const roll of [0, .2, .5, .99]) {
      expect(chooseFish('mountain-stream', '川虫', .7, () => roll).habitat).toContain('mountain-stream');
      expect(chooseFish('campus-river', '練り餌', .4, () => roll).habitat).toContain('campus-river');
      expect(chooseFish('tsukinami-port', 'ルアー', .8, () => roll).habitat).toContain('tsukinami-port');
    }
  });

  it('makes rarity, bait and habitat distance independently affect encounters', () => {
    const common = encounterScore(FISH.oikawa, 'campus-river', '川虫', .2);
    const rarerClone = encounterScore({ ...FISH.oikawa, rarity:3 }, 'campus-river', '川虫', .2);
    expect(common).toBeGreaterThan(rarerClone);
    expect(encounterScore(FISH.dojou, 'campus-river', 'ミミズ', .2)).toBeGreaterThan(encounterScore(FISH.dojou, 'campus-river', '練り餌', .2));
    expect(encounterScore(FISH.dojou, 'campus-river', '練り餌', .2)).toBeGreaterThan(encounterScore(FISH.dojou, 'campus-river', 'ルアー', .2));
    expect(encounterScore(FISH.koi, 'campus-river', '練り餌', .9)).toBeGreaterThan(encounterScore(FISH.koi, 'campus-river', '練り餌', .1));
    expect(encounterScore(FISH.oikawa, 'campus-river', '川虫', .1)).toBeGreaterThan(encounterScore(FISH.oikawa, 'campus-river', '川虫', .9));
    expect(encounterScore(FISH.oikawa, 'mountain-stream', '川虫', .1)).toBe(0);
  });

  it('uses additive encounter points and lets better floats help detect rare fish', () => {
    const basic = encounterBreakdown(FISH.namazu, 'campus-river', 'ミミズ', .85, 0);
    const improved = encounterBreakdown(FISH.namazu, 'campus-river', 'ミミズ', .85, .2);
    expect(basic.total).toBe(basic.stage + basic.rarity + basic.localDensity + basic.bait + basic.distance + basic.tackle);
    expect(improved.tackle).toBeGreaterThan(basic.tackle);
    expect(encounterChances('campus-river', 'ミミズ', .85, .2).namazu).toBeGreaterThan(encounterChances('campus-river', 'ミミズ', .85, 0).namazu!);
  });

  it('exposes normalized encounter chances for balancing and UI checks', () => {
    const chances = encounterChances('campus-river', 'ミミズ', .5);
    expect(Object.values(chances).reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1);
    expect(chances.namazu).toBeGreaterThan(encounterChances('campus-river', '川虫', .5).namazu!);
  });

  it('lets a farther cast gently improve the size roll without guaranteeing a giant', () => {
    const near = makeCatch(FISH.ugui, () => .5, .1);
    const far = makeCatch(FISH.ugui, () => .5, .9);
    expect(far.size).toBeGreaterThan(near.size);
    expect(far.rank).not.toBe('巨大');
  });

  it('records catches and opens the first-chapter introduction without skipping the tackle-shop visit', () => {
    const save = createNewSave();
    const first = makeCatch(FISH.oikawa, () => .5);
    const second = makeCatch(FISH.funa, () => .6);
    recordCatch(save, first, 'campus-river', new Date('2026-01-01'));
    recordCatch(save, second, 'campus-river', new Date('2026-01-02'));
    recordCatch(save, makeCatch(FISH.oikawa, () => .8), 'campus-river');
    expect(save.records.oikawa?.count).toBe(2);
    expect(save.records.oikawa?.maxSize).toBeGreaterThanOrEqual(first.size);
    expect(save.chapter).toBe(1);
    expect(save.storyFlags).toContain('chapter1-unlocked');
    expect(save.unlockedStages).not.toContain('mountain-stream');
  });

  it('sells the basket while preserving encyclopedia records', () => {
    const save = createNewSave();
    const item = makeCatch(FISH.koi, () => .5);
    recordCatch(save, item, 'campus-river');
    const before = save.money;
    expect(sellBasket(save)).toBe(item.value);
    expect(save.money).toBe(before + item.value);
    expect(save.basket).toHaveLength(0);
    expect(save.records.koi?.count).toBe(1);
  });

  it('unlocks the mountain stream only after meeting Uzawa at the tackle shop', () => {
    const save = createNewSave();
    save.chapter = 1;
    completeTackleShopVisit(save);
    expect(save.storyFlags).toContain('uzawa-intro-seen');
    expect(save.unlockedStages).toContain('mountain-stream');
    expect(save.bait).toBe('川虫');
    expect(save.baitStock['川虫']).toBe(5);
  });

  it('keeps a released fish in the observation record but removes it from the sell basket', () => {
    const save = createNewSave();
    const item = makeCatch(FISH.iwana, () => .78, .8);
    recordCatch(save, item, 'mountain-stream');
    releaseCatch(save, item.uid);
    expect(save.records.iwana?.count).toBe(1);
    expect(save.basket).not.toContainEqual(item);
  });

  it('completes the first chapter survey with three stream catches and two species', () => {
    const save = createNewSave();
    save.chapter = 1;
    recordCatch(save, makeCatch(FISH.yamame, () => .5), 'mountain-stream');
    recordCatch(save, makeCatch(FISH.yamame, () => .6), 'mountain-stream');
    expect(streamSurveyReady(save)).toBe(false);
    recordCatch(save, makeCatch(FISH.ayu, () => .5), 'mountain-stream');
    expect(streamSurveyReady(save)).toBe(true);
    expect(save.stageCatchCounts['mountain-stream']).toBe(3);
  });

  it('requires both signature port species before opening the chapter-two report', () => {
    const save = createNewSave();
    save.chapter = 2;
    recordCatch(save, makeCatch(FISH.haze, () => .5), 'tsukinami-port');
    recordCatch(save, makeCatch(FISH.haze, () => .6), 'tsukinami-port');
    recordCatch(save, makeCatch(FISH.kurodai, () => .5), 'tsukinami-port');
    expect(portSurveyReady(save)).toBe(false);
    recordCatch(save, makeCatch(FISH.aji, () => .5), 'tsukinami-port');
    expect(portSurveyReady(save)).toBe(true);
  });

  it('makes every species catchable with starter gear and correct play', () => {
    const catchTimes: Record<string, number> = {};
    for (const fish of Object.values(FISH)) {
      let state = createFightState(fish, .75);
      let result = 'fighting';
      for (let frame = 0; frame < 1800 && result === 'fighting'; frame++) {
        const beat = getFightBeat(fish, state.elapsed + .05);
        const reeling = !beat.burst && state.tension < 78;
        const next = stepFight(state, .05, fish, { reeling, rodControl:0, hookControl:0 });
        state = next.state;
        result = next.result;
      }
      expect(result, `${fish.name} should be catchable with starter gear`).toBe('caught');
      catchTimes[fish.id] = state.elapsed;
    }
    expect(catchTimes.nijimasu).toBeGreaterThan(catchTimes.oikawa);
  });

  it('keeps species difficulty meaningful without impossible reaction windows', () => {
    expect(createFightState(FISH.nijimasu, .6).maxStamina).toBeGreaterThan(createFightState(FISH.oikawa, .6).maxStamina);
    expect(biteWindowMs(FISH.oikawa, 0, 0)).toBeGreaterThan(biteWindowMs(FISH.nijimasu, 0, 0));
    expect(biteWindowMs(FISH.nijimasu, 0, 0)).toBeGreaterThanOrEqual(1200);
  });

  it('rates large fish as harder and equipped tackle as more manageable', () => {
    const fish = FISH.suzuki;
    const small = fightDifficultyRating(fish, specimenPower(fish, fish.minSize), 0, 0);
    const giant = fightDifficultyRating(fish, specimenPower(fish, fish.maxSize), 0, 0);
    const equipped = fightDifficultyRating(fish, specimenPower(fish, fish.maxSize), .34, .32);
    expect(giant).toBeGreaterThan(small);
    expect(equipped).toBeLessThanOrEqual(giant);
  });

  it('breaks the line for every species when the player only holds reel', () => {
    for (const fish of Object.values(FISH)) {
      let state = createFightState(fish, .8);
      let result = 'fighting';
      for (let frame = 0; frame < 1200 && result === 'fighting'; frame++) {
        const next = stepFight(state, .05, fish, { reeling:true, rodControl:0, hookControl:0 });
        state = next.state;
        result = next.result;
      }
      expect(result, `${fish.name} must punish holding through a burst`).toBe('line-broken');
    }
  });

  it('makes safe reeling effective while released bursts reclaim meaningful distance', () => {
    const fish = FISH.koi;
    let safe = createFightState(fish, .7);
    const safeStart = safe.distance;
    for (let frame = 0; frame < 16; frame++) safe = stepFight(safe, .05, fish, { reeling:true, rodControl:0, hookControl:0 }).state;
    expect(safeStart - safe.distance).toBeGreaterThan(7);

    let released = createFightState(fish, .7);
    released.elapsed = 1.9;
    const releasedStart = released.distance;
    for (let frame = 0; frame < 16; frame++) released = stepFight(released, .05, fish, { reeling:false, rodControl:0, hookControl:0 }).state;
    expect(released.distance - releasedStart).toBeGreaterThan(8);
    expect(released.distance - releasedStart).toBeLessThan(18);
  });

  it('makes an unattended fish visibly flee and eventually escape', () => {
    for (const fish of Object.values(FISH)) {
      let state = createFightState(fish, .5);
      const start = state.distance;
      let result = 'fighting';
      for (let frame = 0; frame < 1200 && result === 'fighting'; frame++) {
        const next = stepFight(state, .05, fish, { reeling:false, rodControl:0, hookControl:0 });
        state = next.state;
        result = next.result;
        if (frame === 19) expect(state.distance - start, `${fish.name} should visibly pull away in one second`).toBeGreaterThan(2);
      }
      expect(result, `${fish.name} should escape when completely unattended`).toBe('escaped');
    }
  });

  it('adds a readable landing window that gear can widen', () => {
    expect(canLandFish(FISH.oikawa, .5, 0)).toBe(true);
    expect(canLandFish(FISH.nijimasu, .05, 0)).toBe(false);
    expect(landingTolerance(FISH.nijimasu, .16)).toBeGreaterThan(landingTolerance(FISH.nijimasu, 0));
    expect(landingTolerance(FISH.oikawa, 0)).toBeGreaterThan(landingTolerance(FISH.nijimasu, 0));
  });

  it('makes a large specimen harder than a small specimen of the same species', () => {
    const fish = FISH.koi;
    const smallPower = specimenPower(fish, fish.minSize);
    const giantPower = specimenPower(fish, fish.maxSize);
    expect(smallPower).toBeLessThan(1);
    expect(giantPower).toBeGreaterThan(1);
    expect(createFightState(fish, .6, giantPower).maxStamina).toBeGreaterThan(createFightState(fish, .6, smallPower).maxStamina);
    expect(landingTolerance(fish, 0, giantPower)).toBeLessThan(landingTolerance(fish, 0, smallPower));
    expect(landingTolerance(fish, 0, smallPower) - landingTolerance(fish, 0, giantPower)).toBeGreaterThan(.08);
  });

  it('keeps maximum-size specimens catchable with starter gear and correct play', () => {
    for (const fish of Object.values(FISH)) {
      const power = specimenPower(fish, fish.maxSize);
      let state = createFightState(fish, .7, power);
      let result = 'fighting';
      for (let frame = 0; frame < 2400 && result === 'fighting'; frame++) {
        const beat = getFightBeat(fish, state.elapsed + .05);
        const reeling = !beat.burst && state.tension < 76;
        const next = stepFight(state, .05, fish, { reeling, rodControl:0, hookControl:0 }, power);
        state = next.state;
        result = next.result;
      }
      expect(result, `maximum-size ${fish.name} should remain skill-catchable`).toBe('caught');
    }
  });

  it('uses a distinct purpose-drawn art asset for every fish', () => {
    const sprites = Object.values(FISH).map((fish) => fish.sprite);
    expect(new Set(sprites).size).toBe(Object.keys(FISH).length);
    expect(sprites.every((sprite) => sprite.startsWith('/assets/fish-pixel-v'))).toBe(true);
  });
});
