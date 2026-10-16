import type { StageId } from '../types';

export type FishingSpotId = 'edge' | 'rapid' | 'deep-pool' | 'harbor-wall' | 'breakwater' | 'river-mouth';

export interface FishingSpotVisual {
  key: string;
  asset: string;
  title: string;
  subtitle: string;
  waterStart: number;
  waterColor: number;
  rippleColor: number;
  labelBorder: number;
  overlayColor?: number;
  overlayAlpha?: number;
}

const CAMPUS_RIVER: FishingSpotVisual = {
  key: 'bg-campus-river-v3',
  asset: '/assets/backgrounds/campus-river-pixel-v3.png',
  title: '大学裏の川',
  subtitle: '序章｜昨日の銀色を探して',
  waterStart: 165,
  waterColor: 0xffd889,
  rippleColor: 0xffe2a0,
  labelBorder: 0xd9a451,
};

export const FISHING_SPOT_VISUALS: Record<Exclude<StageId, 'campus-river'>, Record<string, FishingSpotVisual>> = {
  'mountain-stream': {
    edge: {
      key: 'bg-mountain-stream-edge-v1',
      asset: '/assets/backgrounds/mountain-stream-edge-pixel-v1.png',
      title: '青葉渓流・岸際',
      subtitle: '第一章｜木の根の淀み',
      waterStart: 158,
      waterColor: 0xb9f5dc,
      rippleColor: 0xc9fff1,
      labelBorder: 0x8bc5a3,
    },
    rapid: {
      key: 'bg-mountain-stream-rapid-v1',
      asset: '/assets/backgrounds/mountain-stream-rapid-pixel-v1.png',
      title: '青葉渓流・白泡の瀬',
      subtitle: '第一章｜岩を縫う流れ',
      waterStart: 150,
      waterColor: 0xd9fff6,
      rippleColor: 0xd8fff5,
      labelBorder: 0x8bc5a3,
    },
    'deep-pool': {
      key: 'bg-mountain-stream-deep-v1',
      asset: '/assets/backgrounds/mountain-stream-deep-pool-pixel-v1.png',
      title: '青葉渓流・深み',
      subtitle: '第一章｜閉鎖取水路の下',
      waterStart: 158,
      waterColor: 0x8ed5d4,
      rippleColor: 0xaee9e3,
      labelBorder: 0x71ada3,
      overlayColor: 0x071c2b,
      overlayAlpha: .08,
    },
  },
  'tsukinami-port': {
    'harbor-wall': {
      key: 'bg-tsukinami-port-wall-v1',
      asset: '/assets/backgrounds/tsukinami-port-harbor-wall-pixel-v1.png',
      title: '月波港・港の足元',
      subtitle: '第二章｜船影の下を探る',
      waterStart: 142,
      waterColor: 0xffb36b,
      rippleColor: 0xffc58d,
      labelBorder: 0xe28b5b,
    },
    breakwater: {
      key: 'bg-tsukinami-port-breakwater-v1',
      asset: '/assets/backgrounds/tsukinami-port-breakwater-pixel-v1.png',
      title: '月波港・防波堤',
      subtitle: '第二章｜外海へ続く堤',
      waterStart: 125,
      waterColor: 0xff9d64,
      rippleColor: 0xffbf8a,
      labelBorder: 0xd97658,
    },
    'river-mouth': {
      key: 'bg-tsukinami-port-river-mouth-v1',
      asset: '/assets/backgrounds/tsukinami-port-river-mouth-pixel-v1.png',
      title: '月波港・河口の潮目',
      subtitle: '第二章｜二つの水が出会う場所',
      waterStart: 137,
      waterColor: 0xf6a56e,
      rippleColor: 0xffc697,
      labelBorder: 0xdb7658,
    },
  },
};

export const FISHING_BACKGROUND_ASSETS = [
  CAMPUS_RIVER,
  ...Object.values(FISHING_SPOT_VISUALS).flatMap((stage) => Object.values(stage)),
].map(({ key, asset }) => ({ key, asset }));

export function fishingSpotVisual(stageId: StageId, spot: FishingSpotId): FishingSpotVisual {
  if (stageId === 'campus-river') return CAMPUS_RIVER;
  const stage = FISHING_SPOT_VISUALS[stageId];
  return stage[spot] ?? stage[stageId === 'mountain-stream' ? 'rapid' : 'harbor-wall'];
}
