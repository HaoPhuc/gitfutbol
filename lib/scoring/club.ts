import { countryFromLocation } from "../geo";
import { rankLanguages, topLanguageLogo, type LanguageLogo } from "../github/languages";
import type { OrgPayload } from "../github/org";
import { LINE_OF, type Line, type OutfieldLine } from "../lines";
import { FINISH_LABELS, K, STATS } from "./constants";
import { rate } from "./engine";
import type { Finish, Position, Stats } from "./types";

// Club mode, the pure half: a GitHub organization rated like a player (six stats
// on the same scale, a tier that reuses the card art) and a squad of its top
// contributors arranged in a formation. lib/club fetches and scouts; this only
// computes, so every rule here is unit-tested without GitHub.

// Each club signal is rated on two anchors like a player's (SIGNAL_REFS): what a
// typical active open-source org has (→ K.stat.typical) and what an elite one has
// (→ 99), log-scaled in between; zero → K.stat.floor.
export const CLUB_REFS = {
  activeRepos: { typical: 3, elite: 100 }, // public repos pushed in the last 90 days (counted up to 100)
  stars: { typical: 500, elite: 1_000_000 }, // stars over the top 100 repos
  topRepoStars: { typical: 200, elite: 200_000 },
  contributors: { typical: 15, elite: 150 }, // humans in the sampled repos' top-30 lists (at most 180)
  languages: { typical: 4, elite: 20 }, // distinct primary languages in the top 100 repos
  forks: { typical: 100, elite: 200_000 }, // forks over the top 100 repos
  publicRepos: { typical: 20, elite: 3_000 }, // public, non-fork
  ageYears: { typical: 5, elite: 15 },
} satisfies Record<string, { typical: number; elite: number }>;

const ACTIVE_DAYS = 90;
const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const MAIN_LANGUAGES = 5;
const TOP_REPOS = 5;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

// ---- club rating ---------------------------------------------------------------

// The raw counts behind the six club stats, also shown on the club page.
export interface ClubFacts {
  stars: number;
  topRepoStars: number;
  forks: number;
  publicRepos: number;
  activeRepos: number;
  contributors: number;
  languages: number;
  ageYears: number;
}

export function clubFacts(org: OrgPayload, now = new Date()): ClubFacts {
  const since = now.getTime() - ACTIVE_DAYS * DAY_MS;
  const ageYears = Math.max(0, (now.getTime() - Date.parse(org.createdAt)) / YEAR_MS);
  return {
    stars: sum(org.repos.map((r) => r.stars)),
    topRepoStars: Math.max(0, ...org.repos.map((r) => r.stars)),
    forks: sum(org.repos.map((r) => r.forks)),
    publicRepos: org.publicRepos,
    activeRepos: org.recentPushes.filter((t) => Date.parse(t) >= since).length,
    contributors: org.contributors.length,
    languages: new Set(org.repos.flatMap((r) => (r.language ? [r.language] : []))).size,
    ageYears: Math.round(ageYears * 10) / 10,
  };
}

// The football reading: PAC is tempo (repos shipping now), SHO is finishing
// (stars), PAS is the passing network (people who commit together), DRI is
// technical range (languages), DEF is the code others build on and the club has
// to hold up (forks), PHY is the size and years of the squad (repos, age).
export function rateClubStats(f: ClubFacts): Stats {
  const r = CLUB_REFS;
  const o: Stats = {
    pac: rate(f.activeRepos, r.activeRepos),
    sho: 0.7 * rate(f.stars, r.stars) + 0.3 * rate(f.topRepoStars, r.topRepoStars),
    pas: rate(f.contributors, r.contributors),
    dri: rate(f.languages, r.languages),
    def: rate(f.forks, r.forks),
    phy: 0.7 * rate(f.publicRepos, r.publicRepos) + 0.3 * rate(f.ageYears, r.ageYears),
  };
  for (const k of STATS) o[k] = clamp(Math.round(o[k]), 1, 99);
  return o;
}

// A club tier on the player thresholds, so it wears the same card art. Clubs have
// no legacy score (age already counts in PHY) and no in-form spike, so TOTY is
// overall alone and IN-FORM never applies.
export type ClubFinish = Exclude<Finish, "totw" | "founder">;

export function clubFinish(overall: number): ClubFinish {
  const f = K.finish;
  if (overall >= f.iconMin) return "icon";
  if (overall >= f.totyMin) return "toty";
  if (overall >= f.goldMin) return "gold";
  if (overall >= f.silverMin) return "silver";
  return "bronze";
}

// ---- squad + formation -----------------------------------------------------------

export type FormationName = "4-3-3" | "4-4-2" | "3-5-2";

