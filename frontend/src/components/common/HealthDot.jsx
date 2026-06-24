import { T } from "../../utils/theme";

export default function HealthDot({ status }) {
  const c =
    { green: T.green, amber: T.amber, red: T.danger }[status] || T.textLight;
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: c,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
