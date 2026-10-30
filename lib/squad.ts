import { countryName } from "./countries";
import { LINE_OF, type Line } from "./lines";
import type { PlayerEntry } from "./registry";

// National squads: the strongest 25 a country can call up from the player
// registry, and the 4-3-3 that starts. Pure: the page fetches the pool, this
// only picks, so the selection rules are tested on their own.
//
// The scout has no goalkeepers, so the outfield lines are filled first and the
// three best DEF ratings left over take the gloves. Short pools leave open
// slots; nobody is played out of position to fill one.

/** Display order, back to front. */
export const LINES: readonly Line[] = ["GK", "DEF", "MID", "FWD"];

/** Call-ups per line: 3 + 8 + 8 + 6 = a 25-man World Cup squad. */
export const QUOTA: Record<Line, number> = { GK: 3, DEF: 8, MID: 8, FWD: 6 };

/** Starters per line in the 4-3-3. */
export const FORMATION: Record<Line, number> = { GK: 1, DEF: 4, MID: 3, FWD: 3 };

export const SQUAD_SIZE = LINES.reduce((n, l) => n + QUOTA[l], 0);

export interface Squad {
  /** Each line best-first: outfield lines by overall, keepers by DEF stat. */
  lines: Record<Line, PlayerEntry[]>;
  /** The starting XI by line, best-first; a short line starts fewer. */
  xi: Record<Line, PlayerEntry[]>;
  /** Rounded average overall of the XI, or null with nobody to field. */
  rating: number | null;
  /** Players called up, at most SQUAD_SIZE. */
  size: number;
}

const emptyLines = (): Record<Line, PlayerEntry[]> => ({ GK: [], DEF: [], MID: [], FWD: [] });

export function buildSquad(pool: readonly PlayerEntry[]): Squad {
  // Array sort is stable, so equal overalls keep the registry's order.
  const ranked = [...pool].sort((a, b) => b.overall - a.overall);
  const lines = emptyLines();
  const picked = new Set<PlayerEntry>();
  for (const p of ranked) {
    const line = LINE_OF[p.position];
    // An entry from a position the engine no longer emits has no line.
    if (line && lines[line].length < QUOTA[line]) {
      lines[line].push(p);
      picked.add(p);
    }
  }
  lines.GK = ranked
    .filter((p) => !picked.has(p) && LINE_OF[p.position])
    .sort((a, b) => b.stats.def - a.stats.def || b.overall - a.overall)
    .slice(0, QUOTA.GK);

  const xi = emptyLines();
  for (const l of LINES) xi[l] = lines[l].slice(0, FORMATION[l]);
  const starters = LINES.flatMap((l) => xi[l]);
  return {
    lines,
    xi,
    rating: starters.length ? Math.round(starters.reduce((s, p) => s + p.overall, 0) / starters.length) : null,
    size: LINES.reduce((n, l) => n + lines[l].length, 0),
  };
}

// The name on a pitch chip: the surname, FUT-style ("Linus Torvalds" ->
// "Torvalds"). One-word names stay whole; no name falls back to the login.
export function shortName(p: Pick<PlayerEntry, "name" | "login">): string {
  const words = p.name.replace(/\(.*?\)/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.at(-1) ?? p.login;
}

// What the team is called on the squad pages. The country list keeps ISO names
// ("Korea, Republic of"), which read badly on a team sheet: a few get their
// football name, the rest just drop the ", ..." qualifier.
const TEAM_NAMES: Record<string, string> = {
  kr: "South Korea",
  kp: "North Korea",
  cd: "DR Congo",
  vg: "British Virgin Islands",
  vi: "US Virgin Islands",
};

export function teamName(code: string): string | null {
  const name = countryName(code);
  if (!name) return null;
  return TEAM_NAMES[code.toLowerCase()] ?? name.split(", ")[0];
}
