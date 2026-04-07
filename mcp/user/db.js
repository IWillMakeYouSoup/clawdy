import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({ databaseId: "chloesmemory" });

function aboutRef(userId) {
  return db.collection("users").doc(String(userId)).collection("about").doc("profile");
}

export async function getUserAbout(userId) {
  const doc = await aboutRef(userId).get();
  if (!doc.exists) return { prompt: "", descriptionCompleted: false };
  return doc.data();
}

export async function updateUserAbout(userId, prompt) {
  await aboutRef(userId).set(
    { prompt, updatedAt: new Date() },
    { merge: true }
  );
}

export async function markUserAboutComplete(userId) {
  await aboutRef(userId).set(
    { descriptionCompleted: true, updatedAt: new Date() },
    { merge: true }
  );
}
