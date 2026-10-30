import { describe, expect, it } from "vitest";
import {
  buildClub,
  CLUB_REFS,
  clubFacts,
  clubFinish,
  pickSquad,
  rateClubStats,
  type ClubFacts,
  type SquadPlayer,
} from "@/lib/scoring/club";
import type { OrgPayload, OrgRepo } from "@/lib/github/org";
import type { Position } from "@/lib/scoring/types";

// The pure half of club mode: the club rating (anchors, facts, tier) and the
// squad (formation choice, goalkeeper pick, out-of-position fill, partial XIs).

const NOW = new Date("2026-10-30T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const repo = (name: string, stars: number, extra: Partial<OrgRepo> = {}): OrgRepo => ({
  name,
  description: null,
  stars,
  forks: 0,
  language: "TypeScript",
  pushedAt: daysAgo(10),
  archived: false,
  ...extra,
});

const org = (extra: Partial<OrgPayload> = {}): OrgPayload => ({
  login: "acme",
  name: "Acme",
  avatarUrl: "https://example.com/acme.png",
  description: null,
  location: null,
  createdAt: NOW.toISOString(),
  publicRepos: 0,
  repos: [],
  recentPushes: [],
  contributors: [],
  sampledRepos: [],
  contributorsComplete: true,
  ...extra,
});

const factsAt = (pick: "typical" | "elite"): ClubFacts => ({
  activeRepos: CLUB_REFS.activeRepos[pick],
  stars: CLUB_REFS.stars[pick],
  topRepoStars: CLUB_REFS.topRepoStars[pick],
  contributors: CLUB_REFS.contributors[pick],
  languages: CLUB_REFS.languages[pick],
  forks: CLUB_REFS.forks[pick],
  publicRepos: CLUB_REFS.publicRepos[pick],
  ageYears: CLUB_REFS.ageYears[pick],
});

describe("club rating", () => {
  it("rates an empty, brand-new org at the floor", () => {
    const club = buildClub(org(), [], NOW);
    expect(Object.values(club.stats)).toEqual([40, 40, 40, 40, 40, 40]);
    expect(club.overall).toBe(40);
    expect(club.finish).toBe("bronze");
  });

  it("puts every anchor's typical value at 60 and its elite value at 99", () => {
    expect(Object.values(rateClubStats(factsAt("typical")))).toEqual([60, 60, 60, 60, 60, 60]);
    expect(Object.values(rateClubStats(factsAt("elite")))).toEqual([99, 99, 99, 99, 99, 99]);
  });

  it("caps at 99 past the elite anchor", () => {
    const f = factsAt("elite");
    expect(rateClubStats({ ...f, stars: f.stars * 50, forks: f.forks * 50 }).sho).toBe(99);
  });

  it("reads the facts from the payload: sums, distinct languages, 90-day pushes, age", () => {
    const f = clubFacts(
      org({
        createdAt: "2016-10-30T12:00:00Z",
        publicRepos: 42,
        repos: [
          repo("a", 1000, { forks: 30, language: "Go" }),
          repo("b", 200, { forks: 5, language: "Rust" }),
          repo("c", 50, { forks: 1, language: "Go" }),
          repo("d", 0, { language: null }),
        ],
        recentPushes: [daysAgo(1), daysAgo(89), daysAgo(91), daysAgo(400)],
        contributors: [
          { login: "x", avatarUrl: "", contributions: 9, repos: 1 },
          { login: "y", avatarUrl: "", contributions: 3, repos: 2 },
        ],
      }),
      NOW,
    );
    expect(f).toEqual({
      stars: 1250,
      topRepoStars: 1000,
      forks: 36,
      publicRepos: 42,
      activeRepos: 2,
      contributors: 2,
      languages: 2,
      ageYears: 10,
    });
  });

  it("tiers clubs on the player thresholds, without IN-FORM or the legacy gate", () => {
    expect([90, 89, 85, 84, 75, 74, 65, 64].map(clubFinish)).toEqual([
      "icon",
      "toty",
      "toty",
      "gold",
      "gold",
      "silver",
      "silver",
      "bronze",
    ]);
  });

  it("makes the overall the rounded average of the six stats", () => {
    const club = buildClub(
      org({
        createdAt: "2012-01-01T00:00:00Z",
        publicRepos: 300,
        repos: [repo("big", 50_000, { forks: 9_000 }), repo("small", 400, { language: "Python" })],
        recentPushes: Array.from({ length: 20 }, () => daysAgo(5)),
      }),
      [],
      NOW,
    );
    const avg = Object.values(club.stats).reduce((s, x) => s + x, 0) / 6;
    expect(club.overall).toBe(Math.round(avg));
    expect(club.finishLabel).toBe(club.finish.toUpperCase());
  });

  it("derives the display bits: name fallback, flag, main languages, top repos", () => {
    const club = buildClub(
      org({
        name: "  ",
        location: "Berlin, Germany",
        repos: [
          repo("css-heavy", 10, { language: "CSS" }),
          repo("css-2", 20, { language: "CSS" }),
          repo("css-3", 30, { language: "CSS" }),
          repo("api", 500, { language: "Go" }),
          repo("cli", 300, { language: "Go" }),
          repo("web", 900, { language: "TypeScript" }),
          repo("old", 5, { archived: true, description: "  legacy  " }),
        ],
      }),
      [],
      NOW,
    );
    expect(club.name).toBe("acme");
    expect(club.country).toBe("de");
    // Ranked by repo count, with styling languages below real programming languages.
    expect(club.languages).toEqual([
      { name: "Go", repos: 2 },
      { name: "TypeScript", repos: 2 },
      { name: "CSS", repos: 3 },
    ]);
    expect(club.languageLogo?.name).toBe("Go");
    expect(club.topRepos.map((r) => r.name)).toEqual(["web", "api", "cli", "css-3", "css-2"]);
  });
});

