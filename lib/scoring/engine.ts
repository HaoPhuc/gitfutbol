import { countryForLogin } from "../geo";
import { topLanguageLogo } from "../github/languages";
import { deriveMetrics, deriveSkillMoves, deriveStyle, deriveWeakFoot, deriveWorkRate } from "./attributes";
import { ARCHETYPES, FINISH_LABELS, FOUNDER_OVERALL, FOUNDERS, K, SIGNAL_REFS, STATS, WEIGHTS } from "./constants";
import { derivePlaystyles } from "./playstyles";
import { outlook, seasonSignals } from "./progression";
import type { Archetype, Card, Family, Finish, Position, SeasonRating, Signals, StatKey, Stats } from "./types";

const Lg = (x: number) => Math.log10(Math.max(0, x) + 1);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

// §1 — one GitHub count → a rating: zero → floor, typical → K.stat.typical,
// elite → 99, log-scaled in between (each 10× is worth the same within a segment).
function rate(value: number, ref: { typical: number; elite: number }): number {
  const { floor, typical } = K.stat;
  const x = Lg(value);
  const t = Lg(ref.typical);
  if (x <= t) return floor + (typical - floor) * (x / t);
  return typical + (99 - typical) * Math.min(1, (x - t) / (Lg(ref.elite) - t));
}

// §2 — the six stats, rated straight from the signals. Nothing is normalised
// against the player's own profile: the card shows what the signals earned.
function rateStats(s: Signals): Stats {
  const r = SIGNAL_REFS;
  const o: Stats = {
    pac: rate(s.recent_contributions, r.recentContributions),
    sho: 0.7 * rate(s.total_stars_owned, r.stars) + 0.3 * rate(s.max_repo_stars, r.topRepoStars),
    pas: 0.6 * rate(s.prs_to_others, r.prs) + 0.4 * rate(s.followers, r.followers),
    // Log-scaled like the rest, so each extra language counts for less.
    dri: rate(s.languages, r.languages),
    def: rate(s.reviews + s.issues_closed, r.reviewsAndIssues),
    phy:
      0.7 * rate(s.total_contributions_lifetime, r.lifetimeContributions) +
      0.3 * rate(s.active_years, r.activeYears),
  };
  for (const k of STATS) o[k] = clamp(Math.round(o[k]), 1, 99);
  return o;
}

// §3 — archetype, then position. Stats are compared with the player's own
// average only to read the shape; the numbers themselves are never changed.
function classify(st: Stats): { family: Family; position: Position } {
  const m = mean(STATS.map((k) => st[k]));
  const dev = {} as Stats;
  STATS.forEach((k) => (dev[k] = st[k] - m));
  const avg = (ks: StatKey[]) => mean(ks.map((k) => dev[k]));
  const contrast = (a: (typeof ARCHETYPES)[number]) => avg(a.high) - avg(a.low);

  const fits =
    m < K.position.thinMean
      ? []
      : ARCHETYPES.filter(
          (a) => a.high.every((k) => dev[k] >= K.position.standOut) && a.low.every((k) => dev[k] < 0),
        ).sort((a, b) => contrast(b) - contrast(a));
  // Too thin to read, or nothing stands out: an Allrounder, who plays CM until
  // the user picks a position.
  if (!fits.length) return { family: "Allrounder", position: "CM" };
  const family = fits[0].family;
  return { family, position: splitPosition(family, dev) };
}

// Inside an archetype, the position turns on one stat sitting above or below the
// player's average. Wide roles come out right-sided; left is the user's choice.
function splitPosition(family: Exclude<Family, "Allrounder">, dev: Stats): Position {
  const up = (k: StatKey) => dev[k] >= 0;
  switch (family) {
    case "Playmaker":
      return up("pac") ? "RW" : up("sho") ? "SS" : dev.pas > dev.dri ? "CM" : "CAM";
    case "Striker":
      return up("pac") ? "ST" : "CF";
    case "Anchor":
      return up("dri") ? "CDM" : "CB";
    case "Fullback":
      return up("dri") ? "RWB" : "RFB";
  }
}

// §4 — position-weighted, never a flat mean; stats alone cap at 88.
function weightedOVR(stats: Stats, family: Family): number {
  const w = WEIGHTS[family];
  const ovr = STATS.reduce((s, k) => s + stats[k] * w[k], 0);
  return Math.min(Math.round(ovr), K.ovrCap);
}

// §5 — the 88→99 range is bought with years and sustained influence.
function legacyScore(s: Signals): number {
  const { a, b, c, d, e, f, activeCap } = K.legacy;
  const z =
    a * Math.log(s.account_age_years + 1) +
    b * Math.min(s.active_years, activeCap) +
    c * Lg(s.followers) +
    d * Lg(s.total_stars_owned) +
    e * Lg(s.max_repo_stars) -
    f;
  return sigmoid(z);
}

function pickFinish(overall: number, L: number, recentSpike: boolean, login: string): Finish {
  if (K.iconAllowlist.includes(login) || overall >= K.finish.iconMin) return "icon";
  if (overall >= K.finish.totyMin && L >= K.finish.totyLegacy) return "toty";
  if (recentSpike && overall >= K.finish.silverMin) return "totw";
  if (overall >= K.finish.goldMin) return "gold";
  if (overall >= K.finish.silverMin) return "silver";
  return "bronze";
}

