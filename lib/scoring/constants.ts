import type { Family, Finish, FounderMeta, StatKey, Stats } from "./types";

export const STATS: StatKey[] = ["pac", "sho", "pas", "dri", "def", "phy"];

// Canonical stat → display abbreviation: the single source for any surface that
// labels the six stats (the Duel's shootout rows read these).
export const STAT_LABELS: Record<StatKey, string> = {
  pac: "PAC",
  sho: "SHO",
  pas: "PAS",
  dri: "DRI",
  def: "DEF",
  phy: "PHY",
};

// Each GitHub count is rated on two anchors: what a typical active developer has
// (→ K.stat.typical) and what an elite one has (→ 99), log-scaled in between; zero
// → K.stat.floor. The card shows these ratings as-is, so moving an anchor here
// moves that stat on every card.
export const SIGNAL_REFS = {
  recentContributions: { typical: 400, elite: 5_000 },
  stars: { typical: 30, elite: 200_000 },
  topRepoStars: { typical: 15, elite: 150_000 },
  prs: { typical: 30, elite: 2_000 },
  followers: { typical: 30, elite: 100_000 },
  languages: { typical: 5, elite: 20 },
  reviewsAndIssues: { typical: 30, elite: 3_000 },
  lifetimeContributions: { typical: 2_000, elite: 50_000 },
  activeYears: { typical: 4, elite: 12 },
} satisfies Record<string, { typical: number; elite: number }>;

export const K = {
  stat: { floor: 40, typical: 60 },
  position: {
    // Below this average stat there's too little activity to read a shape from.
    thinMean: 50,
    // Points above the player's own average an archetype's HIGH stats need.
    standOut: 5,
  },
  legacy: { a: 1.0, b: 0.7, c: 0.3, d: 0.3, e: 0.3, f: 6.0, activeCap: 15, bonusMax: 11 },
  ovrCap: 88,
  finish: { iconMin: 90, totyMin: 85, totyLegacy: 0.5, goldMin: 75, silverMin: 65 },
  iconAllowlist: ["torvalds"],
};

// The archetype tree. An archetype fits when every HIGH stat stands out above the
// player's own average (by K.position.standOut) and every LOW stat sits below it;
// if several fit, the strongest HIGH-vs-LOW contrast wins. None fitting (or too
// thin a profile) makes an Allrounder.
export const ARCHETYPES: { family: Exclude<Family, "Allrounder">; high: StatKey[]; low: StatKey[] }[] = [
  { family: "Playmaker", high: ["dri", "pas"], low: ["def", "phy"] },
  { family: "Striker", high: ["sho"], low: ["def"] },
  { family: "Anchor", high: ["def", "phy"], low: ["sho"] },
  { family: "Fullback", high: ["pac"], low: ["sho"] },
];

export const WEIGHTS: Record<Family, Stats> = {
  Striker: { pac: 0.2, sho: 0.3, pas: 0.1, dri: 0.2, def: 0.05, phy: 0.15 },
  Playmaker: { pac: 0.1, sho: 0.15, pas: 0.3, dri: 0.25, def: 0.1, phy: 0.1 },
  Anchor: { pac: 0.1, sho: 0.05, pas: 0.15, dri: 0.1, def: 0.4, phy: 0.2 },
  Fullback: { pac: 0.3, sho: 0.05, pas: 0.15, dri: 0.1, def: 0.2, phy: 0.2 },
  Allrounder: { pac: 1 / 6, sho: 1 / 6, pas: 1 / 6, dri: 1 / 6, def: 1 / 6, phy: 1 / 6 },
};

export const FINISH_LABELS: Record<Finish, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  totw: "IN-FORM",
  toty: "TOTY",
  icon: "ICON",
  founder: "FOUNDER",
};

// The people who built gitfut. Keyed by LOWERCASE GitHub login; matched
// case-insensitively in buildCard. Each gets a forced overall (>89), bespoke
// card art (public/cards), and an accent that tints their card + scout report.
export const FOUNDERS: Record<string, FounderMeta> = {
  younesfdj: {
    art: "/cards/founder-red.png",
    accent: "#ff2f45",
    label: "FOUNDER",
    tagline: "Co-founder of gitfut",
  },
  mawsis: {
    art: "/cards/founder-chrome.png",
    accent: "#d8dde3",
    label: "FOUNDER",
    tagline: "Co-founder of gitfut",
  },
};

// Forced overalls (kept beside FOUNDERS but separate so the FounderMeta shape
// stays presentation-only). Both are >89 by design.
export const FOUNDER_OVERALL: Record<string, number> = {
  younesfdj: 93,
  mawsis: 91,
};
