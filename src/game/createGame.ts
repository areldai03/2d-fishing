import Phaser from 'phaser';
import { RiverScene } from './RiverScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 390,
    height: 300,
    parent,
    backgroundColor: '#1b3448',
    pixelArt: true,
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [RiverScene],
  });
}
