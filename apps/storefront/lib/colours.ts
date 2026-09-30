/** Swatch colours for variant colour names. Unknown names fall back to a text label. */
const COLOUR_HEX: Record<string, string> = {
  blush: "#EBC9C4",
  ivory: "#F3ECE0",
  "powder blue": "#C8D7E5",
  sage: "#C3CFBA",
  peach: "#F1D3C1",
  mint: "#CFE2D6",
};

export const colourHex = (name: string): string | undefined => COLOUR_HEX[name.trim().toLowerCase()];

export const uniqueColours = (variants: { colour: string }[]): string[] => [...new Set(variants.map((v) => v.colour))];
