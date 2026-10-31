import type { Card, Finish } from "@/lib/scoring/types";
import type { RingPalette } from "@/lib/yearRing";

// hex (#rgb / #rrggbb) → rgba() string, so a founder's single accent hex can
// drive translucent glows/tints without hand-writing each alpha variant.
export function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Each finish maps to its Year Ring art (public/cards, scripts/bake-card-art.ts),
// the text ink, a glow for the card's drop-shadow, and the avatar's treatment:
// avatarTint darkens the rim of the photo so it sits in the sun; avatarHalo is
// the glow behind a club crest. `ring` is the palette for the player's Year Ring
// (lib/yearRing), and marks a card as a sun card: circular avatar, ring over the
// art. Founder art has no sun, so founders leave it out and keep the feather.
export interface CardTheme {
  bg: string;
  ink: string;
  glow: string;
  avatarTint: string;
  avatarHalo: string;
  ring?: RingPalette;
}

export const CARD_THEME: Record<Finish, CardTheme> = {
  bronze: {
    bg: "/cards/sun-bronze.webp",
    ink: "#F7D5AC",
    glow: "rgba(220,158,102,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(44,18,50,.55))",
    avatarHalo: "rgba(220,158,102,.4)",
    ring: ["#1D1233", "#5A3636", "#915639", "#DC9E66", "#F7D5AC"],
  },
  silver: {
    bg: "/cards/sun-silver.webp",
    ink: "#F1F3FD",
    glow: "rgba(202,208,232,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(30,26,60,.55))",
    avatarHalo: "rgba(202,208,232,.4)",
    ring: ["#1D1233", "#4F4B6C", "#7B7D9F", "#CAD0E8", "#F1F3FD"],
  },
  gold: {
    bg: "/cards/sun-gold.webp",
    ink: "#FFEDB0",
    glow: "rgba(233,204,116,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(44,22,66,.55))",
    avatarHalo: "rgba(233,204,116,.4)",
    ring: ["#1D1233", "#6A4F2E", "#AF862A", "#E9CC74", "#FFF3C4"],
  },
  totw: {
    bg: "/cards/sun-totw.webp",
    ink: "#FFC8EE",
    glow: "rgba(255,92,200,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(63,14,82,.55))",
    avatarHalo: "rgba(255,92,200,.4)",
    ring: ["#1D1233", "#701A64", "#BA218F", "#FF5CC8", "#FFC8EE"],
  },
  toty: {
    bg: "/cards/sun-toty.webp",
    ink: "#EBD8FF",
    glow: "rgba(154,59,255,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(60,26,128,.55))",
    avatarHalo: "rgba(154,59,255,.4)",
    ring: ["#1D1233", "#471F8B", "#6D2BDA", "#B876FF", "#EBD8FF"],
  },
  icon: {
    bg: "/cards/sun-icon.webp",
    ink: "#FFF3C4",
    glow: "rgba(244,222,148,.5)",
    avatarTint: "radial-gradient(circle, transparent 62%, rgba(75,31,125,.55))",
    avatarHalo: "rgba(244,222,148,.4)",
    ring: ["#1D1233", "#725B3D", "#BD9C47", "#F4DE94", "#FFFBEA"],
  },
  // Fallback only — real founder cards carry per-person art/accent via
  // resolveCardTheme(); this keeps the Record<Finish> map total.
  founder: {
    bg: "/cards/founder-red.png",
    ink: "#f6f8fb",
    glow: "rgba(255,47,69,.55)",
    avatarTint: "radial-gradient(ellipse 72% 76% at 52% 40%, transparent 50%, rgba(0,0,0,.30))",
    avatarHalo: "rgba(255,47,69,.42)",
  },
};

// Language logos are full-colour on transparent, and plenty are near-black (Rust),
// so on a dark sun card they sit on this pale plate. In cqw, card width / 100.
export const LOGO_PLATE = { background: "#F4EFFB", padding: 1, radius: 1.6 };

