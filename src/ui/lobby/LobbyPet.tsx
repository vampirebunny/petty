import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { stageHeight, stageWidth } from '../../actor/scenes';
import type { PetState } from '../../sim/types';
import { OutfitPreview, useOutfitClock } from '../OutfitPreview';

// Standing height in world units, feet at actor.y. Used only to pick a zoom.
const petWorldHeight = 130;
// drawPetOnly pins the camera point at 62% of the canvas height.
const cameraAnchor = 0.62;
const actorFootY = 460;

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  /** Feet, from the top of the hero. 1 sits them on the bottom edge. */
  feet: number;
  /** How tall the pet should read, as a fraction of the hero height. */
  size: number;
};

export function LobbyPet({ pet, reducedMotion, feet, size }: Props) {
  const t = useOutfitClock(reducedMotion);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const fit = box.width > 0 && box.height > 0 ? Math.min(box.width / stageWidth, box.height / stageHeight) : 0;
  const zoom = fit > 0 ? (box.height * size) / (fit * petWorldHeight) : 1;
  const scale = fit * zoom;
  const floorY = box.height * feet;
  const cameraY = scale > 0 ? actorFootY - (floorY - box.height * cameraAnchor) / scale : actorFootY;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {box.width > 0 && box.height > 0 ? (
        <OutfitPreview
          breedId={pet.breedId}
          ageDays={pet.ageDays}
          weight={pet.weight}
          vitality={pet.vitality}
          look={pet.look}
          seed={pet.attributes.seed}
          asleep={pet.asleep}
          equipped={pet.equipped}
          width={box.width}
          height={box.height}
          t={t}
          zoom={zoom}
          pose="idle"
          bare
          cameraY={cameraY}
          rounded={false}
        />
      ) : null}
    </View>
  );
}
