import type { Position } from "./scoring/types";

// Squad lines for team views (national squads, club squads). The engine has no
// goalkeeper position, so every scouted position maps to an outfield line; each
// team view decides how it picks its goalkeepers.
export type Line = "GK" | "DEF" | "MID" | "FWD";
export type OutfieldLine = Exclude<Line, "GK">;

export const LINE_OF: Record<Position, OutfieldLine> = {
  ST: "FWD",
  CF: "FWD",
  RW: "FWD",
  LW: "FWD",
  SS: "FWD",
  CAM: "MID",
  CM: "MID",
  CDM: "MID",
  CB: "DEF",
  RWB: "DEF",
  LWB: "DEF",
  RFB: "DEF",
  LFB: "DEF",
};
