import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Modal, Spinner, Toast } from "./UI";
import ProactiveWorkForm from "../forms/ProactiveWorkForm";
import ProactiveWorkDetail from "./ProactiveWorkDetail";
import {
  listProactiveWorkEveryone,
  getProactiveWorkEntry,
  saveProactiveWorkEntry,
  setProactiveWorkHighlighted,
} from "../lib/store";
import { triggerPermissionPromptIfFirstTime } from "../lib/pushNotifications";

const CATEGORY_LABELS = {
  ATTENDANCE_PUNCTUALITY: "Attendance & Punctuality",
  TEAM_SUPPORT: "Team Support",
  INITIATIVE_IDEA: "Initiative / Idea",
  EXTRA_HOURS: "Extra Hours",
  RESOURCE_SAVING: "Resource Saving",
  PROCESS_IMPROVEMENT: "Process Improvement",
  TECHNICAL_MISSOUT: "Technical Missouts",
  FUNCTIONAL_MISSOUT: "Functional Missouts",
  COMMUNICATION_MISSOUT: "Communication Missouts",
  PROCESS_MISSOUT: "Process Missouts",
  TIMELINE_MISSOUT: "Timeline Missouts",
  OTHER: "Other",
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

function categoryLabel(entry) {
  if (entry.category === "OTHER" && entry.other_category_text) return entry.other_category_text;
  return CATEGORY_LABELS[entry.category] || entry.category || "—";
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const PAGE_SIZE = 5;

/**
 * A compact, live slice of the "Everyone" proactive-work feed for the dashboard. Reuses the same
 * form/detail components and store functions as the full Proactive Work page — endorsing,
 * commenting, highlighting and editing all work exactly the same from here, it's just a smaller
 * entry point rather than a read-only preview.
 */
export default function ProactiveWorkFeed({ currentUser, employees }) {
  const listRef = useRef(null);
  const [page, setPage] = useState({ content: [], page: 0, total_pages: 0, total_elements: 0 });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [toast, setToast] = useState(null);

  function flash(m) { setToast(m); setTimeout(() => setToast(null), 2400); }

  const load = async (p = 0) => {
    setLoading(true);
    try {
      const result = await listProactiveWorkEveryone({ page: p, size: PAGE_SIZE });
      setPage(result);
    } catch (err) {
      console.warn("Failed to load work insights feed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, []); // eslint-disable-line

  // The browser's scroll-anchoring heuristic can shift this container's scrollTop on its own
  // when content above it on the page changes size (e.g. the loading spinner above being
  // replaced by real widgets) — even though that layout shift has nothing to do with this list.
  // The visible symptom is the newest item's top half (avatar/name/title) clipped off above the
  // fold while its chip/footer peek in below. Forcing scrollTop back to 0 whenever the page's
  // content changes is a plain, reliable fix regardless of which layout shift caused it.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [page.content]);

  useEffect(() => {
    if (viewingId == null) return;
    let active = true;
    const timer = setTimeout(() => {
      setViewingLoading(true);
      getProactiveWorkEntry(viewingId)
        .then((entry) => { if (active) { setViewingEntry(entry); setViewingLoading(false); } })
        .catch((err) => {
          if (active) { setViewingLoading(false); setViewingId(null); flash(err.message || "Failed to load entry"); }
        });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [viewingId]);

  function openEntry(id) {
    setViewingId(id);
    triggerPermissionPromptIfFirstTime();
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      await saveProactiveWorkEntry(payload);
      setAdding(false);
      setEditingEntry(null);
      await load(page.page);
      if (viewingId != null) setViewingEntry(await getProactiveWorkEntry(viewingId));
      flash(payload.id ? "Work insight updated" : "Work insight logged");
    } catch (err) {
      flash(err.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleHighlight(entry) {
    try {
      await setProactiveWorkHighlighted(entry.id, !entry.is_highlighted);
      await load(page.page);
      if (viewingId === entry.id) setViewingEntry(await getProactiveWorkEntry(entry.id));
    } catch (err) {
      flash(err.message || "Failed to update highlight");
    }
  }

  async function handleViewingChanged() {
    setViewingEntry(await getProactiveWorkEntry(viewingId));
    await load(page.page);
  }

  function designationFor(employeeId) {
    const emp = (employees || []).find((e) => Number(e.id) === Number(employeeId));
    return emp?.designation || emp?.role || "";
  }

  const atLastPage = page.page + 1 >= page.total_pages;

  return (
    <div className="card pwf-card">
      <div className="pwf-head">
        <div>
          <h3 style={{ margin: 0 }}>Work Insights</h3>
          <p className="cell-sub" style={{ margin: "0.15rem 0 0" }}>Recent contributions from across the organization</p>
        </div>
        <Link to="/proactive-work" className="pwf-view-all">View all</Link>
      </div>

      <button type="button" className="pwf-composer" onClick={() => setAdding(true)}>
        <span className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: avatarColor(currentUser?.id) }}>
          {initialsOf(currentUser?.name)}
        </span>
        <span className="pwf-composer__text">Share a work insight…</span>
        <span className="pwf-composer__plus">+</span>
      </button>

      <div className="pwf-list" ref={listRef}>
        {loading ? (
          <div style={{ padding: "1.2rem" }}><Spinner /></div>
        ) : page.content.length === 0 ? (
          <div className="empty" style={{ padding: "1.2rem" }}>
            <p>Nothing logged yet.</p>
          </div>
        ) : (
          page.content.map((e) => {
            // For a jointly-credited entry, the avatar/designation represent whoever's named
            // first in subject_employee_name ("Bhavesh Bhimra & Dipak Suryawanshi") — the first
            // id in subject_employee_ids — rather than the legacy single subject_employee_id,
            // which is always the logger and may not even be the person named first.
            const primarySubjectId = e.subject_employee_ids?.length ? e.subject_employee_ids[0] : e.subject_employee_id;
            return (
            <div key={e.id} className="pwf-item" onClick={() => openEntry(e.id)}>
              <span className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: avatarColor(primarySubjectId), flexShrink: 0 }}>
                {initialsOf(e.subject_employee_name)}
              </span>
              <div className="pwf-item__body">
                <div className="pwf-item__meta">
                  <span className="pwf-item__name">{e.subject_employee_name}</span>
                  {designationFor(primarySubjectId) && <span> · {designationFor(primarySubjectId)}</span>}
                  <span> · {formatRelativeTime(e.created_at)}</span>
                </div>
                <div className="pwf-item__title">{e.title}</div>
                <div className="pwf-item__desc">{e.description}</div>
                <div className="pwf-item__chips">
                  <span className="pwf-chip" style={CATEGORY_CHIP_STYLE[e.category] || {}}>{categoryLabel(e)}</span>
                  {e.kpi_measurement_id && (
                    <span className="pwf-chip pwf-chip--kpi">🔗 {e.kpi_metric_name} · {e.kpi_measurement_period_label}</span>
                  )}
                </div>
                <div className="pwf-item__footer">
                  <span>👍 {e.endorsement_count || 0}</span>
                  <span>💬 {e.comment_count || 0}</span>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {page.total_pages > 1 && (
        <button type="button" className="pwf-more" onClick={() => load(atLastPage ? 0 : page.page + 1)}>
          {atLastPage ? "Back to top ↑" : "Show more contributions ▾"}
        </button>
      )}

      {(adding || editingEntry) && (
        <Modal title={editingEntry ? "Edit work insight" : "Log work insight"}
          subtitle="Something worth recognizing — or a miss worth naming — that no KPI would show."
          onClose={() => { setAdding(false); setEditingEntry(null); }}>
          <ProactiveWorkForm currentUser={currentUser} initial={editingEntry} saving={saving}
            onSubmit={handleSave} onCancel={() => { setAdding(false); setEditingEntry(null); }} />
        </Modal>
      )}

      {viewingId != null && (
        <Modal title="Work Insight" onClose={() => setViewingId(null)}>
          {viewingLoading || !viewingEntry ? <Spinner /> : (
            <ProactiveWorkDetail
              entry={viewingEntry}
              currentUser={currentUser}
              onChanged={handleViewingChanged}
              onToggleHighlight={(entry) => handleToggleHighlight(entry)}
              onEdit={() => { setEditingEntry(viewingEntry); setViewingId(null); }}
            />
          )}
        </Modal>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
