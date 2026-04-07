import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({ databaseId: "chloesmemory" });
const MAX_PAIRS = 20;

function activeRef(userId) {
  return db.collection("users").doc(String(userId)).collection("conversations").doc("active");
}

export async function getHistory(userId) {
  const doc = await activeRef(userId).get();
  return doc.exists ? (doc.data().history ?? []) : [];
}

export async function saveHistory(userId, history) {
  const trimmed =
    history.length > MAX_PAIRS * 2 ? history.slice(history.length - MAX_PAIRS * 2) : history;
  await activeRef(userId).set({ history: trimmed, updatedAt: new Date() });
}

export async function saveTelegramChatId(userId, chatId) {
  const ref = db.collection("users").doc(String(userId));
  const doc = await ref.get();
  if (!doc.exists || !doc.data().telegramChatId) {
    await ref.set({ telegramChatId: chatId }, { merge: true });
  }
}

export async function getTelegramChatId(userId) {
  const doc = await db.collection("users").doc(String(userId)).get();
  return doc.exists ? doc.data().telegramChatId ?? null : null;
}

const COMPACT_THRESHOLD = 30;
const COMPACT_COUNT = 15;

export async function compactHistoryIfNeeded(userId, history, anthropicClient) {
  if (history.length <= COMPACT_THRESHOLD) return history;

  console.log(`Compacting history for user ${userId}: summarizing ${COMPACT_COUNT} of ${history.length} messages`);

  const toSummarize = history.slice(0, COMPACT_COUNT);
  const rest = history.slice(COMPACT_COUNT);

  const formatted = toSummarize
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const response = await anthropicClient.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content:
          "Summarize the following conversation history concisely.\n" +
          "Preserve: key facts about the user, decisions made, goals or intentions mentioned, important context.\n" +
          "Omit: pleasantries, repetition, resolved questions.\n" +
          "Be brief — this replaces 15 messages in an ongoing conversation.\n\n" +
          formatted,
      },
    ],
  });

  const summary = response.content.find((b) => b.type === "text")?.text ?? "";

  const compacted = [
    { role: "user", content: `[Earlier conversation summary: ${summary}]` },
    { role: "assistant", content: "Understood, I have the context." },
    ...rest,
  ];

  await saveHistory(userId, compacted);
  return compacted;
}

export async function archiveAndReset(userId) {
  const ref = activeRef(userId);
  const doc = await ref.get();

  if (!doc.exists || !(doc.data().history ?? []).length) return false;

  const date = new Date().toISOString().slice(0, 10);
  const archiveRef = db
    .collection("users")
    .doc(String(userId))
    .collection("conversations")
    .doc(`archived_${date}`);

  await archiveRef.set({ ...doc.data(), archivedAt: new Date() });
  await ref.set({ history: [], updatedAt: new Date() });
  return true;
}
