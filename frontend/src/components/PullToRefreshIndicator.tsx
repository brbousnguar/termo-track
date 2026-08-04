import type { PullState } from "../hooks/usePullToRefresh";

interface Props {
  pullState: PullState;
  pullDistance: number;
}

const THRESHOLD = 80;

export function PullToRefreshIndicator({ pullState, pullDistance }: Props) {
  if (pullState === "idle" && pullDistance === 0) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const opacity = pullState === "refreshing" ? 1 : Math.min(progress * 1.5, 1);

  let label: string;
  let icon: string;
  if (pullState === "refreshing") {
    label = "Refreshing…";
    icon = "⟳";
  } else if (pullState === "ready") {
    label = "Release to refresh";
    icon = "↑";
  } else {
    label = "Pull to refresh";
    icon = "↓";
  }

  return (
    <div
      className="ptr-indicator"
      style={{
        opacity,
        transform: `translateY(${Math.min(pullDistance * 0.4, 50)}px) scale(${0.8 + progress * 0.2})`,
      }}
    >
      <span
        className={`ptr-icon${pullState === "ready" ? " ptr-icon-ready" : ""}${pullState === "refreshing" ? " ptr-icon-spin" : ""}`}
      >
        {icon}
      </span>
      <span className="ptr-label">{label}</span>
    </div>
  );
}
