// // Mappers between backend DTOs (snake-camelCase from Java) and the
// // existing UI shape used throughout the screens. Keeping this layer
// // means the UI code doesn't need to change when the backend evolves.

// // ─── Cycles ─────────────────────────────────────────────────────
// export const mapCycle = (c = {}) => ({
//   id: c.id ?? c.cycleId,
//   name: c.cycleName ?? c.name ?? "",
//   code: c.cycleCode ?? c.code ?? "",
//   type: c.cycleType ?? c.type ?? "quarterly",
//   start: c.startDate ?? c.start ?? "",
//   end: c.endDate ?? c.end ?? "",
//   locked: c.locked ?? c.isLocked ?? false,
//   active: c.isActive ?? c.active ?? true,
//   raw: c,
// });

// export const toCyclePayload = (form) => ({
//   cycleName: form.name,
//   cycleCode: form.code,
//   cycleType: (form.type || "quarterly").toLowerCase(),
//   startDate: form.start,
//   endDate: form.end,
//   isActive: form.active ?? true,
// });

// // ─── Objectives ─────────────────────────────────────────────────
// export const mapObjective = (o = {}) => {
//   const owner =
//     o.ownerName ||
//     o.ownerEmployeeName ||
//     o.owner ||
//     (o.ownerTeamName ? o.ownerTeamName : "Unassigned");
//   return {
//     id: o.id ?? o.objectiveId,
//     publicId: o.publicId,
//     cycleId: o.cycleId,
//     owner,
//     ownerInitials: initials(owner),
//     title: o.objectiveTitle ?? o.title ?? "",
//     desc: o.objectiveDescription ?? o.desc ?? "",
//     scope: (o.objectiveScope ?? o.scope ?? "company").toLowerCase(),
//     type: (o.objectiveType ?? o.type ?? "committed").toLowerCase(),
//     status: (o.status ?? "active").toLowerCase(),
//     progress: o.progressPct ?? o.progress ?? 0,
//     confidence: o.confidenceScore ?? o.confidence ?? 5,
//     due: formatDate(o.dueDate ?? o.due),
//     raw: o,
//   };
// };

// export const toObjectivePayload = (form) => ({
//   cycleId: form.cycleId,
//   ownerEmployeeId: form.ownerEmployeeId ?? getAuthEmployeeId(),
//   ownerTeamId: form.ownerTeamId ?? null,
//   parentObjectiveId: form.parentObjectiveId ?? null,
//   alignedObjectiveId: form.alignedObjectiveId ?? null,
//   objectiveTitle: form.title,
//   objectiveDescription: form.desc ?? "",
//   objectiveScope: (form.scope || "personal").toLowerCase(),
//   objectiveType: (form.type || "committed").toLowerCase(),
//   goalCategory: form.goalCategory ?? null,
//   successCriteria: form.successCriteria ?? "",
//   status: (form.status || "active").toLowerCase(),
//   progressPct: form.progress ?? 0,
//   confidenceScore: form.confidence ?? 5,
//   scoringMethod: form.scoringMethod ?? "weighted_kr_average",
//   checkInFrequency: form.checkInFrequency ?? "weekly",
//   startDate: form.startDate ?? null,
//   dueDate: form.dueDate ?? form.due ?? null,
// });

// // ─── Key Results ────────────────────────────────────────────────
// export const mapKeyResult = (k = {}) => ({
//   id: k.id ?? k.keyResultId,
//   objId: k.objectiveId ?? k.objId,
//   title: k.keyResultTitle ?? k.title ?? "",
//   metric: k.metricName ?? k.metric ?? "",
//   baseline: k.baselineValue ?? k.baseline ?? 0,
//   target: k.targetValue ?? k.target ?? 0,
//   current: k.currentValue ?? k.current ?? 0,
//   unit: k.measurementUnit ?? k.unit ?? "",
//   weight: k.weightPct ?? k.weight ?? 0,
//   progress: k.progressPct ?? k.progress ?? 0,
//   confidence: (k.confidenceLevel ?? k.confidence ?? "medium").toLowerCase(),
//   trend: (k.trendDirection ?? k.trend ?? "stable").toLowerCase(),
//   owner: k.ownerName ?? k.owner ?? "Unassigned",
//   ownerInitials: initials(k.ownerName ?? k.owner ?? ""),
//   raw: k,
// });

// export const toKeyResultPayload = (form) => ({
//   objectiveId: form.objId ?? form.objectiveId,
//   keyResultTitle: form.title,
//   keyResultDescription: form.desc ?? "",
//   metricName: form.metric,
//   baselineValue: Number(form.baseline) || 0,
//   targetValue: Number(form.target) || 0,
//   stretchTargetValue: form.stretchTarget ?? null,
//   currentValue: Number(form.current ?? form.baseline ?? 0),
//   measurementUnit: form.unit ?? "%",
//   measurementType: form.measurementType ?? "percentage",
//   calculationMethod: form.calculationMethod ?? "linear",
//   weightPct: Number(form.weight) || 0,
//   confidenceLevel: form.confidence ?? "medium",
//   reviewStatus: form.reviewStatus ?? "in_progress",
//   createdBy: form.createdBy ?? getAuthEmployeeId(),
// });

