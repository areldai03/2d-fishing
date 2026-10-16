import { FISH_LIST } from '../data/fish';
import type { SaveData } from '../types';
import { portSurveyReady, streamSurveyReady } from './fishing';

export interface QuestState {
  title: string;
  description: string;
  progress: number;
  counter: string;
}

export type HomeStoryAction =
  | 'chapter1-report'
  | 'chapter1-finale'
  | 'chapter2-report'
  | 'chapter2-finale'
  | 'shop-intro'
  | 'go-fishing'
  | 'go-map';

export interface HomeStoryState {
  chapterLabel: string;
  chapterTitle: string;
  primaryLabel: string;
  primaryHint: string;
  labMessage: string;
  action: HomeStoryAction;
  actionReady: boolean;
}

export interface ObservationMilestone {
  title: string;
  description: string;
}

export function hasStoryFlag(save: SaveData, flag: string): boolean {
  return save.storyFlags.includes(flag);
}

export function addStoryFlag(save: SaveData, flag: string): boolean {
  if (hasStoryFlag(save, flag)) return false;
  save.storyFlags.push(flag);
  return true;
}

export function getCurrentQuest(save: SaveData): QuestState {
  if (save.chapter >= 3) return { title:'第二章の観測完了', description:'日没後に旧水路が開く夜、銀色の影が動く。次の章では夜の川を調査する。', progress:100, counter:'次章：夜の川は眠らない' };
  if (save.chapter === 2) {
    if (!hasStoryFlag(save, 'port-arrival-seen')) return { title:'月波港へ向かう', description:'古い観測帳に残る河口の目撃場所を、移動画面から訪ねよう。', progress:10, counter:'目的地：月波港' };
    const portSpecies = FISH_LIST.filter((fish) => fish.habitat.includes('tsukinami-port') && save.records[fish.id]).length;
    const portCount = save.stageCatchCounts['tsukinami-port'] ?? 0;
    if (!portSurveyReady(save)) return { title:'港の「当たり前」を観測', description:'足元のハゼと中層のアジを含む、合計3匹・2魚種を記録しよう。', progress:25 + Math.min(38, Math.min(portCount/3, portSpecies/2)*38), counter:`${portCount}/3匹・${portSpecies}/2種` };
    if (!hasStoryFlag(save, 'port-mid-report-seen')) return { title:'潮汐データを整理する', description:'研究室へ戻り、釣れた時刻と潮の向きを森野先輩と照らし合わせよう。', progress:68, counter:'報告可能' };
    if (!hasStoryFlag(save, 'tournament-suzuki-seen')) return { title:'夕まずめ大会で大型魚を狙う', description:'河口の潮目へルアーを遠投し、三回うまく引いてスズキを釣り上げよう。', progress:88, counter:'大会目標 0/1' };
    return { title:'研究室へ戻って最終報告', description:'港の大型魚に残る傷と、日没後の監視記録を照らし合わせよう。', progress:98, counter:'帰還可能' };
  }
  if (save.chapter === 0) {
    const species = Object.keys(save.records).length;
    return { title:'大学裏の生態を調べる', description:'合計3匹、2魚種を観測して先輩へ報告しよう。', progress:Math.min(100, Math.min(save.totalCaught/3, species/2)*100), counter:`${save.totalCaught}/3匹・${species}/2種` };
  }
  if (!hasStoryFlag(save, 'uzawa-intro-seen')) return { title:'川を知る人に会う', description:'月波釣具店を訪ね、店主の鵜沢さんに銀色魚の目撃を相談しよう。', progress:8, counter:'目的地：釣具屋' };
  if (!hasStoryFlag(save, 'stream-arrival-seen')) return { title:'青葉渓流へ向かう', description:'移動画面から青葉渓流を選び、鵜沢さんに会おう。', progress:15, counter:'目的地：青葉渓流' };
  if (!save.records.yamame) return { title:'渓流の宝石を観測', description:'川虫を使い、白泡の横を狙ってヤマメを釣ろう。', progress:35, counter:'ヤマメ 0/1' };
  const streamSpecies = FISH_LIST.filter((fish) => fish.habitat.includes('mountain-stream') && save.records[fish.id]).length;
  const streamCount = save.stageCatchCounts['mountain-stream'] ?? 0;
  if (!streamSurveyReady(save)) return { title:'渓流の違う顔を見る', description:'青葉渓流で合計3匹・2魚種を観測する。', progress:55 + Math.min(35, Math.min(streamCount/3, streamSpecies/2)*35), counter:`${streamCount}/3匹・${streamSpecies}/2種` };
  if (!hasStoryFlag(save, 'stream-mid-report-seen')) return { title:'研究室へ戻って中間報告', description:'渓流の観測記録を森野先輩と整理しよう。', progress:72, counter:'報告可能' };
  if (!hasStoryFlag(save, 'deep-pool-clue-seen')) return { title:'深みの入口を探す', description:'青葉渓流へ戻り、鵜沢さんと流れの深みを調べよう。', progress:80, counter:'目的地：青葉渓流' };
  if (!hasStoryFlag(save, 'iwana-challenge-seen')) return { title:'深みの大型イワナ', description:'地点「深い落ち込み」を選び、川虫を遠めへ流して大型イワナを釣ろう。', progress:90, counter:'大型イワナ 0/1' };
  return { title:'研究室へ戻って最終報告', description:'大型イワナの傷と古い観測帳を照らし合わせよう。', progress:98, counter:'帰還可能' };
}

