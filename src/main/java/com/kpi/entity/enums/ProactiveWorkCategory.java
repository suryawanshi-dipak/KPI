package com.kpi.entity.enums;

/** Shared by both {@link ProactiveWorkKind} values on one column: the first six are meaningful
 *  for PROACTIVE entries, the five *_MISSOUT values for MISSOUT entries, and OTHER for either.
 *  The frontend offers only the relevant subset per kind; the server does not cross-validate
 *  category against workKind — that's a UI convenience, not an integrity rule. */
public enum ProactiveWorkCategory {
    ATTENDANCE_PUNCTUALITY,
    TEAM_SUPPORT,
    INITIATIVE_IDEA,
    EXTRA_HOURS,
    RESOURCE_SAVING,
    PROCESS_IMPROVEMENT,
    TECHNICAL_MISSOUT,
    FUNCTIONAL_MISSOUT,
    COMMUNICATION_MISSOUT,
    PROCESS_MISSOUT,
    TIMELINE_MISSOUT,
    OTHER
}
