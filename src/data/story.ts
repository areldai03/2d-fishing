import type { StorySceneData } from '../types';

export const STORY: Record<string, StorySceneData> = {
  opening: {
    id:'opening', title:'序章｜実験が終わるまで', backdrop:'lab',
    archive:{ unlockFlag:'opening-seen', label:'序章', summary:'計算待ちの夕方、森野先輩から古い竿を借りた。' },
    lines:[
      { speaker:'先輩・森野', text:'計算、まだ回ってる？　その顔は回ってるね。' },
      { speaker:'主人公', text:'残り二時間です。進捗はありませんが、待ち時間はあります。' },
      { speaker:'先輩・森野', text:'裏の川、オイカワが出るよ。これ、研究室の備品じゃない竿。' },
      { speaker:'主人公', text:'こうして僕の研究計画には、誰にも申請していない観測項目がひとつ増えた。', tone:'thought' },
      { speaker:'主人公', text:'――川面の奥で、三日月みたいな白い傷が光った気がした。', tone:'important' },
    ],
  },
  chapter1Unlock: {
    id:'chapter1Unlock', title:'第一章｜川の上流にて', backdrop:'night-lab',
    archive:{ unlockFlag:'chapter1-intro-seen', label:'第一章', summary:'大学裏の観測結果から、青葉渓流への道が開けた。' },
    lines:[
      { speaker:'先輩・森野', text:'三匹で二種。初日にしては、ちゃんとデータっぽいね。' },
      { speaker:'主人公', text:'実験ノートより釣果メモのほうが再現性あります。' },
      { speaker:'先輩・森野', text:'その銀色の魚なら、上流で見たって話を聞いたことがある。青葉渓流。バスを二本乗り継ぐけど。' },
      { speaker:'主人公', text:'二本……。研究室よりアクセスが難しい。' },
      { speaker:'先輩・森野', text:'月波釣具店の鵜沢さんを訪ねて。川のことなら、先生より詳しいよ。' },
      { speaker:'主人公', text:'翌朝、解析結果より先にバスの時刻表を確認した。', tone:'thought' },
    ],
  },
  streamArrival: {
    id:'streamArrival', title:'青葉渓流｜最初の観測', backdrop:'stream',
    archive:{ unlockFlag:'stream-arrival-seen', label:'現地調査', summary:'透明な流れの読み方を、鵜沢さんから教わった。' },
    lines:[
      { speaker:'主人公', text:'水が透明すぎる。魚からも、こちらの迷いが丸見えだ。' },
      { speaker:'店主・鵜沢', text:'森野さんの後輩だね。竿先ばかり見ない。流れの色が変わる場所を見るんだ。' },
      { speaker:'主人公', text:'月波釣具店の鵜沢さん。なぜ現地に。' },
      { speaker:'店主・鵜沢', text:'店番より、川番のほうが向いててね。白泡の横へ川虫を流してごらん。' },
      { speaker:'店主・鵜沢', text:'まずはヤマメを一匹。釣れた場所と大きさも記録する。君、そういうのは得意だろう？' },
      { speaker:'主人公', text:'急に研究らしくなってきた。予算は出ないけれど。', tone:'thought' },
    ],
  },
  yamameCaught: {
    id:'yamameCaught', title:'観測記録｜朱点の魚', backdrop:'stream',
    archive:{ unlockFlag:'yamame-story-seen', label:'観測記録', summary:'初めてのヤマメから、渓流魚の逃げ方を観察した。' },
    lines:[
      { speaker:'主人公', text:'朱い点、楕円の模様。写真で見るより、ずっと細かい。' },
      { speaker:'店主・鵜沢', text:'いいヤマメだ。流れに正面から逆らわず、横へ逃げただろう。' },
      { speaker:'主人公', text:'はい。魚にも最急降下法があるんですね。' },
      { speaker:'店主・鵜沢', text:'難しい言葉は知らないが、逃げ道を読めたなら上出来だ。あと一種、川の違う顔も見ておいで。' },
      { speaker:'主人公', text:'スマホの写真フォルダが、実験結果より魚で埋まり始めている。', tone:'thought' },
    ],
  },
  chapter1Finale: {
    id:'chapter1Finale', title:'第一章 終幕｜古い観測帳', backdrop:'night-lab',
    archive:{ unlockFlag:'chapter1-complete', label:'第一章 終幕', summary:'十五年前にも、三日月形の傷を持つ銀色魚がいた。' },
    lines:[
      { speaker:'先輩・森野', text:'おかえり。顔を見れば分かる。解析は外れたけど、魚は当たったね。' },
      { speaker:'主人公', text:'ヤマメを含む二種。流速とポイントも記録しました。こちらは再現できそうです。' },
      { speaker:'先輩・森野', text:'鵜沢さんから預かった古い観測帳、見て。十五年前の欄。' },
      { speaker:'主人公', text:'「大雨の翌朝。大型の銀色魚。右腹に弧状の白傷」……三日月形。' , tone:'important' },
      { speaker:'先輩・森野', text:'同じ魚かは分からない。でも、上流と大学裏を行き来する理由はありそう。' },
      { speaker:'主人公', text:'研究対象が決まるときは、案外こんなものなのかもしれない。仮説はひとつ――あの魚を、もう一度見る。', tone:'thought' },
      { speaker:'店主・鵜沢', text:'調査のお礼だ。波読みの浮き。次は夕暮れの港で、流れと潮の違いを覚えるといい。' },
      { speaker:'主人公', text:'解析終了の通知が鳴った。僕は初めて、それを少しだけ後回しにした。', tone:'important' },
    ],
  },
};
