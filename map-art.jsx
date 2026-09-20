// Treasure-map pieces: parchment paper, ink drawings and map-style controls.
// Everything is drawn with SVG + CSS, so there are no extra image files.

export const MAP = {
  ink: "#3a2412",
  inkSoft: "rgba(58, 36, 18, 0.6)",
  red: "#a82a1e",
  blue: "#2e5e7e",
  green: "#4d6b34",
  cream: "#f6ead0",
  sand: "#c9a061",
  gold: "#e3b445",
  wood: "#8a5a2b",
};

export const FONT_TITLE = "'Pirata One', 'Ma Shan Zheng', serif";
export const FONT_BRUSH = "'Ma Shan Zheng', 'Pirata One', serif";
export const FONT_TEXT = "'IM Fell English', Georgia, serif";

// ---------- shared filters + animations ----------

export function MapDefs() {
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          {/* rough, torn edge for the paper */}
          <filter id="roughEdge" x="-3%" y="-3%" width="106%" height="106%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.025" numOctaves="4" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* tiny wobble so ink lines look hand-drawn */}
          <filter id="inkWobble" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <style>{`
        @keyframes routeFlow { to { stroke-dashoffset: -160; } }
        @keyframes shipBob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes compassSway {
          0%   { transform: rotate(-5deg); }
          100% { transform: rotate(5deg); }
        }
        @keyframes waveDrift {
          0%   { transform: translateX(-5px); }
          100% { transform: translateX(7px); }
        }
        @keyframes sealPulse {
          0%, 100% { transform: scale(1) rotate(-3deg); }
          50%      { transform: scale(1.05) rotate(2deg); }
        }
        @keyframes cloudFly { from { transform: translateX(-42vw); } to { transform: translateX(112vw); } }
        @keyframes birdFly {
          from { transform: translate(-8vw, 0); }
          50%  { transform: translate(50vw, -3vh); }
          to   { transform: translate(112vw, 2vh); }
        }
        @keyframes birdFlap { from { transform: scaleY(1); } to { transform: scaleY(0.45); } }
        @keyframes seaSlide { from { transform: translateX(0); } to { transform: translateX(-1600px); } }
        @keyframes dashFlow { to { stroke-dashoffset: -56; } }
        @keyframes flagWave {
          from { transform: skewY(-4deg) scaleX(1); }
          to   { transform: skewY(4deg) scaleX(0.93); }
        }
        @keyframes floeDrift { from { transform: translateX(-24px); } to { transform: translateX(40px); } }
        @keyframes threadShimmer { from { opacity: 0.16; } to { opacity: 0.42; } }
        @keyframes petalDrift {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translate(-300px, 700px) rotate(260deg); opacity: 0; }
        }
        @keyframes waveSlide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes arrowFly {
          0%   { transform: translateX(0); opacity: 1; }
          28%  { transform: translateX(var(--dx)); opacity: 1; }
          78%  { transform: translateX(var(--dx)); opacity: 1; }
          100% { transform: translateX(var(--dx)); opacity: 0; }
        }
        @keyframes hitPop {
          0%   { transform: translateX(-50%) scale(1); opacity: 1; }
          30%  { transform: translateX(-50%) scale(1.25) rotate(-3deg); opacity: 1; }
          100% { transform: translateX(-50%) scale(0.7) translateY(-24px); opacity: 0; }
        }
        @keyframes hitTint {
          from { color: ${MAP.ink}; }
          to   { color: #2f7a2a; }
        }
        @keyframes burst {
          0%   { transform: scale(0.2) rotate(0deg); opacity: 0; }
          20%  { opacity: 1; }
          45%  { transform: scale(1) rotate(12deg); opacity: 1; }
          100% { transform: scale(1.4) rotate(22deg); opacity: 0; }
        }
        @keyframes missShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(3px); }
        }
        .map-input::placeholder { color: ${MAP.inkSoft}; font-style: italic; }
        .map-island { transition: opacity .2s, filter .2s; }
        .map-island .map-island-art { transition: transform .2s; }
        .map-island:hover { opacity: 1 !important; filter: brightness(1.08); }
        .map-island:hover .map-island-art { transform: translateY(-5px); }
        .map-sheet button:focus-visible { outline: 3px dashed ${MAP.red}; outline-offset: 4px; }
        .map-chip:hover { transform: rotate(-1.5deg); }
        .map-ink-btn:hover { transform: translateY(-2px); }
        .map-seal:hover { filter: brightness(1.1); }
        .map-sheet textarea::placeholder { color: ${MAP.inkSoft}; }
        @media (prefers-reduced-motion: reduce) {
          .map-anim, .map-sheet *, .backdrop * { animation: none !important; }
        }
      `}</style>
    </>
  );
}

// ---------- the paper sheet ----------

const GRAIN =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/>" +
      "<feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.27  0 0 0 0 0.12  0 0 0 0.9 -0.3'/></filter>" +
      "<rect width='100%' height='100%' filter='url(#n)'/></svg>"
  ) +
  '")';

const PAPER_GRADIENT =
  "radial-gradient(ellipse at 18% 12%, rgba(255,242,205,0.6), transparent 55%)," +
  "radial-gradient(circle at 80% 84%, rgba(140,80,30,0.3), transparent 24%)," +
  "radial-gradient(circle at 10% 90%, rgba(140,80,30,0.22), transparent 16%)," +
  "radial-gradient(ellipse at 50% 50%, #ecd7a6 0%, #e0c48a 65%, #c9a061 100%)";

const FOLD = (pos, dir) =>
  `linear-gradient(${dir}, transparent calc(${pos}% - 2px), rgba(80,45,10,0.26) calc(${pos}% - 1px), rgba(255,245,215,0.38) ${pos}%, transparent calc(${pos}% + 3px))`;

export function MapSheet({ children, contentWidth = 1180, center = false }) {
  return (
    <div className="map-sheet" style={sheet.wrap}>
      <MapDefs />
      <div style={sheet.paper}>
        <div style={sheet.folds} />
        <div style={sheet.grain} />
      </div>
      <div style={{ ...sheet.content, maxWidth: contentWidth, ...(center ? { justifyContent: "center" } : {}) }}>
        {children}
      </div>
    </div>
  );
}

