import './style.css';
import { createGame } from './game/createGame';
import { RiverScene } from './game/RiverScene';
import { loadSave, persistSave, eraseSave } from './core/save';
import { chooseFish, makeCatch, recordCatch, sellBasket, streamSurveyReady } from './core/fishing';
import { biteWindowMs, canLandFish, createFightState, landingTolerance, specimenPower, stepFight, type FightState } from './core/fight';
import { buyOrEquip } from './core/shop';
import { FISH, FISH_LIST } from './data/fish';
import { GEAR, CATEGORY_NAMES } from './data/equipment';
import { STAGES } from './data/stages';
import { STORY } from './data/story';
import { setBgm, sfx, type BgmTheme } from './audio';
import type { BaitId, CatchItem, FishData, GearCategory, SaveData, StageId } from './types';

type FishingPhase = 'idle' | 'casting' | 'waiting' | 'nibble' | 'bite' | 'fight' | 'landing' | 'landing-result';

class FishingApp {
  private root: HTMLElement;
  private save: SaveData = loadSave();
  private scene?: RiverScene;
  private phase: FishingPhase = 'idle';
  private castPower = .5;
  private castDirection = 1;
  private castFrame = 0;
  private pendingFish?: FishData;
  private pendingCatch?: CatchItem;
  private pendingPower = 1;
  private timers: number[] = [];
  private isReeling = false;
  private fightState?: FightState;
  private lastFrame = 0;
  private fightFrame = 0;
  private landingFrame = 0;
  private landingLastFrame = 0;
  private landingPosition = .12;
  private landingDirection = 1;
  private selectedBook = FISH_LIST[0].id;
  private selectedStoryArchive = 'opening';
  private currentTab = 'home';

  constructor(root: HTMLElement) {
    this.root = root;
    this.renderShell();
    const game = createGame(this.query('#game-canvas'));
    game.events.once('ready', () => undefined);
    const wait = window.setInterval(() => {
      const scene = game.scene.getScene('river') as RiverScene;
      if (scene?.scene.isActive()) {
        this.scene = scene;
        this.scene.setStage(this.save.activeStage);
        clearInterval(wait);
      }
    }, 50);
    this.bindGlobalControls();
    if (!this.save.openingSeen) this.showTitle();
    else this.activateTab('home');
  }

