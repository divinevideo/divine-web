export const OVERLAY_LAYERS = {
  floating: "z-50",
  toast: "z-[100]",
  overlay: "z-[200]",
  nestedOverlayFloating: "z-[210]",
} as const;

export const OVERLAY_LAYER_VALUES = {
  floating: 50,
  toast: 100,
  overlay: 200,
  nestedOverlayFloating: 210,
} as const;
