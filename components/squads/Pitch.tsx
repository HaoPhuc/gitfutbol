import Link from "next/link";
import type { Line } from "@/lib/lines";
import type { PlayerEntry } from "@/lib/registry";
import { FORMATION, shortName, type Squad } from "@/lib/squad";
import { Avatar } from "./Media";

// The starting XI on a pitch, attack at the top like a FUT team sheet. Every
// slot of the 4-3-3 is drawn; one the squad can't fill shows as open.

const ROWS: readonly Line[] = ["FWD", "MID", "DEF", "GK"];
const ROW_LABEL: Record<Line, string> = { GK: "Goalkeeper", DEF: "Defence", MID: "Midfield", FWD: "Attack" };

// Chips share their row: four defenders still fit side by side at 375px.
const SLOT = "flex min-w-0 max-w-[96px] flex-1 basis-0 flex-col items-center text-center";
const FACE = "h-[clamp(40px,11vw,56px)] w-[clamp(40px,11vw,56px)]";

function Chip({ player, line }: { player: PlayerEntry; line: Line }) {
  // Keepers are outfielders in goal (lib/squad), so the slot names the role.
  const position = line === "GK" ? "GK" : player.position;
  return (
    <Link
      href={`/${player.login}`}
      title={`${player.name || player.login} · ${player.overall} ${player.position}`}
      className={`group ${SLOT} rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60`}
    >
      <span className="relative">
        <Avatar
          src={player.avatarUrl}
          px={56}
          className={`${FACE} border-2 border-white/25 shadow-[0_6px_16px_rgba(0,0,0,.45)] transition group-hover:border-brand`}
        />
        <span className="font-display absolute -bottom-[6px] left-1/2 -translate-x-1/2 rounded-[5px] border border-gold/45 bg-bg px-[5px] text-[14px] leading-[1.25] tabular-nums text-gold-hi">
          {player.overall}
        </span>
      </span>
      <span className="mt-[10px] w-full truncate text-[12px] font-semibold text-ink transition group-hover:text-brand">
        {shortName(player)}
      </span>
      <span className="font-display text-[11px] tracking-[.14em] text-ink-faint">{position}</span>
    </Link>
  );
}

function OpenSlot({ line }: { line: Line }) {
  return (
    <div className={SLOT}>
      <span
        aria-hidden
        className={`${FACE} flex items-center justify-center rounded-full border-2 border-dashed border-white/20 text-[18px] text-white/30`}
      >
        +
      </span>
      <span className="mt-[10px] text-[12px] text-ink-mute">Open</span>
      <span className="font-display text-[11px] tracking-[.14em] text-ink-mute">{line}</span>
    </div>
  );
}

function Markings() {
  const ink = "border-white/[0.13]";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[10px]">
      <div className={`absolute inset-0 rounded-[3px] border ${ink}`} />
      <div className={`absolute inset-x-0 top-1/2 border-t ${ink}`} />
      <div
        className={`absolute left-1/2 top-1/2 aspect-square w-[24%] max-w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full border ${ink}`}
      />
      {/* penalty and goal areas, both ends */}
      <div className={`absolute left-1/2 top-0 h-[14%] w-[50%] -translate-x-1/2 border border-t-0 ${ink}`} />
      <div className={`absolute left-1/2 top-0 h-[6%] w-[24%] -translate-x-1/2 border border-t-0 ${ink}`} />
      <div className={`absolute bottom-0 left-1/2 h-[14%] w-[50%] -translate-x-1/2 border border-b-0 ${ink}`} />
      <div className={`absolute bottom-0 left-1/2 h-[6%] w-[24%] -translate-x-1/2 border border-b-0 ${ink}`} />
    </div>
  );
}

export default function Pitch({ xi }: { xi: Squad["xi"] }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-xl border border-white/[0.08]"
      style={{ background: "repeating-linear-gradient(180deg, #0b2a1a 0 12.5%, #0d311e 12.5% 25%)" }}
    >
      <Markings />
      <div className="relative flex flex-col gap-[clamp(18px,4vw,30px)] px-[clamp(8px,3vw,28px)] py-[clamp(22px,4vw,34px)]">
        {ROWS.map((line) => (
          <div key={line} className="flex justify-center gap-[clamp(4px,2vw,18px)]">
            <span className="sr-only">{ROW_LABEL[line]}</span>
            {Array.from({ length: FORMATION[line] }, (_, i) => {
              const p = xi[line][i];
              return p ? <Chip key={p.login} player={p} line={line} /> : <OpenSlot key={`open-${i}`} line={line} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
