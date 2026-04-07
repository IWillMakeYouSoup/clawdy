import { Firestore } from "@google-cloud/firestore";
import { randomUUID } from "crypto";

const db = new Firestore({ databaseId: "chloesmemory" });

function goalsCol(userId) {
  return db.collection("users").doc(String(userId)).collection("goals");
}

export async function listGoals(userId) {
  const snap = await goalsCol(userId).where("archived", "==", false).get();
  return snap.docs.map((d) => ({ goalId: d.id, ...d.data() }));
}

export async function createGoal(userId, { shortDescription, tags, priority, targetDate, completionDefinition }) {
  const ref = goalsCol(userId).doc();
  const now = new Date();
  await ref.set({
    shortDescription,
    tags: tags ?? [],
    priority: priority ?? "medium",
    targetDate: targetDate ?? null,
    state: "",
    completionDefinition: completionDefinition ?? "",
    lastBroughtUp: now,
    lastConcreteAction: null,
    createdAt: now,
    completed: false,
    archived: false,
    actions: [],
  });
  return ref.id;
}

export async function addAction(userId, goalId, shortDescription) {
  const ref = goalsCol(userId).doc(goalId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`Goal ${goalId} not found`);
  const actions = doc.data().actions ?? [];
  const action = {
    id: randomUUID(),
    shortDescription,
    completed: false,
    completedAt: null,
    createdAt: new Date(),
  };
  await ref.update({ actions: [...actions, action], lastBroughtUp: new Date() });
  return action.id;
}

export async function completeAction(userId, goalId, actionId) {
  const ref = goalsCol(userId).doc(goalId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`Goal ${goalId} not found`);
  const now = new Date();
  const actions = (doc.data().actions ?? []).map((a) =>
    a.id === actionId ? { ...a, completed: true, completedAt: now } : a
  );
  await ref.update({ actions, lastConcreteAction: now });
}

export async function updateGoalState(userId, goalId, state) {
  const ref = goalsCol(userId).doc(goalId);
  await ref.update({ state, lastBroughtUp: new Date() });
}

export async function completeGoal(userId, goalId) {
  const ref = goalsCol(userId).doc(goalId);
  await ref.update({ completed: true, archived: true });
}

export async function archiveGoal(userId, goalId) {
  const ref = goalsCol(userId).doc(goalId);
  await ref.update({ archived: true });
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export async function getTopGoals(userId, limit = 3) {
  const goals = await listGoals(userId);
  return goals
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 1;
      const pb = PRIORITY_ORDER[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
    })
    .slice(0, limit);
}
