import { FISH } from '../data/fish';
import type { AquariumKind, AquariumResident, ShrineRewardId } from '../types';

interface SwimmingFish {
  resident: AquariumResident;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  cruiseSpeed: number;
  direction: 1 | -1;
  facing: number;
  phase: number;
  depth: number;
  targetY: number;
  verticalSpeed: number;
  behavior: 'calm' | 'sprinter' | 'diver' | 'power' | 'trickster';
}

export class AquariumView {
  private readonly context: CanvasRenderingContext2D;
  private readonly width = 344;
  private readonly height = 232;
  private readonly swimmers: SwimmingFish[];
  private frame = 0;
  private lastTime = 0;
  private selectedUid?: string;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    residents: AquariumResident[],
    private readonly kind: AquariumKind,
    private readonly decorations: ShrineRewardId[],
    private readonly onSelect: (resident: AquariumResident) => void,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Aquarium canvas is unavailable');
    this.context = context;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = this.width * dpr;
    canvas.height = this.height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;
    this.swimmers = residents.map((resident, index) => this.createSwimmer(resident, index));
    canvas.addEventListener('pointerdown', this.handlePointer);
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  private createSwimmer(resident: AquariumResident, index: number): SwimmingFish {
    const fish = FISH[resident.fishId];
    const image = new Image();
    image.src = fish.sprite;
    const speciesScale = Math.min(1, Math.max(0, Math.log2(fish.maxSize / 12) / 3));
    const specimenScale = .86 + (resident.size - fish.minSize) / (fish.maxSize - fish.minSize) * .24;
    const width = Math.round((62 + speciesScale * 54) * specimenScale);
    const speedFactor = fish.behavior === 'sprinter' ? 1.25 : fish.behavior === 'calm' ? .7 : fish.behavior === 'power' ? .82 : 1;
    return {
      resident,
      image,
      x:42 + (index * 67) % 265,
      y:58 + (index * 43) % 112,
      width,
      height:Math.round(width * .5),
      speed:(13 + (index % 3) * 3) * speedFactor,
      cruiseSpeed:(13 + (index % 3) * 3) * speedFactor,
      direction:index % 2 ? -1 : 1,
      facing:index % 2 ? -1 : 1,
      phase:index * 1.37,
      depth:.72 + (index % 3) * .12,
      targetY:58 + (index * 43) % 112,
      verticalSpeed:fish.behavior === 'diver' ? 7 : fish.behavior === 'sprinter' ? 5 : 3,
      behavior:fish.behavior,
    };
  }

