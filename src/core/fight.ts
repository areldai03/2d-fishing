import type { FishBehavior, FishData } from '../types';

export interface FightState {
  tension: number;
  distance: number;
  stamina: number;
  maxStamina: number;
  dangerTime: number;
  elapsed: number;
}

export interface FightInput {
  reeling: boolean;
  rodControl: number;
  hookControl: number;
}

export type FightResult = 'fighting' | 'caught' | 'line-broken' | 'escaped';

export interface FightBeat {
  warning: boolean;
  burst: boolean;
  strength: number;
}

export function specimenPower(fish: FishData, size: number): number {
  const range = Math.max(.1, fish.maxSize - fish.minSize);
  const normalized = Math.max(0, Math.min(1, (size - fish.minSize) / range));
  return .82 + normalized * .5;
}

const BEATS: Record<FishBehavior, { cycle: number; warningAt: number; burstAt: number; burstEnd: number; strength: number }> = {
  calm:      { cycle: 4.8, warningAt: 1.15, burstAt: 1.75, burstEnd: 2.55, strength: .96 },
  sprinter:  { cycle: 3.85, warningAt: .95, burstAt: 1.48, burstEnd: 2.18, strength: 1.12 },
  diver:     { cycle: 4.35, warningAt: 1.10, burstAt: 1.72, burstEnd: 2.55, strength: 1.06 },
  trickster: { cycle: 3.65, warningAt: .80, burstAt: 1.35, burstEnd: 2.05, strength: 1.04 },
  power:     { cycle: 4.7, warningAt: 1.20, burstAt: 1.90, burstEnd: 2.75, strength: 1.20 },
};

export function createFightState(fish: FishData, castPower: number, specimenScale = 1): FightState {
  const maxStamina = (18 + fish.difficulty * 18) * specimenScale;
  return {
    tension: 24,
    distance: 58 + Math.max(.08, Math.min(.98, castPower)) * 18,
    stamina: maxStamina,
    maxStamina,
    dangerTime: 0,
    elapsed: 0,
  };
}

export function getFightBeat(fish: FishData, elapsed: number): FightBeat {
  const profile = BEATS[fish.behavior];
  const cycle = elapsed % profile.cycle;
  return {
    warning: cycle >= profile.warningAt && cycle < profile.burstAt,
    burst: cycle >= profile.burstAt && cycle < profile.burstEnd,
    strength: profile.strength,
  };
}

export function stepFight(current: FightState, dt: number, fish: FishData, input: FightInput, specimenScale = 1): { state: FightState; result: FightResult; beat: FightBeat } {
  const safeDt = Math.max(0, Math.min(dt, .1));
  const elapsed = current.elapsed + safeDt;
  const beat = getFightBeat(fish, elapsed);
  const energy = current.maxStamina > 0 ? current.stamina / current.maxStamina : 0;
  const effectiveDifficulty = fish.difficulty * specimenScale;
  const behaviorForce = fish.behavior === 'power' ? 1.08 : fish.behavior === 'calm' ? .9 : 1;
  const force = (.62 + effectiveDifficulty * .28) * (.42 + energy * .58) * behaviorForce;
  let { tension, distance, stamina, dangerTime } = current;

  if (input.reeling) {
    const fatigueHelp = .62 + (1 - energy) * .46;
    const reelRate = (19 + input.hookControl * 9) / (.95 + effectiveDifficulty * .16);
    distance -= safeDt * reelRate * fatigueHelp * (beat.burst ? .22 : 1);
    stamina -= safeDt * (9.2 + input.hookControl * 5) * (beat.burst ? 1.18 : 1);
    tension += safeDt * (9.5 + force * 7) * (1 - input.rodControl * 1.05);
  } else {
    tension -= safeDt * (34 + input.rodControl * 18);
    stamina -= safeDt * (beat.burst ? 2.8 : .65);
    const slackEscapeRate = (1.8 + effectiveDifficulty * .85) * (.65 + energy * .45);
    distance += safeDt * slackEscapeRate;
  }

  if (beat.burst) {
    distance += safeDt * (input.reeling ? 3.1 : 5.2 + effectiveDifficulty * 1.8) * beat.strength * force;
    tension += safeDt * (input.reeling ? 96 : 1.6) * beat.strength * force * (1 - input.rodControl * .72);
  }

  tension = Math.max(4, Math.min(110, tension));
  distance = Math.max(0, Math.min(108, distance));
  stamina = Math.max(0, stamina);
  dangerTime = tension >= 94 ? dangerTime + safeDt : Math.max(0, dangerTime - safeDt * 3.2);
  const state = { tension, distance, stamina, maxStamina: current.maxStamina, dangerTime, elapsed };

  if (dangerTime >= .48 + input.rodControl * .9) return { state, result: 'line-broken', beat };
  if (distance >= 104) return { state, result: 'escaped', beat };
  if (distance <= 5) return { state, result: 'caught', beat };
  return { state, result: 'fighting', beat };
}

export function biteWindowMs(fish: FishData, floatControl: number, hookControl: number): number {
  return Math.max(1200, 1550 - fish.difficulty * 220 + (floatControl + hookControl) * 900);
}

export function landingTolerance(fish: FishData, hookControl: number, specimenScale = 1): number {
  const sizeLevel = Math.max(0, Math.min(1, (specimenScale - .82) / .5));
  return Math.max(.09, Math.min(.23, .23 - fish.difficulty * .035 - sizeLevel * .09 + hookControl * .15));
}

export function canLandFish(fish: FishData, markerPosition: number, hookControl: number, specimenScale = 1): boolean {
  return Math.abs(markerPosition - .5) <= landingTolerance(fish, hookControl, specimenScale);
}
