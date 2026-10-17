import type { ShrineRewardData, ShrineRewardId } from '../types';

export const SHRINE_REWARDS: ReadonlyArray<ShrineRewardData> = [
  { id:'river-grass', name:'ゆらぎ水草', description:'流れに合わせて揺れる、大学裏の川の水草。水槽の中央を柔らかく彩る。', rarity:1, weight:28, asset:'/assets/shrine-rewards/river-grass.svg' },
  { id:'moon-stone', name:'月白の川石', description:'白い弧の筋が入った滑らかな川石。ミカヅキの傷を思わせる。', rarity:1, weight:24, asset:'/assets/shrine-rewards/moon-stone.svg' },
  { id:'driftwood', name:'古流木の止まり木', description:'長い水旅で角が取れた流木。魚が陰へ寄り道する。', rarity:1, weight:22, asset:'/assets/shrine-rewards/driftwood.svg' },
  { id:'bubble-flask', name:'気泡フラスコ', description:'研究室の廃材を再利用した小さな気泡器。規則正しく泡を送る。', rarity:2, weight:13, asset:'/assets/shrine-rewards/bubble-flask.svg' },
  { id:'shrine-lantern', name:'水守りの石灯籠', description:'淡い琥珀色を宿す小さな灯籠。水底でも光は消えない。', rarity:2, weight:9, asset:'/assets/shrine-rewards/shrine-lantern.svg' },
  { id:'crescent-panel', name:'三日月の水景板', description:'水槽の奥へ月影を映す観測背景。銀色の魚影を静かに待つ。', rarity:3, weight:4, asset:'/assets/shrine-rewards/crescent-panel.svg' },
];

export const SHRINE_REWARD_BY_ID = Object.fromEntries(SHRINE_REWARDS.map((reward) => [reward.id, reward])) as Record<ShrineRewardId, ShrineRewardData>;
