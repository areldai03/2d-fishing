import './style.css';
import './pattern.css';
import { createGame } from './game/createGame';
import { RiverScene } from './game/RiverScene';
import { AquariumView } from './game/AquariumView';
import { loadSave, persistSave, eraseSave } from './core/save';
import { AQUARIUM_CAPACITY, aquariumKindForFish, aquariumResidents, moveCatchToAquarium, returnResidentToBasket } from './core/aquarium';
import { chooseFish, completeTackleShopVisit, makeCatch, portSurveyReady, recommendedTackleLevel, recordCatch, releaseCatch, sellBasket, streamSurveyReady } from './core/fishing';
import { biteWindowMs, canLandFish, createFightState, landingTolerance, specimenPower, stepFight, type FightState } from './core/fight';
import { isLurePullOnCurrent, lureWindow, stepLureMarker, type PortTide } from './core/lure';
import { baitAvailable, buyBait, buyOrEquip, consumeBait } from './core/shop';
import { addStoryFlag, getCurrentQuest, getHomeStoryState, getObservationMilestones, hasStoryFlag } from './core/storyProgress';
import { FISH, FISH_LIST } from './data/fish';
import { BAITS } from './data/baits';
import { GEAR, CATEGORY_NAMES } from './data/equipment';
import { STAGES } from './data/stages';
import type { FishingSpotId } from './data/fishingSpots';
import { STORY } from './data/story';
import { StoryPlayer } from './story/StoryPlayer';
import { storyPortrait, storySpeakerName } from './story/characters';
import { setBgm, sfx, type BgmTheme } from './audio';
import type { AquariumKind, AquariumResident, BaitId, CatchItem, FishData, GearCategory, GearData, SaveData, StageId } from './types';

