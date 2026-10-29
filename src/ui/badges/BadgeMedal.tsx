import { SvgXml } from 'react-native-svg';

import { badgeSvgXml } from './svgXml';

type Props = {
  id: string;
  size?: number;
};

export function BadgeMedal({ id, size = 56 }: Props) {
  const xml = badgeSvgXml[id];
  if (!xml) {
    return null;
  }
  return <SvgXml xml={xml} width={size} height={size} />;
}