  private query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <main class="phone-shell">
        <section id="world-wrap">
          <section id="game-canvas" aria-label="釣り場"></section>
          <section id="home-scene" class="home-scene hidden" aria-label="研究室ホーム">
            <img src="/assets/backgrounds/laboratory-home-pixel-v1.png" alt="夕暮れの研究室">
            <div class="lab-glow"></div><div class="screen-scan"></div><div class="dust d1"></div><div class="dust d2"></div><div class="dust d3"></div>
            <div class="home-place"><small>HOME BASE</small><strong>第七実験棟・研究室</strong></div>
            <button class="lab-hotspot tank" data-lab-spot="tank" aria-label="水槽を調べる"><i></i></button>
            <button class="lab-hotspot window" data-lab-spot="window" aria-label="窓を調べる"><i></i></button>
            <button class="lab-hotspot board" data-lab-spot="board" aria-label="ホワイトボードを調べる"><i></i></button>
            <button class="lab-hotspot laptop" data-lab-spot="laptop" aria-label="ノートパソコンを調べる"><i></i></button>
            <button class="lab-hotspot tackle" data-lab-spot="tackle" aria-label="釣具箱を調べる"><i></i></button>
            <div id="lab-bubble" class="lab-bubble hidden"><b></b><p></p><button aria-label="吹き出しを閉じる">▼</button></div>
          </section>
          <section id="menu-scene" class="menu-scene hidden" aria-label="メニュー背景">
            <img id="menu-scene-image" alt="">
            <div class="menu-scene-shade"></div>
            <div id="menu-scene-caption" class="menu-scene-caption"></div>
            <div id="map-pins" class="map-pins"></div>
          </section>
        </section>
        <section id="dock" class="dock"></section>
        <nav class="tabbar" aria-label="メインメニュー">
          <button data-tab="home" class="active"><i class="icon-home"></i><span>ホーム</span></button>
          <button data-tab="fish"><i class="icon-hook"></i><span>釣る</span></button>
          <button data-tab="book"><i class="icon-book"></i><span>図鑑</span></button>
          <button data-tab="shop"><i class="icon-shop"></i><span>釣具屋</span></button>
          <button data-tab="map"><i class="icon-map"></i><span>移動</span></button>
        </nav>
        <div id="overlay"></div>
        <div id="toast" role="status"></div>
      </main>`;
    this.root.querySelectorAll<HTMLButtonElement>('.tabbar button').forEach((button) => button.addEventListener('click', () => {
      if (this.phase !== 'idle') return this.toast('いまは釣りに集中しよう');
      this.activateTab(button.dataset.tab ?? 'home');
      sfx('tap');
    }));
    const labNotes: Record<string, [string, string]> = {
      tank:['研究用水槽','ゼブラフィッシュは正式な研究対象。こちらを釣ると、かなり怒られる。'],
      window:['西向きの窓','川まで徒歩3分。研究室から最も再現性の高い脱出経路だ。'],
      board:['先輩のホワイトボード','魚の遊泳経路と研究の仮説が、同じ色のペンで描かれている。'],
      laptop:['解析用ノートPC','進捗63%。残り時間の推定値は、信頼区間の外にいる。'],
      tackle:['古い釣具箱','森野先輩の私物。「研究費では買っていない」と三回念を押された。'],
    };
    this.root.querySelectorAll<HTMLButtonElement>('[data-lab-spot]').forEach((button) => button.addEventListener('click', () => {
      const note = labNotes[button.dataset.labSpot ?? ''];
      if (note) this.showLabBubble(note[0], note[1]);
    }));
    this.root.querySelector<HTMLButtonElement>('#lab-bubble button')?.addEventListener('click', () => this.query('#lab-bubble').classList.add('hidden'));
  }

  private showTitle(): void {
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<section class="title-screen">
      <div class="title-call">
        <p class="eyebrow">RETRO FISHING RPG</p>
        <h1>研究中、<br><span>釣り中。</span></h1>
        <p class="title-copy">解析終了まで、あと<span>2時間。</span><br>川までは、徒歩3分。</p>
      </div>
      <button class="primary start-button">はじめから</button>
      <p class="title-foot">画面タップ / Space キー</p>
    </section>`;
    overlay.querySelector('.start-button')?.addEventListener('click', () => this.playOpening());
  }

  private playOpening(): void {
    sfx('tap');
    this.playStory('opening', () => {
      this.save.openingSeen = true;
      this.addFlag('opening-seen');
      persistSave(this.save);
      this.activateTab('home');
      this.toast('序章「実験が終わるまで」');
    });
  }

  private playStory(sceneId: keyof typeof STORY, onComplete?: () => void): void {
    setBgm('story');
    const scene = STORY[sceneId];
    const lines = scene.lines;
    let index = 0;
    const overlay = this.query('#overlay');
    const draw = () => {
      const line = lines[index];
      const portrait = this.storyPortrait(line.speaker);
      const lengthClass = line.text.length >= 48 ? 'long' : '';
      overlay.innerHTML = `<section class="story-card story-${scene.backdrop}"><div class="story-art"><div class="story-chapter">${scene.title}</div><img class="story-character" src="${portrait}" alt="${line.speaker}"><div class="story-gradient"></div></div><div class="dialogue ${line.tone ?? ''} ${lengthClass}"><span>${line.speaker}</span><p>${line.text}</p><div class="dialogue-actions"><button class="story-log">LOG</button><button class="story-next">次へ <kbd>Space</kbd></button></div><div class="dots">${lines.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div></div><div id="story-backlog" class="story-backlog hidden"></div></section>`;
      overlay.querySelector('.story-next')?.addEventListener('click', next);
      overlay.querySelector('.story-art')?.addEventListener('click', next);
      overlay.querySelector('.story-log')?.addEventListener('click', () => {
        const backlog = overlay.querySelector<HTMLElement>('#story-backlog');
        if (!backlog) return;
        backlog.classList.remove('hidden');
        backlog.innerHTML = `<div><small>DIALOGUE LOG</small><h3>${scene.title}</h3>${lines.slice(0,index+1).map((item) => `<p><b>${item.speaker}</b>${item.text}</p>`).join('')}<button>閉じる</button></div>`;
        backlog.querySelector('button')?.addEventListener('click', () => backlog.classList.add('hidden'));
      });
    };
    const next = () => {
      sfx('tap');
      index++;
      if (index < lines.length) return draw();
      overlay.innerHTML = '';
      setBgm(this.bgmForTab(this.currentTab));
      onComplete?.();
    };
    draw();
  }

  private storyPortrait(speaker: string): string {
    if (speaker.includes('森野')) return '/assets/characters/morino-pixel-v1.png';
    if (speaker.includes('鵜沢')) return '/assets/characters/uzawa-pixel-v1.png';
    return '/assets/characters/protagonist-pixel-v1.png';
  }

  private showLabBubble(title: string, text: string): void {
    sfx('tap');
    const bubble = this.query('#lab-bubble');
    bubble.querySelector('b')!.textContent = title;
    bubble.querySelector('p')!.textContent = text;
    bubble.classList.remove('hidden');
  }

  private activateTab(tab: string): void {
    this.currentTab = tab;
    const activeTab = tab === 'memo' || tab === 'story-log' ? 'home' : tab;
    this.root.querySelectorAll<HTMLButtonElement>('.tabbar button').forEach((item) => item.classList.toggle('active', item.dataset.tab === activeTab));
    this.renderDock(tab);
    if (tab === 'fish' && this.save.chapter === 1 && this.save.activeStage === 'mountain-stream' && !this.hasFlag('stream-arrival-seen')) {
      this.addFlag('stream-arrival-seen');
      persistSave(this.save);
      this.playStory('streamArrival', () => {
        this.renderFishing();
        this.toast('主目標：ヤマメを観測する');
      });
    }
  }

  private renderDock(tab: string): void {
    const home = tab === 'home' || tab === 'memo' || tab === 'story-log';
    const menu = tab === 'book' || tab === 'shop' || tab === 'map';
    this.query('#dock').classList.toggle('archive-mode', tab === 'story-log');
    this.query('#home-scene').classList.toggle('hidden', !home);
    this.query('#menu-scene').classList.toggle('hidden', !menu);
    this.query('#game-canvas').classList.toggle('hidden', home || menu);
    setBgm(this.bgmForTab(tab));
    if (tab === 'home') return this.renderHome();
    if (tab === 'memo') return this.renderObservationLog();
    if (tab === 'story-log') return this.renderStoryArchive();
    if (menu) this.renderMenuScene(tab as 'book' | 'shop' | 'map');
    if (tab === 'book') return this.renderBook();
    if (tab === 'shop') return this.renderShop();
    if (tab === 'map') return this.renderMap();
    this.renderFishing();
  }

  private bgmForTab(tab: string): BgmTheme {
    if (tab === 'fish') return this.save.activeStage;
    if (tab === 'book') return 'archive';
    if (tab === 'shop') return 'shop';
    if (tab === 'map') return 'map';
    if (tab === 'story-log') return 'archive';
    return 'home';
  }

  private renderMenuScene(tab: 'book' | 'shop' | 'map'): void {
    this.query('#menu-scene').className = `menu-scene scene-${tab}`;
    const config = tab === 'book'
      ? { src:'/assets/backgrounds/field-archive-pixel-v1.png', alt:'魚の観測資料が広がる机', eyebrow:'FIELD ARCHIVE', title:'魚類観測資料室' }
      : tab === 'shop'
        ? { src:'/assets/backgrounds/tackle-shop-pixel-v1.png', alt:'月波釣具店の店内', eyebrow:'TSUKINAMI TACKLE', title:'月波釣具店' }
        : { src:'/assets/backgrounds/route-map-pixel-v1.png', alt:'大学から渓流へ続くルートマップ', eyebrow:'FIELD ROUTE', title:'調査地域図' };
    const image = this.query<HTMLImageElement>('#menu-scene-image');
    image.src = config.src;
    image.alt = config.alt;
    this.query('#menu-scene-caption').innerHTML = `<small>${config.eyebrow}</small><strong>${config.title}</strong>`;
    const pins = this.query('#map-pins');
    if (tab !== 'map') { pins.innerHTML = ''; return; }
    pins.innerHTML = `<button data-map-stage="mountain-stream" class="map-pin stream ${this.save.unlockedStages.includes('mountain-stream') ? '' : 'locked'}"><i></i><span>青葉渓流<small>${this.save.unlockedStages.includes('mountain-stream') ? '山道・バス2本' : '未調査'}</small></span></button><button data-map-stage="campus-river" class="map-pin river"><i></i><span>大学裏の川<small>研究室から徒歩3分</small></span></button>`;
    pins.querySelectorAll<HTMLButtonElement>('[data-map-stage]').forEach((button) => button.addEventListener('click', () => this.travelTo(button.dataset.mapStage as StageId)));
  }

  private renderHome(): void {
    this.query('#lab-bubble').classList.add('hidden');
    const quest = this.currentQuest();
    const completeReady = this.save.chapter === 1 && streamSurveyReady(this.save);
    const chapterLabel = this.save.chapter === 0 ? '序章' : this.save.chapter === 1 ? '第一章' : '第一章 完了';
    this.query('#dock').innerHTML = `<div class="home-dock">
      <div class="home-header"><div><small>${chapterLabel}</small><h2>${this.save.chapter === 0 ? '実験が終わるまで' : '川の上流にて'}</h2></div><span class="clock">18:42</span></div>
      <article class="quest-card ${completeReady ? 'ready' : ''}"><small>CURRENT OBJECTIVE</small><h3>${quest.title}</h3><p>${quest.description}</p><div class="quest-progress"><i style="width:${quest.progress}%"></i></div><em>${quest.counter}</em></article>
      <div class="home-actions">
        <button id="home-primary" class="pixel-button">${completeReady ? '研究ノートをまとめる' : this.save.chapter === 0 ? '大学裏の川へ行く' : '釣行を続ける'}<small>${completeReady ? '第一章の物語を進める' : '装備を確認して出発'}</small></button>
        <div class="home-side-actions"><button id="home-note" class="note-button">観測メモ<span>${Object.keys(this.save.records).length}種 / ${this.save.totalCaught}匹</span></button><button id="home-story-log" class="note-button story-log-button">回想ログ<span>${Object.values(STORY).filter((scene) => this.hasFlag(scene.archive.unlockFlag)).length}件の記録</span></button></div>
      </div>
      <p class="lab-message">${this.save.chapter >= 2 ? '解析完了。第一章の観測記録は保存済みです。' : '計算ジョブ：実行中　残り予測 01:18:37'}</p>
    </div>`;
    this.query('#home-primary').addEventListener('click', () => {
      sfx('tap');
      if (completeReady) return this.finishChapterOne();
      this.activateTab(this.save.chapter === 0 ? 'fish' : 'map');
    });
    this.query('#home-note').addEventListener('click', () => { sfx('tap'); this.activateTab('memo'); });
    this.query('#home-story-log').addEventListener('click', () => { sfx('tap'); this.activateTab('story-log'); });
  }

  private renderObservationLog(): void {
    this.query('#lab-bubble').classList.add('hidden');
    const logs = FISH_LIST
      .map((fish) => ({ fish, record:this.save.records[fish.id] }))
      .filter((item) => item.record)
      .sort((a,b) => new Date(b.record!.firstCaughtAt).getTime() - new Date(a.record!.firstCaughtAt).getTime());
    const giantKinds = logs.filter((item) => item.record!.ranks.includes('巨大')).length;
    const milestones = [
      this.hasFlag('opening-seen') ? ['序章','大学裏の川で、三日月形の傷を持つ銀色魚を目撃。'] : null,
      this.hasFlag('chapter1-unlocked') ? ['第一章','大学裏で3匹・2魚種を観測し、青葉渓流の情報を得た。'] : null,
      this.hasFlag('yamame-story-seen') ? ['観測記録','青葉渓流でヤマメを初観測。流れを利用する逃走を記録。'] : null,
      this.hasFlag('chapter1-complete') ? ['第一章完了','古い観測帳から、十五年前の銀色魚の記録を発見。'] : null,
    ].filter((item): item is string[] => Boolean(item));
    this.query('#dock').innerHTML = `<div class="memo-head"><button id="memo-back" class="tiny-button">← ホーム</button><div><small>FIELD JOURNAL</small><h2>観測メモ</h2></div></div><div class="memo-stats"><div><b>${this.save.totalCaught}</b><span>総捕獲</span></div><div><b>${logs.length}</b><span>観測魚種</span></div><div><b>${giantKinds}</b><span>巨大魚種</span></div></div><section class="memo-section"><h3>調査のあゆみ</h3>${milestones.length ? milestones.map((item,index) => `<article class="milestone"><i>${String(index+1).padStart(2,'0')}</i><div><b>${item[0]}</b><p>${item[1]}</p></div></article>`).join('') : '<p class="empty-log">まだ記録はない。川へ出て最初の一匹を観測しよう。</p>'}</section><section class="memo-section catch-log"><h3>初観測ログ</h3>${logs.map(({fish,record}) => `<article><time>${new Date(record!.firstCaughtAt).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'})}</time><img src="${fish.sprite}" alt=""><div><b>${fish.name}</b><small>${STAGES[record!.firstStage].name}｜最大 ${record!.maxSize.toFixed(1)}cm｜${record!.count}匹</small></div></article>`).join('') || '<p class="empty-log">未記録</p>'}</section>`;
    this.query('#memo-back').addEventListener('click', () => this.activateTab('home'));
  }

  private renderStoryArchive(): void {
    this.query('#lab-bubble').classList.add('hidden');
    const unlocked = Object.values(STORY).filter((scene) => this.hasFlag(scene.archive.unlockFlag));
    if (!unlocked.length) {
      this.query('#dock').innerHTML = `<div class="memo-head"><button id="story-archive-back" class="tiny-button">← ホーム</button><div><small>STORY ARCHIVE</small><h2>回想ログ</h2></div></div><p class="empty-log">まだ回想できる記録はありません。</p>`;
      this.query('#story-archive-back').addEventListener('click', () => this.activateTab('home'));
      return;
    }
    if (!unlocked.some((scene) => scene.id === this.selectedStoryArchive)) this.selectedStoryArchive = unlocked[unlocked.length - 1].id;
    const selected = unlocked.find((scene) => scene.id === this.selectedStoryArchive) ?? unlocked[0];
    this.query('#dock').innerHTML = `<section class="story-archive"><header class="archive-head"><button id="story-archive-back" class="tiny-button">← ホーム</button><div><small>STORY ARCHIVE</small><h2>回想ログ</h2></div><b>${unlocked.length}<span>SCENES</span></b></header><nav class="archive-scenes" aria-label="回想する場面">${unlocked.map((scene, index) => `<button data-archive-scene="${scene.id}" class="${scene.id === selected.id ? 'active' : ''}"><i>${String(index + 1).padStart(2,'0')}</i><span><small>${scene.archive.label}</small><b>${scene.title.split('｜').at(-1)}</b></span></button>`).join('')}</nav><article class="archive-thread"><div class="archive-thread-head"><div><small>${selected.archive.label}</small><h3>${selected.title}</h3><p>${selected.archive.summary}</p></div><button id="archive-replay">場面を再生 ▶</button></div><div class="archive-messages">${selected.lines.map((line, index) => { const player = line.speaker === '主人公'; return `<div class="archive-message ${player ? 'player' : ''} ${line.tone ?? ''}"><img src="${this.storyPortrait(line.speaker)}" alt="${line.speaker}"><div><b>${line.speaker}</b><p>${line.text}</p><small>LOG ${String(index + 1).padStart(2,'0')}</small></div></div>`; }).join('')}</div></article></section>`;
    this.query('#story-archive-back').addEventListener('click', () => this.activateTab('home'));
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-archive-scene]').forEach((button) => button.addEventListener('click', () => {
      this.selectedStoryArchive = button.dataset.archiveScene ?? unlocked[0].id;
      sfx('tap');
      this.renderStoryArchive();
    }));
    this.query('#archive-replay').addEventListener('click', () => {
      sfx('tap');
      this.playStory(selected.id, () => this.activateTab('story-log'));
    });
  }

  private currentQuest(): { title: string; description: string; progress: number; counter: string } {
    if (this.save.chapter >= 2) return { title:'第一章の観測完了', description:'三日月形の傷を持つ銀色魚の古い記録を発見した。次章は今後のアップデートで追加予定。', progress:100, counter:'COMPLETE' };
    if (this.save.chapter === 0) {
      const species = Object.keys(this.save.records).length;
      return { title:'大学裏の生態を調べる', description:'合計3匹、2魚種を観測して先輩へ報告しよう。', progress:Math.min(100, Math.min(this.save.totalCaught/3, species/2)*100), counter:`${this.save.totalCaught}/3匹・${species}/2種` };
    }
    if (!this.hasFlag('stream-arrival-seen')) return { title:'青葉渓流へ向かう', description:'移動画面から青葉渓流を選び、鵜沢さんに会おう。', progress:15, counter:'目的地：青葉渓流' };
    if (!this.save.records.yamame) return { title:'渓流の宝石を観測', description:'川虫を使い、白泡の横を狙ってヤマメを釣ろう。', progress:35, counter:'ヤマメ 0/1' };
    const streamSpecies = FISH_LIST.filter((fish) => fish.habitat.includes('mountain-stream') && this.save.records[fish.id]).length;
    const streamCount = this.save.stageCatchCounts['mountain-stream'] ?? 0;
    if (!streamSurveyReady(this.save)) return { title:'渓流の違う顔を見る', description:'青葉渓流で合計3匹・2魚種を観測する。', progress:55 + Math.min(35, Math.min(streamCount/3, streamSpecies/2)*35), counter:`${streamCount}/3匹・${streamSpecies}/2種` };
    return { title:'研究室へ戻って報告', description:'観測記録を森野先輩と整理しよう。', progress:95, counter:'帰還可能' };
  }

  private hasFlag(flag: string): boolean { return this.save.storyFlags.includes(flag); }
  private addFlag(flag: string): void { if (!this.hasFlag(flag)) this.save.storyFlags.push(flag); }

  private renderFishing(): void {
    const stage = STAGES[this.save.activeStage];
    const baits: BaitId[] = ['練り餌','ミミズ','川虫','ルアー'];
    const equipped = Object.fromEntries((['rod','float','hook'] as GearCategory[]).map((category) => [category, GEAR.find((gear) => gear.id === this.save.equipped[category])!])) as Record<GearCategory, typeof GEAR[number]>;
    const rodEffect = Math.round((1 - (1 - equipped.rod.control * 1.05)) * 100);
    const floatBonus = Math.round(equipped.float.control * 900);
    const hookBonus = Math.round(equipped.hook.control * 900);
    this.query('#dock').innerHTML = `
      <div class="location-row"><div><small>現在地</small><strong>${stage.name}</strong></div><p>${stage.description}</p></div>
      <div class="bait-row"><span>エサ</span>${baits.map((bait) => `<button data-bait="${bait}" class="chip ${bait === this.save.bait ? 'selected' : ''}">${bait}</button>`).join('')}</div>
      <div class="tackle-strip"><span><i>竿</i>${equipped.rod.name}<small>${rodEffect ? `張力 -${rodEffect}%` : '標準'}</small></span><span><i>浮</i>${equipped.float.name}<small>${floatBonus ? `合わせ +${floatBonus}ms` : '標準'}</small></span><span><i>針</i>${equipped.hook.name}<small>${hookBonus ? `+${hookBonus}ms・疲労UP` : '標準'}</small></span></div>
      <div class="cast-panel" id="cast-panel">
        <div class="phase-copy"><small id="phase-label">CAST</small><strong id="phase-title">狙う距離を決めよう</strong><p id="phase-help">ボタンでメーターを動かし、もう一度押してキャスト</p></div>
        <div class="cast-meter" id="cast-meter"><i style="left:${this.castPower*100}%"></i></div>
        <div id="fight-hud" class="fight-hud hidden"><label>糸のテンション <b id="tension-text">安定</b></label><div class="gauge tension"><i id="tension-bar"></i><em></em></div><label>魚との距離 <b id="distance-text">70m</b></label><div class="gauge distance"><i id="distance-bar"></i></div><div id="fish-tell" class="fish-tell">魚の動きを見よう</div></div>
        <div id="landing-hud" class="landing-hud hidden" role="button" tabindex="0" aria-label="タイミングを合わせて魚を引き上げる"><div class="landing-copy"><small>CLICK / TAP <i id="landing-size-label"></i></small><b>魚体が中央に来た瞬間を狙え</b><p>白い印が金色に重なったら、ゲージをクリックして引き上げる</p></div><div class="landing-gauge"><span id="landing-zone"></span><i id="landing-marker"></i><em>水面</em><em>足元</em></div></div>
        <button id="action" class="primary action-button">キャストを始める <kbd>Space</kbd></button>
      </div>`;
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-bait]').forEach((button) => button.addEventListener('click', () => {
      if (this.phase !== 'idle') return;
      this.save.bait = (button.dataset.bait as BaitId) ?? '練り餌';
      persistSave(this.save);
      this.renderFishing();
    }));
    const action = this.query<HTMLButtonElement>('#action');
    action.addEventListener('click', () => this.action());
    action.addEventListener('pointerdown', () => { if (this.phase === 'fight') this.isReeling = true; });
    ['pointerup','pointercancel','pointerleave'].forEach((event) => action.addEventListener(event, () => { if (this.phase === 'fight') this.isReeling = false; }));
    this.query('#cast-panel').addEventListener('pointerdown', () => { if (this.phase === 'landing') this.attemptLanding(); });
  }

  private action(): void {
    if (this.phase === 'idle') return this.beginCast();
    if (this.phase === 'casting') return this.landCast();
    if (this.phase === 'bite') return this.hookFish();
    if (this.phase === 'landing') return this.attemptLanding();
    if (this.phase === 'waiting' || this.phase === 'nibble') return this.failFishing('早すぎた！　これは前アタリだ');
  }

  private beginCast(): void {
    this.phase = 'casting';
    this.castPower = Math.max(.08, Math.min(.98, this.castPower));
    this.castDirection = this.castPower >= .96 ? -1 : 1;
    this.setCopy('CAST','距離を決める','近場は小魚、遠投は大型魚が少し増える。好きな距離で投げよう');
    this.setAction('ここで投げる！');
    const tick = () => {
      if (this.phase !== 'casting') return;
      this.castPower += .012 * this.castDirection;
      if (this.castPower >= .98) {
        this.castPower = .98;
        this.castDirection = -1;
      } else if (this.castPower <= .08) {
        this.castPower = .08;
        this.castDirection = 1;
      }
      const marker = this.root.querySelector<HTMLElement>('#cast-meter i');
      if (marker) marker.style.left = `${this.castPower * 100}%`;
      this.castFrame = requestAnimationFrame(tick);
    };
    this.castFrame = requestAnimationFrame(tick);
  }

  private landCast(): void {
    cancelAnimationFrame(this.castFrame);
    this.phase = 'waiting';
    this.pendingFish = chooseFish(this.save.activeStage, this.save.bait, this.castPower);
    this.pendingCatch = makeCatch(this.pendingFish, Math.random, this.castPower);
    this.pendingPower = specimenPower(this.pendingFish, this.pendingCatch.size);
    this.scene?.setMood('waiting', this.castPower);
    sfx('cast');
    this.setCopy('WAIT','浮きをよく見よう','小さな揺れは前アタリ。深く沈んだ瞬間に合わせる');
    this.setAction('アタリを待つ…');
    this.query<HTMLButtonElement>('#action').classList.add('waiting');
    const lead = 900 + Math.random() * 900;
    this.timers.push(window.setTimeout(() => this.showNibble(), lead));
    this.timers.push(window.setTimeout(() => this.showBite(), lead + 950 + Math.random() * 750));
  }

  private showNibble(): void {
    if (this.phase !== 'waiting') return;
    this.phase = 'nibble';
    this.scene?.setMood('nibble', this.castPower);
    this.setCopy('…','コツ、コツ…','まだ浅い。浮きが消えるまで待とう');
    this.timers.push(window.setTimeout(() => { if (this.phase === 'nibble') { this.phase = 'waiting'; this.scene?.setMood('waiting', this.castPower); } }, 650));
  }

  private showBite(): void {
    if (this.phase !== 'waiting' && this.phase !== 'nibble') return;
    this.phase = 'bite';
    this.scene?.setMood('bite', this.castPower);
    sfx('bite');
    this.setCopy('HIT!','浮きが沈んだ！','今だ、合わせろ！');
    this.setAction('合わせる！');
    const float = GEAR.find((g) => g.id === this.save.equipped.float)?.control ?? 0;
    const hook = GEAR.find((g) => g.id === this.save.equipped.hook)?.control ?? 0;
    this.timers.push(window.setTimeout(() => { if (this.phase === 'bite') this.failFishing('遅かった！　エサだけ取られた'); }, biteWindowMs(this.pendingFish!, float, hook)));
  }

  private hookFish(): void {
    if (!this.pendingFish) return this.resetFishing();
    this.clearTimers();
    this.phase = 'fight';
    this.scene?.setMood('fight', this.castPower);
    this.fightState = createFightState(this.pendingFish, this.castPower, this.pendingPower);
    this.lastFrame = performance.now();
    this.query('#cast-meter').classList.add('hidden');
    this.query('#fight-hud').classList.remove('hidden');
    const sizeTell = this.pendingCatch?.rank === '巨大' ? '桁違いに重い。暴れたら必ず糸を送れ' : this.pendingCatch?.rank === '大' ? '重い手応えだ。走りを見て慎重に寄せよう' : this.pendingCatch?.rank === '小' ? '軽い個体だ。リズムよく寄せよう' : '押して巻く／離して糸を緩める';
    this.setCopy('FIGHT',`${this.pendingFish.name}が掛かった！`,sizeTell);
    this.setAction('長押しで巻く');
    this.query<HTMLButtonElement>('#action').classList.remove('waiting');
    this.fightFrame = requestAnimationFrame((time) => this.updateFight(time));
  }

  private updateFight(time: number): void {
    if (this.phase !== 'fight' || !this.pendingFish) return;
    const dt = Math.min((time - this.lastFrame) / 1000, .05);
    this.lastFrame = time;
    const rodControl = GEAR.find((g) => g.id === this.save.equipped.rod)?.control ?? 0;
    const hookControl = GEAR.find((g) => g.id === this.save.equipped.hook)?.control ?? 0;
    const result = stepFight(this.fightState ?? createFightState(this.pendingFish, this.castPower, this.pendingPower), dt, this.pendingFish, { reeling:this.isReeling, rodControl, hookControl }, this.pendingPower);
    this.fightState = result.state;
    const { tension, distance } = result.state;
    const { warning, burst } = result.beat;
    const tell = this.query('#fish-tell');
    tell.textContent = burst ? '⚠ 走った！ いまは糸を送れ' : warning ? '！ 体をひねっている…' : tension > 76 ? '糸が張りつめている！' : this.isReeling ? 'ぐいぐい寄せている' : '魚の動きを受け流す';
    tell.className = `fish-tell ${burst || tension > 76 ? 'danger' : warning ? 'warn' : ''}`;
    const tensionBar = this.query('#tension-bar');
    const distanceBar = this.query('#distance-bar');
    tensionBar.style.width = `${tension}%`;
    distanceBar.style.width = `${100 - Math.min(100, distance)}%`;
    this.query('#tension-text').textContent = tension > 92 ? '限界！' : tension > 76 ? '危険' : tension > 58 ? '強い' : '安定';
    this.query('#distance-text').textContent = `${Math.ceil(distance)}m`;
    if (result.result === 'line-broken') return this.failFishing('糸が切れた…！　赤くなったらボタンを離そう');
    if (result.result === 'escaped') return this.failFishing('魚に走り切られた…！');
    if (result.result === 'caught') return this.beginLanding();
    this.fightFrame = requestAnimationFrame((next) => this.updateFight(next));
  }

  private beginLanding(): void {
    if (!this.pendingFish) return;
    this.phase = 'landing';
    this.isReeling = false;
    this.scene?.setMood('splash', this.castPower);
    this.query('#fight-hud').classList.add('hidden');
    this.query('#landing-hud').classList.remove('hidden');
    const hookControl = GEAR.find((gear) => gear.id === this.save.equipped.hook)?.control ?? 0;
    const tolerance = landingTolerance(this.pendingFish, hookControl, this.pendingPower);
    const zone = this.query<HTMLElement>('#landing-zone');
    zone.style.top = `${(0.5 - tolerance) * 100}%`;
    zone.style.height = `${tolerance * 200}%`;
    const rank = this.pendingCatch?.rank ?? '中';
    const widthLabel = rank === '巨大' ? '極狭' : rank === '大' ? '狭い' : rank === '小' ? '広い' : '標準';
    this.query('#landing-size-label').textContent = `${rank}サイズ｜${widthLabel}`;
    this.landingPosition = .12;
    this.landingDirection = 1;
    this.landingLastFrame = performance.now();
    this.setCopy('LANDING','最後の取り込み！','ゲージをクリック／タップして印を止めよう');
    this.setAction('クリックで引き上げる！');
    const tick = (time: number) => {
      if (this.phase !== 'landing' || !this.pendingFish) return;
      const dt = Math.min((time - this.landingLastFrame) / 1000, .05);
      this.landingLastFrame = time;
      this.landingPosition += dt * (.72 + this.pendingFish.difficulty * .18 + (this.pendingPower - 1) * .32) * this.landingDirection;
      if (this.landingPosition >= .92) { this.landingPosition = .92; this.landingDirection = -1; }
      if (this.landingPosition <= .08) { this.landingPosition = .08; this.landingDirection = 1; }
      this.query<HTMLElement>('#landing-marker').style.top = `${this.landingPosition * 100}%`;
      this.landingFrame = requestAnimationFrame(tick);
    };
    this.landingFrame = requestAnimationFrame(tick);
  }

  private attemptLanding(): void {
    if (this.phase !== 'landing') return;
    if (!this.pendingFish || !this.fightState) return this.resetFishing();
    this.phase = 'landing-result';
    cancelAnimationFrame(this.landingFrame);
    const hookControl = GEAR.find((gear) => gear.id === this.save.equipped.hook)?.control ?? 0;
    const success = canLandFish(this.pendingFish, this.landingPosition, hookControl, this.pendingPower);
    this.query('#landing-hud').classList.add('locked');
    this.query<HTMLButtonElement>('#action').disabled = true;
    this.setCopy(success ? 'LOCK!' : 'MISS…', success ? '魚体を捉えた！' : 'タイミングが浅い…', success ? 'そのまま岸へ引き上げる' : '魚が身をひねっている');
    this.timers.push(window.setTimeout(() => {
      if (success) return this.catchFish();
      this.failFishing('取り込みに失敗した！　魚は足元から逃げていった…');
    }, 360));
  }

  private catchFish(): void {
    if (!this.pendingFish) return;
    cancelAnimationFrame(this.fightFrame);
    cancelAnimationFrame(this.landingFrame);
    this.scene?.setMood('splash', this.castPower);
    const fish = this.pendingFish;
    const item = this.pendingCatch ?? makeCatch(fish, Math.random, this.castPower);
    const previousChapter = this.save.chapter;
    const firstYamameEvent = fish.id === 'yamame' && this.save.activeStage === 'mountain-stream' && !this.hasFlag('yamame-story-seen');
    const result = recordCatch(this.save, item, this.save.activeStage);
    persistSave(this.save);
    this.updateMoney();
    sfx('catch');
    const tags = [result.isNew ? 'NEW!' : '', result.isRecord ? '自己新記録' : '', item.rank === '巨大' ? 'GIANT' : ''].filter(Boolean);
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<div class="catch-dimmer"><section class="catch-card ${item.rank === '巨大' ? 'giant' : ''}"><div class="catch-rays"></div><p class="catch-label">${tags.map((tag) => `<span>${tag}</span>`).join('')}</p><div class="catch-fish-stage"><img src="${fish.sprite}" alt="${fish.name}"></div><small>${'★'.repeat(fish.rarity)}${'☆'.repeat(4-fish.rarity)}</small><h2>${fish.name}</h2><div class="catch-size"><strong>${item.size.toFixed(1)}</strong> cm <i>${item.rank}サイズ</i></div><p>${item.weight.toFixed(1)} g　／　売値 ${item.value} G</p><button class="primary">記録して持ち帰る</button></section></div>`;
    overlay.querySelector('button')?.addEventListener('click', () => {
      overlay.innerHTML = '';
      const chapterStarted = previousChapter === 0 && this.save.chapter === 1;
      this.resetFishing();
      this.renderFishing();
      if (chapterStarted) {
        this.playStory('chapter1Unlock', () => {
          this.addFlag('chapter1-intro-seen');
          persistSave(this.save);
          this.activateTab('home');
          this.toast('青葉渓流が解放されました');
        });
      } else if (firstYamameEvent) {
        this.addFlag('yamame-story-seen');
        persistSave(this.save);
        this.playStory('yamameCaught', () => {
          this.renderFishing();
          this.toast(streamSurveyReady(this.save) ? '調査完了。研究室へ戻ろう' : '新しい観測目標が追加されました');
        });
      } else if (this.save.chapter === 1 && streamSurveyReady(this.save)) {
        this.toast('調査条件達成！ ホームへ戻ろう');
      }
    });
  }

  private finishChapterOne(): void {
    this.playStory('chapter1Finale', () => {
      this.save.chapter = 2;
      this.addFlag('chapter1-complete');
      let reward = '波読みの浮きを入手';
      if (!this.save.ownedGear.includes('float-2')) {
        this.save.ownedGear.push('float-2');
        this.save.equipped.float = 'float-2';
      } else {
        this.save.money += 450;
        reward = '調査謝礼 450 Gを入手';
      }
      persistSave(this.save);
      this.updateMoney();
      this.activateTab('home');
      this.toast(`第一章クリア｜${reward}`);
    });
  }

  private failFishing(message: string): void {
    cancelAnimationFrame(this.fightFrame);
    cancelAnimationFrame(this.landingFrame);
    this.clearTimers();
    sfx('fail');
    this.scene?.setMood('idle');
    this.phase = 'idle';
    this.pendingFish = undefined;
    this.pendingCatch = undefined;
    this.pendingPower = 1;
    this.fightState = undefined;
    this.toast(message);
    this.renderFishing();
  }

  private resetFishing(): void {
    cancelAnimationFrame(this.fightFrame);
    cancelAnimationFrame(this.landingFrame);
    this.clearTimers();
    this.scene?.setMood('idle');
    this.phase = 'idle';
    this.pendingFish = undefined;
    this.pendingCatch = undefined;
    this.pendingPower = 1;
    this.fightState = undefined;
    this.isReeling = false;
  }

  private clearTimers(): void { this.timers.forEach(clearTimeout); this.timers = []; }
  private setCopy(label: string, title: string, help: string): void { this.query('#phase-label').textContent = label; this.query('#phase-title').textContent = title; this.query('#phase-help').textContent = help; }
  private setAction(label: string): void { this.query('#action').childNodes[0].textContent = `${label} `; }

  private renderBook(): void {
    const found = Object.keys(this.save.records).length;
    const fish = FISH[this.selectedBook];
    const record = this.save.records[fish.id];
    const rankLabels = ['小','中','大','巨大'];
    const distanceNames = { near:'岸際・浅場', middle:'流れの中央', far:'沖・深場', any:'全域' } as const;
    const difficulty = Math.max(1, Math.min(5, Math.round(fish.difficulty * 2.3)));
    this.query('#dock').innerHTML = `<div class="section-heading"><div><small>FIELD NOTE</small><h2>魚類観測図鑑</h2></div><div class="completion"><b>${Math.round(found/FISH_LIST.length*100)}%</b><span>${found} / ${FISH_LIST.length} 種</span></div></div>
      <div class="book-layout"><div class="fish-list">${FISH_LIST.map((item, index) => { const known = this.save.records[item.id]; return `<button data-fish="${item.id}" class="${item.id===fish.id?'selected':''} ${known?'':'unknown'}"><span>${known ? String(index+1).padStart(2,'0') : '??'}</span><b>${known ? item.name : '未観測'}</b><small>${known ? `${known.maxSize.toFixed(1)}cm` : '——'}</small></button>`; }).join('')}</div>
      <article class="fish-entry ${record?'':'silhouette'}"><div class="entry-visual"><img src="${fish.sprite}" alt=""><span>${'★'.repeat(fish.rarity)}${'☆'.repeat(4-fish.rarity)}</span></div><small>NO.${String(FISH_LIST.indexOf(fish)+1).padStart(2,'0')}</small><h3>${record ? fish.name : '？？？？'}</h3><p>${record ? fish.description : 'まだ観測されていない。釣り場やエサを変えてみよう。'}</p>${record ? `<dl><div><dt>生息域</dt><dd>${fish.habitat.map((id) => STAGES[id].name).join('・')}</dd></div><div><dt>サイズ域</dt><dd>${fish.minSize}–${fish.maxSize} cm</dd></div><div><dt>好物</dt><dd>${fish.preferredBaits.join('・')}</dd></div><div><dt>狙い目</dt><dd>${distanceNames[fish.distancePreference]}</dd></div><div><dt>手強さ</dt><dd class="difficulty">${'◆'.repeat(difficulty)}${'◇'.repeat(5-difficulty)}</dd></div><div><dt>最大記録</dt><dd>${record.maxSize.toFixed(1)} cm</dd></div><div><dt>捕獲数</dt><dd>${record.count} 匹</dd></div><div><dt>初観測</dt><dd>${STAGES[record.firstStage].name}</dd></div></dl><div class="rank-stamps">${rankLabels.map((rank) => `<i class="${record.ranks.includes(rank as never)?'on':''}">${rank}</i>`).join('')}</div>` : ''}</article></div>`;
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-fish]').forEach((button) => button.addEventListener('click', () => { this.selectedBook = button.dataset.fish as typeof this.selectedBook; this.renderBook(); }));
  }

  private renderShop(): void {
    const basketValue = this.save.basket.reduce((sum, item) => sum + item.value, 0);
    this.query('#dock').innerHTML = `<div class="shop-head"><div class="shopkeeper"><span>釣</span></div><div><small>月波釣具店　店主・鵜沢</small><p>「道具は腕を助ける。でも、魚を見るのは君だよ」</p></div><strong id="money" class="shop-wallet">${this.save.money.toLocaleString()} G</strong></div>
      <button id="sell" class="sell-button" ${this.save.basket.length ? '' : 'disabled'}><span>釣果をまとめて売る <small>${this.save.basket.length}匹</small></span><strong>+ ${basketValue} G</strong></button>
      <div class="gear-grid">${(['rod','float','hook'] as GearCategory[]).map((category) => `<section><h3>${CATEGORY_NAMES[category]}</h3>${GEAR.filter((gear) => gear.category === category).map((gear) => { const owned = this.save.ownedGear.includes(gear.id); const equipped = this.save.equipped[category] === gear.id; const locked = this.save.chapter < gear.unlockChapter; const unlockLabel = gear.unlockChapter === 1 ? '第一章' : '後半章'; return `<button data-gear="${gear.id}" class="gear ${equipped?'equipped':''}" ${locked?'disabled':''}><i>Lv.${gear.level}</i><span><b>${gear.name}</b><small>${gear.description}</small></span><em>${locked?unlockLabel:equipped?'装備中':owned?'装備する':`${gear.price} G`}</em></button>`; }).join('')}</section>`).join('')}</div>`;
    this.root.querySelector('#sell')?.addEventListener('click', () => { const earned = sellBasket(this.save); persistSave(this.save); this.updateMoney(); sfx('buy'); this.toast(`${earned} G で買い取ってもらった`); this.renderShop(); });
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-gear]').forEach((button) => button.addEventListener('click', () => {
      const result = buyOrEquip(this.save, button.dataset.gear ?? '');
      if (result === 'poor') return this.toast('所持金が足りない');
      if (result === 'locked') return this.toast('物語を進めると入荷します');
      persistSave(this.save); this.updateMoney(); sfx('buy'); this.toast(result === 'bought' ? '購入して装備した！' : '装備を変更した'); this.renderShop();
    }));
  }

  private renderMap(): void {
    this.query('#dock').innerHTML = `<div class="section-heading"><div><small>FIELD ROUTE</small><h2>調査ルートを選ぶ</h2></div><button id="settings" class="tiny-button">設定</button></div><p class="map-guide">地図のピン、または下の目的地を選択すると移動します。</p><div class="map-route"><div class="route-line"></div>${Object.values(STAGES).map((stage, index) => { const open = this.save.unlockedStages.includes(stage.id); const active = stage.id === this.save.activeStage; const route = stage.id === 'campus-river' ? '研究室 → 徒歩3分' : '大学前 → バス → 山道'; return `<button data-stage="${stage.id}" class="stage-card ${active?'active':''} ${open?'':'locked'}" ${open?'':'disabled'}><i>${index+1}</i><span><small>${route}</small><b>${open?stage.name:'未調査の上流'}</b><em>${active?'現在地':open?'このルートで移動':'調査条件が必要'}</em></span></button>`; }).join('')}</div>`;
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((button) => button.addEventListener('click', () => {
      this.travelTo(button.dataset.stage as StageId);
    }));
    this.root.querySelector('#settings')?.addEventListener('click', () => this.showSettings());
  }

  private travelTo(id: StageId): void {
    if (!this.save.unlockedStages.includes(id)) return this.toast('物語を進めると、このルートを調査できます');
    this.save.activeStage = id;
    this.scene?.setStage(id);
    sfx('tap');
    if (id === 'mountain-stream' && !this.hasFlag('stream-arrival-seen')) {
      this.addFlag('stream-arrival-seen');
      persistSave(this.save);
      this.playStory('streamArrival', () => {
        this.activateTab('fish');
        this.toast('主目標：ヤマメを観測する');
      });
    } else {
      persistSave(this.save);
      this.activateTab('fish');
      this.toast(`${STAGES[id].name}へ移動した`);
    }
  }

  private showSettings(): void {
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<section class="settings-card"><h2>設定・セーブ</h2><p>進行は操作のたびにブラウザへ自動保存されます。</p><dl><div><dt>章</dt><dd>${this.save.chapter === 0 ? '序章' : this.save.chapter === 1 ? '第一章' : '第一章クリア'}</dd></div><div><dt>総捕獲</dt><dd>${this.save.totalCaught}匹</dd></div><div><dt>図鑑</dt><dd>${Object.keys(this.save.records).length}/${FISH_LIST.length}種</dd></div></dl><button id="close-settings" class="primary">ゲームへ戻る</button><button id="erase" class="danger-button">セーブデータを消去</button></section>`;
    overlay.querySelector('#close-settings')?.addEventListener('click', () => overlay.innerHTML = '');
    overlay.querySelector('#erase')?.addEventListener('click', () => { if (window.confirm('すべての記録を消去しますか？')) { eraseSave(); location.reload(); } });
  }

  private bindGlobalControls(): void {
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (this.phase === 'fight') this.isReeling = true;
      else if (!this.query('#overlay').innerHTML && this.currentTab === 'fish') this.action();
      else if (!this.query('#overlay').innerHTML && this.currentTab === 'home') this.root.querySelector<HTMLButtonElement>('#home-primary')?.click();
      else (this.root.querySelector('.story-next, #overlay button') as HTMLButtonElement | null)?.click();
    });
    window.addEventListener('keyup', (event) => { if (event.code === 'Space') this.isReeling = false; });
  }

  private updateMoney(): void { const money = this.root.querySelector('#money'); if (money) money.textContent = `${this.save.money.toLocaleString()} G`; }
  private toast(message: string): void {
    const toast = this.query('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2400);
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found');
new FishingApp(root);
