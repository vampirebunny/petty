import { createContext, useContext } from 'react';
import Svg, { Defs, FeColorMatrix, Filter, G, type SvgProps } from 'react-native-svg';

// A view-level `filter: brightness()` on iOS paints a multiply layer over the
// whole box, so transparent corners turn grey. Dim inside the SVG instead.

const brightness = 0.62;
const saturation = 0.85;
const filterId = 'townNight';

function nightMatrix(): number[] {
  const s = saturation;
  const rows = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
  return [...rows.flatMap((row) => [...row.map((v) => +(v * brightness).toFixed(4)), 0, 0]), 0, 0, 0, 1, 0];
}

const matrix = nightMatrix();
const matrixText = matrix.join(' ');

export const NightContext = createContext(false);

export const nightPuff = `rgb(${Math.round(255 * brightness)}, ${Math.round(255 * brightness)}, ${Math.round(255 * brightness)})`;

export function useNight() {
  return useContext(NightContext);
}

export function TownSvg({ children, ...props }: SvgProps) {
  const night = useNight();
  return (
    <Svg {...props}>
      {night ? (
        <>
          <Defs>
            <Filter id={filterId}>
              <FeColorMatrix type="matrix" values={matrix} />
            </Filter>
          </Defs>
          <G filter={`url(#${filterId})`}>{children}</G>
        </>
      ) : (
        children
      )}
    </Svg>
  );
}

export function nightXml(xml: string): string {
  return xml
    .replace(
      /<svg[^>]*>/,
      (open) =>
        `${open}<defs><filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrixText}"/></filter></defs><g filter="url(#${filterId})">`,
    )
    .replace(/<\/svg>\s*$/, '</g></svg>');
}