const sheet = {
  wrap: {
    position: "relative",
    flex: 1,
    width: "100%",
    minHeight: "100vh",
    overflow: "hidden",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    color: MAP.ink,
    fontFamily: FONT_TEXT,
  },
  paper: {
    position: "absolute",
    inset: -30,
    background: PAPER_GRADIENT,
    boxShadow: "inset 0 0 90px 12px rgba(110,60,15,0.55)",
    filter: "url(#roughEdge) drop-shadow(0 18px 28px rgba(0,0,0,0.55))",
  },
  folds: {
    position: "absolute",
    inset: 0,
    backgroundImage: [FOLD(33.33, "90deg"), FOLD(66.66, "90deg"), FOLD(50, "180deg")].join(","),
  },
  grain: {
    position: "absolute",
    inset: 0,
    backgroundImage: GRAIN,
    mixBlendMode: "multiply",
    opacity: 0.7,
  },
  content: {
    position: "relative",
    flex: 1,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    padding: "46px 64px 40px",
  },
};

// ---------- ink drawings ----------

// The Straw Hat Pirates mark: grinning skull, crossed bones behind, straw hat with a red band.
function RogerShapes() {
  const bones = [
    [20, 92, 100, 44],
    [100, 92, 20, 44],
  ];
  return (
    <>
      {bones.map(([x1, y1, x2, y2], i) => {
        const len = Math.hypot(x2 - x1, y2 - y1);
        const nx = (-(y2 - y1) / len) * 4.5;
        const ny = ((x2 - x1) / len) * 4.5;
        return (
          <g key={i} strokeLinecap="round">
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={MAP.ink} strokeWidth="13" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={MAP.cream} strokeWidth="7" />
            {[[x1, y1], [x2, y2]].flatMap(([x, y], j) =>
              [1, -1].map((k) => (
                <circle key={`${j}${k}`} cx={x + nx * k} cy={y + ny * k} r="5.5" fill={MAP.cream} stroke={MAP.ink} strokeWidth="2.4" />
              ))
            )}
          </g>
        );
      })}
      {/* skull: round cranium, wide toothy grin */}
      <ellipse cx="60" cy="52" rx="28" ry="25" fill={MAP.cream} stroke={MAP.ink} strokeWidth="3" />
      <path d="M40 66 h40 v10 q0 6 -6 6 h-28 q-6 0 -6 -6 z" fill={MAP.cream} stroke={MAP.ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M46 67 v14 M53 68 v14 M60 68 v14 M67 68 v14 M74 67 v14 M41 74 h38" stroke={MAP.ink} strokeWidth="1.8" fill="none" />
      <ellipse cx="48" cy="54" rx="7.5" ry="9.5" fill={MAP.ink} transform="rotate(8 48 54)" />
      <ellipse cx="72" cy="54" rx="7.5" ry="9.5" fill={MAP.ink} transform="rotate(-8 72 54)" />
      <path d="M60 60 l-4.5 8 h9 z" fill={MAP.ink} />
      {/* straw hat: brim, crown, red band */}
      <ellipse cx="60" cy="31" rx="50" ry="10" fill={MAP.gold} stroke={MAP.ink} strokeWidth="3" />
      <path d="M32 31 C32 2 88 2 88 31 C74 37 46 37 32 31 Z" fill={MAP.gold} stroke={MAP.ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M32.6 27 C46 33 74 33 87.4 27 L88 33 C74 39 46 39 32 33 Z" fill={MAP.red} stroke={MAP.ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 30 C40 38 80 38 100 30" fill="none" stroke={MAP.ink} strokeWidth="1.2" opacity="0.5" />
      <path d="M48 8 C56 5 66 5 74 9 M44 15 C56 11 68 11 78 16" fill="none" stroke={MAP.ink} strokeWidth="1" opacity="0.45" />
    </>
  );
}

export function JollyRoger({ size = 90 }) {
  return (
    <svg viewBox="0 0 120 100" width={size} height={(size * 100) / 120} style={{ filter: "url(#inkWobble)" }} aria-hidden="true">
      <RogerShapes />
    </svg>
  );
}

export function Compass({ size = 130 }) {
  const ticks = Array.from({ length: 32 }, (_, i) => i);
  return (
    <div className="map-anim" style={{ width: size, height: size, animation: "compassSway 7s ease-in-out infinite alternate" }}>
      <svg viewBox="-115 -115 230 230" width={size} height={size} style={{ filter: "url(#inkWobble)" }} aria-hidden="true">
        <circle r="82" fill="rgba(246,234,208,0.35)" stroke={MAP.ink} strokeWidth="2.5" />
        <circle r="72" fill="none" stroke={MAP.ink} strokeWidth="1" strokeDasharray="2 4" />
        {ticks.map((i) => (
          <line
            key={i}
            x1="0"
            y1="-82"
            x2="0"
            y2={i % 4 === 0 ? -68 : -75}
            transform={`rotate(${i * 11.25})`}
            stroke={MAP.ink}
            strokeWidth={i % 4 === 0 ? 2 : 1}
          />
        ))}
        <polygon
          points="0,-60 10,-10 60,0 10,10 0,60 -10,10 -60,0 -10,-10"
          transform="rotate(45)"
          fill="none"
          stroke={MAP.ink}
          strokeWidth="1.5"
        />
        <polygon points="0,-98 15,-15 98,0 15,15 0,98 -15,15 -98,0 -15,-15" fill={MAP.cream} stroke={MAP.ink} strokeWidth="2.2" />
        <polygon points="0,-98 15,-15 0,0" fill={MAP.red} />
        <polygon points="0,-98 -15,-15 0,0" fill={MAP.ink} opacity="0.8" />
        <polygon points="0,98 15,15 0,0" fill={MAP.ink} opacity="0.8" />
        <polygon points="-98,0 -15,-15 0,0" fill={MAP.ink} opacity="0.5" />
        <circle r="6" fill={MAP.ink} />
        <text y="-103" textAnchor="middle" fontFamily={FONT_TITLE} fontSize="24" fill={MAP.red}>
          N
        </text>
      </svg>
    </div>
  );
}

export function Ship({ size = 110 }) {
  return (
    <svg viewBox="0 -16 120 124" width={size} height={(size * 124) / 120} style={{ filter: "url(#inkWobble)" }} aria-hidden="true">
      {/* sails */}
      <path d="M60 24 C36 28 30 44 32 60 C44 57 54 58 60 62 Z" fill={MAP.cream} stroke={MAP.ink} strokeWidth="2" />
      <path d="M60 12 C102 18 108 46 102 66 C86 61 70 61 60 66 Z" fill={MAP.cream} stroke={MAP.ink} strokeWidth="2.2" />
      {/* the jolly roger on the main sail */}
      <g transform="translate(62 25) scale(0.36)">
        <RogerShapes />
      </g>
      {/* mast + bowsprit */}
      <path d="M60 70 V-14" stroke={MAP.ink} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M14 72 L2 62" stroke={MAP.ink} strokeWidth="3" strokeLinecap="round" />
      {/* black flag with the mark, waving edge */}
      <path d="M60 -15 L96 -12 C92 -5 92 2 96 9 L60 7 Z" fill="#1b1208" stroke={MAP.ink} strokeWidth="1.6" strokeLinejoin="round" />
      <g transform="translate(69 -13) scale(0.2)">
        <RogerShapes />
      </g>
      {/* hull */}
      <path d="M12 70 L108 70 C102 90 84 98 60 98 C36 98 18 90 12 70 Z" fill={MAP.wood} stroke={MAP.ink} strokeWidth="2.6" />
      <path d="M17 80 H103" stroke={MAP.ink} strokeWidth="1.2" opacity="0.7" />
      <circle cx="40" cy="76" r="2.2" fill={MAP.ink} />
      <circle cx="60" cy="76" r="2.2" fill={MAP.ink} />
      <circle cx="80" cy="76" r="2.2" fill={MAP.ink} />
      {/* water */}
      <path
        d="M4 100 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0"
        fill="none"
        stroke={MAP.blue}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WaveMarks() {
  const marks = [
    { x: 4, y: 12, s: 1 },
    { x: 30, y: 4, s: 0.8 },
    { x: 68, y: 8, s: 1.1 },
    { x: 92, y: 24, s: 0.8 },
    { x: 32, y: 88, s: 1 },
    { x: 60, y: 80, s: 0.9 },
    { x: 2, y: 88, s: 0.8 },
    { x: 92, y: 90, s: 1 },
  ];
  return marks.map((m, i) => (
    <svg
      key={i}
      className="map-anim"
      viewBox="0 0 72 16"
      width={72 * m.s}
      style={{
        position: "absolute",
        left: `${m.x}%`,
        top: `${m.y}%`,
        opacity: 0.6,
        animation: `waveDrift ${4 + (i % 3)}s ease-in-out ${i * -0.7}s infinite alternate`,
      }}
      aria-hidden="true"
    >
      <g fill="none" stroke={MAP.blue} strokeWidth="2.4" strokeLinecap="round">
        <path d="M2 11 q6 -9 12 0 t12 0 t12 0 t12 0 t12 0" />
        <path d="M14 4 q5 -6 10 0 t10 0 t10 0" />
      </g>
    </svg>
  ));
}

// ---------- islands + the sailing route ----------

function IslandArt({ kind, selected }) {
  const shores = {
    easy: "M12 78 C10 58 32 46 55 50 C70 36 104 38 118 54 C142 56 152 72 140 86 C120 100 40 102 12 78 Z",
    medium: "M10 80 C6 60 28 52 44 56 C52 30 92 24 108 46 C130 42 152 60 146 80 C134 98 30 100 10 80 Z",
    hard: "M14 84 C8 66 26 58 40 60 C48 40 60 34 72 40 C96 34 110 42 124 54 C146 56 154 78 138 90 C110 104 34 102 14 84 Z",
  };
  return (
    <svg viewBox="-8 -18 176 138" width="100%" style={{ display: "block", filter: "url(#inkWobble)" }} aria-hidden="true">
      {/* water ripples around the shore */}
      <ellipse cx="80" cy="84" rx="80" ry="22" fill="none" stroke={MAP.blue} strokeWidth="1.6" strokeDasharray="7 6" opacity="0.6" />
      <path d={shores[kind]} fill="rgba(201,160,97,0.7)" stroke={MAP.ink} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M30 88 q10 4 22 2 M92 92 q14 3 30 -2" fill="none" stroke={MAP.ink} strokeWidth="1.2" opacity="0.5" />

      {kind === "easy" && (
        <g>
          {/* palm tree */}
          <path d="M96 62 C98 50 94 40 100 28" fill="none" stroke={MAP.ink} strokeWidth="3.4" strokeLinecap="round" />
          <g fill="#6b8f45" stroke={MAP.ink} strokeWidth="1.5" strokeLinejoin="round">
            <path d="M100 28 Q84 14 70 26 Q88 22 100 28 Z" />
            <path d="M100 28 Q104 10 122 14 Q108 18 100 28 Z" />
            <path d="M100 28 Q120 24 128 40 Q114 32 100 28 Z" />
            <path d="M100 28 Q90 12 78 8 Q94 16 100 28 Z" />
          </g>
          {/* hut */}
          <path d="M36 68 L50 52 L64 68 Z" fill={MAP.wood} stroke={MAP.ink} strokeWidth="2" strokeLinejoin="round" />
          <rect x="40" y="68" width="20" height="10" fill="#d9b779" stroke={MAP.ink} strokeWidth="2" />
          <rect x="47" y="71" width="6" height="7" fill={MAP.ink} />
        </g>
      )}

      {kind === "medium" && (
        <g strokeLinejoin="round">
          <path d="M34 74 L62 32 L90 74 Z" fill="#b78a52" stroke={MAP.ink} strokeWidth="2.4" />
          <path d="M72 78 L102 40 L132 78 Z" fill="#a67a45" stroke={MAP.ink} strokeWidth="2.4" />
          <path d="M62 36 L74 72 M62 44 L84 72 M62 54 L92 72" fill="none" stroke={MAP.ink} strokeWidth="1" opacity="0.7" />
          <path d="M102 44 L112 76 M102 52 L122 76" fill="none" stroke={MAP.ink} strokeWidth="1" opacity="0.7" />
          <path d="M55 43 L62 32 L69 43 L64 41 L62 45 L59 41 Z" fill={MAP.cream} stroke={MAP.ink} strokeWidth="1.2" />
          <path d="M62 32 V14" stroke={MAP.ink} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M62 14 L80 19 L62 24 Z" fill={MAP.red} stroke={MAP.ink} strokeWidth="1.2" />
        </g>
      )}

      {kind === "hard" && (
        <g strokeLinejoin="round">
          <path d="M40 80 L82 8 L124 80 Z" fill="#8d5f34" stroke={MAP.ink} strokeWidth="2.6" />
          <path d="M82 8 L96 34 L88 32 L82 44 L76 32 L68 34 Z" fill="#5a3a20" stroke={MAP.ink} strokeWidth="1.4" />
          {/* lava + smoke */}
          <path d="M82 10 C76 22 74 34 79 46 M84 12 C90 24 92 32 90 44" fill="none" stroke={MAP.red} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M82 6 C70 -2 90 -8 80 -16" fill="none" stroke={MAP.ink} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          {/* skull on the rock */}
          <ellipse cx="84" cy="60" rx="10" ry="9" fill="#f1e2bd" stroke={MAP.ink} strokeWidth="1.8" />
          <path d="M79 66 h10 v6 h-10 z" fill="#f1e2bd" stroke={MAP.ink} strokeWidth="1.6" />
          <circle cx="80.5" cy="59" r="2.4" fill={MAP.ink} />
          <circle cx="87.5" cy="59" r="2.4" fill={MAP.ink} />
          <path d="M84 62 l-1.8 3.4 h3.6 z" fill={MAP.ink} />
          {/* side crag */}
          <path d="M112 80 L124 50 L136 80 Z" fill="#7d5230" stroke={MAP.ink} strokeWidth="2.2" />
        </g>
      )}

      {selected && (
        <ellipse cx="80" cy="60" rx="84" ry="64" fill="none" stroke={MAP.red} strokeWidth="3" strokeDasharray="12 7" strokeLinecap="round" />
      )}
    </svg>
  );
}

const SEAS = { easy: "Easy", medium: "Medium", hard: "Hard" };
const ISLAND_POS = { easy: [15, 62], medium: [50, 36], hard: [85, 62] };

export function DifficultyMap({ options, value, onChange }) {
  return (
    <div style={mapStyles.route}>
      <WaveMarks />
      <svg viewBox="0 0 1000 320" style={mapStyles.routeSvg} aria-hidden="true">
        <g style={{ filter: "url(#inkWobble)" }}>
          <path
            className="map-anim"
            d="M150 198 C230 58 400 38 500 118 C600 198 730 300 850 198"
            fill="none"
            stroke={MAP.red}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray="2 14"
            style={{ animation: "routeFlow 9s linear infinite" }}
          />
          {/* X marks the spot, past the last island */}
          <path d="M942 118 l28 28 m0 -28 l-28 28" stroke={MAP.red} strokeWidth="6" strokeLinecap="round" />
        </g>
      </svg>

      {options.map((o) => {
        const [x, y] = ISLAND_POS[o.key];
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            className="map-island"
            onClick={() => onChange(o.key)}
            aria-pressed={selected}
            style={{
              ...mapStyles.island,
              left: `${x}%`,
              top: `${y}%`,
              opacity: selected ? 1 : 0.78,
            }}
          >
            <div className="map-island-art" style={{ position: "relative" }}>
              {selected && (
                <div className="map-anim" style={mapStyles.islandShip}>
                  <Ship size={92} />
                </div>
              )}
              <IslandArt kind={o.key} selected={selected} />
            </div>
            <div style={{ ...mapStyles.islandName, color: selected ? MAP.red : MAP.ink }}>{o.label}</div>
            <div style={mapStyles.islandSea}>{SEAS[o.key]}</div>
          </button>
        );
      })}
    </div>
  );
}

// ---------- small map-style controls ----------

export function SectionTitle({ children, note }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: FONT_TITLE, fontSize: 28, lineHeight: 1, letterSpacing: 0.5 }}>{children}</div>
      <svg viewBox="0 0 200 8" width="100%" height="8" preserveAspectRatio="none" style={{ display: "block", marginTop: 4 }} aria-hidden="true">
        <path
          d="M0 4 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"
          fill="none"
          stroke={MAP.ink}
          strokeWidth="1.6"
          opacity="0.75"
        />
      </svg>
      {note && <div style={{ fontSize: 14, fontStyle: "italic", color: MAP.inkSoft, marginTop: 4 }}>{note}</div>}
    </div>
  );
}

