import type { Line } from "../lines";
import type { Finish, Position, Stats } from "../scoring/types";
import { FIT_PENALTY, FORMATIONS, positionFit, type Fit, type FormationName, type FormationSlot } from "./formations";
import { teamStyle, type TeamStyle } from "./style";

// The shared team engine, part two: a line-up in a formation, and what it adds up
// to. Every team surface (drafted teams, clubs, national squads) rates through
// rateTeam, so strength and chemistry mean the same thing everywhere. Pure.

// What a player needs to take a slot. A registry entry and a Card both fit.
export interface TeamPlayer {
  login: string;
  name: string;
  avatarUrl: string;
  overall: number;
  position: Position;
  finish: Finish;
  stats: Stats;
  country: string; // "" when unknown
  topLanguage?: string | null;
  orgs?: string[]; // lowercase; absent on older registry entries
}

// A line-up: one entry per slot of FORMATIONS[formation], null for an open slot.
export interface Lineup {
  formation: FormationName;
  players: (TeamPlayer | null)[];
}

export const TEAM = {
  maxChemistry: 33,
  playerChemistry: 3,
  // Players sharing a link (the player included) for 1, 2 and 3 chemistry points.
  links: {
    country: [2, 5, 8],
    language: [3, 5, 8],
    org: [2, 4, 7],
  },
  // A club's players all share its org, which would make every club 33/33, so a
  // club's team counts the org link once.
  clubOrgCap: 1,
  chemistryBonus: 3, // strength points a full 33 chemistry adds
} as const;

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// The scout has no keepers, so whoever goes in goal plays on their DEF stat.
export const keeperRating = (p: TeamPlayer) => p.stats.def;

// What a player is worth in a slot, position penalty included.
export function slotRating(p: TeamPlayer, slot: FormationSlot): number {
  if (slot.role === "GK") return keeperRating(p);
  return clamp(p.overall - FIT_PENALTY[positionFit(p.position, slot.role)], 1, 99);
}

// ---- auto-picking a line-up --------------------------------------------------------

// The best eleven of `candidates` for a formation: outfield slots first, each
// going to whoever is worth most there, then the best DEF left over in goal. With
// fewer than eleven the goalkeeper's slot stays open first, so nobody is pulled
// off the field to fill it.
export function autoLineup(candidates: readonly TeamPlayer[], formation: FormationName): Lineup {
  const slots = FORMATIONS[formation];
  const players: (TeamPlayer | null)[] = slots.map(() => null);
  const free = new Set(candidates);

  const offers = slots.flatMap((slot, s) =>
    slot.role === "GK" ? [] : candidates.map((player) => ({ player, s, value: slotRating(player, slot) })),
  );
  // Ties go to the player with the better card, then the login, so a line-up
  // never depends on the order of its candidates.
  offers.sort(
    (a, b) =>
      b.value - a.value ||
      b.player.overall - a.player.overall ||
      a.player.login.toLowerCase().localeCompare(b.player.login.toLowerCase()) ||
      a.s - b.s,
  );
  for (const { player, s } of offers) {
    if (players[s] === null && free.has(player)) {
      players[s] = player;
      free.delete(player);
    }
  }

  const keeperSlot = slots.findIndex((s) => s.role === "GK");
  const keeper = [...free].sort((a, b) => keeperRating(b) - keeperRating(a) || b.overall - a.overall)[0];
  if (keeper) players[keeperSlot] = keeper;
  return { formation, players };
}

// ---- rating a line-up --------------------------------------------------------------

export interface PlacedPlayer {
  slot: FormationSlot;
  player: TeamPlayer | null;
  fit: Fit | null; // null for an open slot and for the keeper, who has no position to fit
  rating: number | null; // slotRating
  chemistry: number; // 0-3
}

export type LineRatings = Record<Exclude<Line, "GK">, number | null>;

export interface TeamReport {
  formation: FormationName;
  placed: PlacedPlayer[];
  size: number; // players fielded
  strength: number | null; // the headline number; null with nobody fielded
  lines: LineRatings; // ATT/MID/DEF; the keeper counts with the defence
  chemistry: number; // 0-33
  style: TeamStyle | null;
}

// Points for how many players share a link, on that link's thresholds.
const linkPoints = (count: number, steps: readonly number[]) => steps.filter((n) => count >= n).length;

// Each player's chemistry, 0-3: how many teammates share their country, top
// language and orgs. Only a player in position earns any (a keeper always is).
function chemistryOf(placed: { player: TeamPlayer | null; fit: Fit | null }[], orgCap: number): number[] {
  const tally = (keys: (p: TeamPlayer) => string[]) => {
    const counts = new Map<string, number>();
    for (const { player } of placed) {
      if (player) for (const k of new Set(keys(player))) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  };
  const countries = tally((p) => (p.country ? [p.country] : []));
  const languages = tally((p) => (p.topLanguage ? [p.topLanguage] : []));
  const orgs = tally((p) => p.orgs ?? []);

  return placed.map(({ player, fit }) => {
    if (!player || fit === "stretch" || fit === "wrong") return 0;
    const country = linkPoints(countries.get(player.country) ?? 0, TEAM.links.country);
    const language = linkPoints(languages.get(player.topLanguage ?? "") ?? 0, TEAM.links.language);
    const org = Math.max(0, ...(player.orgs ?? []).map((o) => linkPoints(orgs.get(o) ?? 0, TEAM.links.org)));
    return Math.min(TEAM.playerChemistry, country + language + Math.min(org, orgCap));
  });
}

// `club` marks a team drafted from one org (see TEAM.clubOrgCap).
export function rateTeam({ formation, players }: Lineup, { club = false } = {}): TeamReport {
  const slots = FORMATIONS[formation];
  const seated = slots.map((slot, i) => {
    const player = players[i] ?? null;
    const fit = player && slot.role !== "GK" ? positionFit(player.position, slot.role) : null;
    return { slot, player, fit, rating: player ? slotRating(player, slot) : null };
  });
  const chem = chemistryOf(seated, club ? TEAM.clubOrgCap : TEAM.playerChemistry);
  const placed: PlacedPlayer[] = seated.map((s, i) => ({ ...s, chemistry: chem[i] }));

  const ratings = (keep: (slot: FormationSlot) => boolean) =>
    placed.flatMap((p) => (p.rating !== null && keep(p.slot) ? [p.rating] : []));
  const lineRating = (keep: (slot: FormationSlot) => boolean) => {
    const r = ratings(keep);
    return r.length ? Math.round(mean(r)) : null;
  };

  const fielded = ratings(() => true);
  const chemistry = chem.reduce((s, x) => s + x, 0);
  return {
    formation,
    placed,
    size: fielded.length,
    strength: fielded.length
      ? clamp(Math.round(mean(fielded) + (TEAM.chemistryBonus * chemistry) / TEAM.maxChemistry), 1, 99)
      : null,
    lines: {
      FWD: lineRating((s) => s.line === "FWD"),
      MID: lineRating((s) => s.line === "MID"),
      DEF: lineRating((s) => s.line === "DEF" || s.line === "GK"),
    },
    chemistry,
    style: teamStyle(placed),
  };
}
