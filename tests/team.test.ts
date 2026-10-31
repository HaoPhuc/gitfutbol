import { describe, expect, it } from "vitest";
import { FIT_PENALTY, FORMATION_NAMES, FORMATIONS, positionFit } from "@/lib/team/formations";
import { autoLineup, keeperRating, rateTeam, slotRating, TEAM, type Lineup, type TeamPlayer } from "@/lib/team/lineup";
import { teamStyle, TYPICAL_STATS, type TeamStyle } from "@/lib/team/style";
import type { Position, Stats } from "@/lib/scoring/types";

// The shared team engine: formations, position fit, the auto-picked line-up,
// strength, chemistry and the team playstyle.

const FLAT: Stats = { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 };

const player = (login: string, position: Position, overall = 70, extra: Partial<TeamPlayer> = {}): TeamPlayer => ({
  login,
  name: login,
  avatarUrl: "",
  overall,
  position,
  finish: "gold",
  stats: FLAT,
  country: "",
  topLanguage: null,
  ...extra,
});

// A full XI of natural fits for a formation, each slot's role as their position.
const naturalXI = (formation: keyof typeof FORMATIONS, extra: (i: number) => Partial<TeamPlayer> = () => ({})): Lineup => ({
  formation,
  players: FORMATIONS[formation].map((slot, i) =>
    player(`p${i}`, slot.role === "GK" ? "CB" : slot.role, 70, extra(i)),
  ),
});

describe("formations", () => {
  it("each field a keeper and ten outfield players", () => {
    for (const name of FORMATION_NAMES) {
      const slots = FORMATIONS[name];
      expect(slots, name).toHaveLength(11);
      expect(slots.filter((s) => s.role === "GK"), name).toHaveLength(1);
    }
  });

  it("match their names, line by line", () => {
    const shape = (name: keyof typeof FORMATIONS) => {
      const count = (line: string) => FORMATIONS[name].filter((s) => s.line === line).length;
      return [count("DEF"), count("MID"), count("FWD")];
    };
    expect(shape("4-3-3")).toEqual([4, 3, 3]);
    expect(shape("4-4-2")).toEqual([4, 4, 2]);
    expect(shape("4-2-3-1")).toEqual([4, 5, 1]);
    expect(shape("3-5-2")).toEqual([3, 5, 2]);
    expect(shape("5-4-1")).toEqual([5, 4, 1]);
  });

  it("lay slots out left to right and on the pitch", () => {
    for (const name of FORMATION_NAMES) {
      for (const s of FORMATIONS[name]) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(100);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(100);
      }
    }
  });
});

describe("positionFit", () => {
  it("never counts a side against a player", () => {
    expect(positionFit("RW", "LW")).toBe("natural");
    expect(positionFit("RWB", "LWB")).toBe("natural");
    expect(positionFit("RFB", "LFB")).toBe("natural");
  });

  it("grades neighbours, the same line and another line", () => {
    expect(positionFit("CM", "CM")).toBe("natural");
    expect(positionFit("ST", "CF")).toBe("close");
    expect(positionFit("RFB", "LWB")).toBe("close");
    expect(positionFit("CDM", "CAM")).toBe("stretch");
    expect(positionFit("ST", "CB")).toBe("wrong");
  });
});

describe("slotRating", () => {
  it("takes the position penalty off the overall", () => {
    const slot = FORMATIONS["4-3-3"].find((s) => s.role === "CB")!;
    expect(slotRating(player("a", "CB", 80), slot)).toBe(80);
    expect(slotRating(player("a", "CDM", 80), slot)).toBe(80 - FIT_PENALTY.close);
    expect(slotRating(player("a", "ST", 80), slot)).toBe(80 - FIT_PENALTY.wrong);
  });

  it("rates a keeper on their DEF stat", () => {
    const slot = FORMATIONS["4-3-3"][0];
    const p = player("a", "ST", 90, { stats: { ...FLAT, def: 41 } });
    expect(keeperRating(p)).toBe(41);
    expect(slotRating(p, slot)).toBe(41);
  });
});