type FishingPhase = 'idle' | 'casting' | 'luring' | 'waiting' | 'nibble' | 'bite' | 'fight' | 'landing' | 'landing-result';

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
  private fishingSpot: FishingSpotId = 'rapid';
  private lurePosition = .08;
  private lureDirection: 1 | -1 = 1;
  private lureHits = 0;
  private lureFrame = 0;
  private lureLastFrame = 0;
  private aquariumView?: AquariumView;
  private storyPlayer: StoryPlayer;

  constructor(root: HTMLElement) {
    this.root = root;
    this.renderShell();
    this.storyPlayer = new StoryPlayer(this.query('#overlay'), () => this.bgmForTab(this.currentTab));
    const game = createGame(this.query('#game-canvas'));
    game.events.once('ready', () => undefined);
    const wait = window.setInterval(() => {
      const scene = game.scene.getScene('river') as RiverScene;
      if (scene?.scene.isActive()) {
        this.scene = scene;
        this.scene.setStage(this.save.activeStage);
        this.scene.setFishingSpot(this.fishingSpot);
        this.scene.setEquipment(this.save.equipped.rod, this.save.equipped.float);
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
            <div class="home-place"><small>HOME BASE</small><strong>東雲大学・第七実験棟</strong></div>
            <button class="lab-hotspot tank" data-lab-spot="tank" aria-label="観測水槽を開く"><i></i></button>
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
      laptop:['河川水質予測モデル','水瀬が書いたコードを研究室サーバーで実行中。進捗63%。残り時間の推定値は、信頼区間の外にいる。'],
      tackle:['古い釣具箱','森野先輩の私物。「研究費では買っていない」と三回念を押された。'],
    };
    this.root.querySelectorAll<HTMLButtonElement>('[data-lab-spot]').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.labSpot === 'tank') return this.openAquarium();
      if (button.dataset.labSpot === 'tackle') return this.openTackleBox();
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
        <p class="title-copy">研究室の計算終了まで、あと<span>2時間。</span><br>川までは、徒歩3分。</p>
      </div>
      <button class="primary start-button">はじめから</button>
      <p class="title-foot">画面タップ / Space キー</p>
    </section>`;
    overlay.querySelector('.start-button')?.addEventListener('click', () => this.playFirstEncounter());
  }

  private playFirstEncounter(): void {
    sfx('tap');
    this.playStory('firstEncounter', () => {
      this.addFlag('first-encounter-seen');
      persistSave(this.save);
      this.showEncounterIntertitle();
    });
  }

  private showEncounterIntertitle(): void {
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<section class="encounter-intertitle"><div class="time-rewind-card"><small>NEXT DAY</small><h2>― 翌日の夕方 ―</h2><p>東雲大学・第七実験棟</p></div><button class="encounter-rewind">続ける <span>▼</span></button></section>`;
    overlay.querySelector('.encounter-rewind')?.addEventListener('click', () => this.playOpening());
  }

  private playOpening(): void {
    sfx('tap');
    this.playStory('opening', () => {
      this.save.openingSeen = true;
      this.addFlag('opening-seen');
      persistSave(this.save);
      this.activateTab('home');
      this.toast('序章「昨日の銀色を探して」');
    });
  }

  private playStory(sceneId: keyof typeof STORY, onComplete?: () => void): void {
    this.storyPlayer.play(sceneId, onComplete);
  }

  private showLabBubble(title: string, text: string): void {
    sfx('tap');
    const bubble = this.query('#lab-bubble');
    bubble.querySelector('b')!.textContent = title;
    bubble.querySelector('p')!.textContent = text;
    bubble.classList.remove('hidden');
  }

  private openAquarium(requestedKind?: AquariumKind): void {
    sfx('tap');
    this.query('#lab-bubble').classList.add('hidden');
    this.aquariumView?.destroy();
    const freshwater = aquariumResidents(this.save, 'freshwater');
    const brackish = aquariumResidents(this.save, 'brackish');
    const kind = requestedKind ?? (!freshwater.length && brackish.length ? 'brackish' : 'freshwater');
    const residents = kind === 'freshwater' ? freshwater : brackish;
    let selected: AquariumResident | undefined = residents[0];
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<div class="aquarium-dimmer"><section class="aquarium-screen ${kind}"><header><div><small>LAB OBSERVATION TANK</small><h2>研究室の観測水槽</h2></div><button id="aquarium-close" aria-label="水槽を閉じる">×</button></header><nav class="aquarium-tabs"><button data-aquarium-kind="freshwater" class="${kind === 'freshwater' ? 'active' : ''}">淡水槽 <b>${freshwater.length}/${AQUARIUM_CAPACITY}</b></button><button data-aquarium-kind="brackish" class="${kind === 'brackish' ? 'active' : ''}">汽水・海水槽 <b>${brackish.length}/${AQUARIUM_CAPACITY}</b></button></nav><div class="aquarium-tank"><canvas id="aquarium-canvas" aria-label="釣った魚が泳ぐ観測水槽"></canvas><div class="tank-caustics"></div>${residents.length ? '' : `<p class="empty-tank">まだ魚はいない。<br>釣果画面からこの水槽へ移せます。</p>`}</div><article id="aquarium-info" class="aquarium-info"></article><div class="aquarium-residents">${residents.map((resident) => { const fish = FISH[resident.fishId]; return `<button data-resident="${resident.uid}"><img src="${fish.sprite}" alt=""><span><b>${fish.name}</b><small>${resident.size.toFixed(1)} cm</small></span></button>`; }).join('')}</div><p class="aquarium-note">魚をタップすると個体記録を確認できます。水質系統ごとに最大${AQUARIUM_CAPACITY}匹。</p></section></div>`;
    const info = overlay.querySelector<HTMLElement>('#aquarium-info')!;
    const showInfo = (resident?: AquariumResident) => {
      selected = resident;
      if (!resident) {
        info.innerHTML = `<span class="tank-icon">◇</span><div><b>空の観測水槽</b><p>次に釣れた魚を迎える準備はできている。</p></div>`;
        return;
      }
      const fish = FISH[resident.fishId];
      info.innerHTML = `<img src="${fish.sprite}" alt=""><div><small>${kind === 'freshwater' ? 'FRESHWATER' : 'BRACKISH / MARINE'} SPECIMEN</small><b>${fish.name}　${resident.size.toFixed(1)}cm</b><p>${STAGES[resident.stage].name}で観測｜${resident.rank}サイズ</p></div><button id="aquarium-remove">水槽から出す</button>`;
      info.querySelector('#aquarium-remove')?.addEventListener('click', () => {
        if (!selected || !returnResidentToBasket(this.save, selected.uid)) return;
        persistSave(this.save);
        this.aquariumView?.destroy();
        this.openAquarium(kind);
        this.toast(`${fish.name}を釣果籠へ戻した`);
      });
    };
    showInfo(selected);
    this.aquariumView = new AquariumView(overlay.querySelector<HTMLCanvasElement>('#aquarium-canvas')!, residents, kind, (resident) => {
      showInfo(resident);
      overlay.querySelectorAll('[data-resident]').forEach((button) => button.classList.toggle('selected', (button as HTMLElement).dataset.resident === resident.uid));
      sfx('tap');
    });
    overlay.querySelector('#aquarium-close')?.addEventListener('click', () => {
      this.aquariumView?.destroy();
      this.aquariumView = undefined;
      overlay.innerHTML = '';
      sfx('tap');
    });
    overlay.querySelectorAll<HTMLButtonElement>('[data-aquarium-kind]').forEach((button) => button.addEventListener('click', () => this.openAquarium(button.dataset.aquariumKind as AquariumKind)));
    overlay.querySelectorAll<HTMLButtonElement>('[data-resident]').forEach((button) => button.addEventListener('click', () => {
      const resident = residents.find((item) => item.uid === button.dataset.resident);
      showInfo(resident);
      overlay.querySelectorAll('[data-resident]').forEach((item) => item.classList.toggle('selected', item === button));
      sfx('tap');
    }));
  }

  private openTackleBox(): void {
    sfx('tap');
    this.query('#lab-bubble').classList.add('hidden');
    const categories: GearCategory[] = ['rod','float','hook'];
    const overlay = this.query('#overlay');
    const inventory = categories.map((category) => `<section class="tacklebox-group"><h3><span>${CATEGORY_NAMES[category]}</span><small>${GEAR.filter((gear) => gear.category === category && this.save.ownedGear.includes(gear.id)).length} / ${GEAR.filter((gear) => gear.category === category).length}</small></h3><div class="tacklebox-grid">${GEAR.filter((gear) => gear.category === category).map((gear) => {
      const owned = this.save.ownedGear.includes(gear.id);
      const equipped = this.save.equipped[category] === gear.id;
      const rewardLabel = gear.id === 'float-2' ? '第一章の調査報酬' : gear.id === 'rod-2' ? '第二章の大会報酬' : this.save.chapter < gear.unlockChapter ? `第${gear.unlockChapter}章で解禁` : '釣具店で購入';
      return `<button data-box-gear="${gear.id}" class="tacklebox-item ${equipped ? 'equipped' : ''} ${owned ? '' : 'locked'}" ${owned ? '' : 'disabled'}><div class="tacklebox-art"><img src="${gear.asset}" alt="${gear.name}"><i>Lv.${gear.level}</i></div><span><b>${gear.name}</b><small>${owned ? this.gearEffect(gear) : rewardLabel}</small></span><em>${equipped ? '装備中' : owned ? '装備する' : '未入手'}</em></button>`;
    }).join('')}</div></section>`).join('');
    const baitInventory = (Object.keys(BAITS) as BaitId[]).map((baitId) => { const bait = BAITS[baitId]; const amount = bait.reusable ? '∞' : this.save.baitStock[baitId as keyof SaveData['baitStock']]; return `<span><i class="bait-pixel"><img src="${bait.asset}" alt=""></i><b>${bait.name}</b><small>${amount}</small></span>`; }).join('');
    overlay.innerHTML = `<div class="tacklebox-dimmer"><section class="tacklebox-screen"><header><div><small>LAB TACKLE INVENTORY</small><h2>研究室の釣具箱</h2></div><button id="tacklebox-close" aria-label="釣具箱を閉じる">×</button></header>${inventory}<section class="tacklebox-baits"><h3>エサの在庫</h3><div>${baitInventory}</div></section><p class="tacklebox-note">所持している道具を選ぶと、その場で装備を変更できます。</p></section></div>`;
    overlay.querySelector('#tacklebox-close')?.addEventListener('click', () => { overlay.innerHTML = ''; sfx('tap'); });
    overlay.querySelectorAll<HTMLButtonElement>('[data-box-gear]').forEach((button) => button.addEventListener('click', () => {
      const gear = GEAR.find((item) => item.id === button.dataset.boxGear);
      if (!gear || !this.save.ownedGear.includes(gear.id)) return;
      buyOrEquip(this.save, gear.id);
      persistSave(this.save);
      this.scene?.setEquipment(this.save.equipped.rod, this.save.equipped.float);
      this.openTackleBox();
      this.toast(`${gear.name}を装備した`);
    }));
  }

  private activateTab(tab: string): void {
    this.currentTab = tab;
    const activeTab = tab === 'memo' || tab === 'story-log' ? 'home' : tab;
    this.root.querySelectorAll<HTMLButtonElement>('.tabbar button').forEach((item) => item.classList.toggle('active', item.dataset.tab === activeTab));
    this.renderDock(tab);
    if (tab === 'home' && this.save.chapter === 2 && !this.hasFlag('chapter2-intro-seen')) {
      this.addFlag('chapter2-intro-seen');
      if (!this.save.unlockedStages.includes('tsukinami-port')) this.save.unlockedStages.push('tsukinami-port');
      persistSave(this.save);
      this.playStory('chapter2Opening', () => {
        this.renderHome();
        this.toast('第二章「夕暮れの港」｜月波港を解放');
      });
      return;
    }
    if (tab === 'fish' && this.save.chapter === 1 && this.save.activeStage === 'mountain-stream' && !this.hasFlag('stream-arrival-seen')) {
      this.addFlag('stream-arrival-seen');
      persistSave(this.save);
      this.playStory('streamArrival', () => {
        this.renderFishing();
        this.toast('主目標：ヤマメを観測する');
      });
      return;
    }
    if (tab === 'fish' && this.save.chapter === 1 && this.save.activeStage === 'mountain-stream' && this.hasFlag('deep-pool-open') && !this.hasFlag('deep-pool-clue-seen')) {
      this.addFlag('deep-pool-clue-seen');
      persistSave(this.save);
      this.playStory('deepPoolClue', () => {
        this.fishingSpot = 'deep-pool';
        this.scene?.setFishingSpot(this.fishingSpot);
        this.renderFishing();
        this.toast('新地点「深い落ち込み」｜川虫を遠くへ流そう');
      });
      return;
    }
    if (tab === 'fish' && this.save.chapter === 2 && this.save.activeStage === 'tsukinami-port' && !this.hasFlag('port-arrival-seen')) {
      this.addFlag('port-arrival-seen');
      persistSave(this.save);
      this.playStory('portArrival', () => {
        this.fishingSpot = 'harbor-wall';
        this.renderFishing();
        this.toast('港の基礎観測：ハゼとアジを記録しよう');
      });
    }
  }

  private renderDock(tab: string): void {
    const home = tab === 'home' || tab === 'memo' || tab === 'story-log';
    const menu = tab === 'book' || tab === 'shop' || tab === 'map';
    const dock = this.query('#dock');
    dock.classList.toggle('archive-mode', tab === 'story-log');
    dock.classList.remove('fight-mode','landing-mode');
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
        : { src:'/assets/backgrounds/route-map-pixel-v3.png', alt:'東雲大学、青葉渓流、月波港の位置を示す調査地図', eyebrow:'FIELD MAP', title:'月波川流域・調査地域図' };
    const image = this.query<HTMLImageElement>('#menu-scene-image');
    image.src = config.src;
    image.alt = config.alt;
    this.query('#menu-scene-caption').innerHTML = `<small>${config.eyebrow}</small><strong>${config.title}</strong>`;
    const pins = this.query('#map-pins');
    if (tab !== 'map') { pins.innerHTML = ''; return; }
    pins.innerHTML = `<div class="map-landmark university"><i></i><span>東雲大学<small>第七実験棟</small></span></div><div class="map-landmark shop"><i></i><span>月波釣具店<small>川沿い商店街</small></span></div><div class="map-landmark future"><i></i><span>山上観測広場<small>未調査｜古い観測標が残る</small></span></div><button data-map-stage="mountain-stream" class="map-pin stream ${this.save.unlockedStages.includes('mountain-stream') ? '' : 'locked'}"><i></i><span>青葉渓流<small>${this.save.unlockedStages.includes('mountain-stream') ? '上流バス下車 → 山道' : '未調査'}</small></span></button><button data-map-stage="campus-river" class="map-pin river"><i></i><span>大学裏の川<small>研究室から徒歩3分</small></span></button><button data-map-stage="tsukinami-port" class="map-pin port ${this.save.unlockedStages.includes('tsukinami-port') ? '' : 'locked'}"><i></i><span>月波港<small>${this.save.unlockedStages.includes('tsukinami-port') ? '海岸線バス下車 → 港' : '未調査'}</small></span></button>`;
    pins.querySelectorAll<HTMLButtonElement>('[data-map-stage]').forEach((button) => button.addEventListener('click', () => this.travelTo(button.dataset.mapStage as StageId)));
  }

  private renderHome(): void {
    this.query('#lab-bubble').classList.add('hidden');
    const quest = getCurrentQuest(this.save);
    const home = getHomeStoryState(this.save);
    this.query('#dock').innerHTML = `<div class="home-dock">
      <div class="home-header"><div><small>${home.chapterLabel}</small><h2>${home.chapterTitle}</h2></div><span class="clock">18:42</span></div>
      <article class="quest-card ${home.actionReady ? 'ready' : ''}"><small>CURRENT OBJECTIVE</small><h3>${quest.title}</h3><p>${quest.description}</p><div class="quest-progress"><i style="width:${quest.progress}%"></i></div><em>${quest.counter}</em></article>
      <div class="home-actions">
        <button id="home-primary" class="pixel-button">${home.primaryLabel}<small>${home.primaryHint}</small></button>
        <div class="home-side-actions"><button id="home-note" class="note-button">観測メモ<span>${Object.keys(this.save.records).length}種 / ${this.save.totalCaught}匹</span></button><button id="home-story-log" class="note-button story-log-button">回想ログ<span>出来事を読み返す</span></button></div>
      </div>
      <p class="lab-message">${home.labMessage}</p>
    </div>`;
    this.query('#home-primary').addEventListener('click', () => {
      sfx('tap');
      if (home.action === 'chapter1-report') return this.continueChapterOne();
      if (home.action === 'chapter1-finale') return this.finishChapterOne();
      if (home.action === 'chapter2-report') return this.continueChapterTwo();
      if (home.action === 'chapter2-finale') return this.finishChapterTwo();
      if (home.action === 'shop-intro') return this.activateTab('shop');
      this.activateTab(home.action === 'go-fishing' ? 'fish' : 'map');
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
    const milestones = getObservationMilestones(this.save);
    this.query('#dock').innerHTML = `<div class="memo-head"><button id="memo-back" class="tiny-button">← ホーム</button><div><small>FIELD JOURNAL</small><h2>観測メモ</h2></div></div><div class="memo-stats"><div><b>${this.save.totalCaught}</b><span>総捕獲</span></div><div><b>${logs.length}</b><span>観測魚種</span></div><div><b>${giantKinds}</b><span>巨大魚種</span></div></div><section class="memo-section"><h3>調査のあゆみ</h3>${milestones.length ? milestones.map((item,index) => `<article class="milestone"><i>${String(index+1).padStart(2,'0')}</i><div><b>${item.title}</b><p>${item.description}</p></div></article>`).join('') : '<p class="empty-log">まだ記録はない。川へ出て最初の一匹を観測しよう。</p>'}</section><section class="memo-section catch-log"><h3>初観測ログ</h3>${logs.map(({fish,record}) => `<article><time>${new Date(record!.firstCaughtAt).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'})}</time><img src="${fish.sprite}" alt=""><div><b>${fish.name}</b><small>${STAGES[record!.firstStage].name}｜最大 ${record!.maxSize.toFixed(1)}cm｜${record!.count}匹</small></div></article>`).join('') || '<p class="empty-log">未記録</p>'}</section>`;
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
    this.query('#dock').innerHTML = `<section class="story-archive"><header class="archive-head"><button id="story-archive-back" class="tiny-button">← ホーム</button><div><small>STORY ARCHIVE</small><h2>回想ログ</h2></div></header><nav class="archive-scenes" aria-label="回想する場面">${unlocked.map((scene) => `<button data-archive-scene="${scene.id}" class="${scene.id === selected.id ? 'active' : ''}"><span><small>${scene.archive.label}</small><b>${scene.title.split('｜').at(-1)}</b></span></button>`).join('')}</nav><article class="archive-thread"><div class="archive-thread-head"><div><small>${selected.archive.label}</small><h3>${selected.title}</h3><p>${selected.archive.summary}</p></div><button id="archive-replay">場面を再生 ▶</button></div><div class="archive-messages">${selected.lines.map((line) => { const player = line.speaker === '主人公'; const speaker = storySpeakerName(line.speaker); return `<div class="archive-message ${player ? 'player' : ''} ${line.tone ?? ''}"><img src="${line.portrait ?? storyPortrait(line.speaker)}" alt="${speaker}"><div><b>${speaker}</b><p>${line.text}</p></div></div>`; }).join('')}</div></article></section>`;
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

  private continueChapterOne(): void {
    this.playStory('streamMidReport', () => {
      this.showHypothesisBoard(() => {
        this.addFlag('flow-boundary-deduced');
        this.addFlag('stream-mid-report-seen');
        this.addFlag('deep-pool-open');
        persistSave(this.save);
        this.activateTab('home');
        this.toast('観測仮説を保存：流れの境目と深み');
      });
    });
  }

  private showHypothesisBoard(onComplete: () => void): void {
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<div class="hypothesis-dimmer"><section class="hypothesis-board"><header><small>OBSERVATION REVIEW</small><h2>観測結果から仮説を立てる</h2><p>ヤマメと、もう一種の魚がいた場所。共通していたのは？</p></header><div class="evidence-row"><span>白泡の脇</span><i>＋</i><span>岩の裏</span></div><div class="hypothesis-options"><button data-hypothesis="fast">水が最も速い場所</button><button data-hypothesis="boundary">速い流れと緩い流れの境目</button><button data-hypothesis="bright">川底が明るく見える場所</button></div><p id="hypothesis-result" class="hypothesis-result">観測メモを見比べて選ぼう。</p><button id="hypothesis-confirm" class="primary hidden">この仮説で深みを調べる</button></section></div>`;
    const result = overlay.querySelector<HTMLElement>('#hypothesis-result')!;
    const confirm = overlay.querySelector<HTMLButtonElement>('#hypothesis-confirm')!;
    overlay.querySelectorAll<HTMLButtonElement>('[data-hypothesis]').forEach((button) => button.addEventListener('click', () => {
      sfx('tap');
      if (button.dataset.hypothesis !== 'boundary') {
        button.classList.add('wrong');
        result.innerHTML = '<b>森野先輩</b>「速さそのものではなく、魚が休める場所を見てみよう」';
        return;
      }
      overlay.querySelectorAll<HTMLButtonElement>('[data-hypothesis]').forEach((item) => { item.disabled = true; });
      button.classList.add('correct');
      result.innerHTML = '<b>仮説成立</b>流れの境目には魚が留まる。次は、その流れが落ち込む深みを調べる。';
      confirm.classList.remove('hidden');
    }));
    confirm.addEventListener('click', () => {
      sfx('tap');
      overlay.innerHTML = '';
      onComplete();
    });
  }

  private continueChapterTwo(): void {
    this.playStory('portMidReport', () => {
      this.showTideBoard(() => {
        this.addFlag('port-mid-report-seen');
        this.addFlag('outflow-tide-deduced');
        persistSave(this.save);
        this.playStory('tournamentStart', () => {
          this.addFlag('tournament-open');
          persistSave(this.save);
          this.activateTab('home');
          this.toast('夕まずめ大会 開始｜河口の潮目をルアーで狙おう');
        });
      });
    });
  }

  private showTideBoard(onComplete: () => void): void {
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<div class="hypothesis-dimmer"><section class="hypothesis-board tide-board"><header><small>TIDAL REVIEW</small><h2>大型魚が港へ入る条件は？</h2><p>釣果時刻と流れの向きを照らし合わせよう。</p></header><div class="evidence-row"><span>日没前</span><i>＋</i><span>下げ潮</span><i>＋</i><span>河口の小魚</span></div><div class="hypothesis-options"><button data-tide="high">満潮で水が止まる時</button><button data-tide="outflow">川水が海へ押し出す時</button><button data-tide="random">潮とは関係なくランダム</button></div><p id="tide-result" class="hypothesis-result">三つの記録が重なる条件を選ぼう。</p><button id="tide-confirm" class="primary hidden">この条件で大会に挑む</button></section></div>`;
    const result = overlay.querySelector<HTMLElement>('#tide-result')!;
    const confirm = overlay.querySelector<HTMLButtonElement>('#tide-confirm')!;
    overlay.querySelectorAll<HTMLButtonElement>('[data-tide]').forEach((button) => button.addEventListener('click', () => {
      sfx('tap');
      if (button.dataset.tide !== 'outflow') {
        button.classList.add('wrong');
        result.innerHTML = '<b>森野先輩</b>「魚がいた時刻だけでなく、水がどちらへ動いたかも見よう」';
        return;
      }
      overlay.querySelectorAll<HTMLButtonElement>('[data-tide]').forEach((item) => { item.disabled = true; });
      button.classList.add('correct');
      result.innerHTML = '<b>仮説成立</b>下げ潮で川水が押し出すと潮目が強まり、小魚と大型魚が同じ線へ集まる。';
      confirm.classList.remove('hidden');
    }));
    confirm.addEventListener('click', () => { sfx('tap'); overlay.innerHTML = ''; onComplete(); });
  }

  private hasFlag(flag: string): boolean { return hasStoryFlag(this.save, flag); }
  private addFlag(flag: string): void { addStoryFlag(this.save, flag); }
  private currentPortTide(): PortTide { return this.hasFlag('tournament-open') ? 'outflow' : 'slack'; }

  private renderFishing(): void {
    const dock = this.query('#dock');
    dock.classList.remove('fight-mode','landing-mode');
    dock.scrollTop = 0;
    const stage = STAGES[this.save.activeStage];
    const baits: BaitId[] = ['練り餌','ミミズ','川虫','ルアー'];
    if (!baitAvailable(this.save, this.save.bait)) {
      this.save.bait = baits.find((bait) => baitAvailable(this.save, bait)) ?? 'ルアー';
      persistSave(this.save);
    }
    const equipped = Object.fromEntries((['rod','float','hook'] as GearCategory[]).map((category) => [category, GEAR.find((gear) => gear.id === this.save.equipped[category])!])) as Record<GearCategory, typeof GEAR[number]>;
    const rodEffect = Math.round((1 - (1 - equipped.rod.control * 1.05)) * 100);
    const floatBonus = Math.round(equipped.float.control * 900);
    const hookBonus = Math.round(equipped.hook.control * 900);
    const deepPoolUnlocked = this.hasFlag('deep-pool-clue-seen');
    const port = this.save.activeStage === 'tsukinami-port';
    if (this.save.activeStage === 'campus-river') this.fishingSpot = 'rapid';
    if (this.save.activeStage === 'mountain-stream' && !['edge','rapid','deep-pool'].includes(this.fishingSpot)) this.fishingSpot = 'rapid';
    if (port && !['harbor-wall','breakwater','river-mouth'].includes(this.fishingSpot)) this.fishingSpot = 'harbor-wall';
    if (this.fishingSpot === 'deep-pool' && !deepPoolUnlocked) this.fishingSpot = 'rapid';
    this.scene?.setFishingSpot(this.fishingSpot);
    this.scene?.setEquipment(this.save.equipped.rod, this.save.equipped.float);
    const spotRow = this.save.activeStage === 'mountain-stream'
      ? `<div class="spot-row"><span>地点</span><button data-spot="edge" class="${this.fishingSpot === 'edge' ? 'selected' : ''}">岸際の淀み</button><button data-spot="rapid" class="${this.fishingSpot === 'rapid' ? 'selected' : ''}">白泡の瀬</button><button data-spot="deep-pool" class="${this.fishingSpot === 'deep-pool' ? 'selected' : ''}" ${deepPoolUnlocked ? '' : 'disabled'}>${deepPoolUnlocked ? '深い落ち込み' : '未調査'}</button></div>`
      : port
        ? `<div class="spot-row port-spots"><span>地点</span><button data-spot="harbor-wall" class="${this.fishingSpot === 'harbor-wall' ? 'selected' : ''}">港の足元</button><button data-spot="breakwater" class="${this.fishingSpot === 'breakwater' ? 'selected' : ''}">防波堤</button><button data-spot="river-mouth" class="${this.fishingSpot === 'river-mouth' ? 'selected' : ''}">河口の潮目</button></div>`
        : '';
    const tide = this.currentPortTide();
    const tideStrip = port ? `<div class="tide-strip ${tide}"><span>潮</span><b>${tide === 'outflow' ? '下げ潮・川水が押す' : '夕凪・流れは緩い'}</b><i>${this.hasFlag('tournament-open') ? '大会中' : '基礎観測'}</i></div>` : '';
    dock.innerHTML = `
      <div class="location-row"><div><small>現在地</small><strong>${stage.name}</strong></div><p>${stage.description}</p></div>
      ${spotRow}
      ${tideStrip}
      <div class="bait-row"><span>エサ</span>${baits.map((bait) => { const data = BAITS[bait]; const available = baitAvailable(this.save, bait); const count = data.reusable ? '∞' : `×${this.save.baitStock[bait as keyof SaveData['baitStock']]}`; return `<button data-bait="${bait}" class="chip ${bait === this.save.bait ? 'selected' : ''} ${available ? '' : 'empty'}" ${available ? '' : 'disabled'}><b>${bait}</b><small>${this.save.chapter < data.unlockChapter ? '未解禁' : count}</small></button>`; }).join('')}</div>
      <div class="tackle-strip"><span><i>竿</i>${equipped.rod.name}<small>${rodEffect ? `張力 -${rodEffect}%` : '標準'}</small></span><span><i>浮</i>${equipped.float.name}<small>${floatBonus ? `合わせ +${floatBonus}ms` : '標準'}</small></span><span><i>針</i>${equipped.hook.name}<small>${hookBonus ? `+${hookBonus}ms・疲労UP` : '標準'}</small></span></div>
      <div class="cast-panel" id="cast-panel">
        <div class="phase-copy"><small id="phase-label">CAST</small><strong id="phase-title">狙う距離を決めよう</strong><p id="phase-help">ボタンでメーターを動かし、もう一度押してキャスト</p></div>
        <div class="cast-meter" id="cast-meter"><i style="left:${this.castPower*100}%"></i></div>
        <div id="lure-hud" class="lure-hud hidden"><div class="lure-copy"><span>潮目へ通す</span><b id="lure-count">誘い 0 / 3</b></div><div class="lure-meter"><span id="lure-zone"></span><i id="lure-marker"></i></div><p id="lure-feedback">白い印が金色に入った瞬間に引く</p></div>
        <div id="fight-hud" class="fight-hud hidden"><label>糸のテンション <b id="tension-text">安定</b></label><div class="gauge tension"><i id="tension-bar"></i><em></em></div><label>魚との距離 <b id="distance-text">70m</b></label><div class="gauge distance"><i id="distance-bar"></i></div><div id="fish-tell" class="fish-tell">魚の動きを見よう</div></div>
        <div id="landing-hud" class="landing-hud hidden" role="button" tabindex="0" aria-label="タイミングを合わせて魚を引き上げる"><div class="landing-copy"><small>CLICK / TAP <i id="landing-difficulty-label"></i></small><b>魚体が中央に来た瞬間を狙え</b><p>白い印が金色に重なったら、ゲージをクリックして引き上げる</p></div><div class="landing-gauge"><span id="landing-zone"></span><i id="landing-marker"></i><em>水面</em><em>足元</em></div></div>
        <button id="action" class="primary action-button">キャストを始める <kbd>Space</kbd></button>
      </div>`;
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-spot]').forEach((button) => button.addEventListener('click', () => {
      if (this.phase !== 'idle' || button.disabled) return;
      this.fishingSpot = button.dataset.spot as FishingSpotId;
      this.scene?.setFishingSpot(this.fishingSpot);
      sfx('tap');
      this.renderFishing();
    }));
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
    if (this.phase === 'luring') return this.attemptLurePull();
    if (this.phase === 'bite') return this.hookFish();
    if (this.phase === 'landing') return this.attemptLanding();
    if (this.phase === 'waiting' || this.phase === 'nibble') return this.failFishing('早すぎた！　これは前アタリだ');
  }

  private beginCast(): void {
    if (!baitAvailable(this.save, this.save.bait)) {
      this.toast('エサがない。釣具屋で補充しよう');
      return;
    }
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
    if (!consumeBait(this.save, this.save.bait)) {
      this.phase = 'idle';
      this.toast('エサが切れている。釣具屋で補充しよう');
      this.renderFishing();
      return;
    }
    persistSave(this.save);
    this.phase = 'waiting';
    const deepPoolChallenge = this.save.chapter === 1 && this.save.activeStage === 'mountain-stream' && this.hasFlag('deep-pool-clue-seen') && !this.hasFlag('iwana-challenge-seen');
    const deepPoolTarget = deepPoolChallenge && this.fishingSpot === 'deep-pool' && this.save.bait === '川虫' && this.castPower >= .58;
    const tournamentTarget = this.save.chapter === 2 && this.save.activeStage === 'tsukinami-port' && this.hasFlag('tournament-open') && !this.hasFlag('tournament-suzuki-seen') && this.fishingSpot === 'river-mouth' && this.save.bait === 'ルアー' && this.castPower >= .62;
    const habitatCast = this.save.activeStage === 'tsukinami-port'
      ? this.fishingSpot === 'harbor-wall' ? this.castPower * .38 : this.fishingSpot === 'breakwater' ? .25 + this.castPower * .55 : .58 + this.castPower * .42
      : this.save.activeStage !== 'mountain-stream'
        ? this.castPower
        : this.fishingSpot === 'edge'
        ? this.castPower * .42
        : this.fishingSpot === 'deep-pool'
          ? .55 + this.castPower * .45
          : .22 + this.castPower * .58;
    const tackleLevel = Math.max(...(['rod','float','hook'] as GearCategory[]).map((category) => GEAR.find((gear) => gear.id === this.save.equipped[category])?.level ?? 1));
    this.pendingFish = tournamentTarget ? FISH.suzuki : deepPoolTarget ? FISH.iwana : chooseFish(this.save.activeStage, this.save.bait, habitatCast, Math.random, tackleLevel);
    this.pendingCatch = tournamentTarget ? makeCatch(this.pendingFish, () => .84, this.castPower) : deepPoolTarget ? makeCatch(this.pendingFish, () => .78, this.castPower) : makeCatch(this.pendingFish, Math.random, this.castPower);
    this.pendingPower = specimenPower(this.pendingFish, this.pendingCatch.size);
    this.scene?.setMood('waiting', this.castPower);
    sfx('cast');
    this.setCopy('WAIT','浮きをよく見よう','小さな揺れは前アタリ。深く沈んだ瞬間に合わせる');
    this.setAction('アタリを待つ…');
    this.query<HTMLButtonElement>('#action').classList.add('waiting');
    if (this.save.activeStage === 'tsukinami-port' && this.save.bait === 'ルアー') return this.beginLureRetrieve();
    const lead = 900 + Math.random() * 900;
    this.timers.push(window.setTimeout(() => this.showNibble(), lead));
    this.timers.push(window.setTimeout(() => this.showBite(), lead + 950 + Math.random() * 750));
  }

  private beginLureRetrieve(): void {
    this.phase = 'luring';
    this.lurePosition = .08;
    this.lureDirection = 1;
    this.lureHits = 0;
    this.lureLastFrame = performance.now();
    this.query('#cast-meter').classList.add('hidden');
    this.query('#lure-hud').classList.remove('hidden');
    const zone = lureWindow(this.currentPortTide());
    const zoneElement = this.query('#lure-zone');
    zoneElement.style.left = `${zone.start * 100}%`;
    zoneElement.style.width = `${(zone.end-zone.start) * 100}%`;
    this.setCopy('LURE','潮目へルアーを通す','金色の流れへ入った瞬間に、三回ルアーを引こう');
    this.setAction('ルアーを引く！');
    this.query<HTMLButtonElement>('#action').classList.remove('waiting');
    this.lureFrame = requestAnimationFrame((time) => this.updateLureRetrieve(time));
  }

  private updateLureRetrieve(time: number): void {
    if (this.phase !== 'luring') return;
    const dt = Math.min((time - this.lureLastFrame) / 1000, .05);
    this.lureLastFrame = time;
    const state = stepLureMarker({ position:this.lurePosition, direction:this.lureDirection }, dt, this.currentPortTide());
    this.lurePosition = state.position;
    this.lureDirection = state.direction;
    const marker = this.root.querySelector<HTMLElement>('#lure-marker');
    if (marker) marker.style.left = `${this.lurePosition * 100}%`;
    this.lureFrame = requestAnimationFrame((next) => this.updateLureRetrieve(next));
  }

  private attemptLurePull(): void {
    const feedback = this.query('#lure-feedback');
    if (!isLurePullOnCurrent(this.lurePosition, this.currentPortTide())) {
      this.lureHits = Math.max(0, this.lureHits - 1);
      feedback.textContent = '潮目を外れた。白い印が金色に入るまで待とう';
      feedback.className = 'miss';
      sfx('fail');
    } else {
      this.lureHits++;
      feedback.textContent = this.lureHits >= 3 ? '水中で重い影が反転した！' : '流れを捉えた。もう一度、間を合わせる';
      feedback.className = 'hit';
      sfx('tap');
    }
    this.query('#lure-count').textContent = `誘い ${this.lureHits} / 3`;
    if (this.lureHits < 3) return;
    cancelAnimationFrame(this.lureFrame);
    this.phase = 'waiting';
    this.setAction('食いつきを待つ…');
    this.timers.push(window.setTimeout(() => this.showBite(), 420));
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
    this.query('#lure-hud').classList.add('hidden');
    this.query('#fight-hud').classList.remove('hidden');
    const dock = this.query('#dock');
    dock.classList.add('fight-mode');
    dock.classList.remove('landing-mode');
    dock.scrollTop = 0;
    const pullTell = this.pendingPower >= 1.18 ? '竿が深くしなる。強い走りに備えよう' : this.pendingPower >= 1.02 ? '確かな重みがある。動きを見て慎重に寄せよう' : '細かな振動が伝わる。リズムよく寄せよう';
    this.setCopy('FIGHT','何かが掛かった！',pullTell);
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
    const dock = this.query('#dock');
    dock.classList.remove('fight-mode');
    dock.classList.add('landing-mode');
    dock.scrollTop = 0;
    const hookControl = GEAR.find((gear) => gear.id === this.save.equipped.hook)?.control ?? 0;
    const tolerance = landingTolerance(this.pendingFish, hookControl, this.pendingPower);
    const zone = this.query<HTMLElement>('#landing-zone');
    zone.style.top = `${(0.5 - tolerance) * 100}%`;
    zone.style.height = `${tolerance * 200}%`;
    const difficultyLabel = tolerance <= .105 ? '最高' : tolerance <= .135 ? '高' : tolerance <= .18 ? '中' : '低';
    this.query('#landing-difficulty-label').textContent = `取り込み難度｜${difficultyLabel}`;
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
    cancelAnimationFrame(this.lureFrame);
    this.scene?.setMood('splash', this.castPower);
    const fish = this.pendingFish;
    const item = this.pendingCatch ?? makeCatch(fish, Math.random, this.castPower);
    const previousChapter = this.save.chapter;
    const firstCatchEvent = this.save.totalCaught === 0 && !this.hasFlag('first-catch-seen');
    const firstYamameEvent = fish.id === 'yamame' && this.save.activeStage === 'mountain-stream' && !this.hasFlag('yamame-story-seen');
    const iwanaChallengeEvent = fish.id === 'iwana' && this.fishingSpot === 'deep-pool' && item.size >= fish.thresholds[1] && this.hasFlag('deep-pool-clue-seen') && !this.hasFlag('iwana-challenge-seen');
    const firstPortCatchEvent = this.save.activeStage === 'tsukinami-port' && !this.hasFlag('first-port-catch-seen');
    const tournamentSuzukiEvent = fish.id === 'suzuki' && this.save.activeStage === 'tsukinami-port' && this.hasFlag('tournament-open') && !this.hasFlag('tournament-suzuki-seen') && item.size >= fish.thresholds[1];
    const result = recordCatch(this.save, item, this.save.activeStage);
    if (iwanaChallengeEvent) releaseCatch(this.save, item.uid);
    persistSave(this.save);
    this.updateMoney();
    sfx('catch');
    const tags = [result.isNew ? 'NEW!' : '', result.isRecord ? '自己新記録' : '', item.rank === '巨大' ? 'GIANT' : ''].filter(Boolean);
    const overlay = this.query('#overlay');
    const disposition = iwanaChallengeEvent ? `${item.weight.toFixed(1)} g　／　深みの主・要リリース` : `${item.weight.toFixed(1)} g　／　売値 ${item.value} G`;
    const waterLabel = aquariumKindForFish(fish.id) === 'freshwater' ? '淡水槽' : '汽水・海水槽';
    const catchActions = iwanaChallengeEvent
      ? `<button id="catch-keep" class="primary">傷を記録する</button>`
      : `<div class="catch-actions"><button id="catch-aquarium" class="catch-secondary">${waterLabel}へ入れる</button><button id="catch-keep" class="primary">記録して持ち帰る</button></div>`;
    overlay.innerHTML = `<div class="catch-dimmer"><section class="catch-card ${item.rank === '巨大' ? 'giant' : ''}"><div class="catch-rays"></div><p class="catch-label">${tags.map((tag) => `<span>${tag}</span>`).join('')}</p><div class="catch-fish-stage"><img src="${fish.sprite}" alt="${fish.name}"></div><div class="catch-result-info"><div class="catch-name-row"><h2>${fish.name}</h2><div class="catch-rarity"><span>RARITY</span><b aria-label="希少度 ${fish.rarity}">${'★'.repeat(fish.rarity)}${'☆'.repeat(4-fish.rarity)}</b></div></div><div class="catch-size"><strong>${item.size.toFixed(1)}</strong> cm <i>${item.rank}サイズ</i></div></div><p>${disposition}</p>${catchActions}</section></div>`;
    const finishCatch = (tankMessage?: string) => {
      overlay.innerHTML = '';
      const chapterStarted = previousChapter === 0 && this.save.chapter === 1;
      this.resetFishing();
      this.renderFishing();
      if (chapterStarted) {
        this.playStory('prologueCatchup', () => {
          this.addFlag('prologue-caught-up');
          persistSave(this.save);
          this.playStory('chapter1Unlock', () => {
            this.addFlag('chapter1-intro-seen');
            persistSave(this.save);
            this.activateTab('home');
            this.toast('新目標：月波釣具店を訪ねよう');
          });
        });
      } else if (firstCatchEvent) {
        this.addFlag('first-catch-seen');
        persistSave(this.save);
        this.playStory('firstCatch', () => {
          this.renderFishing();
          this.toast('初観測を保存した。別の距離とエサも試してみよう');
        });
      } else if (firstYamameEvent) {
        this.addFlag('yamame-story-seen');
        persistSave(this.save);
        this.playStory('yamameCaught', () => {
          this.renderFishing();
          this.toast(streamSurveyReady(this.save) ? '調査完了。研究室へ戻ろう' : '新しい観測目標が追加されました');
        });
      } else if (iwanaChallengeEvent) {
        this.addFlag('iwana-challenge-seen');
        persistSave(this.save);
        this.playStory('iwanaChallengeCaught', () => {
          this.showFishRelease(fish, item, () => {
            this.renderFishing();
            this.toast('イワナを深みに戻した。研究室で最終報告をまとめよう');
          });
        });
      } else if (tournamentSuzukiEvent) {
        this.addFlag('tournament-suzuki-seen');
        persistSave(this.save);
        this.playStory('tournamentSuzukiCaught', () => {
          this.renderFishing();
          this.toast('大会目標達成！ 研究室で港の記録をまとめよう');
        });
      } else if (firstPortCatchEvent) {
        this.addFlag('first-port-catch-seen');
        persistSave(this.save);
        this.playStory('firstPortCatch', () => {
          this.renderFishing();
          this.toast(portSurveyReady(this.save) ? '港の基礎観測完了。研究室へ戻ろう' : 'ハゼとアジ、両方の動きを比べよう');
        });
      } else if (this.save.chapter === 1 && streamSurveyReady(this.save)) {
        this.toast(this.hasFlag('stream-mid-report-seen') ? '深みの大型イワナを狙おう' : '基礎調査完了！ ホームへ戻ろう');
      } else if (this.save.chapter === 2 && portSurveyReady(this.save)) {
        this.toast(this.hasFlag('port-mid-report-seen') ? '河口の潮目へルアーを通そう' : '港の基礎観測完了！ ホームへ戻ろう');
      } else if (tankMessage) {
        this.toast(tankMessage);
      }
    };
    overlay.querySelector('#catch-keep')?.addEventListener('click', () => finishCatch());
    overlay.querySelector('#catch-aquarium')?.addEventListener('click', () => {
      const moved = moveCatchToAquarium(this.save, item.uid, this.save.activeStage);
      if (moved === 'full') return this.toast(`${waterLabel}は満員です。ホームの水槽から魚を出せます`);
      if (moved === 'missing') return this.toast('この個体の記録を確認できませんでした');
      persistSave(this.save);
      sfx('buy');
      finishCatch(`${fish.name}を${waterLabel}へ迎えた`);
    });
  }

  private showFishRelease(fish: FishData, item: CatchItem, onComplete: () => void): void {
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<div class="release-dimmer"><section class="release-card"><small>CATCH &amp; RELEASE</small><h2>記録して、川へ返す</h2><div class="release-water"><i></i><img src="${fish.sprite}" alt="${fish.name}"></div><p><b>${fish.name}　${item.size.toFixed(1)}cm</b>傷と大きさを記録した。深みの主は、もう一度冷たい流れへ戻っていく。</p><button class="primary">見送る</button></section></div>`;
    overlay.querySelector('button')?.addEventListener('click', () => {
      sfx('cast');
      overlay.innerHTML = '';
      onComplete();
    });
  }

  private finishChapterOne(): void {
    this.playStory('chapter1Finale', () => {
      this.save.chapter = 2;
      this.addFlag('chapter1-complete');
      const gear = GEAR.find((item) => item.id === 'float-2')!;
      const previousGear = this.save.equipped.float;
      let rewardSource = 'CHAPTER REWARD｜第一章 調査報酬';
      if (!this.save.ownedGear.includes('float-2')) {
        this.save.ownedGear.push('float-2');
        this.save.equipped.float = 'float-2';
      } else {
        this.save.money += 450;
        rewardSource = 'CHAPTER REWARD｜所持済み・調査謝礼 450 G';
      }
      persistSave(this.save);
      this.updateMoney();
      this.showGearReward(gear, previousGear, rewardSource, () => {
        this.activateTab('home');
        this.toast('第一章クリア｜古い観測帳の記録を保存した');
      });
    });
  }

  private finishChapterTwo(): void {
    this.playStory('chapter2Finale', () => {
      this.save.chapter = 3;
      this.addFlag('chapter2-complete');
      const gear = GEAR.find((item) => item.id === 'rod-2')!;
      const previousGear = this.save.equipped.rod;
      let rewardSource = 'TOURNAMENT REWARD｜月波港 夕まずめ大会';
      if (!this.save.ownedGear.includes('rod-2')) {
        this.save.ownedGear.push('rod-2');
        this.save.equipped.rod = 'rod-2';
      } else {
        this.save.money += 650;
        rewardSource = 'TOURNAMENT REWARD｜所持済み・優勝賞金 650 G';
      }
      persistSave(this.save);
      this.updateMoney();
      this.showGearReward(gear, previousGear, rewardSource, () => {
        this.activateTab('home');
        this.toast('第二章クリア｜夜の川につながる記録を保存した');
      });
    });
  }

  private gearEffect(gear: GearData): string {
    if (gear.level === 1) return '基本性能。操作の癖をそのまま感じられる。';
    if (gear.category === 'rod') return `テンション上昇を約${Math.round(gear.control * 105)}%抑える`;
    if (gear.category === 'float') return `本アタリの受付を約${Math.round(gear.control * 900)}ms延長`;
    return `合わせの受付を約${Math.round(gear.control * 900)}ms延長し、魚を疲れさせる`;
  }

  private showGearReward(gear: GearData, previousGearId: string, source: string, onClose?: () => void): void {
    const overlay = this.query('#overlay');
    const previous = GEAR.find((item) => item.id === previousGearId) ?? gear;
    const asset = gear.asset ? `<img src="${gear.asset}" alt="${gear.name}">` : `<b class="gear-fallback">${CATEGORY_NAMES[gear.category]}</b>`;
    overlay.innerHTML = `<div class="reward-dimmer"><section class="gear-reward"><div class="reward-rays"></div><i class="reward-spark s1"></i><i class="reward-spark s2"></i><i class="reward-spark s3"></i><p class="reward-source">${source}</p><div class="reward-art">${asset}</div><small>${CATEGORY_NAMES[gear.category]}　LV.${gear.level}</small><h2>${gear.name}</h2><p class="reward-description">${gear.description}</p><div class="reward-effect"><span>GEAR EFFECT</span><b>${this.gearEffect(gear)}</b></div><div class="reward-compare"><span>${previous.name}</span><i>▶</i><strong>${gear.name}</strong></div><div class="reward-actions"><button id="reward-later" class="reward-secondary">あとで</button><button id="reward-equip" class="primary">この道具を使う</button></div></section></div>`;
    const close = (equip: boolean) => {
      this.save.equipped[gear.category] = equip ? gear.id : previousGearId;
      persistSave(this.save);
      this.scene?.setEquipment(this.save.equipped.rod, this.save.equipped.float);
      overlay.innerHTML = '';
      sfx(equip ? 'buy' : 'tap');
      onClose?.();
      if (!onClose) {
        this.renderShop();
        this.toast(equip ? `${gear.name}を装備した` : `${gear.name}を道具箱へしまった`);
      }
    };
    overlay.querySelector('#reward-equip')?.addEventListener('click', () => close(true));
    overlay.querySelector('#reward-later')?.addEventListener('click', () => close(false));
  }

  private failFishing(message: string): void {
    cancelAnimationFrame(this.fightFrame);
    cancelAnimationFrame(this.landingFrame);
    cancelAnimationFrame(this.lureFrame);
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
    cancelAnimationFrame(this.lureFrame);
    this.clearTimers();
    this.scene?.setMood('idle');
    this.phase = 'idle';
    this.pendingFish = undefined;
    this.pendingCatch = undefined;
    this.pendingPower = 1;
    this.fightState = undefined;
    this.isReeling = false;
    this.query('#dock').classList.remove('fight-mode','landing-mode');
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
    this.query('#dock').innerHTML = `<div class="section-heading"><div><small>FIELD NOTE</small><h2>魚類観測図鑑</h2></div><div class="completion"><b>${Math.round(found/FISH_LIST.length*100)}%</b><span>${found} / ${FISH_LIST.length} 種</span></div></div>
      <div class="book-layout"><div class="fish-list">${FISH_LIST.map((item, index) => { const known = this.save.records[item.id]; return `<button data-fish="${item.id}" class="${item.id===fish.id?'selected':''} ${known?'':'unknown'}"><span>${known ? String(index+1).padStart(2,'0') : '??'}</span><b>${known ? item.name : '未観測'}</b><small>${known ? `${known.maxSize.toFixed(1)}cm` : '——'}</small></button>`; }).join('')}</div>
      <article class="fish-entry ${record?'':'silhouette'}"><div class="entry-visual">${record ? `<img src="${fish.sprite}" alt="${fish.name}"><span aria-label="魚種の希少度">${'★'.repeat(fish.rarity)}${'☆'.repeat(4-fish.rarity)}</span>` : '<div class="unknown-specimen" aria-label="未観測の魚"><i>?</i><b></b><b></b></div>'}</div><small>${record ? `NO.${String(FISH_LIST.indexOf(fish)+1).padStart(2,'0')}` : 'UNREGISTERED'}</small><h3>${record ? fish.name : '未観測'}</h3><p>${record ? fish.description : '釣り上げるまで、名前も大きさも分からない。水面の気配を頼りに探してみよう。'}</p>${record ? `<dl><div><dt>希少度</dt><dd>${'★'.repeat(fish.rarity)}${'☆'.repeat(4-fish.rarity)} <small>地域内での出会いにくさ</small></dd></div><div><dt>推奨釣具</dt><dd>調査装備 Lv.${recommendedTackleLevel(fish.rarity)} <small>満たすと遭遇点UP</small></dd></div><div><dt>生息域</dt><dd>${fish.habitat.map((id) => STAGES[id].name).join('・')}</dd></div><div><dt>サイズ域</dt><dd>${fish.minSize}–${fish.maxSize} cm</dd></div><div><dt>好物</dt><dd>${fish.preferredBaits.join('・')}</dd></div><div><dt>狙い目</dt><dd>${distanceNames[fish.distancePreference]}</dd></div><div><dt>最大記録</dt><dd>${record.maxSize.toFixed(1)} cm</dd></div><div><dt>捕獲数</dt><dd>${record.count} 匹</dd></div><div><dt>初観測</dt><dd>${STAGES[record.firstStage].name}</dd></div></dl><div class="rank-stamps">${rankLabels.map((rank) => `<i class="${record.ranks.includes(rank as never)?'on':''}">${rank}</i>`).join('')}</div>` : ''}</article></div>`;
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-fish]').forEach((button) => button.addEventListener('click', () => { this.selectedBook = button.dataset.fish as typeof this.selectedBook; this.renderBook(); }));
  }

  private renderShop(): void {
    const basketValue = this.save.basket.reduce((sum, item) => sum + item.value, 0);
    const visibleGear = GEAR;
    const gold = '<i class="gold-coin" aria-hidden="true"></i>';
    const baitShelf = (Object.keys(BAITS) as BaitId[]).filter((baitId) => !BAITS[baitId].reusable).map((baitId) => {
      const bait = BAITS[baitId];
      const locked = this.save.chapter < bait.unlockChapter;
      const stock = bait.reusable ? '永久' : `所持 ${this.save.baitStock[baitId as keyof SaveData['baitStock']]}個`;
      const price = locked ? '第一章で入荷' : bait.reusable ? '何度でも使用可' : `${gold}${bait.price} G / ${bait.bundle}個`;
      return `<button data-buy-bait="${baitId}" class="bait-item ${bait.reusable ? 'reusable' : ''}" ${locked || bait.reusable ? 'disabled' : ''}><span class="bait-pixel"><img src="${bait.asset}" alt=""></span><span><b>${bait.name}</b><small>${bait.description}</small><em>${stock}</em></span><strong>${price}</strong></button>`;
    }).join('');
    this.query('#dock').innerHTML = `<div class="shop-head"><div class="shopkeeper"><span>釣</span></div><div><small>月波釣具店　店主・鵜沢</small><p>「道具は腕を助ける。でも、魚を見るのは君だよ」</p></div><div class="shop-tools"><strong class="shop-wallet">${gold}<span id="money">${this.save.money.toLocaleString()}</span><small>G</small></strong><button id="shop-tackle-box" class="tiny-button">所持品・装備</button></div></div>
      <button id="sell" class="sell-button" ${this.save.basket.length ? '' : 'disabled'}><span>釣果をまとめて売る <small>${this.save.basket.length}匹</small></span><strong>${gold}+ ${basketValue} G</strong></button>
      <section class="bait-shop"><h3>エサ・仕掛け <small>エサは着水時に1個消費</small></h3><div class="bait-shelf">${baitShelf}</div></section>
      <div class="gear-grid">${(['rod','float','hook'] as GearCategory[]).map((category) => `<section><h3>${CATEGORY_NAMES[category]}</h3>${visibleGear.filter((gear) => gear.category === category).map((gear) => { const owned = this.save.ownedGear.includes(gear.id); const equipped = this.save.equipped[category] === gear.id; const locked = this.save.chapter < gear.unlockChapter; const unlockLabel = gear.id === 'float-2' ? '第一章報酬' : gear.id === 'rod-2' ? '第二章報酬' : ['序章','第一章','第二章','第三章','第四章'][gear.unlockChapter] ?? `第${gear.unlockChapter}章`; const art = `<img src="${gear.asset}" alt="">`; return `<button data-gear="${gear.id}" class="gear ${equipped?'equipped':''} ${locked?'locked':''}" ${locked?'disabled':''}><div class="gear-icon">${art}<i>Lv.${gear.level}</i></div><span><b>${gear.name}</b><small>${gear.description}</small></span><em>${locked?unlockLabel:equipped?'装備中':owned?'装備する':`${gold}${gear.price} G`}</em></button>`; }).join('')}</section>`).join('')}</div>`;
    this.root.querySelector('#shop-tackle-box')?.addEventListener('click', () => this.openTackleBox());
    this.root.querySelector('#sell')?.addEventListener('click', () => { const earned = sellBasket(this.save); persistSave(this.save); this.updateMoney(); sfx('buy'); this.toast(`${earned} G で買い取ってもらった`); this.renderShop(); });
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-buy-bait]').forEach((button) => button.addEventListener('click', () => {
      const baitId = button.dataset.buyBait as BaitId;
      const result = buyBait(this.save, baitId);
      if (result === 'poor') return this.toast('所持金が足りない');
      if (result === 'locked') return this.toast('物語を進めると入荷します');
      if (result === 'reusable') return this.toast('ルアーは何度でも使える');
      persistSave(this.save);
      sfx('buy');
      this.toast(`${BAITS[baitId].name}を${BAITS[baitId].bundle}個購入した`);
      this.renderShop();
    }));
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-gear]').forEach((button) => button.addEventListener('click', () => {
      const gear = GEAR.find((item) => item.id === button.dataset.gear);
      if (!gear) return this.toast('道具の情報を読み込めませんでした');
      const previousGear = this.save.equipped[gear.category];
      const result = buyOrEquip(this.save, gear.id);
      if (result === 'poor') return this.toast('所持金が足りない');
      if (result === 'locked') return this.toast('物語を進めると入荷します');
      persistSave(this.save);
      this.updateMoney();
      this.scene?.setEquipment(this.save.equipped.rod, this.save.equipped.float);
      sfx('buy');
      if (result === 'bought') return this.showGearReward(gear, previousGear, 'NEW TACKLE｜月波釣具店');
      this.toast('装備を変更した');
      this.renderShop();
    }));
    if (this.save.chapter === 1 && !this.hasFlag('uzawa-intro-seen') && !this.query('#overlay').innerHTML) {
      this.playStory('tackleShopIntro', () => {
        completeTackleShopVisit(this.save);
        persistSave(this.save);
        this.renderShop();
        this.toast('青葉渓流への調査ルートと川虫5個を入手した');
      });
    }
  }

  private renderMap(): void {
    this.query('#dock').innerHTML = `<div class="section-heading"><div><small>FIELD MAP</small><h2>調査地点を選ぶ</h2></div><button id="settings" class="tiny-button">設定</button></div><p class="map-guide">地図のピン、または下の目的地を選択すると移動します。</p><div class="map-route">${Object.values(STAGES).map((stage, index) => { const open = this.save.unlockedStages.includes(stage.id); const active = stage.id === this.save.activeStage; const route = stage.id === 'campus-river' ? '研究室から徒歩3分' : stage.id === 'mountain-stream' ? '上流バス下車後、山道へ' : '海岸線バス下車後、河口へ'; const unknown = stage.id === 'tsukinami-port' ? '未調査の河口' : '未調査の上流'; return `<button data-stage="${stage.id}" class="stage-card ${active?'active':''} ${open?'':'locked'}" ${open?'':'disabled'}><i>${index+1}</i><span><small>${route}</small><b>${open?stage.name:unknown}</b><em>${active?'現在地':open?'ここへ移動':'調査条件が必要'}</em></span></button>`; }).join('')}</div>`;
    this.query('#dock').querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((button) => button.addEventListener('click', () => {
      this.travelTo(button.dataset.stage as StageId);
    }));
    this.root.querySelector('#settings')?.addEventListener('click', () => this.showSettings());
  }

  private travelTo(id: StageId): void {
    if (!this.save.unlockedStages.includes(id)) return this.toast('物語を進めると、このルートを調査できます');
    this.save.activeStage = id;
    this.fishingSpot = id === 'tsukinami-port' ? 'harbor-wall' : 'rapid';
    this.scene?.setStage(id);
    this.scene?.setFishingSpot(this.fishingSpot);
    sfx('tap');
    const hasArrivalStory = id === 'mountain-stream' && !this.hasFlag('stream-arrival-seen');
    const hasDeepPoolStory = id === 'mountain-stream' && this.hasFlag('deep-pool-open') && !this.hasFlag('deep-pool-clue-seen');
    const hasPortArrivalStory = id === 'tsukinami-port' && !this.hasFlag('port-arrival-seen');
    persistSave(this.save);
    this.activateTab('fish');
    if (!hasArrivalStory && !hasDeepPoolStory && !hasPortArrivalStory) this.toast(`${STAGES[id].name}へ移動した`);
  }

  private showSettings(): void {
    const overlay = this.query('#overlay');
    overlay.innerHTML = `<section class="settings-card"><h2>設定・セーブ</h2><p>進行は操作のたびにブラウザへ自動保存されます。</p><dl><div><dt>章</dt><dd>${this.save.chapter === 0 ? '序章' : this.save.chapter === 1 ? '第一章' : this.save.chapter === 2 ? '第二章' : '第二章クリア'}</dd></div><div><dt>総捕獲</dt><dd>${this.save.totalCaught}匹</dd></div><div><dt>図鑑</dt><dd>${Object.keys(this.save.records).length}/${FISH_LIST.length}種</dd></div></dl><button id="close-settings" class="primary">ゲームへ戻る</button><button id="replay-prologue" class="tiny-button replay-prologue">冒頭「最初の遭遇」を再生</button><button id="erase" class="danger-button">セーブデータを消去</button></section>`;
    overlay.querySelector('#close-settings')?.addEventListener('click', () => overlay.innerHTML = '');
    overlay.querySelector('#replay-prologue')?.addEventListener('click', () => this.playFirstEncounter());
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
