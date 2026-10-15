import { FISH } from '../data/fish';
import type { AquariumKind, AquariumResident } from '../types';

interface SwimmingFish {
  resident: AquariumResident;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  direction: 1 | -1;
  phase: number;
  depth: number;
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
      direction:index % 2 ? -1 : 1,
      phase:index * 1.37,
      depth:.72 + (index % 3) * .12,
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
    this.update(dt);
    this.draw(time / 1000);
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }

  private update(dt: number): void {
    this.swimmers.forEach((fish) => {
      fish.x += fish.speed * fish.direction * dt;
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

    this.drawPlants(time, fresh);
    [...this.swimmers].sort((a,b) => a.depth - b.depth).forEach((fish) => this.drawFish(fish, time));
    this.drawBubbles(time);
    this.drawGravel(fresh);
    ctx.strokeStyle = '#061923';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, this.width - 6, this.height - 6);
    ctx.strokeStyle = '#d9ba6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, this.width - 14, this.height - 14);
  }

  private drawFish(fish: SwimmingFish, time: number): void {
    const ctx = this.context;
    const bob = Math.sin(time * (1.1 + fish.speed / 35) + fish.phase) * 3;
    const roll = Math.sin(time * .8 + fish.phase) * .018;
    ctx.save();
    ctx.translate(Math.round(fish.x), Math.round(fish.y + bob));
    ctx.rotate(roll * fish.direction);
    ctx.scale(fish.direction, 1);
    ctx.globalAlpha = fish.depth;
    if (this.selectedUid === fish.resident.uid) {
      ctx.fillStyle = '#ffe29a88';
      ctx.fillRect(-fish.width/2 - 4, -fish.height/2 - 4, fish.width + 8, fish.height + 8);
    }
    if (fish.image.complete && fish.image.naturalWidth > 0) {
      ctx.drawImage(fish.image, -fish.width/2, -fish.height/2, fish.width, fish.height);
    }
    ctx.restore();
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
