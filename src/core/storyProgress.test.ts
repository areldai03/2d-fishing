import { describe, expect, it } from 'vitest';
import { createNewSave } from './save';
import { addStoryFlag, getCurrentQuest, getHomeStoryState, getObservationMilestones } from './storyProgress';

const record = () => ({
  firstCaughtAt:'2026-01-01T00:00:00.000Z',
  firstStage:'mountain-stream' as const,
  count:1,
  maxSize:30,
  maxWeight:300,
  ranks:['中' as const],
});

describe('story progress', () => {
  it('describes the prologue objective and default home action', () => {
    const save = createNewSave();
    expect(getCurrentQuest(save)).toMatchObject({ title:'大学裏の生態を調べる', counter:'0/3匹・0/2種' });
    expect(getHomeStoryState(save)).toMatchObject({ chapterLabel:'序章', action:'go-fishing', actionReady:false });
  });

  it('derives first chapter report and finale actions from observations', () => {
    const save = createNewSave();
    save.chapter = 1;
    addStoryFlag(save, 'uzawa-intro-seen');
    addStoryFlag(save, 'stream-arrival-seen');
    save.records.yamame = record();
    save.records.iwana = record();
    save.stageCatchCounts['mountain-stream'] = 3;
    expect(getCurrentQuest(save).title).toBe('研究室へ戻って中間報告');
    expect(getHomeStoryState(save).action).toBe('chapter1-report');
    addStoryFlag(save, 'stream-mid-report-seen');
    addStoryFlag(save, 'deep-pool-clue-seen');
    addStoryFlag(save, 'iwana-challenge-seen');
    expect(getHomeStoryState(save).action).toBe('chapter1-finale');
  });

  it('keeps flags unique and builds the observation timeline in order', () => {
    const save = createNewSave();
    expect(addStoryFlag(save, 'first-encounter-seen')).toBe(true);
    expect(addStoryFlag(save, 'first-encounter-seen')).toBe(false);
    addStoryFlag(save, 'opening-seen');
    expect(save.storyFlags).toEqual(['first-encounter-seen','opening-seen']);
    expect(getObservationMilestones(save).map((item) => item.title)).toEqual(['最初の遭遇','序章']);
  });
});