// export const toProgressPayload = (form) => ({
//   currentValue: Number(form.current),
//   confidenceLevel: form.confidence ?? "medium",
//   trendDirection: form.trend ?? "improving",
// });

// // ─── Initiatives ────────────────────────────────────────────────
// export const mapInitiative = (i = {}) => ({
//   id: i.id ?? i.initiativeId,
//   krId: i.keyResultId ?? i.krId,
//   title: i.initiativeTitle ?? i.title ?? "",
//   owner: i.ownerName ?? i.owner ?? "Unassigned",
//   status: (i.initiativeStatus ?? i.status ?? "planned").toLowerCase(),
//   priority: (i.priority ?? "medium").toLowerCase(),
//   completion: i.completionPct ?? i.completion ?? 0,
//   due: formatDate(i.dueDate ?? i.due),
//   blocker: i.blockerNote ?? i.blocker ?? null,
//   raw: i,
// });

// export const toInitiativePayload = (form) => ({
//   keyResultId: form.krId ?? form.keyResultId,
//   initiativeTitle: form.title,
//   initiativeDescription: form.desc ?? "",
//   ownerEmployeeId: form.ownerEmployeeId ?? getAuthEmployeeId(),
//   initiativeStatus: (form.status || "planned").toLowerCase(),
//   impactEstimate: form.impactEstimate ?? "medium",
//   effortEstimate: form.effortEstimate ?? "medium",
//   completionPct: Number(form.completion) || 0,
//   blockerNote: form.blocker ?? null,
//   startDate: form.startDate ?? null,
//   dueDate: form.dueDate ?? form.due ?? null,
//   priority: (form.priority || "medium").toLowerCase(),
//   sortOrder: form.sortOrder ?? 0,
// });

// // ─── Check-ins ──────────────────────────────────────────────────
// export const mapCheckIn = (c = {}) => ({
//   id: c.id ?? c.checkInId,
//   objId: c.objectiveId ?? c.objId,
//   krId: c.keyResultId ?? c.krId,
//   summary: c.summary ?? "",
//   details: c.details ?? "",
//   progress: c.progressPct ?? c.progress ?? 0,
//   confidence: c.confidenceScore ?? c.confidence ?? 5,
//   health: (c.healthStatus ?? c.health ?? "green").toLowerCase(),
//   date: formatDate(c.checkInDate ?? c.date),
//   week: c.weekNumber ?? c.week ?? 0,
//   type: c.updateType ?? c.type ?? "progress_update",
//   wins: c.wins ?? "",
//   blockers: c.blockers ?? "",
//   nextSteps: c.nextSteps ?? "",
//   visibility: c.visibility ?? "team",
//   raw: c,
// });

// export const toCheckInPayload = (form) => ({
//   objectiveId: form.objId ?? form.objectiveId,
//   keyResultId: form.krId ?? form.keyResultId ?? null,
//   employeeId: form.employeeId ?? getAuthEmployeeId(),
//   checkInDate: form.date ?? new Date().toISOString().slice(0, 10),
//   weekNumber: form.week ?? weekNumber(new Date()),
//   updateType: form.type ?? "progress_update",
//   summary: form.summary ?? "",
//   details: form.details ?? "",
//   progressPct: Number(form.progress) || 0,
//   confidenceScore: Number(form.confidence) || 5,
//   healthStatus: (form.health ?? "green").toLowerCase(),
//   wins: form.wins ?? "",
//   blockers: form.blockers ?? "",
//   nextSteps: form.nextSteps ?? "",
//   visibility: form.visibility ?? "team",
// });

// // ─── Teams ──────────────────────────────────────────────────────
// export const mapTeam = (t = {}) => ({
//   id: t.id ?? t.teamId,
//   name: t.name ?? "",
//   description: t.description ?? "",
//   raw: t,
// });

// export const toTeamPayload = (form) => ({
//   name: form.name,
//   description: form.description ?? "",
// });

// // ─── Auth helpers ────────────────────────────────────────────────
// function getAuthEmployeeId() {
//   try {
//     const user = JSON.parse(sessionStorage.getItem("okr_user") || "{}");
//     return user.employeeId ?? null;
//   } catch {
//     return null;
//   }
// }

// // ─── Utilities ──────────────────────────────────────────────────
// export function initials(name = "") {
//   return name
//     .split(/\s+/)
//     .filter(Boolean)
//     .slice(0, 2)
//     .map((s) => s[0]?.toUpperCase() || "")
//     .join("") || "—";
// }

// export function formatDate(d) {
//   if (!d) return "";
//   try {
//     const date = new Date(d);
//     if (Number.isNaN(date.getTime())) return String(d);
//     return date.toLocaleDateString("en-US", {
//       month: "short",
//       day: "numeric",
//       year: "numeric",
//     });
//   } catch {
//     return String(d);
//   }
// }

// export function weekNumber(date) {
//   const target = new Date(date.valueOf());
//   const dayNr = (date.getDay() + 6) % 7;
//   target.setDate(target.getDate() - dayNr + 3);
//   const firstThursday = target.valueOf();
//   target.setMonth(0, 1);
//   if (target.getDay() !== 4) {
//     target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
//   }
//   return 1 + Math.ceil((firstThursday - target) / 604800000);
// }

