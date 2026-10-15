import type { BaitData, BaitId, ConsumableBaitId } from '../types';

export const BAITS: Record<BaitId, BaitData> = {
  '練り餌': { id:'練り餌', name:'川魚用の練り餌', description:'匂いが広がりやすい基本餌。コイやフナに強い。', price:25, bundle:5, unlockChapter:0, reusable:false },
  'ミミズ': { id:'ミミズ', name:'活きミミズ', description:'底を探る魚が好む万能餌。扱いやすい小箱入り。', price:40, bundle:5, unlockChapter:0, reusable:false },
  '川虫': { id:'川虫', name:'清流の川虫', description:'渓流魚や小型遊泳魚に効く。鮮度が命の採集餌。', price:55, bundle:5, unlockChapter:1, reusable:false },
  'ルアー': { id:'ルアー', name:'研究用スプーン', description:'何度でも使える小型ルアー。潮目では誘い操作が必要。', price:0, bundle:0, unlockChapter:0, reusable:true },
};

export const CONSUMABLE_BAITS: ConsumableBaitId[] = ['練り餌','ミミズ','川虫'];