// Per-card theme: identical to CARD_THEME for everyone except founders, who get
// their own art, a near-white ink, and a glow/halo derived from their accent.
export function resolveCardTheme(card: Card): CardTheme {
  const base = CARD_THEME[card.finish];
  if (!card.founder) return base;
  const a = card.founder.accent;
  return {
    bg: card.founder.art,
    ink: card.founder.ink ?? "#f6f8fb",
    glow: rgba(a, 0.55),
    avatarTint: "radial-gradient(ellipse 72% 76% at 52% 40%, transparent 50%, rgba(0,0,0,.30))",
    avatarHalo: rgba(a, 0.42),
  };
}

export interface ResultTheme {
  glow: string;
  chip: string;
  ink: string;
}

export const RESULT_THEME: Record<Finish, ResultTheme> = {
  bronze: { glow: "rgba(190,120,60,.34)", chip: "#2A1A0C", ink: "#F0CFA8" },
  silver: { glow: "rgba(170,188,210,.34)", chip: "#262B33", ink: "#D6DCE6" },
  gold: { glow: "rgba(225,185,80,.4)", chip: "#3A2806", ink: "#F3D679" },
  totw: { glow: "rgba(255,92,200,.42)", chip: "#3F0E52", ink: "#FFC8EE" },
  toty: { glow: "rgba(154,59,255,.5)", chip: "#2B1259", ink: "#D2A7FF" },
  icon: { glow: "rgba(243,213,128,.45)", chip: "#2A1A45", ink: "#F3D688" },
  founder: { glow: "rgba(255,47,69,.4)", chip: "#221016", ink: "#ff6273" },
};

// Per-card result accent: founders tint the whole scout report to their own
// accent (red for Younes, chrome for Mawsis); everyone else uses RESULT_THEME.
export function resolveResultTheme(card: Card): ResultTheme {
  const base = RESULT_THEME[card.finish];
  if (!card.founder) return base;
  return { ink: card.founder.accent, glow: rgba(card.founder.accent, 0.34), chip: base.chip };
}

// ---- Duel kit clash: TOTY vs silver, and nothing else ----
// Those tiers' inks are both pale (toty #D2A7FF vs silver #D6DCE6), so in that
// one matchup nothing side-coded on the Duel (names, bars, radars, scoreboard)
// says whose color is whose. The fix is surgical, only for this pairing: the
// TOTY side swaps its pale ink for the tier's own saturated purple — the color
// its ring already wears — so it reads MORE toty, and silver stays silver.
// Every other matchup keeps its true tier inks.
const TOTY_KIT: ResultTheme = { ink: "#B876FF", glow: RESULT_THEME.toty.glow, chip: RESULT_THEME.toty.chip };

export function duelThemes(challenger: Card, opponent: Card): { home: ResultTheme; away: ResultTheme } {
  const home = resolveResultTheme(challenger);
  const away = resolveResultTheme(opponent);
  if (challenger.finish === "toty" && opponent.finish === "silver") return { home: TOTY_KIT, away };
  if (challenger.finish === "silver" && opponent.finish === "toty") return { home, away: TOTY_KIT };
  return { home, away };
}

// Confetti palette per tier — gold for prestige, green always woven in (brand).
// Founders burst in their own accent. Consumed by the card reveal (the Duel
// deliberately keeps its full time clean — no confetti).
const CONFETTI: Partial<Record<Finish, string[]>> = {
  toty: ["#e9cc74", "#d4af37", "#b876ff", "#ffffff", "#39d353"],
  icon: ["#e9cc74", "#d4af37", "#f5f0e1", "#ffffff", "#39d353"],
  totw: ["#39d353", "#e9cc74", "#ffffff", "#ff5cc8"],
};

export function confettiPalette(card: Card): string[] {
  if (card.founder) return [card.founder.accent, "#ffffff", "#39d353"];
  return CONFETTI[card.finish] ?? ["#39d353", "#e9cc74", "#ffffff"];
}
