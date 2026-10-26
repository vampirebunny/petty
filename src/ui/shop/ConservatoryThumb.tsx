import { SvgXml } from 'react-native-svg';

const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300">
  <defs>
    <pattern id="gxScale" width="16" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(13.5)">
      <rect width="16" height="11" fill="#F7A6CC"/>
      <path d="M0 5 A8 8 0 0 0 16 5" stroke="#E27FAD" stroke-width="1.6" fill="none"/>
      <path d="M-8 10.5 A8 8 0 0 0 8 10.5 M8 10.5 A8 8 0 0 0 24 10.5" stroke="#E27FAD" stroke-width="1.6" fill="none"/>
    </pattern>
    <linearGradient id="gxRoofSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.45"/><stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#C2537F" stop-opacity="0.18"/></linearGradient>
    <radialGradient id="gxGlow" cx="0.62" cy="0.75" r="0.75"><stop offset="0" stop-color="#FFE9C7"/><stop offset="0.55" stop-color="#FFF4E6"/><stop offset="1" stop-color="#F6FBFF"/></radialGradient>
    <linearGradient id="gxGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CBEBFF" stop-opacity="0.55"/><stop offset="1" stop-color="#CBEBFF" stop-opacity="0.18"/></linearGradient>
    <linearGradient id="gxStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4EA"/><stop offset="1" stop-color="#EBCDB4"/></linearGradient>
    <linearGradient id="gxVelvet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9DAFF"/><stop offset="1" stop-color="#B597EC"/></linearGradient>
    <linearGradient id="gxGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#E3A324"/></linearGradient>
    <linearGradient id="gxPot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC4E1"/><stop offset="1" stop-color="#F48BBE"/></linearGradient>
    <linearGradient id="gxLeaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B8F0C8"/><stop offset="1" stop-color="#5FBF84"/></linearGradient>

    <!-- used by the pet's OUTSIDE copy while crossing the door (section 4c):
         everything outside the house silhouette, plus the door opening -->
    <clipPath id="gxOutsideClip">
      <path clip-rule="evenodd" d="M-1000 -1000 H1360 V1300 H-1000 Z
        M70 216 L70 116 L135 64 L235 88 L300 140 L300 240 L170 240 Z
        M106 224.6 L106 170 C106 146 142 155 142 178.6 L142 233.3 Z"/>
    </clipPath>
  </defs>

  <!-- ===================== HOUSE BACK ===================== -->
  <g id="houseBack">
    <ellipse cx="192" cy="266" rx="168" ry="12" fill="#EBB9D1" opacity="0.55"/>

    <!-- warm interior and the far walls -->
    <path id="interiorGlow" d="M70 216 L70 116 L135 64 L235 88 L300 140 L300 240 L170 240 Z" fill="url(#gxGlow)"/>
    <path d="M70 116 L135 64 L200 116 L200 216 L300 240 M70 216 L200 216" stroke="#E9DCCF" stroke-width="2.5" stroke-linejoin="round" fill="none"/>

    <!-- framed portrait on the back wall -->
    <g data-detail="true">
      <rect x="124" y="140" width="22" height="26" rx="3" fill="#FFFFFF" stroke="url(#gxGold)" stroke-width="3" transform="skewY(14)"/>
      <path d="M130 175 q5 -6 10 0" stroke="#F48BBE" stroke-width="2.5" stroke-linecap="round" fill="none" transform="skewY(14) translate(0 -14)"/>
    </g>

    <!-- little chandelier -->
    <g id="chandelier" data-detail="true">
      <line x1="214" y1="90" x2="214" y2="104" stroke="#D9A23A" stroke-width="1.6"/>
      <path d="M200 106 Q214 118 228 106" stroke="url(#gxGold)" stroke-width="3" stroke-linecap="round" fill="none"/>
      <line x1="214" y1="104" x2="214" y2="114" stroke="#D9A23A" stroke-width="2"/>
      <circle cx="200" cy="104" r="3.4" fill="#FFF3C4"/>
      <circle cx="214" cy="100" r="3.4" fill="#FFF3C4"/>
      <circle cx="228" cy="104" r="3.4" fill="#FFF3C4"/>
      <circle id="chandelierGlow" cx="214" cy="104" r="16" fill="#FFE7A8" opacity="0.35"/>
    </g>

    <!-- velvet cushion with gold piping -->
    <ellipse cx="228" cy="228" rx="68" ry="14" fill="url(#gxVelvet)"/>
    <ellipse cx="228" cy="228" rx="68" ry="14" fill="none" stroke="url(#gxGold)" stroke-width="2.5"/>
    <path d="M180 222 Q228 214 276 222" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.55"/>
  </g>

  <!-- ===================== PET (inside slot) ===================== -->

  <!-- ===================== HOUSE FRONT ===================== -->
  <g id="houseFront">
    <!-- glass: side wall (door cut out) and front gable -->
    <path d="M70 216 L70 116 L170 140 L170 240 Z M106 224.6 L106 170 C106 146 142 155 142 178.6 L142 233.3 Z" fill="url(#gxGlass)" fill-rule="evenodd"/>
    <path d="M170 240 L170 140 L235 88 L300 140 L300 240 Z" fill="url(#gxGlass)"/>

    <!-- reflections -->
    <path d="M184 232 L206 184" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
    <path d="M198 236 L210 210" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
    <path d="M276 190 L292 158" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
    <path d="M76 204 L90 150" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
    <path d="M150 214 L162 176" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.5"/>

    <!-- gold glazing bars -->
    <line x1="156" y1="236.6" x2="156" y2="136.6" stroke="url(#gxGold)" stroke-width="3"/>
    <path d="M70 150 L106 158.6 M142 167.3 L170 174" stroke="url(#gxGold)" stroke-width="3" stroke-linecap="round"/>
    <line x1="202" y1="240" x2="202" y2="114.4" stroke="url(#gxGold)" stroke-width="3"/>
    <line x1="235" y1="240" x2="235" y2="146" stroke="url(#gxGold)" stroke-width="3"/>
    <line x1="268" y1="240" x2="268" y2="114.4" stroke="url(#gxGold)" stroke-width="3"/>
    <path d="M170 176 L300 176" stroke="url(#gxGold)" stroke-width="3"/>
    <path d="M170 176 Q186 158 202 176 Q218 158 235 176 Q251 158 268 176 Q284 158 300 176" stroke="url(#gxGold)" stroke-width="2.5" fill="none"/>

    <!-- cream frame (outline + fill stroke) -->
    <path d="M70 216 L70 116 L170 140 L170 240 M300 240 L300 140 L235 88 L170 140" stroke="#E7C9AA" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
    <path d="M70 216 L70 116 L170 140 L170 240 M300 240 L300 140 L235 88 L170 140" stroke="#FFFCF6" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" fill="none"/>

    <!-- arched side door frame -->
    <path d="M106 224.6 L106 170 C106 146 142 155 142 178.6 L142 233.3" stroke="#E7C9AA" stroke-width="10" stroke-linecap="round" fill="none"/>
    <path d="M106 224.6 L106 170 C106 146 142 155 142 178.6 L142 233.3" stroke="#FFFCF6" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path data-detail="true" d="M110 166 C112 152 136 158 138 176" stroke="url(#gxGold)" stroke-width="2.5" stroke-linecap="round" fill="none"/>

    <!-- corner posts with gold caps -->
    <rect x="164" y="134" width="12" height="110" rx="5" fill="#FFFCF6" stroke="#E7C9AA" stroke-width="2"/>
    <rect x="161" y="130" width="18" height="8" rx="3" fill="url(#gxGold)"/>
    <rect x="294" y="134" width="12" height="110" rx="5" fill="#FFFCF6" stroke="#E7C9AA" stroke-width="2"/>
    <rect x="291" y="130" width="18" height="8" rx="3" fill="url(#gxGold)"/>
    <rect x="64" y="110" width="12" height="108" rx="5" fill="#FFFCF6" stroke="#E7C9AA" stroke-width="2"/>
    <rect x="61" y="106" width="18" height="8" rx="3" fill="url(#gxGold)"/>

    <!-- round gable window with gold paw crest -->
    <circle cx="235" cy="128" r="16" fill="#FFFCF6" stroke="#E7C9AA" stroke-width="2"/>
    <circle cx="235" cy="128" r="12" fill="url(#gxGold)" stroke="#D9961A" stroke-width="1.5"/>
    <ellipse cx="235" cy="131" rx="4.3" ry="3.5" fill="#B8770F"/>
    <circle cx="230" cy="126" r="1.9" fill="#B8770F"/>
    <circle cx="233.3" cy="123.2" r="1.9" fill="#B8770F"/>
    <circle cx="236.7" cy="123.2" r="1.9" fill="#B8770F"/>
    <circle cx="240" cy="126" r="1.9" fill="#B8770F"/>

    <!-- stone base -->
    <path d="M64 228 L64 214 L170 239 L170 254 Z" fill="url(#gxStone)"/>
    <path d="M168 238 L308 238 L308 254 L168 254 Z" fill="url(#gxStone)"/>
    <path data-detail="true" d="M64 221 L170 246.5 M168 246 L308 246 M100 222.6 L100 237 M136 231 L136 245.5 M204 238 L204 246 M240 246 L240 254 M276 238 L276 246" stroke="#DDBB9E" stroke-width="1.5" fill="none"/>

    <!-- stone steps up to the door -->
    <path d="M96 228 L150 241 L146 248 L90 235 Z" fill="url(#gxStone)" stroke="#DDBB9E" stroke-width="1.2"/>
    <path d="M88 238 L152 253 L148 261 L80 246 Z" fill="url(#gxStone)" stroke="#DDBB9E" stroke-width="1.2"/>
    <path d="M100 232 L144 242.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.7"/>

    <!-- wall lantern -->
    <g id="lantern">
      <path d="M90 160 L96 160" stroke="url(#gxGold)" stroke-width="2.5" stroke-linecap="round"/>
      <circle id="lanternGlow" cx="88" cy="172" r="12" fill="#FFE7A8" opacity="0.45"/>
      <path d="M83 164 L93 164 L95 178 L81 178 Z" fill="#FFF6D6" stroke="url(#gxGold)" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M81 164 L88 158 L95 164 Z" fill="url(#gxGold)"/>
      <rect x="82" y="178" width="12" height="3" rx="1.5" fill="url(#gxGold)"/>
    </g>

    <!-- scalloped shingle roof -->
    <path d="M240 82 L140 58 L60 124 L160 148 Z" fill="url(#gxScale)"/>
    <path d="M240 82 L140 58 L60 124 L160 148 Z" fill="url(#gxRoofSheen)"/>
    <path d="M160 148 L60 124" stroke="#E27FAD" stroke-width="4" stroke-linecap="round"/>
    <path d="M240 82 L312 146" stroke="#F48BBE" stroke-width="12" stroke-linecap="round"/>
    <path d="M162 146 L240 84 L310 146" stroke="#FFFCF6" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
    <path d="M168 141 L240 90 L304 141" stroke="url(#gxGold)" stroke-width="2" stroke-linejoin="round" fill="none"/>
    <line x1="240" y1="82" x2="140" y2="58" stroke="url(#gxGold)" stroke-width="6" stroke-linecap="round"/>
    <circle cx="242" cy="80" r="5" fill="url(#gxGold)"/>
    <circle cx="138" cy="57" r="4.5" fill="url(#gxGold)"/>
    <path d="M240 86 L240 98" stroke="url(#gxGold)" stroke-width="2.5"/>
    <circle cx="240" cy="100" r="3" fill="url(#gxGold)"/>
    <path d="M150 64 L230 84" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.5"/>

    <!-- glass cupola -->
    <rect x="179" y="46" width="24" height="24" rx="3" fill="#FFFCF6" stroke="#E7C9AA" stroke-width="2"/>
    <rect x="184" y="50" width="14" height="16" rx="2" fill="#CBEBFF"/>
    <line x1="191" y1="50" x2="191" y2="66" stroke="url(#gxGold)" stroke-width="1.5"/>
    <path d="M187 62 L194 52" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <path d="M174 48 Q191 22 208 48 Z" fill="url(#gxPot)"/>
    <path d="M181 42 Q186 32 194 30" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.7"/>
    <rect x="173" y="46" width="36" height="4" rx="2" fill="url(#gxGold)"/>
    <circle cx="191" cy="28" r="3" fill="url(#gxGold)"/>

    <!-- weathervane -->
    <g data-detail="true">
      <line x1="191" y1="28" x2="191" y2="8" stroke="#D9A23A" stroke-width="2"/>
      <path d="M181 14 L201 14" stroke="#D9A23A" stroke-width="2" stroke-linecap="round"/>
      <path d="M201 10 L207 14 L201 18 Z" fill="#E3A324"/>
      <path d="M181 10 L177 10 L179 14 L177 18 L181 18 Z" fill="#E3A324"/>
    </g>

    <!-- topiaries in pink pots -->
    <path d="M30 254 L54 254 L50 270 L34 270 Z" fill="url(#gxPot)"/>
    <rect x="28" y="250" width="28" height="6" rx="3" fill="#F48BBE"/>
    <line x1="42" y1="250" x2="42" y2="230" stroke="#B9875A" stroke-width="3"/>
    <circle cx="42" cy="220" r="15" fill="url(#gxLeaf)"/>
    <path d="M33 214 Q37 208 44 207" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6"/>
    <path d="M316 240 L342 240 L338 258 L320 258 Z" fill="url(#gxPot)"/>
    <rect x="314" y="236" width="30" height="6" rx="3" fill="#F48BBE"/>
    <line x1="329" y1="236" x2="329" y2="214" stroke="#B9875A" stroke-width="3"/>
    <circle cx="329" cy="203" r="16" fill="url(#gxLeaf)"/>
    <path d="M319 197 Q323 190 331 189" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6"/>

    <!-- sparkles: Pet Shop thumbnail only -->
    <g data-thumb="true">
      <path d="M40 70 L43 79 L52 82 L43 85 L40 94 L37 85 L28 82 L37 79 Z" fill="#FFD25E"/>
      <path d="M330 120 L332 126 L338 128 L332 130 L330 136 L328 130 L322 128 L328 126 Z" fill="#FFD25E"/>
      <path d="M300 40 L301.5 45 L306 46.5 L301.5 48 L300 53 L298.5 48 L294 46.5 L298.5 45 Z" fill="#FFC4E1"/>
    </g>
  </g>

  <!-- ===================== PET (outside slot) ===================== -->
</svg>`;

export function ConservatoryThumb({ size }: { size: number }) {
  return <SvgXml xml={xml} width={size} height={size * (300 / 360)} />;
}
