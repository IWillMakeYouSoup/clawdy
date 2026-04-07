import { Firestore } from "@google-cloud/firestore";
import pkg from "cron-parser";
const { CronExpressionParser } = pkg;

const db = new Firestore({ databaseId: "chloesmemory" });

function jobsCol(userId) {
  return db.collection("users").doc(String(userId)).collection("heartbeat");
}

function nextRun(cronExpression, timezone) {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate: new Date(),
    tz: timezone,
  });
  return interval.next().toDate();
}

export async function listDueJobs() {
  const now = new Date();
  const snap = await db
    .collectionGroup("heartbeat")
    .where("enabled", "==", true)
    .where("nextRunAt", "<=", now)
    .get();

  return snap.docs.map((d) => {
    // Extract userId from path: users/{userId}/heartbeat/{jobId}
    const userId = d.ref.parent.parent.id;
    return { jobId: d.id, userId, ...d.data() };
  });
}

export async function listJobs(userId) {
  const snap = await jobsCol(userId).get();
  return snap.docs.map((d) => ({ jobId: d.id, ...d.data() }));
}

export async function createJob(userId, { name, cronExpression, timezone, prompt }) {
  const ref = jobsCol(userId).doc();
  const now = new Date();
  await ref.set({
    name,
    cronExpression,
    timezone: timezone ?? "Europe/Paris",
    prompt,
    enabled: true,
    respondToUser: true,
    createdAt: now,
    lastRanAt: null,
    nextRunAt: nextRun(cronExpression, timezone ?? "UTC"),
  });
  return ref.id;
}

export async function updateJob(userId, jobId, fields) {
  const ref = jobsCol(userId).doc(jobId);
  const update = { ...fields };
  // If schedule changed, recompute nextRunAt
  if (fields.cronExpression || fields.timezone) {
    const doc = await ref.get();
    const data = doc.data();
    const expr = fields.cronExpression ?? data.cronExpression;
    const tz = fields.timezone ?? data.timezone;
    update.nextRunAt = nextRun(expr, tz);
  }
  await ref.update(update);
}

export async function deleteJob(userId, jobId) {
  await jobsCol(userId).doc(jobId).delete();
}

export async function markJobRan(userId, jobId, cronExpression, timezone) {
  await jobsCol(userId).doc(jobId).update({
    lastRanAt: new Date(),
    nextRunAt: nextRun(cronExpression, timezone),
  });
}
