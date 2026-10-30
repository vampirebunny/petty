// Swap the app font here, then point the matching useFonts assets in App.tsx at the new files.
// Text picks up `regular` through the stylesheet install in installDefaultFont.ts.
// Heavier cuts are named faces. A `fontWeight` on top of `regular` does not select them.

export const fontFamily = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
  // Candy buttons, headers, coins, and tooltips. The rest of the app stays on Nunito.
  fredokaSemibold: 'Fredoka_600SemiBold',
  fredokaBold: 'Fredoka_700Bold',
  mono: 'ShareTechMono_400Regular',
} as const;
