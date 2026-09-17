import { useRef, useState } from "react";
import {
  setProactiveWorkEndorsed,
  addProactiveWorkComment,
  editProactiveWorkComment,
  deleteProactiveWorkComment,
} from "../lib/store";

const CATEGORY_LABELS = {
  ATTENDANCE_PUNCTUALITY: "Attendance & Punctuality",
  TEAM_SUPPORT: "Team Support",
  INITIATIVE_IDEA: "Initiative / Idea",
  EXTRA_HOURS: "Extra Hours",
  RESOURCE_SAVING: "Resource Saving",
  PROCESS_IMPROVEMENT: "Process Improvement",
  OTHER: "Other",
};

const CATEGORY_ICONS = {
  ATTENDANCE_PUNCTUALITY: "🕒",
  TEAM_SUPPORT: "🤝",
  INITIATIVE_IDEA: "💡",
  EXTRA_HOURS: "⏱",
  RESOURCE_SAVING: "♻️",
  PROCESS_IMPROVEMENT: "🔧",
  OTHER: "📌",
};

const CATEGORY_CHIP_STYLE = {
  ATTENDANCE_PUNCTUALITY: { background: "#e8effd", color: "#1d4ed8" },
  TEAM_SUPPORT: { background: "#e8f6ed", color: "#15803d" },
  INITIATIVE_IDEA: { background: "#f5f0ff", color: "#7c3aed" },
  EXTRA_HOURS: { background: "#fff4e8", color: "#c2570c" },
  RESOURCE_SAVING: { background: "#e6f7f6", color: "#0f766e" },
  PROCESS_IMPROVEMENT: { background: "#eef2ff", color: "#4338ca" },
  OTHER: { background: "var(--surface-2)", color: "var(--muted)" },
};

const AVATAR_COLORS = ["#2563eb", "#0e9f6e", "#7c3aed", "#db6d1f", "#dc2626", "#0f766e"];

function initialsOf(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function avatarColor(id) {
  const n = Number(id) || 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function PersonAvatar({ id, name, size = 32 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34, background: avatarColor(id), flexShrink: 0 }}>
      {initialsOf(name)}
    </div>
  );
}

function categoryLabel(entry) {
  if (!entry) return "—";
  if (entry.category === "OTHER" && entry.other_category_text) return entry.other_category_text;
  return CATEGORY_LABELS[entry.category] || entry.category || "—";
}

function formatShortDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatWhen(entry) {
  if (!entry?.effort_start_date) return "—";
  if (entry.effort_end_date && entry.effort_end_date !== entry.effort_start_date) {
    return `${entry.effort_start_date} → ${entry.effort_end_date}`;
  }
  return entry.effort_start_date;
}

/**
 * v2 entry detail, styled as a recognition card rather than a plain key/value read-out.
 * `onChanged` re-fetches just this entry in the parent (keeps the modal open); `onEdit` swaps
 * to the edit form (closes this view). "Save"/"Share" from the reference design are deliberately
 * absent — they aren't things this module builds, and a share link specifically contradicts the
 * BRD's own call ("a link implies an audience and a permission model that does not exist").
 */