const SKETCHY = "18px 6px 16px 8px / 8px 16px 6px 18px";

export function ChoiceChip({ active, onClick, children, sub }) {
  return (
    <button
      className="map-chip"
      onClick={onClick}
      aria-pressed={active}
      style={{
        ...mapStyles.chip,
        background: active ? MAP.ink : "rgba(246,234,208,0.35)",
        color: active ? MAP.cream : MAP.ink,
        boxShadow: active ? `3px 4px 0 ${MAP.red}` : "none",
      }}
    >
      <span style={{ fontFamily: FONT_TITLE, fontSize: 24, lineHeight: 1 }}>{children}</span>
      <span style={{ fontSize: 13, fontStyle: "italic", opacity: 0.8 }}>{sub}</span>
    </button>
  );
}

export function InkButton({ variant = "secondary", style, ...props }) {
  const look = {
    primary: { background: MAP.red, color: MAP.cream, border: `2.5px solid ${MAP.ink}`, boxShadow: `3px 4px 0 ${MAP.ink}` },
    secondary: { background: "rgba(246,234,208,0.4)", color: MAP.ink, border: `2.5px solid ${MAP.ink}` },
    ghost: { background: "transparent", color: MAP.inkSoft, border: "2.5px solid transparent" },
  }[variant];
  return <button className="map-ink-btn" {...props} style={{ ...mapStyles.inkBtn, ...look, ...style }} />;
}

