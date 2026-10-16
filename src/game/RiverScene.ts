import Phaser from 'phaser';
import type { StageId } from '../types';
import { FISHING_BACKGROUND_ASSETS, fishingSpotVisual, type FishingSpotId } from '../data/fishingSpots';

export type WaterMood = 'idle' | 'cast' | 'waiting' | 'nibble' | 'bite' | 'fight' | 'splash';

export class RiverScene extends Phaser.Scene {
  private stageId: StageId = 'campus-river';
  private mood: WaterMood = 'idle';
  private bobber?: Phaser.GameObjects.Container;
  private line?: Phaser.GameObjects.Graphics;
  private ripples: Phaser.GameObjects.Ellipse[] = [];
  private fishShadow?: Phaser.GameObjects.Ellipse;
  private waterLines: Phaser.GameObjects.Rectangle[] = [];
  private ambientPixels: Phaser.GameObjects.Rectangle[] = [];
  private castX = 205;
  private castY = 215;
  private fishingSpot: FishingSpotId = 'rapid';

  constructor() { super('river'); }

  preload(): void {
    FISHING_BACKGROUND_ASSETS.forEach(({ key, asset }) => this.load.image(key, asset));
  }

  create(): void {
    this.drawWorld();
    this.scale.on('resize', () => undefined);
    this.events.emit('ready');
  }

  update(time: number, delta: number): void {
    this.waterLines.forEach((line, index) => {
      line.x = 190 + Math.sin(time / (800 + index * 80) + index) * (28 + index * 3);
    });
    if (this.bobber) {
      const force = this.mood === 'bite' ? 11 : this.mood === 'nibble' ? 4 : 1.6;
      this.bobber.y += Math.sin(time / (this.mood === 'bite' ? 80 : 260)) * force * .075;
      if (this.mood === 'bite') this.bobber.angle = Math.sin(time / 65) * 14;
    }
    if (this.fishShadow && this.mood === 'fight') {
      this.fishShadow.x = this.castX + Math.sin(time / 260) * 72;
      this.fishShadow.alpha = .18 + Math.sin(time / 190) * .08;
    }
    this.ripples.forEach((ripple, index) => {
      const p = (time / 1300 + index * .35) % 1;
      ripple.setScale(.4 + p * 1.4).setAlpha((1 - p) * .35);
    });
    this.ambientPixels.forEach((pixel, index) => {
      const kind = pixel.getData('kind') as string;
      if (kind === 'fall') {
        pixel.y += delta * (.018 + (index % 3) * .004);
        pixel.x += Math.sin(time / 150 + index) * .08;
        if (pixel.y > 202) pixel.setPosition(246 + (index * 29) % 122, 118 + (index % 4) * 5);
      } else if (kind === 'leaf') {
        pixel.x += delta * .012;
        pixel.y += Math.sin(time / 260 + index) * .13;
        pixel.angle = (pixel.angle + delta * .025) % 90;
        if (pixel.x > 405) pixel.setPosition(-8, 82 + (index * 31) % 165);
      } else {
        pixel.setAlpha(.12 + (Math.sin(time / 420 + index) + 1) * .12);
        pixel.setScale(.65 + (Math.sin(time / 600 + index) + 1) * .18, 1);
      }
    });
  }

  setStage(stageId: StageId): void {
    if (this.stageId === stageId) return;
    this.stageId = stageId;
    this.redrawWorld();
  }

  setFishingSpot(spot: FishingSpotId): void {
    if (this.fishingSpot === spot) return;
    this.fishingSpot = spot;
    this.redrawWorld();
  }

  private redrawWorld(): void {
    this.children.removeAll(true);
    this.waterLines = [];
    this.ripples = [];
    this.ambientPixels = [];
    this.drawWorld();
  }

  setMood(mood: WaterMood, castPower = .55): void {
    this.mood = mood;
    this.castX = 92 + castPower * 220;
    this.castY = 252 - castPower * 70;
    if (!this.bobber || !this.line || !this.fishShadow) return;
    const visible = mood !== 'idle' && mood !== 'cast';
    this.bobber.setVisible(visible).setPosition(this.castX, this.castY);
    this.line.setVisible(visible).clear();
    if (visible) this.line.lineStyle(1.5, 0xfff1c5, .9).lineBetween(372, 104, this.castX, this.castY - 9);
    this.ripples.forEach((r) => r.setPosition(this.castX, this.castY + 12).setVisible(visible));
    this.fishShadow.setPosition(this.castX, this.castY + 32);
    this.fishShadow.setVisible(mood === 'fight');
    if (mood === 'splash') this.makeSplash();
  }

