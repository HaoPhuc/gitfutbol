import type { StatKey, Stats } from "../scoring/types";
import type { SlotRole } from "./formations";
import type { PlacedPlayer, TeamPlayer } from "./lineup";

// The shared team engine, part three: how a team plays. Five tendencies on a
// 0-100 scale, read from the players' stats and the shape of the formation, roll
// up into two axes (patient or direct, fall back or press) and so into one of
// four styles. GitHub has no match data, so this reads what a team is built to
// do, not what it did.
//
// Tendencies weigh one set of stats against another, the same idea as the card
// archetypes: a stronger team isn't more direct or more pressing just for being
// stronger. Each stat counts from a typical starter's (TYPICAL_STATS), because
// the raw scales differ: real cards run far higher on SHO than on DEF, so raw
// gaps would make every team direct.

export type TendencyKey = "buildup" | "width" | "attack" | "pressing" | "block";
export type Tendencies = Record<TendencyKey, number>;

// The two ends of each tendency, 0 then 100, for the UI.
export const TENDENCY_ENDS: Record<TendencyKey, { label: string; low: string; high: string }> = {
  buildup: { label: "Buildup", low: "Patient", high: "Direct" },
  width: { label: "Width", low: "Central", high: "Wide" },
  attack: { label: "Attack", low: "Combine", high: "Finish" },
  pressing: { label: "Pressing", low: "Hold shape", high: "Press" },
  block: { label: "Block", low: "Deep", high: "High" },
};

export type StyleName = "High Control" | "Slow Burn" | "Full Throttle" | "Hit and Run";

export interface TeamStyle {
  name: StyleName;
  blurb: string;
  tendencies: Tendencies;
  directness: number; // 0 patient .. 100 direct
  pressing: number; // 0 fall back .. 100 press
}

const BLURBS: Record<StyleName, string> = {
  "High Control": "keeps the ball and wins it back high up the pitch",
  "Slow Burn": "keeps the ball and stays compact without it",
  "Full Throttle": "goes forward fast and presses straight after losing it",
  "Hit and Run": "sits deep and breaks at speed",
};

export const STYLE_AT = {
  minOutfield: 3, // fewer players than this don't make a style
  neutral: 50,
  statScale: 2.5, // tendency points per stat point of lean
  typicalWide: 0.3, // share of outfield slots a middling formation plays wide
  widthPerShare: 100, // width points per share of outfield slots above that
  blockPerDefender: 12, // block points per defender fewer than a back four
} as const;

// Mean stats of the outfield players who make an auto-picked XI, from random
// pools of real cards sampled down the leaderboard (89 players, Oct 2026), which
// spreads teams across all four styles. Re-measure as the registry grows: a change
// here shifts every team.
export const TYPICAL_STATS: Stats = { pac: 71, sho: 85, pas: 70, dri: 70, def: 56, phy: 82 };

const WIDE_ROLES: readonly SlotRole[] = ["LW", "RW", "LWB", "RWB", "LFB", "RFB"];

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const average = (players: TeamPlayer[], keys: StatKey[]) => mean(players.flatMap((p) => keys.map((k) => p.stats[k])));

// A group's lean toward `high` stats over `low` ones, each from its typical value.
const aboveTypical = (players: TeamPlayer[], keys: StatKey[]) =>
  average(players, keys) - mean(keys.map((k) => TYPICAL_STATS[k]));
const lean = (players: TeamPlayer[], high: StatKey[], low: StatKey[]) =>
  players.length
    ? STYLE_AT.neutral + STYLE_AT.statScale * (aboveTypical(players, high) - aboveTypical(players, low))
    : STYLE_AT.neutral;

export function teamStyle(placed: PlacedPlayer[]): TeamStyle | null {
  const field = placed.flatMap(({ slot, player }) => (player && slot.role !== "GK" ? [{ slot, player }] : []));
  if (field.length < STYLE_AT.minOutfield) return null;

  const playersOn = (...lines: string[]) => field.filter(({ slot }) => lines.includes(slot.line)).map((f) => f.player);
  const back = playersOn("DEF", "MID");
  const front = playersOn("MID", "FWD");
  const defenders = playersOn("DEF");

  // The formation sets most of the width, then quick wide players stretch it.
  const wide = field.filter(({ slot }) => WIDE_ROLES.includes(slot.role)).map((f) => f.player);
  const width =
    STYLE_AT.neutral +
    STYLE_AT.widthPerShare * (wide.length / field.length - STYLE_AT.typicalWide) +
    (wide.length
      ? STYLE_AT.statScale *
        (average(wide, ["pac"]) -
          average(
            field.map((f) => f.player),
            ["pac"],
          ))
      : 0);

  // A back five sits deeper than a back three whoever plays there; a quick back
  // line can hold a higher one than a slow, strong one.
  const defenderSlots = placed.filter(({ slot }) => slot.line === "DEF").length;
  const block = lean(defenders, ["pac"], ["def"]) + STYLE_AT.blockPerDefender * (4 - defenderSlots);

  const tendencies: Tendencies = {
    buildup: clamp(lean(back, ["pac", "phy"], ["pas", "dri"])),
    width: clamp(width),
    attack: clamp(lean(front, ["sho", "pac"], ["pas", "dri"])),
    pressing: clamp(lean(front, ["pac", "phy", "def"], ["sho", "pas"])),
    block: clamp(block),
  };

  const directness = clamp(mean([tendencies.buildup, tendencies.attack]));
  const pressing = clamp(mean([tendencies.pressing, tendencies.block]));
  const direct = directness >= STYLE_AT.neutral;
  const press = pressing >= STYLE_AT.neutral;
  const name: StyleName = direct ? (press ? "Full Throttle" : "Hit and Run") : press ? "High Control" : "Slow Burn";
  return { name, blurb: BLURBS[name], tendencies, directness, pressing };
}