export function WaxSeal({ onClick, children }) {
  return (
    <button className="map-seal map-anim" onClick={onClick} style={mapStyles.seal}>
      <span style={mapStyles.sealRing} />
      <span style={{ position: "relative" }}>{children}</span>
    </button>
  );
}

const mapStyles = {
  route: {
    position: "relative",
    width: "min(100%, 980px)",
    aspectRatio: "1000 / 320",
    margin: "auto",
  },
  routeSvg: { position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" },
  island: {
    position: "absolute",
    width: "20%",
    transform: "translate(-50%, -56%)",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textAlign: "center",
    color: MAP.ink,
  },
  islandShip: {
    position: "absolute",
    left: "-56%",
    top: "6%",
    width: "52%",
    zIndex: 2,
    animation: "shipBob 3.2s ease-in-out infinite",
    pointerEvents: "none",
  },
  islandName: { fontFamily: FONT_TITLE, fontSize: 32, lineHeight: 1, marginTop: 2 },
  islandSea: { fontFamily: FONT_TEXT, fontStyle: "italic", fontSize: 15, color: MAP.inkSoft },
  chip: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "10px 20px 9px",
    border: `2.5px solid ${MAP.ink}`,
    borderRadius: SKETCHY,
    cursor: "pointer",
    fontFamily: FONT_TEXT,
    transition: "transform .15s",
  },
  inkBtn: {
    padding: "11px 22px",
    borderRadius: SKETCHY,
    fontFamily: FONT_TITLE,
    fontSize: 22,
    letterSpacing: 0.5,
    cursor: "pointer",
    transition: "transform .15s",
  },
  seal: {
    position: "relative",
    width: 138,
    height: 138,
    border: "none",
    borderRadius: "48% 52% 46% 54% / 52% 46% 54% 48%",
    background: "radial-gradient(circle at 35% 28%, #e4644d 0%, #b02a1c 46%, #6e120b 100%)",
    boxShadow:
      "inset 0 0 0 5px rgba(0,0,0,0.12), inset 0 -10px 16px rgba(0,0,0,0.35), inset 0 7px 10px rgba(255,255,255,0.25), 0 10px 18px rgba(60,20,10,0.5)",
    color: MAP.cream,
    fontFamily: FONT_TITLE,
    fontSize: 30,
    lineHeight: 1,
    cursor: "pointer",
    textShadow: "0 2px 3px rgba(0,0,0,0.5)",
    animation: "sealPulse 3.4s ease-in-out infinite",
  },
  sealRing: {
    position: "absolute",
    inset: 14,
    borderRadius: "50%",
    border: "2px dashed rgba(255,230,200,0.5)",
  },
};