export default function ProactiveWorkDetail({ entry, currentUser, onChanged, onEdit, onToggleHighlight }) {
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingBody, setEditingBody] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const commentInputRef = useRef(null);

  const isSubject = Number(entry.subject_employee_id) === Number(currentUser?.id);
  const isAuthor = Number(entry.logged_by_id) === Number(currentUser?.id);
  const isAdmin = currentUser?.role === "admin";
  const canHighlight = currentUser?.role === "manager" || currentUser?.role === "admin";
  const isPrivate = entry.visibility === "PRIVATE";

  // The endorse/comment controls are absent entirely on a PRIVATE entry, for everyone — not
  // greyed out for whoever happens to be able to view it (subject's manager, admin).
  const canEndorse = !isPrivate && !isSubject;
  const canEdit = isAuthor || isAdmin;
  const endorserCount = entry.endorsers?.length || 0;
  const commentCount = (entry.comments || []).filter((c) => !c.is_deleted).length;

  async function handleEndorseToggle() {
    setBusy(true);
    setError(null);
    try {
      await setProactiveWorkEndorsed(entry.id, !entry.endorsed_by_me);
      await onChanged();
    } catch (err) {
      setError(err.message || "Failed to update endorsement.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePostComment(ev) {
    ev.preventDefault();
    if (!commentDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addProactiveWorkComment(entry.id, commentDraft.trim());
      setCommentDraft("");
      await onChanged();
    } catch (err) {
      setError(err.message || "Failed to add comment.");
    } finally {
      setBusy(false);
    }
  }

  function startEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
  }

  async function saveEditComment(commentId) {
    if (!editingBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await editProactiveWorkComment(commentId, editingBody.trim());
      setEditingCommentId(null);
      await onChanged();
    } catch (err) {
      setError(err.message || "Failed to edit comment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm("Delete this comment?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProactiveWorkComment(commentId);
      await onChanged();
    } catch (err) {
      setError(err.message || "Failed to delete comment.");
    } finally {
      setBusy(false);
    }
  }

  const chipStyle = CATEGORY_CHIP_STYLE[entry.category] || CATEGORY_CHIP_STYLE.OTHER;
  const hasInfoBox = !!entry.kpi_measurement_id || !!entry.value_statement;

  return (
    <div>
      <div className="pwd-header">
        <PersonAvatar id={entry.subject_employee_id} name={entry.subject_employee_name} />
        <div className="pwd-header__body">
          <div className="pwd-header__name">{entry.subject_employee_name}</div>
          <div className="pwd-header__meta">
            {formatShortDate(entry.effort_start_date)} · Logged by {entry.logged_by_name}
          </div>
        </div>
        <span className={`pwd-visibility ${isPrivate ? "pwd-visibility--private" : "pwd-visibility--public"}`}>
          {isPrivate ? "🔒 Private" : "🌐 Public"}
        </span>
      </div>

      <div className="pwd-title">{entry.title}</div>
      <p className="pwd-desc">{entry.description}</p>

      <div className="pwd-chips">
        <span className="pwd-chip" style={chipStyle}>
          {CATEGORY_ICONS[entry.category] || "📌"} {categoryLabel(entry)}
        </span>
      </div>

      {hasInfoBox && (
        <div className="pwd-info-box">
          {entry.kpi_measurement_id && (
            <div className="pwd-info-box__col">
              <span>🎯</span>
              <div>
                <div className="pwd-info-box__label">Linked KPI</div>
                <div className="pwd-info-box__value">{entry.kpi_metric_name}</div>
                <div className="pwd-info-box__sub">{entry.kpi_measurement_period_label}</div>
              </div>
            </div>
          )}
          {entry.value_statement && (
            <div className="pwd-info-box__col">
              <span>📈</span>
              <div>
                <div className="pwd-info-box__label">Impact</div>
                <div className="pwd-info-box__value" style={{ fontWeight: 500 }}>{entry.value_statement}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isPrivate && (
        <div className="pwd-stats">
          <span>{endorserCount} {endorserCount === 1 ? "endorsement" : "endorsements"}</span>
          <span>{commentCount} {commentCount === 1 ? "comment" : "comments"}</span>
        </div>
      )}

      {!isPrivate && (
        <div className="pwd-actions">
          {canEndorse && (
            <button type="button" className={`pwd-action-btn ${entry.endorsed_by_me ? "pwd-action-btn--active" : ""}`}
              disabled={busy} onClick={handleEndorseToggle}>
              👍 {entry.endorsed_by_me ? "Endorsed" : "Endorse"}
            </button>
          )}
          <button type="button" className="pwd-action-btn" onClick={() => commentInputRef.current?.focus()}>
            💬 Comment
          </button>
          {canHighlight && (
            <button type="button" className={`pwd-action-btn ${entry.is_highlighted ? "pwd-action-btn--active" : ""}`}
              onClick={() => onToggleHighlight(entry)}>
              ⭐ {entry.is_highlighted ? "Highlighted" : "Highlight"}
            </button>
          )}
        </div>
      )}

      {isPrivate && <p className="cell-sub" style={{ margin: "0 0 1rem" }}>Private entries aren't endorsed or commented on.</p>}

      {!isPrivate && endorserCount > 0 && (
        <p className="cell-sub" style={{ marginTop: "-0.5rem", marginBottom: "0.9rem" }}>
          Endorsed by {entry.endorsers.map((e) => e.name).join(", ")}
        </p>
      )}

      {!isPrivate && (
        <>
          {(entry.comments || []).map((c) => (
            <div key={c.id} className="pwd-comment">
              <PersonAvatar id={c.author_id} name={c.author_name} size={28} />
              <div className="pwd-comment__body">
                <div className="pwd-comment__meta">
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{c.author_name}</span>
                  <span>{formatShortDate(c.created_at)}{c.edited_at ? " · edited" : ""}</span>
                </div>
                {editingCommentId === c.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <textarea className="textarea" value={editingBody} onChange={(e) => setEditingBody(e.target.value)} />
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button type="button" className="btn btn--primary" style={{ fontSize: "0.76rem", padding: "0.25rem 0.6rem" }}
                        disabled={busy} onClick={() => saveEditComment(c.id)}>Save</button>
                      <button type="button" className="btn" style={{ fontSize: "0.76rem", padding: "0.25rem 0.6rem" }}
                        onClick={() => setEditingCommentId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="pwd-comment__bubble" style={{ fontStyle: c.is_deleted ? "italic" : "normal", color: c.is_deleted ? "var(--muted)" : "var(--ink)" }}>
                    {c.body}
                  </div>
                )}
                {!c.is_deleted && editingCommentId !== c.id && (
                  Number(c.author_id) === Number(currentUser?.id) ? (
                    <div className="pwd-comment__links">
                      <button type="button" onClick={() => startEditComment(c)}>Edit</button>
                      <button type="button" onClick={() => handleDeleteComment(c.id)}>Delete</button>
                    </div>
                  ) : isAdmin ? (
                    <div className="pwd-comment__links">
                      <button type="button" onClick={() => handleDeleteComment(c.id)}>Delete</button>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          ))}
          {(!entry.comments || entry.comments.length === 0) && (
            <p className="cell-sub" style={{ fontStyle: "italic", marginBottom: "0.8rem" }}>No comments yet.</p>
          )}

          <form onSubmit={handlePostComment} className="pwd-composer">
            <PersonAvatar id={currentUser?.id} name={currentUser?.name} size={28} />
            <input ref={commentInputRef} className="input" placeholder="Add a comment…" value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)} disabled={busy} />
            <button type="submit" className="btn btn--primary" style={{ fontSize: "0.8rem" }} disabled={busy || !commentDraft.trim()}>
              Post
            </button>
          </form>
        </>
      )}

      {error && <div className="field-error" style={{ marginTop: "0.6rem" }}>⚠️ {error}</div>}

      {showDetails && (
        <div className="pwd-details">
          <div className="preview-panel__row"><span className="k">Effort period</span><span className="v mono">{formatWhen(entry)}</span></div>
          {entry.is_seen && entry.seen_by_name && (
            <div className="preview-panel__row"><span className="k">Seen by</span><span className="v">{entry.seen_by_name} · {formatShortDate(entry.seen_at)}</span></div>
          )}
          {entry.edited_at && (
            <div className="preview-panel__row"><span className="k">Edited</span><span className="v">{formatShortDate(entry.edited_at)}</span></div>
          )}
          <div className="preview-panel__row">
            <span className="k">Visibility</span>
            <span className="v">{isPrivate ? "Visible to the subject, their manager and admin only" : "Visible to everyone at Vitec"}</span>
          </div>
        </div>
      )}

      <div className="pwd-footer">
        <button type="button" onClick={() => setShowDetails((s) => !s)}>
          {showDetails ? "︿" : "⌄"} View details
        </button>
        {canEdit && <button type="button" onClick={onEdit}>✏️ Edit</button>}
      </div>
    </div>
  );
}
