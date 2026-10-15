export type PortTide = 'slack' | 'outflow';

export interface LureMarkerState {
  position: number;
  direction: 1 | -1;
}

export function lureWindow(tide: PortTide): { start: number; end: number } {
  return tide === 'outflow' ? { start:.43, end:.61 } : { start:.35, end:.67 };
}

export function stepLureMarker(state: LureMarkerState, dt: number, tide: PortTide): LureMarkerState {
  const speed = tide === 'outflow' ? .82 : .68;
  let position = state.position + state.direction * speed * Math.max(0, dt);
  let direction = state.direction;
  if (position >= .96) { position = .96 - (position - .96); direction = -1; }
  if (position <= .04) { position = .04 + (.04 - position); direction = 1; }
  return { position, direction };
}

export function isLurePullOnCurrent(position: number, tide: PortTide): boolean {
  const window = lureWindow(tide);
  return position >= window.start && position <= window.end;
}
