import { T } from "../../utils/theme";

export default function ProgressBar({ pct, color = T.navy, height = 7 }) {
  const c =
    pct >= 60 ? T.green : pct >= 25 ? T.amber : pct === 0 ? T.border : T.danger;
  return (
    <div
      style={{
        height,
        borderRadius: height,
        background: "#e9ecef",
        overflow: "hidden",
        flex: 1,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(pct, 100)}%`,
          background: color || c,
          borderRadius: height,
          transition: "width .4s ease",
        }}
      />
    </div>
  );
}
