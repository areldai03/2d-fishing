import type { GearData } from '../types';

export const GEAR: GearData[] = [
  { id:'rod-1', category:'rod', level:1, name:'竹の釣り竿', description:'しなやかな一本。基本を覚えるには十分。', asset:'/assets/gear/rod-1.png', price:0, unlockChapter:0, control:0 },
  { id:'rod-2', category:'rod', level:2, name:'磯部調整・カーボンロッド', description:'月波港大会の記念品。張力上昇を約19%抑え、危険域にも少し粘れる。', asset:'/assets/gear/rod-2.png', price:0, unlockChapter:3, control:.18 },
  { id:'rod-3', category:'rod', level:3, name:'月穿ち竿', description:'強い流れでも粘る、古い水門の記録に残された大物用の竿。', price:2800, unlockChapter:4, control:.34 },
  { id:'float-1', category:'float', level:1, name:'赤白の浮き', description:'小さな変化を見逃さなければ頼れる。', asset:'/assets/gear/float-1.png', price:0, unlockChapter:0, control:0 },
  { id:'float-2', category:'float', level:2, name:'鵜沢調整・波読みの浮き', description:'本アタリが約0.18秒長くなり、希少魚の小さな反応も拾いやすい。', asset:'/assets/gear/float-2.png', price:0, unlockChapter:2, control:.2 },
  { id:'float-3', category:'float', level:3, name:'星見浮き', description:'暗い水面の反応を拾い、希少魚との遭遇点を大きく補う夜釣り用の浮き。', price:2500, unlockChapter:4, control:.38 },
  { id:'hook-1', category:'hook', level:1, name:'普通の釣り針', description:'丁寧に合わせれば、ちゃんと掛かる。', asset:'/assets/gear/hook-1.png', price:0, unlockChapter:0, control:0 },
  { id:'hook-2', category:'hook', level:2, name:'鋭刃の釣り針', description:'合わせが約0.14秒伸び、魚を早く疲れさせる。', asset:'/assets/gear/hook-2.png', price:380, unlockChapter:1, control:.16 },
  { id:'hook-3', category:'hook', level:3, name:'月牙針', description:'大型魚の硬い口元を捉える、半月形に研がれた大物用の針。', price:2300, unlockChapter:4, control:.32 },
];

export const CATEGORY_NAMES = { rod:'釣り竿', float:'浮き', hook:'釣り針' } as const;
