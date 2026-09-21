import type { Expression } from "@/types";

/**
 * Hermoz's face is built from a small set of reusable parts (eyes, brows,
 * mouth, decorations) rather than 14 fully separate drawings. Each
 * Expression maps to a combination of parts below. This keeps the art
 * consistent (same head, same proportions) while still giving every
 * expression a genuinely different silhouette instead of just palette
 * swaps.
 */

type EyeShape =
  | "round"
  | "happy"
  | "closedHappy"
  | "halfLid"
  | "wide"
  | "closedCurve"
  | "lookUp"
  | "angry"
  | "smug"
  | "sparkle"
  | "droopy"
  | "worried"
  | "wink";

type MouthShape =
  | "flat"
  | "smile"
  | "bigSmile"
  | "frown"
  | "wavy"
  | "o"
  | "smirk"
  | "openSmall"
  | "concernedFlat";

type BrowShape = "none" | "raisedOne" | "angry" | "sad" | "worried" | "up";

type Decoration = "question" | "zzz" | "sweat" | "tear" | "sparkles" | "thoughtDots" | null;

interface FaceRecipe {
  eyes: EyeShape;
  mouth: MouthShape;
  brows: BrowShape;
  decoration: Decoration;
}

export const FACE_RECIPES: Record<Expression, FaceRecipe> = {
  neutral: { eyes: "round", mouth: "flat", brows: "none", decoration: null },
  happy: { eyes: "happy", mouth: "smile", brows: "none", decoration: null },
  laughing: { eyes: "closedHappy", mouth: "bigSmile", brows: "none", decoration: null },
  annoyed: { eyes: "halfLid", mouth: "flat", brows: "raisedOne", decoration: null },
  confused: { eyes: "round", mouth: "wavy", brows: "raisedOne", decoration: "question" },
  surprised: { eyes: "wide", mouth: "o", brows: "up", decoration: null },
  sleepy: { eyes: "closedCurve", mouth: "openSmall", brows: "none", decoration: "zzz" },
  thinking: { eyes: "lookUp", mouth: "flat", brows: "none", decoration: "thoughtDots" },
  angry: { eyes: "angry", mouth: "frown", brows: "angry", decoration: null },
  smug: { eyes: "smug", mouth: "smirk", brows: "none", decoration: null },
  excited: { eyes: "sparkle", mouth: "bigSmile", brows: "up", decoration: "sparkles" },
  sad: { eyes: "droopy", mouth: "frown", brows: "sad", decoration: "tear" },
  concerned: { eyes: "worried", mouth: "concernedFlat", brows: "worried", decoration: "sweat" },
  teasing: { eyes: "wink", mouth: "smirk", brows: "none", decoration: null },
  arguing: { eyes: "angry", mouth: "wavy", brows: "raisedOne", decoration: null },
  roasting: { eyes: "wink", mouth: "smirk", brows: "raisedOne", decoration: "sparkles" },
  agreeing: { eyes: "happy", mouth: "smile", brows: "none", decoration: null },
  disagreeing: { eyes: "halfLid", mouth: "frown", brows: "raisedOne", decoration: null },
  error: { eyes: "worried", mouth: "concernedFlat", brows: "worried", decoration: "sweat" },
  offline: { eyes: "closedCurve", mouth: "flat", brows: "none", decoration: "zzz" },
  visionActive: { eyes: "sparkle", mouth: "openSmall", brows: "up", decoration: null },
};

const INK = "var(--panda-black, #262229)";
const WHITE = "var(--panda-white, #fbfbf9)";

