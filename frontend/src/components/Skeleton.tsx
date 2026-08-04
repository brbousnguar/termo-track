interface BoxProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function SkeletonBox({
  width = "100%",
  height = 20,
  borderRadius = 8,
  className = "",
}: BoxProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
      }}
    />
  );
}

export function SkeletonText({ width = "60%", className = "" }: { width?: string | number; className?: string }) {
  return (
    <div
      className={`skeleton skeleton-text ${className}`}
      style={{ width: typeof width === "number" ? `${width}px` : width }}
    />
  );
}

/** A chart-shaped skeleton: a large rectangle with a few horizontal "axis" lines. */
export function SkeletonChart({ height = 260 }: { height?: number }) {
  return (
    <div className="skeleton-chart" style={{ height }}>
      <SkeletonBox height={height - 40} borderRadius={8} />
      <div className="skeleton-chart-axes">
        <SkeletonText width="30%" />
        <SkeletonText width="45%" />
        <SkeletonText width="20%" />
      </div>
    </div>
  );
}

/** A table-shaped skeleton with a header row and data rows. */
export function SkeletonTable({
  rows = 2,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="skeleton-table">
      {/* Header */}
      <div className="skeleton-table-row">
        <SkeletonBox width={60} height={14} borderRadius={4} />
        {Array.from({ length: cols - 1 }).map((_, i) => (
          <SkeletonBox key={`h-${i}`} width={40} height={14} borderRadius={4} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row">
          <SkeletonText width={80} />
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <SkeletonBox key={`d-${r}-${c}`} width={36} height={16} borderRadius={4} />
          ))}
        </div>
      ))}
    </div>
  );
}
