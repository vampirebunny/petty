import { SvgXml } from 'react-native-svg';

import { stadiumXml } from './stadiumXml';

const artW = 320;
const artH = 300;

function prepared(xml: string): string {
  return xml
    .replace(/id="wall"/g, 'id="stadiumWall"')
    .replace(/url\(#wall\)/g, 'url(#stadiumWall)')
    .replace(/id="gate"/g, 'id="stadiumGate"')
    .replace(/url\(#gate\)/g, 'url(#stadiumGate)');
}

export function StadiumIcon({ width }: { width: number }) {
  const height = (width * artH) / artW;
  return <SvgXml xml={prepared(stadiumXml)} width={width} height={height} />;
}