function Eye({ shape, side }: { shape: EyeShape; side: "left" | "right" }) {
  const cx = side === "left" ? 62 : 138;
  const flip = side === "left" ? 1 : -1;

  switch (shape) {
    case "round":
      return (
        <>
          <circle cx={cx} cy={112} r={9} fill={WHITE} />
          <circle cx={cx} cy={113} r={4.5} fill={INK} />
        </>
      );
    case "wide":
      return (
        <>
          <circle cx={cx} cy={110} r={12} fill={WHITE} />
          <circle cx={cx} cy={111} r={6} fill={INK} />
        </>
      );
    case "happy":
      return (
        <path
          d={`M ${cx - 11} 115 Q ${cx} 100 ${cx + 11} 115`}
          stroke={WHITE}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "closedHappy":
      return (
        <path
          d={`M ${cx - 10} 108 Q ${cx} 122 ${cx + 10} 108`}
          stroke={WHITE}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "closedCurve":
      return (
        <path
          d={`M ${cx - 9} 113 Q ${cx} 118 ${cx + 9} 113`}
          stroke={WHITE}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "halfLid":
      return (
        <>
          <path d={`M ${cx - 12} 105 L ${cx + 12} 105`} stroke={WHITE} strokeWidth={4} strokeLinecap="round" />
          <circle cx={cx} cy={114} r={7} fill={WHITE} />
          <circle cx={cx} cy={115} r={3.5} fill={INK} />
        </>
      );
    case "lookUp":
      return (
        <>
          <circle cx={cx} cy={112} r={9} fill={WHITE} />
          <circle cx={cx + 2 * flip} cy={107} r={4.5} fill={INK} />
        </>
      );
    case "angry":
      return (
        <>
          <path
            d={side === "left" ? `M 51 101 L 73 108` : `M 149 101 L 127 108`}
            stroke={WHITE}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={116} r={7} fill={WHITE} />
          <circle cx={cx} cy={117} r={3.6} fill={INK} />
        </>
      );
    case "smug":
      return (
        <path
          d={`M ${cx - 10} 111 Q ${cx} 106 ${cx + 10} 111`}
          stroke={WHITE}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "sparkle":
      return (
        <>
          <circle cx={cx} cy={110} r={11} fill={WHITE} />
          <circle cx={cx} cy={111} r={5.5} fill={INK} />
          <circle cx={cx - 3} cy={107} r={2} fill={WHITE} />
        </>
      );
    case "droopy":
      return (
        <path
          d={`M ${cx - 10} 106 Q ${cx} 116 ${cx + 10} 112`}
          stroke={WHITE}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "worried":
      return (
        <>
          <circle cx={cx} cy={113} r={8} fill={WHITE} />
          <circle cx={cx} cy={115} r={4} fill={INK} />
        </>
      );
    case "wink":
      return side === "left" ? (
        <path d={`M 51 112 Q 62 120 73 112`} stroke={WHITE} strokeWidth={5} strokeLinecap="round" fill="none" />
      ) : (
        <>
          <circle cx={cx} cy={111} r={9} fill={WHITE} />
          <circle cx={cx} cy={112} r={4.5} fill={INK} />
        </>
      );
    default:
      return null;
  }
}

function Brow({ shape }: { shape: BrowShape }) {
  if (shape === "none") return null;
  switch (shape) {
    case "raisedOne":
      return <path d="M 128 88 L 150 82" stroke={INK} strokeWidth={4} strokeLinecap="round" />;
    case "angry":
      return (
        <>
          <path d="M 46 92 L 72 100" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <path d="M 154 92 L 128 100" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </>
      );
    case "sad":
      return (
        <>
          <path d="M 48 90 Q 62 96 74 95" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
          <path d="M 152 90 Q 138 96 126 95" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
        </>
      );
    case "worried":
      return (
        <>
          <path d="M 50 94 Q 62 86 74 92" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
          <path d="M 150 94 Q 138 86 126 92" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
        </>
      );
    case "up":
      return (
        <>
          <path d="M 50 90 L 74 86" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <path d="M 150 90 L 126 86" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

function Mouth({ shape, isOpen = false }: { shape: MouthShape; isOpen?: boolean }) {
  if (isOpen) {
    return <ellipse cx={100} cy={166} rx={7} ry={5.5} fill={INK} />;
  }
  switch (shape) {
    case "flat":
      return <path d="M 92 166 L 108 166" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />;
    case "smile":
      return (
        <path d="M 86 162 Q 100 174 114 162" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      );
    case "bigSmile":
      return (
        <path
          d="M 80 160 Q 100 182 120 160 Q 100 172 80 160 Z"
          fill={INK}
        />
      );
    case "frown":
      return (
        <path d="M 86 172 Q 100 160 114 172" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      );
    case "wavy":
      return (
        <path
          d="M 84 164 Q 90 158 96 164 Q 102 170 108 164 Q 114 158 116 164"
          stroke={INK}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "o":
      return <ellipse cx={100} cy={166} rx={7} ry={9} fill={INK} />;
    case "smirk":
      return (
        <path d="M 88 165 Q 100 172 112 160" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      );
    case "openSmall":
      return <ellipse cx={100} cy={165} rx={5} ry={4} fill={INK} />;
    case "concernedFlat":
      return (
        <path d="M 90 168 Q 100 164 110 168" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      );
    default:
      return null;
  }
}

function DecorationLayer({ kind }: { kind: Decoration }) {
  if (!kind) return null;
  switch (kind) {
    case "question":
      return (
        <text x={148} y={62} fontSize={26} fontWeight={700} fill={INK} className="hermoz-deco hermoz-deco-bob">
          ?
        </text>
      );
    case "zzz":
      return (
        <text x={140} y={56} fontSize={22} fontWeight={700} fill={INK} className="hermoz-deco hermoz-deco-float">
          z z z
        </text>
      );
    case "sweat":
      return (
        <path
          d="M 156 78 C 156 86 148 86 148 78 C 148 73 152 68 156 62 C 160 68 156 73 156 78 Z"
          fill="#7cc4ea"
          className="hermoz-deco hermoz-deco-drip"
        />
      );
    case "tear":
      return (
        <path
          d="M 66 128 C 66 136 58 136 58 128 C 58 123 62 118 66 112 C 70 118 66 123 66 128 Z"
          fill="#7cc4ea"
          className="hermoz-deco hermoz-deco-drip"
        />
      );
    case "sparkles":
      return (
        <g className="hermoz-deco hermoz-deco-twinkle" fill="var(--hermoz-accent, #ff8f6b)">
          <path d="M 40 55 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 z" />
          <path d="M 165 45 l 2.4 6.5 l 6.5 2.4 l -6.5 2.4 l -2.4 6.5 l -2.4 -6.5 l -6.5 -2.4 l 6.5 -2.4 z" />
        </g>
      );
    case "thoughtDots":
      return (
        <g className="hermoz-deco hermoz-deco-float" fill={INK}>
          <circle cx={148} cy={70} r={3} />
          <circle cx={158} cy={60} r={4} />
          <circle cx={170} cy={48} r={5.5} />
        </g>
      );
    default:
      return null;
  }
}

export function PandaFace({
  expression,
  mouthOpen = false,
}: {
  expression: Expression;
  mouthOpen?: boolean;
}) {
  const recipe = FACE_RECIPES[expression];
  return (
    <g>
      <Eye shape={recipe.eyes} side="left" />
      <Eye shape={recipe.eyes} side="right" />
      <Brow shape={recipe.brows} />
      <Mouth shape={recipe.mouth} isOpen={mouthOpen} />
      <DecorationLayer kind={recipe.decoration} />
    </g>
  );
}

/**
 * The static body parts that never change between expressions: ears, head
 * silhouette, eye patches, blush, nose. `PandaFace` is layered on top.
 */
export function PandaBody({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {/* ears */}
      <circle cx={40} cy={40} r={24} fill={INK} />
      <circle cx={160} cy={40} r={24} fill={INK} />

      {/* head */}
      <ellipse cx={100} cy={105} rx={70} ry={68} fill={WHITE} />

      {/* eye patches */}
      <ellipse cx={62} cy={106} rx={24} ry={30} fill={INK} />
      <ellipse cx={138} cy={106} rx={24} ry={30} fill={INK} />

      {/* blush */}
      <ellipse cx={52} cy={140} rx={10} ry={6.5} fill="var(--panda-blush, #ffb6a1)" opacity={0.85} />
      <ellipse cx={148} cy={140} rx={10} ry={6.5} fill="var(--panda-blush, #ffb6a1)" opacity={0.85} />

      {/* nose */}
      <ellipse cx={100} cy={150} rx={6} ry={4.5} fill={INK} />

      {children}

      {/* little body */}
      <path
        d="M 46 172 Q 40 220 78 232 L 122 232 Q 160 220 154 172 Q 100 190 46 172 Z"
        fill={WHITE}
        stroke={INK}
        strokeWidth={2}
      />
      {/* arm nubs */}
      <ellipse cx={44} cy={196} rx={12} ry={16} fill={INK} />
      <ellipse cx={156} cy={196} rx={12} ry={16} fill={INK} />
      {/* feet */}
      <ellipse cx={80} cy={230} rx={16} ry={9} fill={INK} />
      <ellipse cx={120} cy={230} rx={16} ry={9} fill={INK} />
    </>
  );
}
