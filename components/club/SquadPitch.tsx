"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import type { Line } from "@/lib/lines";
import type { Squad, SquadSlot } from "@/lib/scoring/club";
import { cardDisplayName } from "@/lib/text";
import { RESULT_THEME } from "../finishTheme";

// The starting XI on a pitch, attack at the top: one row per line, one chip per
// slot (avatar ringed in the player's tier ink, overall, position), each linking
// to the player's card. Chips share a row's width, so a five-man midfield still
// fits a 375px screen.

const ROWS: Line[] = ["FWD", "MID", "DEF", "GK"];
const ROW_LABEL: Record<Line, string> = { FWD: "Forwards", MID: "Midfielders", DEF: "Defenders", GK: "Goalkeeper" };
const PLAYING: Record<Line, string> = { FWD: "up front", MID: "in midfield", DEF: "in defence", GK: "in goal" };

// Mown stripes over a deep green, under faint white markings.
const PITCH =
  "repeating-linear-gradient(180deg, rgba(255,255,255,.028) 0 12.5%, transparent 12.5% 25%), linear-gradient(180deg, #05271b, #03190f)";
const MARKING = "pointer-events-none absolute border-white/[0.1]";
const AVATAR = "h-[clamp(38px,11vw,52px)] w-[clamp(38px,11vw,52px)]";

const hideOnError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  e.currentTarget.style.visibility = "hidden";
};

function Chip({ slot, line }: { slot: SquadSlot; line: Line }) {
  const base = "flex min-w-0 max-w-[92px] flex-1 basis-0 flex-col items-center text-center";
  const p = slot.player;
  if (!p) {
    return (
      <li className={base}>
        <span
          className={`font-display grid ${AVATAR} place-items-center rounded-full border border-dashed border-white/25 bg-black/20 text-[11px] tracking-[.12em] text-ink-mute`}
        >
          {line}
        </span>
        <span className="mt-[8px] text-[11.5px] text-ink-mute">Open</span>
      </li>
    );
  }

  const theme = RESULT_THEME[p.finish];
  const keeper = line === "GK";
  const title = keeper
    ? `${p.name}, a ${p.position} in goal`
    : slot.outOfPosition
      ? `${p.name}, a ${p.position} playing ${PLAYING[line]}`
      : `${p.name}, ${p.position}`;
  return (
    <li className={base}>
      <Link
        href={`/${p.login}`}
        title={title}
        aria-label={`${title}, overall ${p.overall}`}
        className="group flex w-full min-w-0 flex-col items-center"
      >
        <span className="relative">
          <span
            className={`block ${AVATAR} overflow-hidden rounded-full border-2 bg-black/30`}
            style={{ borderColor: theme.ink }}
          >
            <img src={p.avatarUrl} onError={hideOnError} alt="" className="h-full w-full object-cover" />
          </span>
          <span
            className="font-display absolute -bottom-[5px] -right-[7px] min-w-[24px] rounded-[6px] border px-[4px] text-[14px] leading-[17px] tabular-nums"
            style={{ background: theme.chip, color: theme.ink, borderColor: `${theme.ink}55` }}
          >
            {p.overall}
          </span>
        </span>
        <span className="mt-[8px] w-full truncate text-[clamp(11px,3vw,12.5px)] font-semibold leading-tight text-ink-dim transition group-hover:text-brand">
          {cardDisplayName(p.name)}
        </span>
        <span className="font-display mt-[2px] inline-flex items-center gap-[3px] text-[11.5px] leading-none tracking-[.1em] text-ink-faint">
          {keeper ? "GK" : p.position}
          {slot.outOfPosition && <ArrowLeftRight size={11} className="text-gold-hi" aria-hidden />}
        </span>
      </Link>
    </li>
  );
}

export default function SquadPitch({ squad }: { squad: Squad }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/[0.08] px-[6px] py-[22px]"
      style={{ background: PITCH }}
    >
      <div aria-hidden className={`${MARKING} inset-[8px] rounded-lg border`} />
      <div aria-hidden className={`${MARKING} inset-x-[8px] top-1/2 border-t`} />
      <div
        aria-hidden
        className={`${MARKING} left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 rounded-full border`}
      />
      <div aria-hidden className={`${MARKING} left-1/2 top-[8px] h-[12%] w-[46%] -translate-x-1/2 border border-t-0`} />
      <div aria-hidden className={`${MARKING} bottom-[8px] left-1/2 h-[12%] w-[46%] -translate-x-1/2 border border-b-0`} />

      <div className="relative flex flex-col gap-[clamp(16px,3.6vw,26px)]">
        {ROWS.map((line) => (
          <ul key={line} aria-label={ROW_LABEL[line]} className="flex justify-center gap-[clamp(4px,1.6vw,14px)]">
            {squad.lines[line].map((slot, i) => (
              <Chip key={slot.player?.login ?? `open-${i}`} slot={slot} line={line} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
