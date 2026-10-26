import { SvgXml } from 'react-native-svg';

const thumbs: Record<string, string> = {
  bed_cloud_puff: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mTop" x1="0" y1="132" x2="0" y2="164"><stop offset="0" stop-color="#F2FFF9"/><stop offset="0.6" stop-color="#C4F2DE"/><stop offset="1" stop-color="#94E2C2"/></linearGradient>
      <linearGradient id="mSide" x1="0" y1="150" x2="0" y2="182"><stop offset="0" stop-color="#7DD8B4"/><stop offset="1" stop-color="#43AE88"/></linearGradient>
      <linearGradient id="mPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD3E7"/><stop offset="1" stop-color="#F48DBE"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="186" rx="124" ry="6" fill="#8FC9B2" opacity="0.45"/>
    <rect x="22" y="148" width="236" height="34" rx="17" fill="url(#mSide)"/>
    <rect x="24" y="132" width="232" height="32" rx="16" fill="url(#mTop)"/>
    <path d="M48 138 Q140 131 232 138" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.7"/>
    <path d="M30 156 Q140 170 250 156" stroke="url(#mPink)" stroke-width="5" stroke-linecap="round" fill="none"/>
    <g fill="url(#mPink)"><rect x="129" y="170" width="22" height="6" rx="3"/><circle cx="129" cy="170" r="3.6"/><circle cx="129" cy="176" r="3.6"/><circle cx="151" cy="170" r="3.6"/><circle cx="151" cy="176" r="3.6"/></g>
  </svg>`,
  bed_bone_sofa: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="chTop" x1="0" y1="138" x2="0" y2="162"><stop offset="0" stop-color="#FFF1E8"/><stop offset="0.55" stop-color="#FFD0BC"/><stop offset="1" stop-color="#FFAE92"/></linearGradient>
      <linearGradient id="chSide" x1="0" y1="156" x2="0" y2="176"><stop offset="0" stop-color="#F59A80"/><stop offset="1" stop-color="#D06A52"/></linearGradient>
      <linearGradient id="chArm" x1="0" y1="122" x2="0" y2="170"><stop offset="0" stop-color="#FFE6D9"/><stop offset="0.5" stop-color="#FFB89F"/><stop offset="1" stop-color="#E8806A"/></linearGradient>
      <linearGradient id="chGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A6"/><stop offset="0.5" stop-color="#F4C04A"/><stop offset="1" stop-color="#D99016"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="186" rx="120" ry="6" fill="#E3A994" opacity="0.45"/>
    <path d="M40 172 L54 172 L51 186 L43 186 Z M226 172 L240 172 L237 186 L229 186 Z" fill="url(#chGold)"/>
    <rect x="28" y="156" width="224" height="20" rx="10" fill="url(#chSide)"/>
    <rect x="30" y="138" width="222" height="24" rx="12" fill="url(#chTop)"/>
    <path d="M36 157 Q144 165 250 157" stroke="url(#chGold)" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M26 170 L26 136 Q26 122 42 122 Q58 122 58 136 L58 164 Z" fill="url(#chArm)"/>
    <ellipse cx="42" cy="135" rx="13" ry="12" fill="#FFE3D5" stroke="#F4C04A" stroke-width="3"/>
  </svg>`,
  bed_kitty_cave: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="csL" cx="0.45" cy="0.35" r="0.75"><stop offset="0" stop-color="#FBF7FF"/><stop offset="0.55" stop-color="#DCCBFA"/><stop offset="1" stop-color="#B79BEE"/></radialGradient>
      <radialGradient id="csP" cx="0.45" cy="0.35" r="0.75"><stop offset="0" stop-color="#FFF0F7"/><stop offset="0.55" stop-color="#FFC4DE"/><stop offset="1" stop-color="#F79AC4"/></radialGradient>
      <linearGradient id="csGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A6"/><stop offset="0.5" stop-color="#F4C04A"/><stop offset="1" stop-color="#D99016"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="186" rx="118" ry="6" fill="#B9A3E0" opacity="0.5"/>
    <ellipse cx="140" cy="162" rx="110" ry="16" fill="url(#csL)"/>
    <ellipse cx="152" cy="146" rx="78" ry="12" fill="url(#csP)"/>
    <path d="M74 146 A78 12 0 0 0 230 146" stroke="url(#csGold)" stroke-width="3" fill="none"/>
    <ellipse cx="152" cy="146" rx="5" ry="3.2" fill="#E77FB0"/>
    <path d="M58 176 Q62 174 66 176 L67 184 Q62 186 57 184 Z" fill="url(#csGold)"/>
  </svg>`,
  bed_moon_cradle: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="spTop" x1="0" y1="126" x2="0" y2="156"><stop offset="0" stop-color="#EFFFFC"/><stop offset="0.55" stop-color="#B5EEE6"/><stop offset="1" stop-color="#7FD6CA"/></linearGradient>
      <linearGradient id="spFront" x1="0" y1="150" x2="0" y2="172"><stop offset="0" stop-color="#63C9BC"/><stop offset="1" stop-color="#2F9C90"/></linearGradient>
      <linearGradient id="spGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A6"/><stop offset="0.5" stop-color="#F4C04A"/><stop offset="1" stop-color="#D99016"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="186" rx="120" ry="6" fill="#8CC6BE" opacity="0.45"/>
    <rect x="34" y="176" width="14" height="9" rx="4" fill="#D99016"/>
    <rect x="232" y="176" width="14" height="9" rx="4" fill="#D99016"/>
    <path d="M44 160 L236 160 L254 170 L26 170 Z" fill="#F4C04A"/>
    <path d="M42 150 Q140 160 238 150 Q244 160 236 168 Q140 174 44 168 Q36 160 42 150 Z" fill="url(#spFront)"/>
    <path d="M62 130 Q140 124 218 130 Q232 140 238 150 Q140 160 42 150 Q48 140 62 130 Z" fill="url(#spTop)"/>
    <ellipse cx="140" cy="141" rx="6" ry="3.5" fill="url(#spGold)"/>
    <path d="M42 150 Q140 160 238 150" stroke="url(#spGold)" stroke-width="4" fill="none"/>
  </svg>`,
};

export function bedThumbId(itemId: string): string | null {
  return thumbs[itemId] ? itemId : null;
}

export function BedThumb({ itemId, size }: { itemId: string; size: number }) {
  const xml = thumbs[itemId];
  if (!xml) {
    return null;
  }
  return <SvgXml xml={xml} width={size} height={size * (200 / 280)} />;
}