// ---------- game pieces: hearts, arrow, hit burst, front wave ----------

export function Heart({ size = 26, filled = true }) {
  return (
    <svg viewBox="0 0 32 30" width={size} height={(size * 30) / 32} style={{ filter: "url(#inkWobble)" }} aria-hidden="true">
      <path
        d="M16 28 C4 19 2 13 2 9 C2 4 6 2 9.5 2 C12.5 2 15 4 16 6.5 C17 4 19.5 2 22.5 2 C26 2 30 4 30 9 C30 13 28 19 16 28 Z"
        fill={filled ? MAP.red : "rgba(58,36,18,0.12)"}
        stroke={MAP.ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.55}
      />
      {filled && <path d="M8 9 C8 7 10 6 11.5 6.5" fill="none" stroke="#f6ead0" strokeWidth="2" strokeLinecap="round" opacity="0.8" />}
    </svg>
  );
}

const ARROW_LEN = 96;
const ARROW_H = (ARROW_LEN * 14) / 74;

// One arrow flying from (x0, y0) toward a target `len` pixels away at `angle` degrees.
export function ArrowShot({ x0, y0, len, angle }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x0,
        top: y0,
        width: 0,
        height: 0,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "0 0",
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <svg
        viewBox="0 0 74 14"
        width={ARROW_LEN}
        height={ARROW_H}
        style={{
          position: "absolute",
          left: 0,
          top: -ARROW_H / 2,
          overflow: "visible",
          "--dx": `${Math.max(0, len - ARROW_LEN)}px`,
          animation: "arrowFly 900ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards",
        }}
        aria-hidden="true"
      >
        <line x1="6" y1="7" x2="62" y2="7" stroke={MAP.ink} strokeWidth="5" strokeLinecap="round" />
        <line x1="6" y1="7" x2="62" y2="7" stroke="#c99a5b" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M56 0.5 L74 7 L56 13.5 L60.5 7 Z" fill="#d9dfe4" stroke={MAP.ink} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M0 7 L8 0.5 L15 0.5 L11 7 L15 13.5 L8 13.5 Z" fill={MAP.red} stroke={MAP.ink} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Comic-style impact star, shown where the arrow lands.
export function Burst() {
  const points = (outer, inner) =>
    Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8;
      const r = i % 2 ? inner : outer;
      return `${(70 + r * Math.cos(a)).toFixed(1)},${(70 + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  return (
    <svg
      viewBox="0 0 140 140"
      width="170"
      height="170"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -85,
        marginTop: -85,
        pointerEvents: "none",
        zIndex: 3,
        animation: "burst 600ms 200ms ease-out both",
      }}
      aria-hidden="true"
    >
      <polygon points={points(66, 36)} fill={MAP.gold} stroke={MAP.ink} strokeWidth="4" strokeLinejoin="round" />
      <polygon points={points(44, 24)} fill="#fff3c4" />
    </svg>
  );
}

// A strip of moving water drawn in front of the boat so it sits in the sea.
export function FrontWave({ fill = "#5f9fae" }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: -2, height: 30, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
      <svg
        className="map-anim"
        viewBox="0 0 800 40"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, bottom: 0, width: "200%", height: "100%", animation: "waveSlide 12s linear infinite" }}
        aria-hidden="true"
      >
        <path d={WAVE_PATH} fill={fill} />
        <path d={WAVE_CREST} fill="none" stroke={MAP.ink} strokeWidth="2.4" opacity="0.55" />
      </svg>
    </div>
  );
}

// ---------- level backdrops: a parchment page with an ink-drawn scene for each level ----------

const WAVE_CREST = "M0 20 Q50 0 100 20 T200 20 T300 20 T400 20 T500 20 T600 20 T700 20 T800 20";
const WAVE_PATH = WAVE_CREST + " V40 H0 Z";

export const LEVEL_NAMES = ["Water 7", "Marineford", "Dressrosa"];
export const LEVEL_SEA = ["#5f9fae", "#6f8a9e", "#4f9c94"];

// The scenes are drawn on a 1600 x 900 canvas. The waterline is at y = 630, the sea is below it
// (that is where the boat sails), and the scenery stands on the waterline.
const SEA_WAVE = (() => {
  let d = "M0 0 Q50 -16 100 0";
  for (let k = 2; k <= 32; k++) d += ` T${k * 100} 0`;
  return d;
})();
const SEA_WAVE_FILL = SEA_WAVE + " V240 H0 Z";
const WATERLINE = (() => {
  let d = "M0 630 q50 -5 100 0";
  for (let k = 1; k < 16; k++) d += " t100 0";
  return d;
})();

const line = { stroke: MAP.ink, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" };
const WOBBLE = { filter: "url(#inkWobble)" };

function Sea({ id, top, bottom }) {
  const layers = [
    { y: 648, dur: 36, op: 0.35, dir: "normal" },
    { y: 708, dur: 26, op: 0.45, dir: "reverse" },
    { y: 776, dur: 19, op: 0.55, dir: "normal" },
  ];
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x="0" y="630" width="1600" height="300" fill={`url(#${id})`} />
      {layers.map((l, i) => (
        <g key={i} style={{ animation: `seaSlide ${l.dur}s linear infinite ${l.dir}` }}>
          <path d={SEA_WAVE_FILL} transform={`translate(0 ${l.y})`} fill={bottom} opacity={l.op} />
          <path d={SEA_WAVE} transform={`translate(0 ${l.y})`} fill="none" stroke={MAP.ink} strokeWidth="2" opacity="0.4" />
        </g>
      ))}
    </g>
  );
}

function Waterline() {
  return <path d={WATERLINE} fill="none" stroke={MAP.ink} strokeWidth="3.5" strokeLinecap="round" style={WOBBLE} />;
}

function SceneSvg({ children }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      {children}
    </svg>
  );
}

