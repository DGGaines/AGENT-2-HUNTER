import { useMemo } from "react";
import type { Candidate, MajorTick, Seat } from "@/lib/types";
import { pct } from "@/lib/format";
import { HOUSE_SYMBOLS } from "@/lib/config";

type Props = {
  hunt: Candidate[];
  majors: MajorTick[];
  seats: Seat[];
  scanning: boolean;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Constellation({ hunt, majors, seats, scanning }: Props) {
  const seated = useMemo(() => new Set(seats.map((s) => s.mint)), [seats]);
  const house = HOUSE_SYMBOLS.map((sym, i) => {
    const tick = majors.find((m) => m.symbol === sym);
    const a = (i / HOUSE_SYMBOLS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      symbol: sym,
      x: 200 + Math.cos(a) * 48,
      y: 168 + Math.sin(a) * 38,
      change: tick?.change24h ?? 0,
    };
  });

  const bodies = hunt.map((c, i) => {
    const n = Math.max(hunt.length, 1);
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (hash(c.mint) % 20) / 80;
    const spread = 138 + (hash(c.mint) % 18);
    const mag = Math.min(36, 20 + Math.abs(c.change1h) * 0.4);
    return {
      c,
      x: 200 + Math.cos(a) * spread,
      y: 170 + Math.sin(a) * (spread * 0.72),
      r: mag,
      seated: seated.has(c.mint),
    };
  });

  return (
    <div className="relative overflow-hidden rounded-[2px] border border-line bg-well">
      <svg viewBox="0 0 400 340" className="h-[280px] w-full sm:h-[340px]">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3dffc0" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3dffc0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="170" r="150" fill="url(#glow)" />
        {scanning ? (
          <g className="scan-beam">
            <path d="M200 170 L200 20 A150 150 0 0 1 320 80 Z" fill="#ff2ccb" opacity="0.07" />
          </g>
        ) : null}

        {house.map((h) => (
          <g key={h.symbol}>
            <circle
              cx={h.x}
              cy={h.y}
              r="16"
              fill="#0c0b14"
              stroke="#ff2ccb"
              strokeWidth="1.2"
              opacity="0.7"
            />
            <text
              x={h.x}
              y={h.y - 1}
              textAnchor="middle"
              fill="#ff2ccb"
              fontSize="8"
              fontFamily="Rajdhani, sans-serif"
              letterSpacing="0.08em"
            >
              {h.symbol}
            </text>
            <text
              x={h.x}
              y={h.y + 9}
              textAnchor="middle"
              fill={h.change >= 0 ? "#3dffc0" : "#ff3b5c"}
              fontSize="7"
              fontFamily="IBM Plex Mono, monospace"
            >
              {pct(h.change, 1)}
            </text>
          </g>
        ))}

        {bodies.map((b) => (
          <g key={b.c.mint} className="bubble-live">
            <circle
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill="#07060c"
              stroke={b.seated ? "#ff2ccb" : "#3dffc0"}
              strokeWidth={b.seated ? 2.4 : 1.6}
            />
            {b.seated ? (
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r + 6}
                fill="none"
                stroke="#ff2ccb"
                strokeWidth="0.8"
                opacity="0.6"
              />
            ) : null}
            <text
              x={b.x}
              y={b.y - 6}
              textAnchor="middle"
              fill="#f2ecf6"
              fontSize="10"
              fontFamily="Rajdhani, sans-serif"
              fontWeight="700"
              letterSpacing="0.12em"
            >
              {b.c.symbol.slice(0, 6)}
            </text>
            <text
              x={b.x}
              y={b.y + 8}
              textAnchor="middle"
              fill={b.c.change1h >= 0 ? "#3dffc0" : "#ff3b5c"}
              fontSize="10"
              fontFamily="IBM Plex Mono, monospace"
            >
              {pct(b.c.change1h)}
            </text>
            {b.seated ? (
              <text
                x={b.x}
                y={b.y + 18}
                textAnchor="middle"
                fill="#ff2ccb"
                fontSize="7"
                fontFamily="Rajdhani, sans-serif"
                letterSpacing="0.14em"
              >
                SEAT
              </text>
            ) : null}
          </g>
        ))}

        {bodies.length === 0 ? (
          <text
            x="200"
            y="176"
            textAnchor="middle"
            fill="#8a8296"
            fontSize="12"
            fontFamily="Rajdhani, sans-serif"
            letterSpacing="0.18em"
          >
            NO SELLABLE NAMES
          </text>
        ) : null}
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-3 font-ui text-[10px] tracking-[0.14em] text-dim">
        INNER RING MAJORS · OUTER HUNT · MAJORS MAY SIT IF THEY CLEAR GATES
      </div>
    </div>
  );
}
