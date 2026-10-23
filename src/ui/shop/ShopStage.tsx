import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Rect } from 'react-native-svg';

import type { Equipped, PetState } from '../../sim/types';
import { LedgeCard } from './Glossy';
import { ShopPet } from './ShopPet';
import { shop } from './theme';

const boxW = 358;
const boxH = 196;

type Props = {
  pet: PetState;
  equipped: Equipped;
  reducedMotion: boolean;
  width: number;
};

function jars() {
  const colors = [
    { body: '#B8F5DC', lid: '#6FDDB0' },
    { body: '#DCCFFF', lid: '#9C84E8' },
    { body: '#FFE38F', lid: '#F0B93C' },
  ];
  return colors.map((color, index) => {
    const x = 18 + index * 28;
    return (
      <G key={color.body}>
        <Rect x={x} y={50} width={22} height={26} rx={6} fill={color.body} />
        <Rect x={x - 1} y={46} width={24} height={8} rx={3} fill={color.lid} />
      </G>
    );
  });
}

export function ShopStage({ pet, equipped, reducedMotion, width }: Props) {
  const height = width * (boxH / boxW);
  return (
    <View style={styles.wrap}>
    <LedgeCard face={shop.stage} ledge={shop.cardLedge} radius={26} style={{ height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${boxW} ${boxH}`} preserveAspectRatio="none">
        <Rect x={0} y={0} width={boxW} height={boxH} fill={shop.stage} />
        {Array.from({ length: 12 }, (_, index) => {
          const stripe = boxW / 12;
          const x = index * stripe;
          const color = index % 2 === 0 ? '#FF9FCB' : '#FFFFFF';
          return (
            <G key={index}>
              <Rect x={x} y={0} width={stripe + 0.5} height={16} fill={color} />
              <Circle cx={x + stripe / 2} cy={16} r={15} fill={color} />
            </G>
          );
        })}
        <Rect x={12} y={78} width={88} height={7} rx={3.5} fill="#E8B48C" />
        {jars()}
        <Rect x={258} y={78} width={88} height={7} rx={3.5} fill="#E8B48C" />
        <Circle cx={278} cy={66} r={9} fill="#df5340" />
        <Circle cx={274} cy={63} r={3} fill="#ffffff" opacity={0.7} />
        <Ellipse cx={302} cy={68} rx={14} ry={5} fill="#3a8fd8" />
        <Ellipse cx={302} cy={67} rx={8} ry={2.4} fill="#7cc0f2" />
        <Circle cx={330} cy={64} r={10} fill="#d9628f" />
        <Ellipse cx={330} cy={64} rx={7} ry={3} fill="none" stroke="#a8406a" strokeWidth={1.2} />
        <Rect x={0} y={160} width={boxW} height={boxH - 160} fill="#FFD3E8" />
        <Ellipse cx={179} cy={172} rx={78} ry={11} fill="#FFBEDD" />
      </Svg>
      <ShopPet
        pet={pet}
        equipped={equipped}
        reducedMotion={reducedMotion}
        width={width}
        height={height}
      />
    </LedgeCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
});
