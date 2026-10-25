import { SvgXml } from 'react-native-svg';

const thumbs: Record<string, string> = {
  bed_cloud_puff: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cpPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC4E1"/><stop offset="1" stop-color="#F48BBE"/></linearGradient>
      <linearGradient id="cpLilac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E8FF"/><stop offset="1" stop-color="#D6BEF5"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="186" rx="116" ry="9" fill="#E9BBD3" opacity="0.6"/>
    <ellipse cx="140" cy="118" rx="118" ry="46" fill="url(#cpPink)"/>
    <path d="M54 96 Q140 66 226 96" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.55"/>
    <ellipse cx="140" cy="124" rx="92" ry="30" fill="#FFE1EF"/>
    <ellipse cx="140" cy="130" rx="84" ry="21" fill="url(#cpLilac)"/>
    <path d="M92 124 Q140 116 188 124" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.6"/>
    <circle cx="46" cy="146" r="25" fill="url(#cpPink)"/>
    <circle cx="234" cy="146" r="25" fill="url(#cpPink)"/>
    <circle cx="92" cy="158" r="27" fill="url(#cpPink)"/>
    <circle cx="188" cy="158" r="27" fill="url(#cpPink)"/>
    <circle cx="140" cy="162" r="28" fill="url(#cpPink)"/>
  </svg>`,
  bed_bone_sofa: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bsMint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B8F0D8"/><stop offset="1" stop-color="#6FCFA6"/></linearGradient>
      <linearGradient id="bsMintDeep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9BE6C5"/><stop offset="1" stop-color="#57BE93"/></linearGradient>
      <linearGradient id="bsButter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1B0"/><stop offset="1" stop-color="#FFD25E"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="188" rx="112" ry="8" fill="#B5DCCB" opacity="0.7"/>
    <rect x="54" y="166" width="14" height="18" rx="5" fill="#E8A86B"/>
    <rect x="212" y="166" width="14" height="18" rx="5" fill="#E8A86B"/>
    <rect x="52" y="72" width="176" height="70" rx="26" fill="url(#bsMintDeep)"/>
    <rect x="40" y="124" width="200" height="48" rx="20" fill="url(#bsMint)"/>
    <rect x="60" y="114" width="160" height="28" rx="14" fill="#DDFBEE"/>
    <circle cx="102" cy="94" r="13" fill="url(#bsButter)"/>
    <circle cx="102" cy="114" r="13" fill="url(#bsButter)"/>
    <circle cx="178" cy="94" r="13" fill="url(#bsButter)"/>
    <circle cx="178" cy="114" r="13" fill="url(#bsButter)"/>
    <rect x="100" y="92" width="80" height="24" rx="12" fill="url(#bsButter)"/>
    <rect x="26" y="98" width="44" height="76" rx="22" fill="url(#bsMint)"/>
    <rect x="210" y="98" width="44" height="76" rx="22" fill="url(#bsMint)"/>
  </svg>`,
  bed_kitty_cave: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="kcLav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2D2FF"/><stop offset="1" stop-color="#A98BE8"/></linearGradient>
      <linearGradient id="kcPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD0E6"/><stop offset="1" stop-color="#F59BC6"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="186" rx="108" ry="9" fill="#C9B6EA" opacity="0.6"/>
    <path d="M72 84 L60 30 Q58 22 66 26 L112 58 Z" fill="url(#kcLav)"/>
    <path d="M78 72 L70 40 L100 60 Z" fill="url(#kcPink)"/>
    <path d="M208 84 L220 30 Q222 22 214 26 L168 58 Z" fill="url(#kcLav)"/>
    <path d="M202 72 L210 40 L180 60 Z" fill="url(#kcPink)"/>
    <path d="M50 180 Q40 180 40 168 L40 124 C40 48 240 48 240 124 L240 168 Q240 180 230 180 Z" fill="url(#kcLav)"/>
    <ellipse cx="140" cy="140" rx="54" ry="44" fill="#5E4A82"/>
    <ellipse cx="140" cy="140" rx="54" ry="44" fill="none" stroke="#F4ECFF" stroke-width="10"/>
    <ellipse cx="140" cy="172" rx="44" ry="11" fill="url(#kcPink)"/>
  </svg>`,
  bed_moon_cradle: `<svg viewBox="0 0 280 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mcMoon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF2B3"/><stop offset="1" stop-color="#FFC94A"/></linearGradient>
      <linearGradient id="mcPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD6EA"/><stop offset="1" stop-color="#F7A3CB"/></linearGradient>
    </defs>
    <ellipse cx="140" cy="188" rx="120" ry="8" fill="#E6CF8E" opacity="0.6"/>
    <path d="M30 184 Q30 10 140 10 Q250 10 250 184" stroke="#D99A5E" stroke-width="11" stroke-linecap="round" fill="none"/>
    <line x1="140" y1="18" x2="66" y2="94" stroke="#C98C55" stroke-width="2.5"/>
    <line x1="140" y1="18" x2="214" y2="94" stroke="#C98C55" stroke-width="2.5"/>
    <circle cx="140" cy="18" r="5" fill="#C98C55"/>
    <ellipse cx="140" cy="128" rx="60" ry="11" fill="url(#mcPink)"/>
    <path d="M58 92 C58 182 222 182 222 92 C206 146 74 146 58 92 Z" fill="url(#mcMoon)"/>
    <path d="M140 168 L143.5 175 L151 176 L145.5 181 L147 188 L140 184.5 L133 188 L134.5 181 L129 176 L136.5 175 Z" fill="#FFC94A" stroke="#E0A52C" stroke-width="1"/>
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
