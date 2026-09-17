import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../api/notifications";
import { getBrowserPermissionState, subscribeCurrentBrowser, enableNotificationsNow } from "../lib/pushNotifications";

export default function NotificationPreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [toast, setToast] = useState(null);
  const [browserPermission, setBrowserPermission] = useState(getBrowserPermissionState());

  const [form, setForm] = useState({
    newEntryScope: "EVERYONE",
    delivery: "INSTANT",
    ownActivity: true,
    highlight: true,
    quietHoursEnabled: false,
    quietFrom: "19:00",
    quietTo: "09:00",
  });

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    getNotificationPreferences()
      .then((data) => {
        if (data) {
          setForm({
            newEntryScope: data.newEntryScope || "EVERYONE",
            delivery: data.delivery || "INSTANT",
            ownActivity: data.ownActivity !== false,
            highlight: data.highlight !== false,
            quietHoursEnabled: Boolean(data.quietFrom && data.quietTo),
            quietFrom: data.quietFrom ? data.quietFrom.slice(0, 5) : "19:00",
            quietTo: data.quietTo ? data.quietTo.slice(0, 5) : "09:00",
          });
        }
        setBrowserPermission(getBrowserPermissionState());
        setLoading(false);
      })
      .catch((err) => {
        flash(err.message || "Failed to load preferences");
        setLoading(false);
      });
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        newEntryScope: form.newEntryScope,
        delivery: form.delivery,
        ownActivity: form.ownActivity,
        highlight: form.highlight,
        quietFrom: form.quietHoursEnabled ? `${form.quietFrom}:00` : null,
        quietTo: form.quietHoursEnabled ? `${form.quietTo}:00` : null,
      };
      await updateNotificationPreferences(payload);
      flash("Notification preferences saved successfully.");
    } catch (err) {
      flash(err.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout crumb="Notification Preferences">
      <div className="pref-page-container">
        <div className="pref-header">
          <h1 className="pref-title">Notification Preferences</h1>
          <p className="pref-subtitle">
            Control how and when you receive proactive work updates and desktop alerts.
          </p>
        </div>

        {toast && <div className="pref-toast">{toast}</div>}

        {/* Browser Permission Banner */}
        <div className={`browser-perm-card ${browserPermission}`}>
          <div className="browser-perm-card__icon">
            {browserPermission === "granted" ? "🔔" : browserPermission === "denied" ? "🚫" : "ℹ️"}
          </div>
          <div className="browser-perm-card__info">
            <strong>
              {browserPermission === "granted"
                ? "Desktop push notifications are enabled on this browser"
                : browserPermission === "denied"
                ? "Desktop notifications are blocked by your browser"
                : "Desktop notifications have not been enabled on this device"}
            </strong>
            <p>
              {browserPermission === "granted"
                ? "You will receive desktop alerts per the delivery preferences below."
                : browserPermission === "denied"
                ? "Because you previously blocked notifications, the site cannot re-prompt you. To enable popups, click the lock/settings icon in your browser address bar and change Notifications to 'Allow'."
                : browserPermission === "unsupported"
                ? "This browser doesn't support desktop push notifications."
                : "Enable it below, or you'll be prompted automatically the first time you endorse or open a proactive work entry."}
            </p>
          </div>
          {browserPermission === "granted" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const ok = await subscribeCurrentBrowser();
                flash(ok ? "Push subscription refreshed!" : "Failed to refresh subscription.");
              }}
            >
              Verify Subscription
            </button>
          )}
          {browserPermission === "default" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={enabling}
              onClick={async () => {
                setEnabling(true);
                try {
                  const ok = await enableNotificationsNow();
                  setBrowserPermission(getBrowserPermissionState());
                  flash(ok
                    ? "Desktop notifications enabled for this device."
                    : "Notifications weren't enabled. You can try again anytime.");
                } finally {
                  setEnabling(false);
                }
              }}
            >
              {enabling ? "Requesting..." : "Enable Notifications"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="pref-loading">Loading preferences...</div>
        ) : (
          <form className="pref-form" onSubmit={handleSave}>
            {/* Row 1: New proactive work scope */}
            <div className="pref-row">
              <div className="pref-row__label">
                <strong>New proactive work</strong>
                <p>Which discretionary work entries should trigger desktop popups and bell alerts.</p>
              </div>
              <div className="pref-row__control">
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${form.newEntryScope === "EVERYONE" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, newEntryScope: "EVERYONE" })}
                  >
                    Everyone
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${form.newEntryScope === "MY_TEAM" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, newEntryScope: "MY_TEAM" })}
                  >
                    My team
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${form.newEntryScope === "NONE" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, newEntryScope: "NONE" })}
                  >
                    Off
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Delivery method */}
            <div className="pref-row">
              <div className="pref-row__label">
                <strong>How it arrives</strong>
                <p>Choose between real-time alerts or batching to reduce interruptions.</p>
              </div>
              <div className="pref-row__control">
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${form.delivery === "INSTANT" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, delivery: "INSTANT" })}
                  >
                    As it happens
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${form.delivery === "HOURLY_DIGEST" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, delivery: "HOURLY_DIGEST" })}
                  >
                    Hourly
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${form.delivery === "DAILY_DIGEST" ? "active" : ""}`}
                    onClick={() => setForm({ ...form, delivery: "DAILY_DIGEST" })}
                  >
                    Daily at 5pm
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: Endorsements and comments */}
            <div className="pref-row">
              <div className="pref-row__label">
                <strong>Endorsements and comments on my entries</strong>
                <p>Notify me when peers recognize or comment on work I logged.</p>
              </div>
              <div className="pref-row__control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.ownActivity}
                    onChange={(e) => setForm({ ...form, ownActivity: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* Row 4: Manager highlight */}
            <div className="pref-row">
              <div className="pref-row__label">
                <strong>When my manager highlights my entry</strong>
                <p>Notify me when leadership flags my proactive work as standout effort.</p>
              </div>
              <div className="pref-row__control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.highlight}
                    onChange={(e) => setForm({ ...form, highlight: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* Row 5: Quiet hours */}
            <div className="pref-row">
              <div className="pref-row__label">
                <strong>Quiet hours</strong>
                <p>Notifications during quiet hours are held and delivered after the window.</p>
              </div>
              <div className="pref-row__control quiet-hours-control">
                <label className="toggle-switch" style={{ marginBottom: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={form.quietHoursEnabled}
                    onChange={(e) => setForm({ ...form, quietHoursEnabled: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>

                {form.quietHoursEnabled && (
                  <div className="quiet-hours-inputs">
                    <span>From</span>
                    <input
                      type="time"
                      value={form.quietFrom}
                      onChange={(e) => setForm({ ...form, quietFrom: e.target.value })}
                    />
                    <span>To</span>
                    <input
                      type="time"
                      value={form.quietTo}
                      onChange={(e) => setForm({ ...form, quietTo: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pref-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving Changes..." : "Save Preferences"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
