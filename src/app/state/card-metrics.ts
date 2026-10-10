import { Density } from '../core/model/types';

/** Positions and font sizes inside a person card, shared by drawing and measuring. */
export interface CardMetrics {
  /** Where the text column starts. */
  textX: number;
  /** Right padding of the text column. */
  padRight: number;
  shield: { x: number; w: number; h: number; initials: number };
  photo: { r: number };
  given: { size: number; y: number };
  surname: { size: number; y: number };
  dates: { size: number; y: number };
  place: { size: number; y: number };
  /** The relationship line at the top; `shift` moves the other lines down to make room. */
  kin: { size: number; y: number; shift: number };
  radius: number;
}

export const CARD_METRICS: Record<Density, CardMetrics> = {
  comfortable: {
    textX: 50,
    padRight: 10,
    shield: { x: 14, w: 24, h: 28, initials: 10.5 },
    photo: { r: 17 },
    given: { size: 15.5, y: 25 },
    surname: { size: 13.5, y: 42 },
    dates: { size: 11.5, y: 58 },
    place: { size: 11, y: 72 },
    kin: { size: 10.5, y: 18, shift: 12 },
    radius: 5,
  },
  compact: {
    textX: 40,
    padRight: 8,
    shield: { x: 11, w: 20, h: 24, initials: 9 },
    photo: { r: 14 },
    given: { size: 13.5, y: 20 },
    surname: { size: 12, y: 34 },
    dates: { size: 10.5, y: 47 },
    place: { size: 10, y: 60 },
    kin: { size: 9.5, y: 15, shift: 10 },
    radius: 4,
  },
};

export const FONT_SERIF = '"Alegreya Variable", "Alegreya", Georgia, "Times New Roman", serif';
export const FONT_SMALL_CAPS = '"Alegreya SC", "Alegreya Variable", Georgia, serif';
export const FONT_SANS = '"Alegreya Sans", "Segoe UI", system-ui, sans-serif';

export function cardFonts(m: CardMetrics) {
  return {
    given: `500 ${m.given.size}px ${FONT_SERIF}`,
    surname: `500 ${m.surname.size}px ${FONT_SMALL_CAPS}`,
    dates: `400 ${m.dates.size}px ${FONT_SANS}`,
    place: `400 ${m.place.size}px ${FONT_SANS}`,
    kin: `500 ${m.kin.size}px ${FONT_SMALL_CAPS}`,
  };
}

export const UNION_LABEL_FONT = `400 11px ${FONT_SANS}`;

/**
 * The shield behind a person's initials: a heater shield, flat on top and
 * curving to a point.
 */
export function shieldPath(w: number, h: number): string {
  const side = h * 0.42;
  return `M0,0H${w}V${side}C${w},${h * 0.74} ${w * 0.74},${h * 0.92} ${w / 2},${h}C${w * 0.26},${h * 0.92} 0,${h * 0.74} 0,${side}Z`;
}
