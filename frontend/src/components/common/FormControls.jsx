import { s } from "../../utils/theme";

export function FormGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

export function Input({ ...props }) {
  return <input style={s.input} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select style={{ ...s.input, cursor: "pointer" }} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ style, ...props }) {
  return (
    <textarea
      style={{ ...s.input, minHeight: 72, resize: "vertical", lineHeight: 1.5, ...style }}
      {...props}
    />
  );
}
