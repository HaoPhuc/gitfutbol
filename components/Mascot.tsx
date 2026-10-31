"use client";

import { memo } from "react";

// GitFut mascot — the low-poly wolf logo (public/logo). Small sizes swap to the
// solid head, because the facets turn to mush below about 64px. `animate` adds
// a gentle float (used on the hero/loading screen). The legacy `kick`/`ball`
// props are accepted but no longer composite anything.
interface MascotProps {
  size?: number;
  className?: string;
  animate?: boolean;
  /** @deprecated ball is baked into the asset; kept for call-site compatibility */
  kick?: boolean;
  /** @deprecated ball is baked into the asset; kept for call-site compatibility */
  ball?: boolean;
}

function Mascot({ size = 220, className, animate = true }: MascotProps) {
  return (
    <img
      src={size <= 64 ? "/logo/wolf-small.svg" : "/logo/wolf-head.svg"}
      alt="GitFut mascot — a low-poly purple wolf"
      width={size}
      height={size}
      className={`${animate ? "animate-float" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

export default memo(Mascot);
