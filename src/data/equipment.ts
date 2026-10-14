import type { GearData } from '../types';

export const GEAR: GearData[] = [
  { id:'rod-1', category:'rod', level:1, name:'竹の釣り竿', description:'しなやかな一本。基本を覚えるには十分。', price:0, unlockChapter:0, control:0 },
  { id:'rod-2', category:'rod', level:2, name:'カーボンロッド', description:'張力上昇を約19%抑え、危険域にも少し粘れる。', price:520, unlockChapter:1, control:.18 },
  { id:'rod-3', category:'rod', level:3, name:'月穿ち竿', description:'未実装の後半章で解禁される伝説級の竿。', price:2800, unlockChapter:4, control:.34 },
  { id:'float-1', category:'float', level:1, name:'赤白の浮き', description:'小さな変化を見逃さなければ頼れる。', price:0, unlockChapter:0, control:0 },
  { id:'float-2', category:'float', level:2, name:'波読みの浮き', description:'本アタリの受付が約0.18秒長く、合図も見やすい。', price:440, unlockChapter:1, control:.2 },
  { id:'float-3', category:'float', level:3, name:'星見浮き', description:'未実装の後半章で解禁される伝説級の浮き。', price:2500, unlockChapter:4, control:.38 },
  { id:'hook-1', category:'hook', level:1, name:'普通の釣り針', description:'丁寧に合わせれば、ちゃんと掛かる。', price:0, unlockChapter:0, control:0 },
  { id:'hook-2', category:'hook', level:2, name:'鋭刃の釣り針', description:'合わせが約0.14秒伸び、魚を早く疲れさせる。', price:380, unlockChapter:1, control:.16 },
  { id:'hook-3', category:'hook', level:3, name:'月牙針', description:'未実装の後半章で解禁される伝説級の針。', price:2300, unlockChapter:4, control:.32 },
];

export const CATEGORY_NAMES = { rod:'釣り竿', float:'浮き', hook:'釣り針' } as const;