  private drawWorld(): void {
    const stream = this.stageId === 'mountain-stream';
    const port = this.stageId === 'tsukinami-port';
    const deepPool = stream && this.fishingSpot === 'deep-pool';
    const visual = fishingSpotVisual(this.stageId, this.fishingSpot);
    this.add.image(195, 150, visual.key).setDisplaySize(390, 300).setDepth(0);
    if (visual.overlayColor && visual.overlayAlpha) {
      this.add.rectangle(0, 0, 390, 300, visual.overlayColor, visual.overlayAlpha).setOrigin(0).setDepth(1);
    }

    // The source painting supplies the environment; these sparse highlights are
    // separate so the water still feels alive instead of behaving like wallpaper.
    const waterStart = visual.waterStart;
    for (let i = 0; i < 5; i++) {
      const line = this.add.rectangle(190, waterStart + i * 27, 35 + (i % 4) * 22, i % 3 === 0 ? 2 : 1, visual.waterColor, deepPool ? .22 : stream ? .18 : port ? .28 : .2).setDepth(2);
      this.waterLines.push(line);
    }
    if (stream) {
      const fallCount = deepPool ? 6 : this.fishingSpot === 'edge' ? 4 : 14;
      for (let i = 0; i < fallCount; i++) {
        const fall = this.add.rectangle(246 + (i * 29) % 122, 118 + (i % 5) * 13, i % 3 === 0 ? 4 : 2, 5 + i % 4, 0xdcfff7, .42).setDepth(2);
        fall.setData('kind', 'fall');
        this.ambientPixels.push(fall);
      }
      for (let i = 0; i < 6; i++) {
        const leaf = this.add.rectangle(15 + i * 68, 72 + (i * 37) % 154, 3, 2, i % 2 ? 0xd58b3b : 0x8fb652, .75).setDepth(4).setAngle(i * 13);
        leaf.setData('kind', 'leaf');
        this.ambientPixels.push(leaf);
      }
    } else if (port) {
      for (let i = 0; i < 14; i++) {
        const glint = this.add.rectangle(30 + (i * 61) % 345, 152 + (i * 37) % 136, 8 + i % 5 * 6, i % 4 === 0 ? 2 : 1, i % 3 ? 0xffa75f : 0xe7d09c, .22).setDepth(2);
        glint.setData('kind', 'glint');
        this.ambientPixels.push(glint);
      }
      for (let i = 0; i < 3; i++) {
        const gull = this.add.rectangle(250 + i * 34, 55 + i * 11, 7, 2, 0xffdfbd, .65).setDepth(4).setAngle(i % 2 ? 18 : -18);
        gull.setData('kind', 'leaf');
        this.ambientPixels.push(gull);
      }
    } else {
      for (let i = 0; i < 10; i++) {
        const glint = this.add.rectangle(25 + (i * 73) % 355, 166 + (i * 29) % 122, 9 + i % 4 * 5, i % 4 === 0 ? 2 : 1, 0xffcb67, .2).setDepth(2);
        glint.setData('kind', 'glint');
        this.ambientPixels.push(glint);
      }
    }
    this.add.rectangle(0, 293, 390, 7, 0x0b2333, .72).setOrigin(0).setDepth(9);

    this.line = this.add.graphics().setDepth(7).setVisible(false);
    this.fishShadow = this.add.ellipse(205, 240, 96, 18, 0x071c29, .3).setDepth(3).setVisible(false);
    this.bobber = this.add.container(205, 215, [
      this.add.rectangle(0, -14, 4, 18, 0xf3eee0),
      this.add.rectangle(0, -21, 4, 10, 0xe65645),
      this.add.ellipse(0, 0, 14, 25, 0xf3eee0).setStrokeStyle(3, 0x172c37),
      this.add.rectangle(0, -5, 11, 8, 0xe65645),
    ]).setDepth(8).setVisible(false);
    for (let i = 0; i < 3; i++) this.ripples.push(this.add.ellipse(205, 328, 38, 12).setStrokeStyle(2, visual.rippleColor).setDepth(5).setVisible(false));
    const labelWidth = Math.min(236, Math.max(174, visual.title.length * 17 + 28));
    this.add.rectangle(10, 10, labelWidth, 49, 0x091c28, .78).setOrigin(0).setStrokeStyle(1, visual.labelBorder, .8).setDepth(9);
    this.add.text(18, 15, visual.title, {
      fontFamily:'-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
      fontStyle:'700',
      fontSize:'17px',
      color:'#fff4cf',
      shadow:{ offsetX:1, offsetY:1, color:'#091923', blur:0, stroke:false, fill:true },
    }).setResolution(3).setDepth(10);
    this.add.text(18, 40, visual.subtitle, {
      fontFamily:'-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
      fontStyle:'600',
      fontSize:'10px',
      color:stream ? '#bfe6d0' : port ? '#ffc89a' : '#ffd78a',
    }).setResolution(3).setDepth(10);
  }

  private makeSplash(): void {
    for (let i = 0; i < 13; i++) {
      const drop = this.add.rectangle(this.castX, this.castY + 12, 3 + Math.random() * 4, 3 + Math.random() * 5, 0xe9fbf4).setDepth(12);
      this.tweens.add({ targets:drop, x:this.castX - 60 + Math.random()*120, y:this.castY - 62 + Math.random()*36, alpha:0, scale:.2, duration:500 + Math.random()*350, ease:'Quad.out', onComplete:() => drop.destroy() });
    }
  }
}
