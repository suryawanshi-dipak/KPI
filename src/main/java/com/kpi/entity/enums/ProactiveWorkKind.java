package com.kpi.entity.enums;

/** Whether a logged entry is effort worth crediting (PROACTIVE), a self-reported shortfall
 *  worth surfacing (MISSOUT), or fulfilling core responsibilities / KRA goals (ACHIEVEMENT).
 *  Independent of {@link ProactiveWorkEntryType}, which only tracks whether the entry links to
 *  a KPI measurement. */
public enum ProactiveWorkKind {
    PROACTIVE,
    MISSOUT,
    // KPI-29: Added ACHIEVEMENT for logging fulfilled core responsibilities and KRAs
    ACHIEVEMENT
}