function archetypeFromShape(st: Stats, finish: Finish): Archetype {
  if (finish === "icon")
    return { name: "Galáctico", blurb: "hall-of-fame maintainer — high and balanced, earned over years" };
  const top = [...STATS].sort((a, b) => st[b] - st[a]);
  const peak = st[top[0]];
  const top2 = top.slice(0, 2);
  const has = (a: StatKey, b: StatKey) => top2.includes(a) && top2.includes(b);
  if (top[0] === "sho" && st.def < peak - 18 && st.pas < peak - 12)
    return { name: "Poacher", blurb: "one viral repo, clinical — a pure star-magnet finisher" };
  if (top[0] === "pas" && top2.includes("def"))
    return { name: "Regista", blurb: "deep playmaker — coordinates from the back with cross-repo PRs and reviews" };
  if (top[0] === "def" && top2.includes("pas"))
    return { name: "Libero", blurb: "ball-playing sweeper — a reviewer who also builds, keeping the codebase clean" };
  if (top[0] === "dri")
    return { name: "Fantasista", blurb: "the magician — a polyglot working across many stacks" };
  if (has("phy", "sho")) return { name: "Target Man", blurb: "a prolific shipper whose output lands" };
  if (has("phy", "pac") || has("pac", "dri"))
    return { name: "Mezzala", blurb: "the engine — a relentless box-to-box daily-driver" };
  if (top[0] === "def")
    return { name: "Libero", blurb: "ball-playing sweeper — a reviewer who also builds, keeping the codebase clean" };
  if (top[0] === "sho")
    return { name: "Poacher", blurb: "one viral repo, clinical — a pure star-magnet finisher" };
  return { name: "Mezzala", blurb: "the engine — a relentless box-to-box daily-driver" };
}

// The whole rating for one set of signals, before any founder override. The live
// card and every rebuilt season go through it.
function rateSignals(s: Signals) {
  const stats = rateStats(s);
  const { position, family } = classify(stats);
  const baseOVR = weightedOVR(stats, family);
  const L = legacyScore(s);
  const overall = clamp(baseOVR + Math.round(K.legacy.bonusMax * L), 1, 99);
  return { stats, position, family, baseOVR, L, overall, finish: pickFinish(overall, L, s.recent_spike, s.login) };
}

// `now` dates the season history (the samples pass their capture date).
export function buildCard(s: Signals, now = new Date()): Card {
  const rated = rateSignals(s);
  const { stats, position, family, baseOVR, L } = rated;

  // Founders get a forced overall (>89) and the bespoke "founder" tier. We drive
  // `finish` directly rather than via pickFinish: any overall >= 90 would
  // otherwise auto-promote to ICON (and flip club/archetype), hijacking the look.
  const founder = FOUNDERS[s.login.toLowerCase()];
  const overall = founder ? FOUNDER_OVERALL[s.login.toLowerCase()] : rated.overall;
  const finish: Finish = founder ? "founder" : rated.finish;
  const seasons: SeasonRating[] = [
    ...seasonSignals(s, now).map(({ year, signals }) => {
      const r = rateSignals(signals);
      return { year, current: false, overall: r.overall, position: r.position, finish: r.finish, stats: r.stats };
    }),
    { year: now.getUTCFullYear(), current: true, overall, position, finish, stats },
  ];
  const archetype = founder
    ? { name: "Founder", blurb: "co-founder of GitFut — they built the very scout reading this card" }
    : archetypeFromShape(stats, finish);
  const skill = deriveSkillMoves(s);
  const weak = deriveWeakFoot(stats);
  const work = deriveWorkRate(stats);
  const style = deriveStyle(s);
  // Headline language's own catalog logo (null when it has none) — never a
  // different language's icon, so the logo always matches `topLanguage`.
  const languageLogo = topLanguageLogo(s.rankedLanguages ?? []);
  return {
    login: s.login,
    name: s.name,
    avatarUrl: s.avatarUrl,
    country: countryForLogin(s.login, s.location) ?? "",
    club: finish === "icon" ? "legends" : "neutral",
    stats,
    position,
    family,
    baseOVR,
    overall,
    finish,
    finishLabel: FINISH_LABELS[finish],
    archetype: archetype.name,
    archetypeBlurb: archetype.blurb,
    topLanguage: s.topLanguage ?? null,
    languageLogo,
    ...(founder ? { founder } : null),
    ...(s.years ? { years: s.years } : null),
    seasons,
    outlook: outlook(s, overall),
    legacy: { L },
    report: {
      skillMoves: skill.value,
      weakFoot: weak.value,
      workRate: { attack: work.attack, defense: work.defense },
      style: style.value,
      reasons: {
        skillMoves: skill.reason,
        weakFoot: weak.reason,
        workRate: work.reason,
        style: style.reason,
      },
      playstyles: derivePlaystyles(s),
      metrics: deriveMetrics(s),
    },
  };
}
