"use client";

import { memo } from "react";

// GitFutbol mascot — the cute wolf biting the ball (public/logo). Small sizes swap
// to the simpler head, because the facets and rays turn to mush below about
// 96px. `animate` adds a gentle float (used on the hero/loading screen). The
// legacy `kick`/`ball` props are accepted but no longer composite anything.
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
      src={size <= 96 ? "/logo/wolf-cute-small.svg" : "/logo/wolf-cute.svg"}
      alt="GitFutbol mascot — a cute purple wolf biting a football"
      width={size}
      height={size}
      className={`${animate ? "animate-float" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

export default memo(Mascot);
