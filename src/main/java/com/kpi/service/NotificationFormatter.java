package com.kpi.service;

import com.kpi.entity.Employee;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.NotificationType;
import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.util.EmployeeUtils;
import org.springframework.stereotype.Component;

/**
 * Single canonical builder for notification titles, bodies, and push payloads across the app.
 *
 * <p><strong>KPI Masking Invariant:</strong>
 * Per BRD security requirements, the notification body MUST NEVER name a linked KPI or indicate
 * that any link to a KPI exists. Because push notifications and org-wide broadcasts cannot be
 * masked per-viewer at send-time, the payload carries ONLY what every recipient in the organization
 * is unconditionally permitted to see: category and verbatim title. Descriptions and value statements
 * are intentionally omitted (a truncated description misleads, and may contain private project details).
 */
@Component
public class NotificationFormatter {

    /** @param actor whoever performed the action this notification is about — the logger for
     *                NEW_ENTRY/LOGGED_FOR_YOU, or the endorser/commenter/highlighter otherwise. */
    public String formatTitle(NotificationType type, Employee actor) {
        String actorName = actor != null ? EmployeeUtils.resolveName(actor) : "A colleague";
        return switch (type) {
            case LOGGED_FOR_YOU -> actorName + " logged proactive work for you";
            case ENDORSED_YOURS -> actorName + " endorsed your proactive work";
            case COMMENTED_YOURS -> actorName + " commented on your proactive work";
            case HIGHLIGHTED_YOURS -> actorName + " highlighted your proactive work";
            case NEW_ENTRY -> actorName + " logged proactive work";
        };
    }

    public String formatBody(ProactiveWorkEntry entry) {
        String categoryLabel = formatCategory(entry.getCategory(), entry.getOtherCategoryText());
        // Title verbatim, never description, never KPI name or measurement ID.
        return categoryLabel + " — \"" + entry.getTitle() + "\"";
    }

    public String formatCategory(ProactiveWorkCategory category, String otherText) {
        if (category == null) return "Proactive Work";
        return switch (category) {
            case ATTENDANCE_PUNCTUALITY -> "Attendance & Punctuality";
            case TEAM_SUPPORT -> "Team Support";
            case INITIATIVE_IDEA -> "Initiative / Idea";
            case EXTRA_HOURS -> "Extra Hours";
            case RESOURCE_SAVING -> "Resource Saving";
            case PROCESS_IMPROVEMENT -> "Process Improvement";
            case OTHER -> (otherText != null && !otherText.isBlank()) ? otherText.trim() : "Other";
        };
    }

    public String formatDigestTitle(boolean isDaily) {
        return isDaily ? "Proactive Work Daily Digest" : "Proactive Work Hourly Digest";
    }

    public String formatDigestBody(long count, boolean isDaily) {
        String unit = count == 1 ? "person" : "people";
        return isDaily
                ? count + " " + unit + " logged proactive work today."
                : count + " new proactive work entries logged this hour.";
    }

    public String formatEntryUrl(Long entryId) {
        return "/proactive-work/" + entryId;
    }

    public String formatDigestUrl() {
        return "/proactive-work";
    }

    public String buildPushJson(String title, String body, String url, Long entryId, boolean includeActions) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"title\":").append(quote(title)).append(",");
        json.append("\"body\":").append(quote(body)).append(",");
        json.append("\"icon\":\"/kpi/favicon.svg\",");
        json.append("\"badge\":\"/kpi/favicon.svg\",");
        json.append("\"data\":{");
        json.append("\"url\":").append(quote(url));
        if (entryId != null) {
            json.append(",\"entryId\":").append(entryId);
        }
        json.append("}");
        if (includeActions && entryId != null) {
            json.append(",\"actions\":[");
            json.append("{\"action\":\"open\",\"title\":\"Open\"},");
            json.append("{\"action\":\"endorse\",\"title\":\"Endorse\"}");
            json.append("]");
        }
        json.append("}");
        return json.toString();
    }

    private static String quote(String s) {
        if (s == null) return "\"\"";
        return "\"" + s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t") + "\"";
    }
}
