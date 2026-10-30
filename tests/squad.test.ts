import { describe, expect, it } from "vitest";
import { FORMATION, QUOTA, SQUAD_SIZE, buildSquad, shortName, teamName } from "@/lib/squad";
import type { PlayerEntry } from "@/lib/registry";
import type { Position } from "@/lib/scoring/types";

const player = (login: string, overall: number, position: Position, def = 50): PlayerEntry => ({
  login,
  name: login,
  avatarUrl: "",
  overall,
  position,
  family: "Allrounder",
  finish: "gold",
  country: "fr",
  topLanguage: null,
  stats: { pac: 60, sho: 60, pas: 60, dri: 60, def, phy: 60 },
});

// n players at one position, overalls counting down from `top`.
const many = (prefix: string, n: number, position: Position, top = 90) =>
  Array.from({ length: n }, (_, i) => player(`${prefix}${i}`, top - i, position));

const logins = (ps: PlayerEntry[]) => ps.map((p) => p.login);

describe("buildSquad", () => {
  it("fills a deep pool to exactly 25: 3 GK, 8 DEF, 8 MID, 6 FWD", () => {
    const pool = [...many("cb", 15, "CB"), ...many("cm", 15, "CM"), ...many("st", 15, "ST")];
    const squad = buildSquad(pool);
    expect(SQUAD_SIZE).toBe(25);
    expect(squad.size).toBe(25);
    expect(squad.lines.GK).toHaveLength(QUOTA.GK);
    expect(squad.lines.DEF).toHaveLength(8);
    expect(squad.lines.MID).toHaveLength(8);
    expect(squad.lines.FWD).toHaveLength(6);
  });

  it("maps every position to its line and takes the best by overall", () => {
    const pool = [
      player("rwb", 80, "RWB"),
      player("cb", 85, "CB"),
      player("cdm", 82, "CDM"),
      player("cam", 88, "CAM"),
      player("lw", 79, "LW"),
      player("cf", 91, "CF"),
    ];
    const { lines } = buildSquad(pool);
    expect(logins(lines.DEF)).toEqual(["cb", "rwb"]);
    expect(logins(lines.MID)).toEqual(["cam", "cdm"]);
    expect(logins(lines.FWD)).toEqual(["cf", "lw"]);
  });

  it("sorts by overall even when the pool comes unsorted", () => {
    const { lines } = buildSquad([player("a", 70, "ST"), player("b", 95, "ST"), player("c", 80, "ST")]);
    expect(logins(lines.FWD)).toEqual(["b", "c", "a"]);
  });

  it("keeps the registry order on equal overalls", () => {
    const pool = many("st", 8, "ST", 80).map((p) => ({ ...p, overall: 80 }));
    expect(logins(buildSquad(pool).lines.FWD)).toEqual(["st0", "st1", "st2", "st3", "st4", "st5"]);
  });

  it("gives the gloves to the best DEF stats left over, not to picked defenders", () => {
    const pool = [
      ...many("cb", 8, "CB", 90).map((p) => ({ ...p, stats: { ...p.stats, def: 99 } })),
      player("cb-spare", 70, "CB", 88),
      player("st-spare", 60, "ST", 91),
      ...many("st", 6, "ST", 95),
      player("cm", 75, "CM", 80),
      player("cm-low", 50, "CM", 85),
    ];
    const { lines } = buildSquad(pool);
    // Midfield isn't full, so both CMs are outfield picks and never in goal.
    expect(logins(lines.MID)).toEqual(["cm", "cm-low"]);
    expect(logins(lines.GK)).toEqual(["st-spare", "cb-spare"]);
  });

  it("breaks a DEF-stat tie between keepers by overall", () => {
    const pool = [...many("st", 6, "ST", 99), player("low", 60, "ST", 80), player("high", 70, "ST", 80)];
    expect(logins(buildSquad(pool).lines.GK)).toEqual(["high", "low"]);
  });

  it("leaves open slots on a short pool instead of playing anyone out of position", () => {
    const squad = buildSquad([player("a", 90, "ST"), player("b", 85, "ST"), player("c", 80, "CM")]);
    expect(squad.size).toBe(3);
    expect(squad.lines.DEF).toEqual([]);
    expect(squad.lines.GK).toEqual([]);
    expect(logins(squad.xi.FWD)).toEqual(["a", "b"]);
    expect(logins(squad.xi.MID)).toEqual(["c"]);
  });

  it("never calls anyone up twice", () => {
    const squad = buildSquad([...many("cb", 10, "CB"), ...many("cm", 10, "CM"), ...many("st", 10, "ST")]);
    const all = [...squad.lines.GK, ...squad.lines.DEF, ...squad.lines.MID, ...squad.lines.FWD];
    expect(new Set(all.map((p) => p.login)).size).toBe(all.length);
  });

  it("starts a 4-3-3 with the best keeper and the top of each line", () => {
    const pool = [
      ...many("cb", 9, "CB"),
      ...many("cm", 9, "CM"),
      ...many("st", 7, "ST"),
      player("gk", 40, "CB", 99),
    ];
    const { xi, lines } = buildSquad(pool);
    expect(logins(xi.GK)).toEqual([lines.GK[0].login]);
    expect(lines.GK[0].login).toBe("gk");
    expect(logins(xi.DEF)).toEqual(["cb0", "cb1", "cb2", "cb3"]);
    expect(logins(xi.MID)).toEqual(["cm0", "cm1", "cm2"]);
    expect(logins(xi.FWD)).toEqual(["st0", "st1", "st2"]);
    expect(Object.values(FORMATION).reduce((a, b) => a + b, 0)).toBe(11);
  });

  it("rates the team by the XI's average overall, rounded", () => {
    expect(buildSquad([player("a", 90, "ST"), player("b", 85, "ST")]).rating).toBe(88);
    // The bench doesn't count: four strikers, three start.
    expect(buildSquad(many("st", 4, "ST", 90)).rating).toBe(89);
  });

  it("has no rating and no players for an empty pool", () => {
    const squad = buildSquad([]);
    expect(squad.rating).toBeNull();
    expect(squad.size).toBe(0);
  });
});

describe("shortName", () => {
  it("uses the surname of a full name", () => {
    expect(shortName({ name: "Linus Torvalds", login: "torvalds" })).toBe("Torvalds");
  });
  it("keeps a one-word name and drops a parenthetical", () => {
    expect(shortName({ name: "ThePrimeagen", login: "ThePrimeagen" })).toBe("ThePrimeagen");
    expect(shortName({ name: "Theo Browne (t3.gg)", login: "t3dotgg" })).toBe("Browne");
  });
  it("falls back to the login", () => {
    expect(shortName({ name: "  ", login: "octocat" })).toBe("octocat");
  });
});

describe("teamName", () => {
  it("drops the ISO qualifier and knows the football names", () => {
    expect(teamName("ir")).toBe("Iran");
    expect(teamName("KR")).toBe("South Korea");
    expect(teamName("cd")).toBe("DR Congo");
    expect(teamName("eng")).toBe("England");
    expect(teamName("us")).toBe("United States");
  });
  it("is null for an unknown code", () => {
    expect(teamName("zz")).toBeNull();
  });
});