const player = (login: string, position: Position, overall: number, def = 50): SquadPlayer => ({
  login,
  name: login,
  avatarUrl: "",
  overall,
  position,
  finish: "gold",
  def,
  contributions: 0,
});

// n players at one position, best first from `top`.
const many = (prefix: string, position: Position, n: number, top: number) =>
  Array.from({ length: n }, (_, i) => player(`${prefix}${i + 1}`, position, top - i));

const logins = (slots: { player: SquadPlayer | null }[]) => slots.map((s) => s.player?.login ?? null);

describe("pickSquad", () => {
  it("fields a natural 4-3-3 and puts the spare player in goal", () => {
    const squad = pickSquad([...many("d", "CB", 4, 70), ...many("m", "CM", 3, 75), ...many("f", "ST", 4, 85)]);
    expect(squad.formation).toBe("4-3-3");
    expect(squad.moved).toBe(0);
    expect(logins(squad.lines.FWD)).toEqual(["f1", "f2", "f3"]);
    expect(logins(squad.lines.GK)).toEqual(["f4"]);
    expect(squad.size).toBe(11);
  });

  it("picks the formation that moves the fewest players off their line", () => {
    expect(pickSquad([...many("d", "CB", 3, 70), ...many("m", "CM", 6, 70), ...many("f", "ST", 2, 70)]).formation).toBe(
      "3-5-2",
    );
    // 4-4-2 and 3-5-2 both fit everyone: the tie goes to the one listed first.
    expect(pickSquad([...many("d", "CB", 4, 70), ...many("m", "CM", 5, 70), ...many("f", "ST", 2, 70)]).formation).toBe(
      "4-4-2",
    );
    expect(pickSquad([...many("d", "RWB", 4, 70), ...many("m", "CAM", 4, 70), ...many("f", "RW", 3, 70)]).formation).toBe(
      "4-3-3",
    );
  });

  it("puts the leftover with the best DEF in goal, then fills short lines nearest-first, out of position", () => {
    const squad = pickSquad([
      player("cb", "CB", 70),
      player("cm1", "CM", 72),
      player("cm2", "CM", 71),
      ...many("f", "ST", 8, 90).map((p) => (p.login === "f6" ? { ...p, def: 80 } : p)),
    ]);
    // 4-3-3 keeps three strikers up front (the fewest moves); f4..f8 are left over.
    expect(squad.formation).toBe("4-3-3");
    expect(logins(squad.lines.FWD)).toEqual(["f1", "f2", "f3"]);
    expect(logins(squad.lines.GK)).toEqual(["f6"]); // the best DEF of the leftovers
    // The best remaining leftover drops into midfield (nearest), the rest into defence.
    expect(squad.lines.MID.map((s) => [s.player?.login, s.outOfPosition])).toEqual([
      ["cm1", false],
      ["cm2", false],
      ["f4", true],
    ]);
    expect(squad.lines.DEF.map((s) => [s.player?.login, s.outOfPosition])).toEqual([
      ["cb", false],
      ["f5", true],
      ["f7", true],
      ["f8", true],
    ]);
    expect(squad.moved).toBe(4);
    expect(squad.size).toBe(11);
  });

  it("leaves a partial XI with open slots, the goalkeeper's first", () => {
    const squad = pickSquad([player("a", "CB", 80), player("b", "CB", 70), player("c", "CM", 60), player("d", "ST", 51)]);
    expect(squad.formation).toBe("4-3-3");
    expect(logins(squad.lines.GK)).toEqual([null]);
    expect(logins(squad.lines.DEF)).toEqual(["a", "b", null, null]);
    expect(logins(squad.lines.MID)).toEqual(["c", null, null]);
    expect(logins(squad.lines.FWD)).toEqual(["d", null, null]);
    expect(squad.size).toBe(4);
    expect(squad.rating).toBe(65); // (80 + 70 + 60 + 51) / 4 = 65.25
  });

  it("has no rating and every slot open with no players", () => {
    const squad = pickSquad([]);
    expect(squad.rating).toBeNull();
    expect(squad.size).toBe(0);
    expect([squad.lines.GK, squad.lines.DEF, squad.lines.MID, squad.lines.FWD].map((l) => l.length)).toEqual([1, 4, 3, 3]);
  });

  it("takes the best eleven of a bigger pool and rates the squad on them", () => {
    const pool = [...many("d", "CB", 5, 80), ...many("m", "CM", 5, 70), ...many("f", "ST", 3, 60)];
    const squad = pickSquad(pool);
    const fielded = [squad.lines.GK, squad.lines.DEF, squad.lines.MID, squad.lines.FWD].flat().map((s) => s.player!);
    expect(fielded).toHaveLength(11);
    // The two weakest (f2, f3 at 59 and 58) sit out.
    expect(fielded.map((p) => p.login)).not.toContain("f3");
    expect(fielded.map((p) => p.login)).not.toContain("f2");
    expect(squad.rating).toBe(Math.round(fielded.reduce((s, p) => s + p.overall, 0) / 11));
  });
});
