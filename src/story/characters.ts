const PORTRAITS = {
  protagonist:'/assets/characters/protagonist-pixel-v1.png',
  morino:'/assets/characters/morino-pixel-v1.png',
  uzawa:'/assets/characters/uzawa-pixel-v1.png',
  isobe:'/assets/characters/isobe-ren-pixel-v1.png',
} as const;

export function storyPortrait(speaker: string): string {
  if (speaker.includes('森野')) return PORTRAITS.morino;
  if (speaker.includes('鵜沢')) return PORTRAITS.uzawa;
  if (speaker.includes('磯部')) return PORTRAITS.isobe;
  return PORTRAITS.protagonist;
}

export function storySpeakerName(speaker: string): string {
  if (speaker === '主人公') return '水瀬 朔';
  if (speaker === '先輩・森野') return '森野 澪';
  if (speaker === '店主・鵜沢') return '鵜沢 源一';
  return speaker;
}
