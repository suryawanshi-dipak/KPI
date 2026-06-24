import { useState } from "react";
import { T, s } from "../../utils/theme";

export default function Btn({
  children,
  variant = "outline",
  onClick,
  style = {},
  disabled = false,
  type = "button",
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...s.btn(variant),
        ...(hov && variant === "primary"
          ? { background: T.navyDark }
          : hov
          ? { background: "#f9fafb" }
          : {}),
        ...(disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}),
        ...style,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
