import { T, s } from "../../utils/theme";

const BADGE_MAP = {
  active: [T.navyLight, T.navy],
  personal: ["#e8f5e9", "#2f9e44"],
  company: ["#eef1f8", T.navyDark],
  team: ["#fff3e0", "#e67700"],
  committed: ["#f3f4f6", "#4b5563"],
  learning: ["#f0fdf4", "#166534"],
  aspirational: ["#fefce8", "#854d0e"],
  green: ["#dcfce7", "#166534"],
  amber: ["#fff7ed", "#9a3412"],
  red: ["#fee2e2", "#991b1b"],
  critical: ["#fee2e2", "#991b1b"],
  high: ["#fff7ed", "#9a3412"],
  medium: ["#f3f4f6", "#4b5563"],
  low: ["#f9fafb", "#6b7280"],
  planned: ["#f3f4f6", "#4b5563"],
  draft: ["#f9fafb", "#6b7280"],
  default: ["#f3f4f6", "#374151"],
};

export default function Badge({ children, type = "default" }) {
  const [bg, color] = BADGE_MAP[type] || BADGE_MAP.default;
  return <span style={s.badge(bg, color)}>{children}</span>;
}