// Outfield players per line; the listed order breaks ties.
export const FORMATIONS: Record<FormationName, Record<OutfieldLine, number>> = {
  "4-3-3": { DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { DEF: 4, MID: 4, FWD: 2 },
  "3-5-2": { DEF: 3, MID: 5, FWD: 2 },
};

export const SQUAD_SIZE = 11;
const OUTFIELD: OutfieldLine[] = ["DEF", "MID", "FWD"];

// A scouted contributor, reduced to what the squad needs.
export interface SquadPlayer {
  login: string;
  name: string;
  avatarUrl: string;
  overall: number;
  position: Position; // their own card's position
  finish: Finish;
  def: number; // DEF stat, for the goalkeeper pick
  contributions: number;
}

export interface SquadSlot {
  player: SquadPlayer | null; // null: an open slot
  outOfPosition: boolean; // an outfield player away from their natural line
}

export interface Squad {
  formation: FormationName;
  lines: Record<Line, SquadSlot[]>; // GK has one slot
  moved: number; // outfield players away from their natural line
  rating: number | null; // rounded average overall of the players fielded; null when nobody is
  size: number; // players fielded
}

const OPEN: SquadSlot = { player: null, outOfPosition: false };

const byBest = (a: SquadPlayer, b: SquadPlayer) =>
  b.overall - a.overall ||
  b.contributions - a.contributions ||
  a.login.toLowerCase().localeCompare(b.login.toLowerCase());

// One formation's line-up for players already sorted best-first.
function arrange(players: SquadPlayer[], formation: FormationName): Squad {
  const caps = FORMATIONS[formation];
  const lines: Record<OutfieldLine, SquadSlot[]> = { DEF: [], MID: [], FWD: [] };
  const leftovers: SquadPlayer[] = [];
  for (const p of players) {
    const line = LINE_OF[p.position];
    if (lines[line].length < caps[line]) lines[line].push({ player: p, outOfPosition: false });
    else leftovers.push(p);
  }

  // The engine has no keepers: with a full XI, the leftover with the best DEF
  // goes in goal (ties: the better player).
  let keeper: SquadPlayer | null = null;
  if (players.length >= SQUAD_SIZE && leftovers.length) {
    keeper = leftovers.reduce((best, p) => (p.def > best.def ? p : best));
    leftovers.splice(leftovers.indexOf(keeper), 1);
  }

  // Short lines take the remaining leftovers, best first, each on the open line
  // nearest their own (a winger drops into midfield before defence).
  let moved = 0;
  for (const p of leftovers) {
    const open = OUTFIELD.filter((l) => lines[l].length < caps[l]);
    if (!open.length) break;
    const home = OUTFIELD.indexOf(LINE_OF[p.position]);
    const gap = (l: OutfieldLine) => Math.abs(OUTFIELD.indexOf(l) - home);
    const to = open.reduce((a, b) => (gap(b) < gap(a) ? b : a));
    lines[to].push({ player: p, outOfPosition: true });
    moved++;
  }

  const fielded = [keeper, ...OUTFIELD.flatMap((l) => lines[l].map((s) => s.player))].filter(
    (p): p is SquadPlayer => p !== null,
  );
  const fill = (slots: SquadSlot[], n: number) => [...slots, ...Array.from({ length: n - slots.length }, () => OPEN)];
  return {
    formation,
    lines: {
      GK: [keeper ? { player: keeper, outOfPosition: false } : OPEN],
      DEF: fill(lines.DEF, caps.DEF),
      MID: fill(lines.MID, caps.MID),
      FWD: fill(lines.FWD, caps.FWD),
    },
    moved,
    rating: fielded.length ? Math.round(mean(fielded.map((p) => p.overall))) : null,
    size: fielded.length,
  };
}

// The best eleven in the formation that moves the fewest players off their
// natural line (LINE_OF of their card's position). Fewer than eleven players
// leaves open slots, the goalkeeper's first.
export function pickSquad(candidates: SquadPlayer[]): Squad {
  const players = [...candidates].sort(byBest).slice(0, SQUAD_SIZE);
  const options = (Object.keys(FORMATIONS) as FormationName[]).map((f) => arrange(players, f));
  return options.reduce((best, s) => (s.moved < best.moved ? s : best));
}

// ---- the club --------------------------------------------------------------------

export interface ClubRepo {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  archived: boolean;
}

export interface ClubLanguage {
  name: string;
  repos: number; // top-100 repos with it as their primary language
}

export interface Club {
  login: string;
  name: string; // the org's display name, else its login
  avatarUrl: string; // the crest
  description: string | null;
  location: string | null;
  country: string; // flag code from the location, "" when unknown
  createdAt: string;
  stats: Stats;
  overall: number;
  finish: ClubFinish;
  finishLabel: string;
  facts: ClubFacts;
  languages: ClubLanguage[]; // main languages, most repos first
  languageLogo: LanguageLogo | null; // the headline language's logo, for the card
  topRepos: ClubRepo[];
  squad: Squad;
  sampledRepos: string[]; // repos the squad was drawn from
  // Set by lib/club: whether every squad scout landed, and when it was built.
  complete?: boolean;
  builtAt?: string;
}

export function buildClub(org: OrgPayload, players: SquadPlayer[], now = new Date()): Club {
  const facts = clubFacts(org, now);
  const stats = rateClubStats(facts);
  const overall = clamp(Math.round(mean(STATS.map((k) => stats[k]))), 1, 99);
  const finish = clubFinish(overall);

  const counts = new Map<string, number>();
  for (const r of org.repos) if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  const ranked = rankLanguages(org.repos);

  return {
    login: org.login,
    name: org.name?.trim() || org.login,
    avatarUrl: org.avatarUrl,
    description: org.description?.trim() || null,
    location: org.location,
    country: countryFromLocation(org.location) ?? "",
    createdAt: org.createdAt,
    stats,
    overall,
    finish,
    finishLabel: FINISH_LABELS[finish],
    facts,
    languages: ranked.slice(0, MAIN_LANGUAGES).map((name) => ({ name, repos: counts.get(name) ?? 0 })),
    languageLogo: topLanguageLogo(ranked),
    topRepos: [...org.repos]
      .sort((a, b) => b.stars - a.stars)
      .slice(0, TOP_REPOS)
      .map(({ name, description, stars, forks, language, archived }) => ({
        name,
        description: description?.trim() || null,
        stars,
        forks,
        language,
        archived,
      })),
    squad: pickSquad(players),
    sampledRepos: org.sampledRepos,
  };
}
