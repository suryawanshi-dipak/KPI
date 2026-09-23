package com.kpi.entity.enums;

/** Whether a logged entry is effort worth crediting (PROACTIVE) or a self-reported shortfall
 *  worth surfacing (MISSOUT). Independent of {@link ProactiveWorkEntryType}, which only tracks
 *  whether the entry links to a KPI measurement. */
public enum ProactiveWorkKind {
    PROACTIVE,
    MISSOUT
}
