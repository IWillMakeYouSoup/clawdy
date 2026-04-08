import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { listDueJobs, markJobRan } from "./mcp/heartbeat/db.js";
import { getSoulManifest } from "./mcp/soul/index.js";
import { getUserAbout } from "./mcp/user/index.js";
import { getTelegramChatId, getHistory, saveHistory } from "./db.js";

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendTelegram(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function runJob(job) {
  const { userId, jobId, name, cronExpression, timezone, prompt, respondToUser = true } = job;

  const telegramChatId = respondToUser ? await getTelegramChatId(userId) : null;
  if (respondToUser && !telegramChatId) {
    console.warn(`Heartbeat: no telegramChatId for user ${userId}, skipping`);
    return;
  }

  const [soulManifest, userAbout] = await Promise.all([
    getSoulManifest(userId),
    getUserAbout(userId),
  ]);

  const system = [
    "# Soul Manifest",
    soulManifest,
    userAbout.prompt ? `\n# About the user\n${userAbout.prompt}` : "",
    "\nYou are sending a proactive scheduled message. Be brief and natural — not robotic.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system,
    messages: [{ role: "user", content: `[Scheduled task] ${prompt}` }],
  });

  const reply = response.content.find((b) => b.type === "text")?.text ?? "";
  if (reply) {
    await sendTelegram(telegramChatId, reply);
    const now = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "short",
    });
    const history = await getHistory(userId);
    await saveHistory(userId, [
      ...history,
      { role: "user", content: `[${now}] [Scheduled: ${name}] ${prompt}` },
      { role: "assistant", content: reply },
    ]);
  }

  await markJobRan(userId, jobId, cronExpression, timezone);
}

router.get("/", async (_req, res) => {
  res.json({ status: "ok", ran: 0 }); // respond fast, process async
  const jobs = await listDueJobs();
  let ran = 0;
  await Promise.allSettled(
    jobs.map(async (job) => {
      try {
        await runJob(job);
        ran++;
      } catch (err) {
        console.error(`Heartbeat job ${job.jobId} failed:`, err.message);
        try {
          const chatId = await getTelegramChatId(job.userId);
          if (chatId) {
            await sendTelegram(
              chatId,
              `Hey, something went wrong with your scheduled task "${job.name}" — here's what happened:\n\n${err.message}`
            );
          }
        } catch (notifyErr) {
          console.error(`Failed to notify user ${job.userId} of job error:`, notifyErr.message);
        }
      }
    })
  );
  console.log(`Heartbeat: ran ${ran}/${jobs.length} jobs`);
});

export default router;
