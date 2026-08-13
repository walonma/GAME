// Procedural SVG "pip" art for suits that traditionally show a pattern rather than a
// digit (筒/pin = circles, 索/sou = bamboo sticks). Pure vector shapes, no fonts or image
// assets, so it renders identically (and scales cleanly) on every device.

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
    [1, 1],
  ],
  6: [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  7: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  8: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  9: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
};

const PIP_COLORS = ["#2f6fb0", "#2f8f52", "#b0392f"];

function gridPos(col: number, row: number): [number, number] {
  return [17 + col * 33, 17 + row * 33];
}

export function PinPips({ count }: { count: number }) {
  const positions = PIP_LAYOUTS[count] ?? [];
  const single = count === 1;
  return (
    <svg className="tile-pip-svg" viewBox="0 0 100 100" aria-hidden="true">
      {positions.map(([col, row], i) => {
        const [cx, cy] = gridPos(col, row);
        const r = single ? 24 : 13;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill={PIP_COLORS[i % PIP_COLORS.length]} />
            <circle cx={cx} cy={cy} r={r * 0.4} fill="#fdf8ec" opacity={0.9} />
          </g>
        );
      })}
    </svg>
  );
}

export function SouBamboo({ count }: { count: number }) {
  const positions = PIP_LAYOUTS[count] ?? [];
  const single = count === 1;
  return (
    <svg className="tile-pip-svg" viewBox="0 0 100 100" aria-hidden="true">
      {positions.map(([col, row], i) => {
        const [cx, cy] = gridPos(col, row);
        const w = single ? 16 : 10;
        const h = single ? 56 : 27;
        return (
          <g key={i}>
            <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={w / 2} fill="#2f7d4f" />
            <line x1={cx - w / 2 + 1.5} y1={cy - h / 6} x2={cx + w / 2 - 1.5} y2={cy - h / 6} stroke="#1f5636" strokeWidth={1.5} />
            <line x1={cx - w / 2 + 1.5} y1={cy + h / 6} x2={cx + w / 2 - 1.5} y2={cy + h / 6} stroke="#1f5636" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}

/** Simplified flower-tile icon: a 5-petal blossom for the plant tiles (梅蘭竹菊), a small sun/sparkle for the season tiles (春夏秋冬). */
export function FlowerIcon({ season }: { season: boolean }) {
  if (season) {
    const rays = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI) / 4;
      const x1 = 50 + Math.cos(angle) * 16;
      const y1 = 50 + Math.sin(angle) * 16;
      const x2 = 50 + Math.cos(angle) * 26;
      const y2 = 50 + Math.sin(angle) * 26;
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c99a2e" strokeWidth={4} strokeLinecap="round" />;
    });
    return (
      <svg className="tile-flower-svg" viewBox="0 0 100 100" aria-hidden="true">
        {rays}
        <circle cx={50} cy={50} r={14} fill="#e6b94d" />
      </svg>
    );
  }

  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const cx = 50 + Math.cos(angle) * 18;
    const cy = 50 + Math.sin(angle) * 18;
    const deg = (angle * 180) / Math.PI;
    return <ellipse key={i} cx={cx} cy={cy} rx={14} ry={9} fill="#d9679a" transform={`rotate(${deg + 90} ${cx} ${cy})`} />;
  });
  return (
    <svg className="tile-flower-svg" viewBox="0 0 100 100" aria-hidden="true">
      {petals}
      <circle cx={50} cy={50} r={9} fill="#e6b94d" />
    </svg>
  );
}