  private readonly handlePointer = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * this.width;
    const y = (event.clientY - rect.top) / rect.height * this.height;
    const hit = [...this.swimmers].reverse().find((fish) => Math.abs(x - fish.x) <= fish.width * .52 && Math.abs(y - fish.y) <= fish.height * .58);
    if (!hit) return;
    this.selectedUid = hit.resident.uid;
    this.onSelect(hit.resident);
  };

  private tick(time: number): void {
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, .05) : 0;
    this.lastTime = time;
    this.update(dt, time / 1000);
    this.draw(time / 1000);
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }

  private update(dt: number, time: number): void {
    this.swimmers.forEach((fish) => {
      const pulse = Math.sin(time * .72 + fish.phase);
      const burst = fish.behavior === 'sprinter'
        ? .72 + Math.pow(Math.max(0, Math.sin(time * 1.45 + fish.phase)), 3) * .78
        : fish.behavior === 'trickster'
          ? .72 + Math.abs(Math.sin(time * .58 + fish.phase)) * .52
          : fish.behavior === 'power'
            ? .82 + pulse * .12
            : .78 + pulse * .2;
      fish.speed += (fish.cruiseSpeed * burst - fish.speed) * Math.min(1, dt * 2.4);
      fish.x += fish.speed * fish.direction * dt;
      fish.facing += (fish.direction - fish.facing) * Math.min(1, dt * 5.5);
      const verticalRange = fish.behavior === 'diver' ? 42 : fish.behavior === 'trickster' ? 27 : 18;
      fish.targetY = 114 + Math.sin(time * (fish.behavior === 'diver' ? .34 : .19) + fish.phase) * verticalRange;
      fish.y += Math.sign(fish.targetY - fish.y) * Math.min(Math.abs(fish.targetY - fish.y), fish.verticalSpeed * dt);
      const margin = fish.width * .47 + 8;
      if (fish.x > this.width - margin) { fish.x = this.width - margin; fish.direction = -1; }
      if (fish.x < margin) { fish.x = margin; fish.direction = 1; }
    });
  }

  private draw(time: number): void {
    const ctx = this.context;
    const fresh = this.kind === 'freshwater';
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, fresh ? '#88c8b9' : '#70aeb7');
    gradient.addColorStop(.42, fresh ? '#397f78' : '#326d7b');
    gradient.addColorStop(1, fresh ? '#153e45' : '#183849');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = fresh ? '#d8efe055' : '#f4d49a55';
    for (let index = 0; index < 7; index++) {
      const x = Math.round(((index * 71 + time * (5 + index % 2)) % 410) - 35);
      ctx.fillRect(x, 16 + index * 21, 36 + index % 3 * 13, index % 2 ? 1 : 2);
    }

    this.drawShrineBackdrop(time);
    this.drawPlants(time, fresh);
    [...this.swimmers].sort((a,b) => a.depth - b.depth).forEach((fish) => this.drawFish(fish, time));
    this.drawBubbles(time);
    this.drawGravel(fresh);
    this.drawShrineDecorations(time);
    ctx.strokeStyle = '#061923';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, this.width - 6, this.height - 6);
    ctx.strokeStyle = '#d9ba6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, this.width - 14, this.height - 14);
  }

  private drawFish(fish: SwimmingFish, time: number): void {
    const ctx = this.context;
    const bob = Math.sin(time * (1.1 + fish.speed / 35) + fish.phase) * 2;
    const roll = Math.sin(time * .8 + fish.phase) * .015;
    const turnScale = Math.max(.12, Math.abs(fish.facing));
    const direction = fish.facing < 0 ? -1 : 1;
    const tailRate = 3.3 + fish.speed / 8;
    const tailAmplitude = fish.behavior === 'calm' ? .075 : fish.behavior === 'power' ? .1 : .14;
    const tailAngle = Math.sin(time * tailRate + fish.phase) * tailAmplitude * direction;

    ctx.save();
    ctx.globalAlpha = fish.depth * .25;
    ctx.fillStyle = '#061f28';
    const shadowWidth = Math.round(fish.width * (.28 + fish.depth * .18));
    ctx.fillRect(Math.round(fish.x - shadowWidth / 2), 198 + Math.round((1 - fish.depth) * 7), shadowWidth, 3);
    ctx.restore();

    ctx.save();
    ctx.translate(Math.round(fish.x), Math.round(fish.y + bob));
    ctx.rotate(roll * direction);
    ctx.scale(direction * turnScale, 1);
    ctx.globalAlpha = fish.depth;
    if (this.selectedUid === fish.resident.uid) {
      ctx.fillStyle = '#ffe29a88';
      ctx.fillRect(-fish.width/2 - 3, fish.height/2 + 3, fish.width + 6, 2);
    }
    if (fish.image.complete && fish.image.naturalWidth > 0) {
      this.drawArticulatedFish(fish, tailAngle);
    }
    ctx.restore();
  }

  private drawArticulatedFish(fish: SwimmingFish, tailAngle: number): void {
    const ctx = this.context;
    const sourceWidth = fish.image.naturalWidth;
    const sourceHeight = fish.image.naturalHeight;
    const tailEnd = .31;
    const bodyStart = .25;
    const attachX = -fish.width / 2 + fish.width * tailEnd;

    ctx.save();
    ctx.translate(attachX, 0);
    ctx.rotate(tailAngle);
    ctx.drawImage(
      fish.image,
      0, 0, sourceWidth * tailEnd, sourceHeight,
      -fish.width * tailEnd, -fish.height / 2, fish.width * tailEnd, fish.height,
    );
    ctx.restore();

    ctx.drawImage(
      fish.image,
      sourceWidth * bodyStart, 0, sourceWidth * (1 - bodyStart), sourceHeight,
      -fish.width / 2 + fish.width * bodyStart, -fish.height / 2,
      fish.width * (1 - bodyStart), fish.height,
    );
  }

  private drawPlants(time: number, fresh: boolean): void {
    const ctx = this.context;
    const colors = fresh ? ['#214f42','#39704f','#6b8752'] : ['#244a48','#45695d','#817b4e'];
    [22,39,301,320].forEach((x, plant) => {
      for (let segment = 0; segment < 5; segment++) {
        const sway = Math.round(Math.sin(time * .7 + plant + segment * .4) * 3);
        ctx.fillStyle = colors[(plant + segment) % colors.length];
        ctx.fillRect(x + sway, 190 - segment * 15, 5, 18);
        ctx.fillRect(x + sway + (segment % 2 ? -8 : 5), 190 - segment * 15, 10, 4);
      }
    });
  }

  private hasDecoration(id: ShrineRewardId): boolean {
    return this.decorations.includes(id);
  }

  private drawShrineBackdrop(time: number): void {
    if (!this.hasDecoration('crescent-panel')) return;
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = .7;
    ctx.fillStyle = '#142d3b';
    ctx.fillRect(112, 25, 120, 75);
    ctx.fillStyle = '#b58b4c';
    ctx.fillRect(108, 21, 128, 5);
    ctx.fillRect(108, 100, 128, 5);
    ctx.fillRect(108, 26, 5, 74);
    ctx.fillRect(231, 26, 5, 74);
    ctx.fillStyle = '#245f6d';
    ctx.fillRect(118, 31, 108, 64);
    ctx.fillStyle = '#d8ddbd';
    const glow = 1 + Math.round(Math.sin(time * .8) * 1);
    ctx.fillRect(159, 42, 29 + glow, 6);
    ctx.fillRect(177, 48, 9, 9);
    ctx.fillRect(171, 57, 10, 8);
    ctx.fillRect(161, 64, 12, 6);
    ctx.restore();
  }

  private drawShrineDecorations(time: number): void {
    const ctx = this.context;
    if (this.hasDecoration('driftwood')) {
      ctx.fillStyle = '#3c3328';
      ctx.fillRect(113, 191, 101, 10);
      ctx.fillRect(132, 181, 48, 12);
      ctx.fillRect(177, 175, 10, 20);
      ctx.fillStyle = '#765c38';
      ctx.fillRect(119, 187, 83, 6);
      ctx.fillRect(137, 180, 39, 5);
    }
    if (this.hasDecoration('river-grass')) {
      [83,94,105,116].forEach((x, index) => {
        const sway = Math.round(Math.sin(time * .9 + index) * 3);
        ctx.fillStyle = index % 2 ? '#4f8054' : '#2f674d';
        ctx.fillRect(x + sway, 169 - index % 2 * 8, 5, 38 + index % 2 * 8);
        ctx.fillRect(x + sway - 6, 175 - index * 3, 12, 4);
      });
    }
    if (this.hasDecoration('moon-stone')) {
      ctx.fillStyle = '#526b69';
      ctx.fillRect(220, 185, 45, 19);
      ctx.fillRect(228, 178, 30, 8);
      ctx.fillStyle = '#9caaa0';
      ctx.fillRect(228, 182, 28, 15);
      ctx.fillStyle = '#e4e4c7';
      ctx.fillRect(247, 181, 5, 5);
      ctx.fillRect(242, 186, 7, 5);
      ctx.fillRect(236, 191, 8, 4);
    }
    if (this.hasDecoration('bubble-flask')) {
      ctx.fillStyle = '#c7e0d0';
      ctx.fillRect(279, 176, 26, 27);
      ctx.fillRect(285, 164, 14, 14);
      ctx.fillStyle = '#4a8d87';
      ctx.fillRect(283, 187, 18, 14);
      ctx.fillStyle = '#d8ad5d';
      ctx.fillRect(283, 161, 18, 6);
      ctx.strokeStyle = '#e5f2d8cc';
      ctx.lineWidth = 2;
      for (let index = 0; index < 4; index++) {
        const y = 163 - ((time * (9 + index) + index * 13) % 49);
        ctx.strokeRect(290 + (index % 2) * 6, Math.round(y), 3 + index % 2, 3 + index % 2);
      }
    }
    if (this.hasDecoration('shrine-lantern')) {
      ctx.fillStyle = '#405857';
      ctx.fillRect(27, 184, 35, 20);
      ctx.fillRect(35, 159, 19, 27);
      ctx.fillRect(28, 155, 33, 7);
      ctx.fillStyle = '#d3a84d';
      ctx.fillRect(40, 165, 10, 12);
      ctx.fillStyle = `rgba(255,221,117,${.55 + Math.sin(time * 1.6) * .12})`;
      ctx.fillRect(36, 162, 18, 18);
      ctx.fillStyle = '#f5db7d';
      ctx.fillRect(41, 166, 9, 10);
    }
  }

  private drawBubbles(time: number): void {
    const ctx = this.context;
    ctx.strokeStyle = '#d7f1e899';
    ctx.lineWidth = 2;
    for (let index = 0; index < 9; index++) {
      const y = 196 - ((time * (8 + index % 3 * 3) + index * 29) % 180);
      const x = 44 + (index * 91) % 260 + Math.sin(time + index) * 3;
      const size = 2 + index % 3;
      ctx.strokeRect(Math.round(x), Math.round(y), size, size);
    }
  }

  private drawGravel(fresh: boolean): void {
    const ctx = this.context;
    ctx.fillStyle = fresh ? '#6d6c50' : '#77705c';
    ctx.fillRect(7, 204, this.width - 14, 21);
    const colors = fresh ? ['#8b825b','#555c4b','#b39b66'] : ['#9b8c68','#555d5d','#bea576'];
    for (let index = 0; index < 46; index++) {
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(10 + (index * 37) % 326, 205 + (index * 11) % 17, 5 + index % 5, 3 + index % 3);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.canvas.removeEventListener('pointerdown', this.handlePointer);
  }
}