describe("autoLineup", () => {
  const pool = [
    ...["d1", "d2", "d3", "d4"].map((l) => player(l, "CB", 75)),
    ...["m1", "m2", "m3"].map((l) => player(l, "CM", 75)),
    ...["f1", "f2", "f3"].map((l) => player(l, "ST", 75)),
    player("keeper", "CB", 60, { stats: { ...FLAT, def: 95 } }),
  ];

  it("fills every slot and gives the leftover with the best DEF the gloves", () => {
    const { players } = autoLineup(pool, "4-3-3");
    expect(players.every(Boolean)).toBe(true);
    expect(new Set(players).size).toBe(11);
    expect(players[0]?.login).toBe("keeper");
  });

  it("puts players where they're worth most", () => {
    const report = rateTeam(autoLineup(pool, "4-3-3"));
    const at = (role: string) => report.placed.filter((p) => p.slot.role === role).map((p) => p.player?.position);
    expect(at("CM")).toEqual(["CM", "CM", "CM"]);
    expect(at("ST")).toEqual(["ST"]);
  });

  it("leaves the goalkeeper's slot open first when short of eleven", () => {
    const { players } = autoLineup(pool.slice(0, 5), "4-3-3");
    expect(players[0]).toBeNull();
    expect(players.filter(Boolean)).toHaveLength(5);
  });

  it("doesn't depend on the candidates' order", () => {
    const logins = (l: Lineup) => l.players.map((p) => p?.login);
    expect(logins(autoLineup([...pool].reverse(), "4-4-2"))).toEqual(logins(autoLineup(pool, "4-4-2")));
  });

  it("copes with nobody", () => {
    expect(autoLineup([], "4-3-3").players.every((p) => p === null)).toBe(true);
  });
});

describe("rateTeam", () => {
  it("averages what the players are worth in their slots", () => {
    const report = rateTeam(naturalXI("4-3-3"));
    expect(report.size).toBe(11);
    expect(report.chemistry).toBe(0);
    expect(report.strength).toBe(70); // ten 70s and a keeper on DEF 70
  });

  it("gives line ratings, with the keeper in the defence", () => {
    const lineup = naturalXI("4-3-3");
    lineup.players[0] = player("gk", "CB", 70, { stats: { ...FLAT, def: 20 } });
    const { lines } = rateTeam(lineup);
    expect(lines.FWD).toBe(70);
    expect(lines.MID).toBe(70);
    expect(lines.DEF).toBe(60); // (20 + 4 × 70) / 5
  });

  it("lowers strength for players out of position", () => {
    const lineup = naturalXI("4-3-3");
    const clean = rateTeam(lineup).strength as number;
    lineup.players = lineup.players.map((p, i) => (i && p ? { ...p, position: "ST" as const } : p));
    expect(rateTeam(lineup).strength).toBeLessThan(clean);
  });

  it("handles a partial team and an empty one", () => {
    const lineup = naturalXI("4-3-3");
    lineup.players = lineup.players.map((p, i) => (i === 1 ? p : null));
    const report = rateTeam(lineup);
    expect(report.size).toBe(1);
    expect(report.strength).toBe(70);
    expect(report.lines).toEqual({ FWD: null, MID: null, DEF: 70 });
    expect(report.style).toBeNull();

    const empty = rateTeam({ formation: "4-3-3", players: [] });
    expect(empty.size).toBe(0);
    expect(empty.strength).toBeNull();
    expect(empty.chemistry).toBe(0);
  });
});

