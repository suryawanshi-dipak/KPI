/**
 * Status auto-computation — mirrors BRD §7.2.
 *
 * direction: 'higher_better' | 'lower_better'
 * When warn/critical thresholds are null, only green/red are computed.
 *
 * This is a frontend preview of the backend rule so the measurement form
 * can show the user the status the moment they type a value. The backend
 * remains the source of truth on save.
 */
export function computeStatus({ value, direction, target, warn, critical }) {
  if (value === null || value === undefined || value === "" || isNaN(Number(value))) {
    return "unknown";
  }
  const v = Number(value);
  const t = num(target);
  const w = num(warn);
  const c = num(critical);

  const higher = direction === "higher_better";

  // No thresholds → binary green/red against target only.
  if (w === null && c === null) {
    if (t === null) return "unknown";
    if (higher) return v >= t ? "green" : "red";
    return v <= t ? "green" : "red";
  }

  if (higher) {
    // higher_better:
    // - Green: value >= target (t)
    // - Amber: warn_threshold (w) <= value < target (t)
    // - Red: critical_threshold (c) <= value < warn_threshold (w)
    // - Critical: value < critical_threshold (c)
    if (t !== null && v >= t) return "green";
    if (w !== null && v >= w) return "amber";
    if (c !== null && v >= c) return "red";
    return "critical";
  } else {
    // lower_better:
    // - Green: value <= target (t)
    // - Amber: target (t) < value <= warn_threshold (w)
    // - Red: warn_threshold (w) < value <= critical_threshold (c)
    // - Critical: value > critical_threshold (c)
    if (t !== null && v <= t) return "green";
    if (w !== null && v <= w) return "amber";
    if (c !== null && v <= c) return "red";
    return "critical";
  }
}

function num(x) {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return isNaN(n) ? null : n;
}

export const STATUS_META = {
  green:    { label: "Green",    color: "var(--ok)",      bg: "var(--ok-bg)" },
  amber:    { label: "Amber",    color: "var(--warn)",    bg: "var(--warn-bg)" },
  red:      { label: "Red",      color: "var(--bad)",     bg: "var(--bad-bg)" },
  critical: { label: "Critical", color: "var(--bad)",     bg: "var(--bad-bg)" },
  unknown:  { label: "Unknown",  color: "var(--muted)",   bg: "var(--surface-2)" },
};
