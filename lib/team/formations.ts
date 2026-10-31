import { LINE_OF, type Line } from "../lines";
import type { Position } from "../scoring/types";

// The shared team engine, part one: formations as named slots, and how well a
// card's position fits a slot. lib/team/lineup rates a team on top of this. Pure,
// like the scoring engine.

export type SlotRole = Position | "GK";

export interface FormationSlot {
  role: SlotRole;
  line: Line; // the line the slot plays on, which a wide midfielder's card doesn't say
  x: number; // 0 left touchline .. 100 right touchline
  y: number; // 0 own goal .. 100 opposition goal
}

// One row of a formation: its role per slot, left to right.
const row = (line: Line, y: number, ...roles: SlotRole[]): FormationSlot[] =>
  roles.map((role, i) => ({ role, line, y, x: Math.round((100 * (i + 1)) / (roles.length + 1)) }));

const GOAL = row("GK", 5, "GK");
const BACK_FOUR = row("DEF", 24, "LFB", "CB", "CB", "RFB");
const BACK_THREE = row("DEF", 22, "CB", "CB", "CB");
const BACK_FIVE = row("DEF", 24, "LWB", "CB", "CB", "CB", "RWB");

export const FORMATIONS = {
  "4-3-3": [...GOAL, ...BACK_FOUR, ...row("MID", 50, "CM", "CM", "CM"), ...row("FWD", 78, "LW", "ST", "RW")],
  "4-4-2": [...GOAL, ...BACK_FOUR, ...row("MID", 52, "LW", "CM", "CM", "RW"), ...row("FWD", 80, "ST", "ST")],
  "4-2-3-1": [
    ...GOAL,
    ...BACK_FOUR,
    ...row("MID", 42, "CDM", "CDM"),
    ...row("MID", 64, "LW", "CAM", "RW"),
    ...row("FWD", 84, "ST"),
  ],
  "4-1-2-1-2": [
    ...GOAL,
    ...BACK_FOUR,
    ...row("MID", 38, "CDM"),
    ...row("MID", 52, "CM", "CM"),
    ...row("MID", 66, "CAM"),
    ...row("FWD", 82, "ST", "ST"),
  ],
  "3-5-2": [
    ...GOAL,
    ...BACK_THREE,
    ...row("MID", 42, "CDM"),
    ...row("MID", 54, "LWB", "CM", "CM", "RWB"),
    ...row("FWD", 80, "ST", "ST"),
  ],
  "3-4-3": [...GOAL, ...BACK_THREE, ...row("MID", 50, "LWB", "CM", "CM", "RWB"), ...row("FWD", 78, "LW", "ST", "RW")],
  "5-3-2": [...GOAL, ...BACK_FIVE, ...row("MID", 52, "CM", "CDM", "CM"), ...row("FWD", 80, "ST", "ST")],
  "5-4-1": [...GOAL, ...BACK_FIVE, ...row("MID", 54, "LW", "CM", "CM", "RW"), ...row("FWD", 82, "ST")],
} satisfies Record<string, FormationSlot[]>;

export type FormationName = keyof typeof FORMATIONS;
export const FORMATION_NAMES = Object.keys(FORMATIONS) as FormationName[];

// ---- position fit ----------------------------------------------------------------

// natural: their position, on either side. close: a neighbouring role, played
// nearly as well. stretch: the right line, the wrong job. wrong: another line.
export type Fit = "natural" | "close" | "stretch" | "wrong";

// Rating points a player loses by fit; the keeper's slot has its own rule.
export const FIT_PENALTY: Record<Fit, number> = { natural: 0, close: 1, stretch: 3, wrong: 7 };

// Left/right is the user's choice, so a side never counts against a player: the
// engine only emits right-sided codes, and a RW is as natural at LW.
const SIDELESS: Partial<Record<Position, Position>> = { LW: "RW", LWB: "RWB", LFB: "RFB" };
const sideless = (p: Position): Position => SIDELESS[p] ?? p;

const NEIGHBOURS: [Position, Position][] = [
  ["ST", "CF"],
  ["CF", "SS"],
  ["SS", "CAM"],
  ["RW", "CF"],
  ["RW", "SS"],
  ["CAM", "CM"],
  ["CM", "CDM"],
  ["CDM", "CB"],
  ["CB", "RFB"],
  ["RFB", "RWB"],
];
const closeRoles = (a: Position, b: Position) =>
  NEIGHBOURS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// How a card's position fits an outfield slot. A goalkeeper's slot takes anyone:
// the scout has no keepers, so see keeperRating in lib/team/lineup.
export function positionFit(position: Position, role: Position): Fit {
  const a = sideless(position);
  const b = sideless(role);
  if (a === b) return "natural";
  if (closeRoles(a, b)) return "close";
  return LINE_OF[a] === LINE_OF[b] ? "stretch" : "wrong";
}
