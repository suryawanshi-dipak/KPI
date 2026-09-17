import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import {
  getBellFeed,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications";

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const loadUnread = async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (e) {
      // Quiet fail if not logged in or network error
    }
  };

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await getBellFeed({ page: 0, size: 25 });
      setNotifications(data?.content || []);
    } catch (e) {
      console.warn("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      loadFeed();
    }
  }, [open]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (e) {
      console.warn("Failed to mark all notifications as read:", e);
    }
  };

  const handleItemClick = async (n) => {
    if (!n.readAt) {
      markNotificationRead(n.id).catch(() => {});
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
    }
    setOpen(false);
    if (n.url) {
      navigate(n.url);
    } else if (n.entryId) {
      navigate(`/proactive-work/${n.entryId}`);
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        id="notification-bell-button"
        className="notification-bell-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        title="Notifications"
      >
        <Icon.bell style={{ width: 20, height: 20 }} />
        {unreadCount > 0 && (
          <span className="bell-badge" id="notification-unread-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown" id="notification-dropdown-menu">
          <div className="notification-dropdown__header">
            <div className="notification-dropdown__title">
              Notifications
              {unreadCount > 0 && (
                <span className="notification-dropdown__pill">{unreadCount} new</span>
              )}
            </div>
            <div className="notification-dropdown__actions">
              {unreadCount > 0 && (
                <button
                  className="notification-dropdown__mark-read"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  Mark all read
                </button>
              )}
              <button
                className="notification-dropdown__pref-link"
                onClick={() => {
                  setOpen(false);
                  navigate("/preferences");
                }}
                title="Notification Settings"
              >
                <Icon.settings style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          <div className="notification-dropdown__list">
            {loading ? (
              <div className="notification-dropdown__loading">Loading updates...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-dropdown__empty">
                <p>No notifications yet</p>
                <small>Updates when colleagues log proactive work appear here.</small>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    className={`notification-item ${isUnread ? "unread" : "read"}`}
                    onClick={() => handleItemClick(n)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="notification-item__icon">
                      {n.type === "LOGGED_FOR_YOU" ? "🎯" : "✨"}
                    </div>
                    <div className="notification-item__content">
                      <div className="notification-item__header">
                        <span className="notification-item__title">{n.title}</span>
                        <span className="notification-item__time">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <div className="notification-item__body">{n.body}</div>
                    </div>
                    {isUnread && <span className="notification-item__dot" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
