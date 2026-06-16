import { useEffect } from "react";
import { Icon } from "./Icon";
import { STATUS_META } from "../lib/status";

export function StatusPill({ status }) {
  const s = (status || "unknown").toLowerCase();
  const meta = STATUS_META[s] || STATUS_META.unknown;
  return <span className={`pill pill--${s}`}>{meta.label}</span>;
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function Modal({ title, subtitle, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <Icon.close />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ message, kind = "ok" }) {
  return (
    <div className={`toast toast--${kind}`}>
      <Icon.check style={{ width: 16, height: 16 }} />
      {message}
    </div>
  );
}

/* Field wrapper: label + error + hint */
export function Field({ label, required, error, hint, full, children }) {
  return (
    <div className={`field ${full ? "field--full" : ""}`}>
      {label && (
        <label>
          {label} {required && <span className="req">*</span>}
          {hint && <span className="hint"> — {hint}</span>}
        </label>
      )}
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
