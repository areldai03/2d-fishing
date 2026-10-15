import { describe, expect, it } from 'vitest';
import { isLurePullOnCurrent, lureWindow, stepLureMarker } from './lure';

describe('port lure action', () => {
  it('makes the tournament outflow window narrower than the basic lesson', () => {
    const slack = lureWindow('slack');
    const outflow = lureWindow('outflow');
    expect(outflow.end - outflow.start).toBeLessThan(slack.end - slack.start);
    expect(isLurePullOnCurrent(.5, 'outflow')).toBe(true);
    expect(isLurePullOnCurrent(.3, 'outflow')).toBe(false);
  });

  it('moves and bounces the marker without leaving the readable gauge', () => {
    const forward = stepLureMarker({ position:.9, direction:1 }, .2, 'outflow');
    expect(forward.direction).toBe(-1);
    expect(forward.position).toBeLessThanOrEqual(.96);
    const backward = stepLureMarker({ position:.08, direction:-1 }, .2, 'slack');
    expect(backward.direction).toBe(1);
    expect(backward.position).toBeGreaterThanOrEqual(.04);
  });
});
