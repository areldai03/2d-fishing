import { describe, expect, it } from 'vitest';
import { FISHING_BACKGROUND_ASSETS, fishingSpotVisual, type FishingSpotId } from './fishingSpots';
import type { StageId } from '../types';

describe('fishing spot visuals', () => {
  it.each([
    ['mountain-stream', 'edge'],
    ['mountain-stream', 'rapid'],
    ['mountain-stream', 'deep-pool'],
    ['tsukinami-port', 'harbor-wall'],
    ['tsukinami-port', 'breakwater'],
    ['tsukinami-port', 'river-mouth'],
  ] satisfies [StageId, FishingSpotId][])('assigns a dedicated image to %s / %s', (stage, spot) => {
    expect(fishingSpotVisual(stage, spot).asset).toContain(spot);
  });

  it('preloads each image key only once', () => {
    const keys = FISHING_BACKGROUND_ASSETS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('falls back to the stage default when a stale spot is supplied', () => {
    expect(fishingSpotVisual('mountain-stream', 'harbor-wall').title).toContain('白泡の瀬');
    expect(fishingSpotVisual('tsukinami-port', 'rapid').title).toContain('港の足元');
  });
});