function Wash({ color }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, transparent 0%, ${color} 70%, transparent 70.5%)`,
      }}
    />
  );
}

// ---- Level 1: Water 7 (canal town) + Enies Lobby (Gates of Justice) ----

function WaterHouse({ x, w, h, wall, roof }) {
  const top = 630 - h;
  const rows = Math.max(1, Math.floor((h - 60) / 62));
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill={wall} />
      <path d={`M${x - 7} ${top} L${x + w / 2} ${top - w * 0.5} L${x + w + 7} ${top} Z`} fill={roof} />
      {Array.from({ length: rows }, (_, j) =>
        [0.16, 0.6].map((f, k) => {
          const y = top + 22 + j * 62;
          const r = w * 0.12;
          return <path key={`${j}${k}`} d={`M${x + w * f} ${y + 30} v-16 a${r} ${r} 0 0 1 ${r * 2} 0 v16 z`} fill="#8fb7c2" strokeWidth="2.2" />;
        })
      )}
      <rect x={x + w / 2 - 10} y={592} width="20" height="38" rx="3" fill="#8a5a2b" />
    </g>
  );
}

function WaterSevenScene() {
  const left = [
    [40, 84, 240, "#efe0b8", "#c0563c"],
    [132, 70, 310, "#e6cf9c", "#b3492f"],
    [210, 92, 205, "#f3e8cc", "#cf6a44"],
    [310, 62, 280, "#e0c9a0", "#c0563c"],
  ];
  const right = [
    [676, 84, 225, "#f3e8cc", "#b3492f"],
    [768, 70, 300, "#e6cf9c", "#cf6a44"],
    [846, 52, 190, "#efe0b8", "#c0563c"],
  ];
  return (
    <>
      <Wash color="rgba(140, 200, 212, 0.4)" />
      <SceneSvg>
        <Sea id="sea0" top="#a5d3da" bottom={LEVEL_SEA[0]} />
        <g {...line} style={WOBBLE}>
          {left.map(([x, w, h, wall, roof]) => <WaterHouse key={x} x={x} w={w} h={h} wall={wall} roof={roof} />)}
          {right.map(([x, w, h, wall, roof]) => <WaterHouse key={x} x={x} w={w} h={h} wall={wall} roof={roof} />)}
          {/* arched bridge over the canal */}
          <path d="M352 606 Q480 492 612 606 L612 624 Q480 510 352 624 Z" fill="#d9c9a6" />
          <path d="M384 630 Q480 552 584 630" fill="none" />
          <path d="M392 598 v-16 M432 572 v-16 M480 556 v-16 M528 572 v-16 M572 598 v-16" fill="none" strokeWidth="2.4" />
          {/* clock tower */}
          <rect x="606" y="290" width="62" height="340" fill="#efe7d6" />
          <path d="M596 290 L637 226 L678 290 Z" fill="#7d8894" />
          <path d="M637 226 V196" fill="none" />
          <circle cx="637" cy="340" r="21" fill="#f6ead0" />
          <path d="M637 340 V326 M637 340 L648 346" fill="none" strokeWidth="2.4" />
          <path d="M606 400 h62 M606 470 h62 M606 540 h62" fill="none" strokeWidth="2" />

          {/* Enies Lobby: rock island, fortress, Tower of Justice, Gates of Justice */}
          <path d="M890 630 C905 590 935 560 985 548 L1440 548 C1490 562 1520 600 1545 630 Z" fill="#cdb98f" />
          <rect x="1010" y="440" width="420" height="108" fill="#e9e1cf" />
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={1014 + i * 30} y="426" width="18" height="14" fill="#e9e1cf" strokeWidth="2.2" />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={1040 + i * 60} y="466" width="18" height="30" rx="8" fill="#8fb7c2" strokeWidth="2.2" />
          ))}
          <rect x="1195" y="240" width="52" height="200" fill="#efe7d6" />
          <path d="M1195 290 h52 M1195 340 h52 M1195 390 h52" fill="none" strokeWidth="2" />
          <path d="M1183 240 L1221 176 L1259 240 Z" fill="#7d8894" />
          <path d="M1221 176 V146" fill="none" />
          <rect x="1128" y="462" width="30" height="86" fill="#d8cdb4" />
          <rect x="1284" y="462" width="30" height="86" fill="#d8cdb4" />
          <path d="M1158 548 V506 Q1221 446 1284 506 V548 Z" fill="#8a5a2b" />
          <path d="M1221 470 V548" fill="none" strokeWidth="2.4" />
          <circle cx="1206" cy="528" r="3.5" fill={MAP.ink} />
          <circle cx="1236" cy="528" r="3.5" fill={MAP.ink} />
          <path d="M770 606 H905" fill="none" strokeWidth="3.5" />
        </g>
        {/* waterfall curtain around the island */}
        <g fill="none" stroke="#a9dbe6" strokeWidth="7" strokeDasharray="16 12" strokeLinecap="round">
          {Array.from({ length: 22 }, (_, i) => (
            <path
              key={i}
              d={`M${985 + i * 21} 552 V626`}
              style={{ animation: `dashFlow ${1.1 + (i % 3) * 0.25}s linear infinite` }}
            />
          ))}
        </g>
        <Waterline />
      </SceneSvg>
    </>
  );
}

// ---- Level 2: Marineford (Marine HQ, execution platform, Moby Dick, ice) ----

function Seagull({ x, y, s = 1 }) {
  return (
    <path
      d={`M${x - 16 * s} ${y + 4 * s} Q${x - 8 * s} ${y - 12 * s} ${x} ${y} Q${x + 8 * s} ${y - 12 * s} ${x + 16 * s} ${y + 4 * s}`}
      fill="none"
      strokeWidth="2.6"
    />
  );
}

function MarinefordScene() {
  return (
    <>
      <Wash color="rgba(222, 130, 100, 0.34)" />
      <SceneSvg>
        <Sea id="sea1" top="#b3c4ce" bottom={LEVEL_SEA[1]} />
        <g {...line} style={WOBBLE}>
          {/* ice walls */}
          <path d="M40 630 L100 512 L136 556 L188 432 L236 548 L274 498 L326 604 L382 630 Z" fill="#d5eaf0" />
          <path d="M400 630 L442 556 L474 588 L516 514 L566 630 Z" fill="#dbeef3" />
          <path d="M188 432 L204 556 M100 512 L112 598 M516 514 L528 606 M274 498 L286 590" fill="none" stroke="#ffffff" strokeWidth="4" />

          {/* Moby Dick */}
          <g transform="translate(-70 -24)">
          <path d="M604 626 Q650 668 730 668 L812 668 Q846 648 858 606 Z" fill="#8a5a2b" />
          <path d="M556 604 C556 574 600 562 632 578 L646 646 C600 656 560 636 556 604 Z" fill="#e9e1cf" />
          <circle cx="590" cy="596" r="6" fill={MAP.ink} />
          <path d="M566 626 Q596 640 634 628" fill="none" />
          <path d="M728 668 V440" fill="none" strokeWidth="4" />
          <path d="M652 470 Q728 450 806 470 L800 592 Q728 610 658 592 Z" fill="#f6ead0" />
          <ellipse cx="729" cy="524" rx="24" ry="22" fill="#fff8e6" />
          <circle cx="720" cy="522" r="4" fill={MAP.ink} />
          <circle cx="738" cy="522" r="4" fill={MAP.ink} />
          <path d="M704 536 Q729 562 754 536 Q729 548 704 536 Z" fill={MAP.ink} />
          </g>

          {/* execution platform */}
          <path d="M884 630 L906 526 L992 526 L1014 630 Z" fill="#a9763a" />
          <rect x="900" y="510" width="98" height="16" fill="#8a5a2b" />
          <path d="M925 510 L975 396 M975 510 L925 396" fill="none" strokeWidth="6" />
          <path d="M948 630 L948 526 M978 630 L978 526" fill="none" strokeWidth="2.4" />

          {/* Marine HQ */}
          <rect x="1046" y="480" width="520" height="150" fill="#ece6d8" />
          {Array.from({ length: 17 }, (_, i) => (
            <rect key={i} x={1050 + i * 30.4} y="466" width="18" height="14" fill="#ece6d8" strokeWidth="2.2" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={1070 + i * 56} y="520" width="20" height="46" rx="9" fill="#8a97a3" strokeWidth="2.2" />
          ))}
          <rect x="1140" y="318" width="152" height="312" rx="6" fill="#f2ecdf" />
          <path d="M1140 380 h152 M1140 450 h152" fill="none" strokeWidth="2.2" />
          <path d="M1130 320 Q1216 220 1302 320 Z" fill="#7d8894" />
          <circle cx="1216" cy="400" r="34" fill="#f6ead0" />
          <path d="M1194 402 q11 -14 22 0 t22 0" fill="none" strokeWidth="2.4" />
          <path d="M1216 272 V150" fill="none" strokeWidth="3.5" />
          <rect x="1400" y="360" width="82" height="270" fill="#ece6d8" />
          <path d="M1394 362 L1441 300 L1488 362 Z" fill="#7d8894" />
          <Seagull x={520} y={330} s={1.2} />
          <Seagull x={1000} y={300} />
        </g>
        {/* the big Marine flag, waving */}
        <g style={{ transformBox: "fill-box", transformOrigin: "0% 50%", animation: "flagWave 2.4s ease-in-out infinite alternate" }}>
          <rect x="1216" y="150" width="92" height="62" fill="#fff8e6" stroke={MAP.ink} strokeWidth="3" />
          <path d="M1236 182 q10 -14 20 0 t20 0" fill="none" stroke={MAP.ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M1232 196 h60" stroke={MAP.ink} strokeWidth="2.6" strokeLinecap="round" />
        </g>
        {/* drifting ice floes */}
        {[[120, 664], [430, 690], [1060, 672], [1340, 700]].map(([x, y], i) => (
          <g key={i} style={{ animation: `floeDrift ${8 + i * 2}s ease-in-out ${-i * 2}s infinite alternate` }}>
            <path d={`M${x} ${y} l18 -12 l34 -2 l22 14 l-24 10 l-36 0 Z`} fill="#e3f2f6" stroke={MAP.ink} strokeWidth="2.6" strokeLinejoin="round" />
          </g>
        ))}
        <Waterline />
      </SceneSvg>
    </>
  );
}

// ---- Level 3: Dressrosa (hill town, palace, Colosseum, the Birdcage) ----

const HILL = [[240, 626], [640, 512], [1000, 424], [1160, 396], [1400, 452], [1600, 500]];
function hillY(x) {
  for (let i = 0; i < HILL.length - 1; i++) {
    const [x0, y0] = HILL[i];
    const [x1, y1] = HILL[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return 630;
}

function DressrosaScene() {
  const walls = ["#f0c98a", "#e89a7a", "#e8b04a", "#e6849a", "#f3dfb0", "#d9855a"];
  const houses = [];
  for (let row = 0; row < 3; row++) {
    for (let x = 300 + row * 30; x < 1560; x += 68) {
      if (x > 1040 && x < 1250 && row === 0) continue; // the palace stands here
      const base = Math.min(626, hillY(x + 26) + 70 + row * 38);
      houses.push({ x, base, h: 52 + ((x * 7 + row * 13) % 30), wall: walls[(Math.floor(x / 68) + row * 2) % walls.length], key: `${row}-${x}` });
    }
  }
  houses.sort((a, b) => a.base - b.base);
  return (
    <>
      <Wash color="rgba(240, 160, 150, 0.38)" />
      <SceneSvg>
        <Sea id="sea2" top="#a8d8cb" bottom={LEVEL_SEA[2]} />
        <g {...line} style={WOBBLE}>
          {/* the hill */}
          <path d="M240 630 L240 626 C420 600 520 546 640 512 C820 458 980 424 1160 396 C1320 396 1440 470 1600 500 L1600 630 Z" fill="#d9b878" />
          {houses.map((h) => (
            <g key={h.key}>
              <rect x={h.x} y={h.base - h.h} width="54" height={h.h} fill={h.wall} strokeWidth="2.6" />
              <path d={`M${h.x - 5} ${h.base - h.h} L${h.x + 27} ${h.base - h.h - 22} L${h.x + 59} ${h.base - h.h} Z`} fill="#d8683a" strokeWidth="2.6" />
              <rect x={h.x + 10} y={h.base - h.h + 14} width="12" height="16" rx="6" fill="#7a4a2a" strokeWidth="2" />
              <rect x={h.x + 32} y={h.base - h.h + 14} width="12" height="16" rx="6" fill="#7a4a2a" strokeWidth="2" />
            </g>
          ))}
          {/* palace on the summit */}
          <rect x="1050" y="300" width="210" height="100" fill="#f3e2d0" />
          <rect x="1100" y="236" width="110" height="64" fill="#f0d4c4" />
          <path d="M1088 236 Q1155 150 1222 236 Z" fill="#e6849a" />
          <path d="M1155 196 V140" fill="none" />
          <path d="M1155 140 L1192 150 L1155 160 Z" fill="#e6849a" strokeWidth="2.6" />
          <rect x="1050" y="214" width="46" height="90" fill="#f3e2d0" />
          <path d="M1042 214 L1073 170 L1104 214 Z" fill="#d8683a" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={1068 + i * 32} y="330" width="14" height="30" rx="7" fill="#7a4a2a" strokeWidth="2.2" />
          ))}
          {/* Corrida Colosseum on the shore */}
          <path d="M84 630 L84 556 Q84 512 258 512 Q432 512 432 556 L432 630 Z" fill="#e2c58b" />
          <ellipse cx="258" cy="514" rx="174" ry="22" fill="#cdb078" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={`u${i}`} d={`M${118 + i * 40} 560 v-14 a14 14 0 0 1 28 0 v14 z`} fill="#7a4a2a" strokeWidth="2.2" />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <path key={`l${i}`} d={`M${118 + i * 40} 622 v-24 a14 14 0 0 1 28 0 v24 z`} fill="#7a4a2a" strokeWidth="2.2" />
          ))}
          <path d="M84 580 H432" fill="none" strokeWidth="2.4" />
          <Seagull x={640} y={330} s={1.1} />
        </g>
        {/* the Birdcage: a net of thin strings over the whole island */}
        <g fill="none" stroke={MAP.ink} strokeWidth="1.3" style={{ animation: "threadShimmer 5s ease-in-out infinite alternate" }}>
          {Array.from({ length: 9 }, (_, i) => (
            <path key={`a${i}`} d={`M${-100 + i * 220} -20 Q${200 + i * 220} 330 ${600 + i * 220} 630`} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <path key={`b${i}`} d={`M${800 + i * 220} -20 Q${500 + i * 220} 330 ${i * 220 - 100} 630`} />
          ))}
          <path d="M-60 630 Q800 -430 1660 630" strokeWidth="3.2" />
        </g>
        {/* drifting petals */}
        {[[300, 40], [560, -20], [820, 10], [1080, -40], [1320, 20], [1500, -10], [140, -30], [960, 60]].map(([x, y], i) => (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="7"
            ry="4"
            fill={i % 2 ? "#e6849a" : "#f0a04a"}
            stroke={MAP.ink}
            strokeWidth="1.4"
            style={{ animation: `petalDrift ${14 + (i % 4) * 3}s linear ${-i * 2.3}s infinite` }}
          />
        ))}
        <Waterline />
      </SceneSvg>
    </>
  );
}

// ---- the page itself ----

function InkCloud({ width }) {
  return (
    <svg viewBox="0 0 260 90" width={width} style={{ display: "block", filter: "url(#inkWobble)" }} aria-hidden="true">
      <path
        d="M28 76 C6 76 4 52 26 48 C24 26 52 18 66 34 C74 12 106 8 120 30 C134 14 166 18 172 40 C192 30 220 42 216 62 C238 60 254 74 234 80 Z"
        fill="rgba(255,250,235,0.6)"
        stroke={MAP.ink}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M60 60 q10 -8 20 0 M110 54 q10 -8 20 0 M160 62 q10 -8 20 0" fill="none" stroke={MAP.ink} strokeWidth="1.6" opacity="0.5" strokeLinecap="round" />
    </svg>
  );
}

const INK_CLOUDS = [
  { top: "8%", width: "24vw", dur: 230, delay: -60 },
  { top: "20%", width: "18vw", dur: 300, delay: -180 },
  { top: "33%", width: "28vw", dur: 260, delay: -110 },
];

const BIRDS = [
  { top: "16%", dur: 75, delay: -10, size: 22 },
  { top: "20%", dur: 75, delay: -14, size: 16 },
  { top: "28%", dur: 95, delay: -60, size: 18 },
];

export function LevelBackdrop({ level = 0 }) {
  const scenes = [<WaterSevenScene key={0} />, <MarinefordScene key={1} />, <DressrosaScene key={2} />];
  return (
    <div className="backdrop" style={bd.root} aria-hidden="true">
      <MapDefs />
      <div style={bd.paper} />

      {INK_CLOUDS.map((c, i) => (
        <div key={i} style={{ position: "absolute", left: 0, top: c.top, animation: `cloudFly ${c.dur}s linear ${c.delay}s infinite` }}>
          <InkCloud width={c.width} />
        </div>
      ))}
      {BIRDS.map((b, i) => (
        <div key={i} style={{ position: "absolute", left: 0, top: b.top, animation: `birdFly ${b.dur}s linear ${b.delay}s infinite` }}>
          <svg viewBox="0 0 24 10" width={b.size} style={{ display: "block", animation: "birdFlap 0.7s ease-in-out infinite alternate" }}>
            <path d="M1 8 Q6 -1 12 6 Q18 -1 23 8" fill="none" stroke={MAP.ink} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      ))}

      {scenes.map((scene, i) => (
        <div key={i} style={{ ...bd.layer, opacity: level === i ? 1 : 0 }}>
          {scene}
        </div>
      ))}

      <div style={bd.grain} />
      <div style={bd.edges} />
    </div>
  );
}

const bd = {
  root: { position: "fixed", inset: 0, zIndex: -1, overflow: "hidden", background: "#e0c48a" },
  paper: { position: "absolute", inset: 0, background: PAPER_GRADIENT },
  layer: { position: "absolute", inset: 0, transition: "opacity 1.5s ease" },
  grain: { position: "absolute", inset: 0, backgroundImage: GRAIN, mixBlendMode: "multiply", opacity: 0.7 },
  edges: { position: "absolute", inset: 0, boxShadow: "inset 0 0 150px 30px rgba(110,60,15,0.5)", pointerEvents: "none" },
};