describe("chemistry", () => {
  const withCountry = (n: number) => naturalXI("4-3-3", (i) => (i < n ? { country: "vn" } : {}));

  it("counts shared countries on their thresholds", () => {
    expect(rateTeam(withCountry(1)).chemistry).toBe(0);
    expect(rateTeam(withCountry(2)).chemistry).toBe(2 * 1);
    expect(rateTeam(withCountry(5)).chemistry).toBe(5 * 2);
    expect(rateTeam(withCountry(8)).chemistry).toBe(8 * 3);
  });

  it("counts a shared top language", () => {
    const lang = (n: number) => rateTeam(naturalXI("4-3-3", (i) => (i < n ? { topLanguage: "Rust" } : {}))).chemistry;
    expect(lang(2)).toBe(0);
    expect(lang(3)).toBe(3);
  });

  it("counts any shared org", () => {
    const report = rateTeam(
      naturalXI("4-3-3", (i) => (i === 1 ? { orgs: ["vercel", "acme"] } : i === 2 ? { orgs: ["acme"] } : {})),
    );
    expect(report.placed[1].chemistry).toBe(1);
    expect(report.placed[2].chemistry).toBe(1);
    expect(report.chemistry).toBe(2);
  });

  it("adds links up to three a player, and a full team reaches the maximum", () => {
    const report = rateTeam(naturalXI("4-3-3", () => ({ country: "vn", topLanguage: "Go", orgs: ["acme"] })));
    expect(report.placed.every((p) => p.chemistry === 3)).toBe(true);
    expect(report.chemistry).toBe(TEAM.maxChemistry);
    expect(report.strength).toBe(70 + TEAM.chemistryBonus);
  });

  it("gives nothing to a player out of position, but still counts them for others", () => {
    const lineup = withCountry(2);
    lineup.players[1] = { ...lineup.players[1]!, position: "ST" }; // a striker at left-back
    const report = rateTeam(lineup);
    expect(report.placed[1].chemistry).toBe(0);
    expect(report.placed[0].chemistry).toBe(1);
  });

  it("lets a neighbouring role and the keeper earn it", () => {
    const lineup = withCountry(2);
    lineup.players[1] = { ...lineup.players[1]!, position: "RWB" }; // close to fullback
    const report = rateTeam(lineup);
    expect(report.placed[0].chemistry).toBe(1);
    expect(report.placed[1].chemistry).toBe(1);
  });

  it("counts a club's own org once, so a club isn't 33/33 by default", () => {
    const club = naturalXI("4-3-3", () => ({ orgs: ["acme"] }));
    expect(rateTeam(club).chemistry).toBe(TEAM.maxChemistry);
    expect(rateTeam(club, { club: true }).chemistry).toBe(11);
  });
});

describe("teamStyle", () => {
  const styled = (stats: Partial<Stats>, formation: keyof typeof FORMATIONS = "4-3-3") =>
    rateTeam(naturalXI(formation, () => ({ stats: { ...FLAT, ...stats } }))).style as TeamStyle;

  it("reads a passing team as patient, a quick shooting one as direct", () => {
    expect(styled({ pas: 85, dri: 85, pac: 60, sho: 60, phy: 60 }).directness).toBeLessThan(50);
    expect(styled({ pac: 85, sho: 85, phy: 80, pas: 60, dri: 60 }).directness).toBeGreaterThan(50);
  });

  it("names all four styles", () => {
    expect(styled({ pac: 71, sho: 70, pas: 80, dri: 85, def: 56, phy: 90 }).name).toBe("High Control");
    expect(styled({ pac: 60, sho: 85, pas: 85, dri: 85, def: 80, phy: 70 }, "5-3-2").name).toBe("Slow Burn");
    expect(styled({ pac: 90, sho: 90, pas: 60, dri: 60, def: 60, phy: 95 }).name).toBe("Full Throttle");
    expect(styled({ pac: 71, sho: 99, pas: 60, dri: 60, def: 80, phy: 85 }, "5-3-2").name).toBe("Hit and Run");
  });

  it("isn't changed by how strong a team is, only by its shape", () => {
    const level = (n: number) => styled({ pac: n, sho: n, pas: n, dri: n, def: n, phy: n });
    expect(level(90).tendencies).toEqual(level(55).tendencies);
  });

  it("widens and narrows with the formation", () => {
    expect(styled({}, "4-3-3").tendencies.width).toBeGreaterThan(styled({}, "4-1-2-1-2").tendencies.width);
  });

  it("sits a typical team in the middle of both axes", () => {
    const typical = styled(TYPICAL_STATS);
    expect(typical.tendencies.buildup).toBe(50);
    expect(typical.tendencies.attack).toBe(50);
    expect(typical.tendencies.pressing).toBe(50);
    expect(typical.tendencies.block).toBe(50);
  });

  it("drops the block with more defenders", () => {
    expect(styled({}, "3-4-3").tendencies.block).toBeGreaterThan(styled({}, "4-3-3").tendencies.block);
    expect(styled({}, "4-3-3").tendencies.block).toBeGreaterThan(styled({}, "5-3-2").tendencies.block);
  });

  it("keeps tendencies on the 0-100 scale", () => {
    const extreme = styled({ pac: 99, sho: 99, phy: 99, pas: 1, dri: 1, def: 1 });
    for (const v of Object.values(extreme.tendencies)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("needs a few outfield players", () => {
    expect(teamStyle(rateTeam({ formation: "4-3-3", players: [] }).placed)).toBeNull();
  });
});
