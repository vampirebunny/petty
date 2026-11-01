import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';

export type StampMotif =
  | 'space'
  | 'sea'
  | 'royal'
  | 'beach'
  | 'winter'
  | 'rock'
  | 'garden'
  | 'spooky'
  | 'west'
  | 'hero'
  | 'pirate'
  | 'safari';

export function StampMotifArt({ motif }: { motif: StampMotif }) {
  switch (motif) {
    case 'space':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M14 23 L8.5 31 L14 30 Z" fill="#F49CC8" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Path d="M26 23 L31.5 31 L26 30 Z" fill="#F49CC8" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Path d="M16.5 30 L20 37.5 L23.5 30 Z" fill="#FFD45E" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Path d="M20 3.5 C27.5 9.5 28.5 20 26.5 30 H13.5 C11.5 20 12.5 9.5 20 3.5 Z" fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Circle cx={20} cy={15.5} r={3.8} fill="#7CE0FF" stroke="#2E2A5A" strokeWidth={2.2} />
        </Svg>
      );
    case 'sea':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M27 20 L37 12.5 L36 27.5 Z" fill="#FFAD7A" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Ellipse cx={17.5} cy={20} rx={12} ry={8.5} fill="#FFD45E" stroke="#2E2A5A" strokeWidth={2.2} />
          <Path d="M19 12.5 Q22 20 19 27.5" fill="none" stroke="#2E2A5A" strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={11.5} cy={18} r={1.8} fill="#2E2A5A" />
          <Circle cx={31} cy={8} r={2.2} fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={1.6} />
          <Circle cx={34.5} cy={3.5} r={1.5} fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={1.4} />
        </Svg>
      );
    case 'royal':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M6 29 L7.5 11 L14.5 19 L20 7.5 L25.5 19 L32.5 11 L34 29 Z" fill="#FFD45E" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Rect x={6} y={29} width={28} height={6} rx={1.5} fill="#F7A9C9" stroke="#2E2A5A" strokeWidth={2.2} />
          <Circle cx={20} cy={22.5} r={2.8} fill="#7CC4F5" stroke="#2E2A5A" strokeWidth={1.8} />
          <Circle cx={7.5} cy={10} r={2} fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={1.6} />
          <Circle cx={20} cy={6.5} r={2} fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={1.6} />
          <Circle cx={32.5} cy={10} r={2} fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={1.6} />
        </Svg>
      );
    case 'beach':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M7 36 Q20 29 33 36 Z" fill="#FFE08A" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Path d="M20 19 V34" stroke="#2E2A5A" strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M4 20 Q20 0 36 20 Z" fill="#FF8A8A" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Path d="M20 5 Q14 11 13 20 L27 20 Q26 11 20 5 Z" fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={1.8} strokeLinejoin="round" />
        </Svg>
      );
    case 'winter':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <G stroke="#2E2A5A" strokeWidth={5.4} strokeLinecap="round" fill="none">
            <Path d="M20 4 V36 M6 12 L34 28 M6 28 L34 12 M15.5 6.5 L20 11 L24.5 6.5 M15.5 33.5 L20 29 L24.5 33.5" />
          </G>
          <G stroke="#BDEBFF" strokeWidth={2.6} strokeLinecap="round" fill="none">
            <Path d="M20 4 V36 M6 12 L34 28 M6 28 L34 12 M15.5 6.5 L20 11 L24.5 6.5 M15.5 33.5 L20 29 L24.5 33.5" />
          </G>
          <Circle cx={20} cy={20} r={4} fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={2} />
        </Svg>
      );
    case 'rock':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M18 22 L33 7" stroke="#2E2A5A" strokeWidth={6.5} strokeLinecap="round" />
          <Path d="M18 22 L33 7" stroke="#FFD45E" strokeWidth={3} strokeLinecap="round" />
          <Rect x={30} y={2} width={7} height={7} rx={1.5} fill="#FFD45E" stroke="#2E2A5A" strokeWidth={2} transform="rotate(45 33.5 5.5)" />
          <Path d="M8 20 C4 24 5 32 10 35 C15 38 21 36 22 31 C23 28 26 27 26 24 C26 20 22 18 19 20 C16 22 12 17 8 20 Z" fill="#FF5FA2" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Circle cx={15} cy={27} r={2.6} fill="#2E2A5A" />
          <Path d="M10 31 L14 35" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'garden':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M20 25 V37" stroke="#2E2A5A" strokeWidth={2.4} strokeLinecap="round" />
          <Ellipse cx={26} cy={31} rx={5} ry={2.6} fill="#7FD3A0" stroke="#2E2A5A" strokeWidth={2} transform="rotate(-30 26 31)" />
          <Circle cx={20} cy={9} r={5.2} fill="#F7A9C9" stroke="#2E2A5A" strokeWidth={2} />
          <Circle cx={27} cy={14} r={5.2} fill="#F7A9C9" stroke="#2E2A5A" strokeWidth={2} />
          <Circle cx={24.3} cy={22} r={5.2} fill="#F7A9C9" stroke="#2E2A5A" strokeWidth={2} />
          <Circle cx={15.7} cy={22} r={5.2} fill="#F7A9C9" stroke="#2E2A5A" strokeWidth={2} />
          <Circle cx={13} cy={14} r={5.2} fill="#F7A9C9" stroke="#2E2A5A" strokeWidth={2} />
          <Circle cx={20} cy={16.5} r={4.4} fill="#FFD45E" stroke="#2E2A5A" strokeWidth={2} />
        </Svg>
      );
    case 'spooky':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M9.5 35 V18 C9.5 10.5 14.5 5 20 5 C25.5 5 30.5 10.5 30.5 18 V35 L27 31.5 L23.5 35 L20 31.5 L16.5 35 L13 31.5 Z" fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Ellipse cx={16} cy={17.5} rx={2} ry={3} fill="#2E2A5A" />
          <Ellipse cx={24} cy={17.5} rx={2} ry={3} fill="#2E2A5A" />
          <Ellipse cx={20} cy={24.5} rx={2.2} ry={1.6} fill="#FFAD7A" />
        </Svg>
      );
    case 'west':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Ellipse cx={20} cy={28} rx={17} ry={5} fill="#C98A66" stroke="#2E2A5A" strokeWidth={2.2} />
          <Path d="M11 28 Q10 12 15.5 12 Q20 16 24.5 12 Q30 12 29 28 Z" fill="#E0A479" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Path d="M11.2 23 Q20 26 28.8 23 L28.6 26.5 Q20 29.5 11.4 26.5 Z" fill="#FF8A5C" stroke="#2E2A5A" strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M15 15 Q14.5 19 15 21" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
        </Svg>
      );
    case 'hero':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Path d="M20 3.5 L33.5 8.5 V19.5 C33.5 28 27.5 33.5 20 36.5 C12.5 33.5 6.5 28 6.5 19.5 V8.5 Z" fill="#7CC4F5" stroke="#2E2A5A" strokeWidth={2.2} strokeLinejoin="round" />
          <Polygon points="22.5,8.5 13.5,22 19.5,22 16.5,31.5 26.5,16.5 20.5,16.5 23.5,8.5" fill="#FFD45E" stroke="#2E2A5A" strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      );
    case 'pirate':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <G stroke="#2E2A5A" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <Path d="M20 11 V34 M13 16 H27 M8 24 Q9 34 20 34 Q31 34 32 24" />
          </G>
          <G stroke="#FFD45E" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <Path d="M20 11 V34 M13 16 H27 M8 24 Q9 34 20 34 Q31 34 32 24" />
          </G>
          <Circle cx={20} cy={7.5} r={3.6} fill="#FFFFFF" stroke="#2E2A5A" strokeWidth={2.2} />
          <Path d="M5 25.5 L8 22 L11 25.5 Z M29 25.5 L32 22 L35 25.5 Z" fill="#FFD45E" stroke="#2E2A5A" strokeWidth={1.8} strokeLinejoin="round" />
        </Svg>
      );
    case 'safari':
      return (
        <Svg viewBox="0 0 40 40" width="100%" height="100%">
          <Circle cx={27} cy={15} r={8} fill="#FFAD7A" stroke="#2E2A5A" strokeWidth={2} />
          <Path d="M17.5 35 L18.8 19 L21.2 19 L22.5 35 Z" fill="#A8784A" stroke="#2E2A5A" strokeWidth={2} strokeLinejoin="round" />
          <Path d="M19 21 L13 16 M21 21 L26 17" stroke="#2E2A5A" strokeWidth={2} strokeLinecap="round" />
          <Ellipse cx={20} cy={14} rx={15.5} ry={5} fill="#7FD3A0" stroke="#2E2A5A" strokeWidth={2.2} />
          <Path d="M5 35.5 H35" stroke="#2E2A5A" strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      );
  }
}
