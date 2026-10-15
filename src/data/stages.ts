import type { StageData, StageId } from '../types';

export const STAGES: Record<StageId, StageData> = {
  'campus-river': { id:'campus-river', name:'大学裏の川', subtitle:'第七実験棟から徒歩三分', description:'コンクリート護岸と草むらが同居する、いつもの川。橋の影は少し深い。', accent:'#e8b866', unlockedAtChapter:0 },
  'mountain-stream': { id:'mountain-stream', name:'青葉渓流', subtitle:'バスを二本乗り継いだ先', description:'岩間を冷たい水が走る。流心は速く、岸際には小さな淀みがある。', accent:'#8ed0ad', unlockedAtChapter:1 },
  'tsukinami-port': { id:'tsukinami-port', name:'月波港', subtitle:'川が海へほどける場所', description:'川水と潮が混ざる小さな港。夕まずめ、流れの境目に魚が集まる。', accent:'#e49a62', unlockedAtChapter:2 },
};
