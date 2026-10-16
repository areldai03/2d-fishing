import { setBgm, sfx, type BgmTheme } from '../audio';
import { STORY } from '../data/story';
import type { StorySceneData } from '../types';
import { storyPortrait, storySpeakerName } from './characters';

export class StoryPlayer {
  constructor(
    private readonly overlay: HTMLElement,
    private readonly returnBgm: () => BgmTheme,
  ) {}

  play(sceneId: string, onComplete?: () => void): void {
    const scene = STORY[sceneId];
    if (!scene) throw new Error(`Unknown story scene: ${sceneId}`);
    setBgm('story');
    if (scene.presentation === 'cinematic') {
      this.playCinematic(scene, onComplete);
      return;
    }
    this.playNovel(scene, onComplete);
  }

  private finish(onComplete?: () => void): void {
    this.overlay.innerHTML = '';
    setBgm(this.returnBgm());
    onComplete?.();
  }

  private playNovel(scene: StorySceneData, onComplete?: () => void): void {
    const lines = scene.lines;
    let index = 0;
    this.overlay.innerHTML = `<section class="story-card story-${scene.backdrop} story-${scene.id}"><div class="story-art"><div class="story-chapter">${scene.title}</div><img class="story-character" src="" alt=""><div class="story-gradient"></div></div><div class="dialogue"><span></span><p></p><div class="dialogue-actions"><button class="story-log">LOG</button><button class="story-next">次へ <kbd>Space</kbd></button></div></div><div id="story-backlog" class="story-backlog hidden"></div></section>`;
    const portraitElement = this.overlay.querySelector<HTMLImageElement>('.story-character')!;
    const dialogue = this.overlay.querySelector<HTMLElement>('.dialogue')!;
    const speakerElement = dialogue.querySelector<HTMLElement>('span')!;
    const textElement = dialogue.querySelector<HTMLElement>('p')!;
    const draw = () => {
      const line = lines[index];
      const portrait = line.portrait ?? storyPortrait(line.speaker);
      const lengthClass = line.text.length >= 48 ? 'long' : '';
      if (portraitElement.getAttribute('src') !== portrait) portraitElement.src = portrait;
      portraitElement.alt = storySpeakerName(line.speaker);
      dialogue.className = `dialogue ${line.tone ?? ''} ${lengthClass}`;
      speakerElement.textContent = storySpeakerName(line.speaker);
      textElement.textContent = line.text;
    };
    const next = () => {
      sfx('tap');
      index++;
      if (index < lines.length) return draw();
      this.finish(onComplete);
    };
    this.overlay.querySelector('.story-next')?.addEventListener('click', next);
    this.overlay.querySelector('.story-art')?.addEventListener('click', next);
    this.overlay.querySelector('.story-log')?.addEventListener('click', () => {
      const backlog = this.overlay.querySelector<HTMLElement>('#story-backlog');
      if (!backlog) return;
      backlog.classList.remove('hidden');
      backlog.innerHTML = `<div><small>DIALOGUE LOG</small><h3>${scene.title}</h3>${lines.slice(0,index+1).map((item) => `<p><b>${storySpeakerName(item.speaker)}</b>${item.text}</p>`).join('')}<button>閉じる</button></div>`;
      backlog.querySelector('button')?.addEventListener('click', () => backlog.classList.add('hidden'));
    });
    draw();
  }

  private playCinematic(scene: StorySceneData, onComplete?: () => void): void {
    const lines = scene.lines;
    let index = 0;
    this.overlay.innerHTML = `<section class="encounter-cinematic"><div class="encounter-image" role="button" aria-label="次へ"><img src="${scene.art}" alt="夕暮れの川と水中の巨大な銀色魚"><div class="encounter-waterline"></div><i class="encounter-bubble b1"></i><i class="encounter-bubble b2"></i><div class="encounter-scan"></div></div><div class="encounter-silhouette hidden"></div><div class="encounter-scene-label"><small>FIRST CONTACT</small><b>${scene.title}</b></div><div class="encounter-caption"><span></span><p></p><div class="encounter-caption-foot"><button class="story-next">次へ <kbd>Space</kbd></button></div></div></section>`;
    const cinematic = this.overlay.querySelector<HTMLElement>('.encounter-cinematic')!;
    const silhouette = this.overlay.querySelector<HTMLElement>('.encounter-silhouette')!;
    const caption = this.overlay.querySelector<HTMLElement>('.encounter-caption')!;
    const speakerElement = caption.querySelector<HTMLElement>('span')!;
    const textElement = caption.querySelector<HTMLElement>('p')!;
    const draw = () => {
      const line = lines[index];
      cinematic.classList.toggle('has-silhouette', Boolean(line.portrait));
      caption.className = `encounter-caption ${line.tone ?? ''}`;
      speakerElement.textContent = storySpeakerName(line.speaker);
      textElement.textContent = line.text;
      silhouette.classList.toggle('hidden', !line.portrait);
      if (line.portrait) silhouette.innerHTML = `<img src="${line.portrait}" alt="${line.speaker}のシルエット">`;
    };
    const next = () => {
      sfx('tap');
      index++;
      if (index < lines.length) return draw();
      this.finish(onComplete);
    };
    this.overlay.querySelector('.story-next')?.addEventListener('click', next);
    this.overlay.querySelector('.encounter-image')?.addEventListener('click', next);
    silhouette.addEventListener('click', next);
    draw();
  }
}