export function getHomeStoryState(save: SaveData): HomeStoryState {
  const reportReady = save.chapter === 1 && hasStoryFlag(save, 'uzawa-intro-seen') && streamSurveyReady(save) && !hasStoryFlag(save, 'stream-mid-report-seen');
  const chapter1FinaleReady = save.chapter === 1 && hasStoryFlag(save, 'uzawa-intro-seen') && hasStoryFlag(save, 'iwana-challenge-seen');
  const portReportReady = save.chapter === 2 && portSurveyReady(save) && !hasStoryFlag(save, 'port-mid-report-seen');
  const chapter2FinaleReady = save.chapter === 2 && hasStoryFlag(save, 'tournament-suzuki-seen');
  const needsShopIntro = save.chapter === 1 && !hasStoryFlag(save, 'uzawa-intro-seen');
  const action: HomeStoryAction = reportReady ? 'chapter1-report'
    : chapter1FinaleReady ? 'chapter1-finale'
      : portReportReady ? 'chapter2-report'
        : chapter2FinaleReady ? 'chapter2-finale'
          : needsShopIntro ? 'shop-intro'
            : save.chapter === 0 ? 'go-fishing' : 'go-map';
  const actionReady = ['chapter1-report','chapter1-finale','chapter2-report','chapter2-finale'].includes(action);
  const chapterLabel = save.chapter === 0 ? '序章' : save.chapter === 1 ? '第一章' : save.chapter === 2 ? '第二章' : '第二章 完了';
  const primaryLabel = action === 'chapter2-finale' ? '港の最終報告をまとめる'
    : action === 'chapter2-report' ? '潮汐データを整理する'
      : action === 'chapter1-finale' ? '最終報告をまとめる'
        : action === 'chapter1-report' ? '中間報告をまとめる'
          : action === 'shop-intro' ? '月波釣具店へ行く'
            : action === 'go-fishing' ? '大学裏の川へ行く' : '釣行を続ける';
  return {
    chapterLabel,
    chapterTitle:save.chapter === 0 ? '昨日の銀色を探して' : save.chapter === 1 ? '川の上流にて' : save.chapter === 2 ? '夕暮れの港' : '夜へ続く水路',
    primaryLabel,
    primaryHint:actionReady || needsShopIntro ? `${chapterLabel}の物語を進める` : '装備を確認して出発',
    labMessage:save.chapter >= 3 ? '港の観測記録：同期済み　次回調査は日没後' : save.chapter === 2 ? '潮汐データ：取得中　夕まずめの観測窓を解析しています' : save.chapter === 0 ? '昨夜の計算ジョブ：完了　結果ファイルを保存済み' : '次の計算ジョブ：準備中　観測記録を整理しています',
    action,
    actionReady,
  };
}

const MILESTONES: ReadonlyArray<{ flag: string; title: string; description: string }> = [
  { flag:'first-encounter-seen', title:'最初の遭遇', description:'大学裏の川で、三日月形の傷を持つ巨大な銀色魚を目撃。' },
  { flag:'opening-seen', title:'序章', description:'銀色魚を目撃した翌日、森野先輩へ相談し、比較観測のため古い竿を借りた。' },
  { flag:'first-catch-seen', title:'初観測', description:'初めて自分の操作で魚を釣り上げ、場所・エサ・大きさを記録した。' },
  { flag:'prologue-caught-up', title:'比較観測', description:'大学裏で三匹を記録し、昨日の銀色魚が通常の魚影とは違うと確かめた。' },
  { flag:'chapter1-unlocked', title:'第一章', description:'大学裏の観測を森野先輩へ報告し、月波釣具店を紹介された。' },
  { flag:'uzawa-intro-seen', title:'川の共同研究者', description:'鵜沢店主から川虫と青葉渓流への調査ルートを教わった。' },
  { flag:'yamame-story-seen', title:'観測記録', description:'青葉渓流でヤマメを初観測。流れを利用する逃走を記録。' },
  { flag:'flow-boundary-deduced', title:'観測仮説', description:'白泡の脇と岩の裏に共通する「流れの境目」を特定した。' },
  { flag:'iwana-challenge-seen', title:'深みの調査', description:'大型イワナの古傷を記録し、深みへリリースした。' },
  { flag:'chapter1-complete', title:'第一章完了', description:'古い観測帳から、十五年前の銀色魚の記録を発見。' },
  { flag:'port-arrival-seen', title:'第二章', description:'月波港で磯部蓮と出会い、潮目へルアーを通す方法を教わった。' },
  { flag:'port-mid-report-seen', title:'潮汐仮説', description:'下げ潮の河口に小魚と大型魚が集まる条件を特定した。' },
  { flag:'tournament-suzuki-seen', title:'夕まずめ大会', description:'大型スズキを記録し、傷が移動経路を示す可能性を確かめた。' },
  { flag:'chapter2-complete', title:'第二章完了', description:'日没後に旧水路を通る銀色魚の影を、次の調査対象に定めた。' },
];

export function getObservationMilestones(save: SaveData): ObservationMilestone[] {
  return MILESTONES
    .filter((milestone) => hasStoryFlag(save, milestone.flag))
    .map(({ title, description }) => ({ title, description }));
}
