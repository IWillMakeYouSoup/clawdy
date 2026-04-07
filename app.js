import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { tools as goalTools, run as goalRun } from "./mcp/usergoals/index.js";
import { getTopGoals } from "./mcp/usergoals/db.js";
import { tools as userTools, run as userRun, getUserAbout } from "./mcp/user/index.js";
import { tools as soulTools, run as soulRun, getSoulManifest } from "./mcp/soul/index.js";
import { tools as heartbeatTools, run as heartbeatRun } from "./mcp/heartbeat/index.js";
import { tools as weatherTools, run as weatherRun } from "./mcp/weather/index.js";
import { getHistory, saveHistory, archiveAndReset, saveTelegramChatId, compactHistoryIfNeeded } from "./db.js";
import heartbeatRouter from "./heartbeat.js";

const app = express();
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const IS_LOCAL = process.env.NODE_ENV !== "production";
const DEBUG_TELEGRAM = process.env.DEBUG_TELEGRAM === "true";

const tools = [...goalTools, ...userTools, ...soulTools, ...heartbeatTools, ...weatherTools];

async function runTool(name, input, userId) {
  if (goalTools.some((t) => t.name === name)) return goalRun(name, input, userId);
  if (userTools.some((t) => t.name === name)) return userRun(name, input, userId);
  if (soulTools.some((t) => t.name === name)) return soulRun(name, input, userId);
  if (heartbeatTools.some((t) => t.name === name)) return heartbeatRun(name, input, userId);
  if (weatherTools.some((t) => t.name === name)) return weatherRun(name, input);
  throw new Error(`Unknown tool: ${name}`);
}

function buildSystemPrompt(topGoals, userAbout, soulManifest) {
  const lines = [
    "# Soul Manifest",
    soulManifest,
    "\n# Assistant Instructions",
    "You are a personal assistant and coach. Be concise, warm, and proactive.",
    "If the user mentions something that sounds like an important goal not yet tracked, suggest saving it.",
  ];

  if (userAbout.prompt) {
    lines.push(`\n## About the user\n${userAbout.prompt}`);
  }

  if (!userAbout.descriptionCompleted) {
    lines.push(
      "\n## Getting to know the user",
      "You don't yet have a complete picture of who the user is. Unless the user raises something urgent, gently work toward learning: their name, occupation, hobbies and free time, core values, what inspires them, some likes and dislikes, and what they want more of in life.",
      "Do this naturally and conversationally — not as an interview. Weave questions into the flow of conversation. As you learn things, update the profile using updateUserAbout. Once all the above is covered, call markUserAboutComplete."
    );
  }

  if (topGoals.length) {
    const goalLines = topGoals
      .map((g, i) => {
        const tags = g.tags?.length ? ` [${g.tags.join(", ")}]` : "";
        const state = g.state ? ` — ${g.state}` : "";
        return `${i + 1}. [${g.priority}]${tags} ${g.shortDescription}${state}`;
      })
      .join("\n");
    lines.push(`\n## Top goals\n${goalLines}\nProactively connect the conversation to these goals where relevant.`);
  }

  return lines.join("\n");
}

async function askClaude(userText, userId) {
  const [rawHistory, topGoals, userAbout, soulManifest] = await Promise.all([
    getHistory(userId),
    getTopGoals(userId),
    getUserAbout(userId),
    getSoulManifest(userId),
  ]);
  const history = await compactHistoryIfNeeded(userId, rawHistory, client);

  const messages = [...history, { role: "user", content: userText }];
  const system = buildSystemPrompt(topGoals, userAbout, soulManifest);

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const reply = response.content.find((b) => b.type === "text")?.text ?? "";
      await saveHistory(userId, [
        ...history,
        { role: "user", content: userText },
        { role: "assistant", content: reply },
      ]);
      return reply;
    }

    const toolResults = await Promise.all(
      response.content
        .filter((b) => b.type === "tool_use")
        .map(async (b) => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: String(await runTool(b.name, b.input, userId)),
        }))
    );

    messages.push({ role: "user", content: toolResults });
  }
}

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

app.use("/heartbeat", heartbeatRouter);

app.post("/webhook", async (req, res) => {
  const message = req.body?.message;
  if (!message?.chat?.id || !message?.text) {
    return res.status(400).json({ error: "message.chat.id and message.text are required" });
  }

  const chatId = message.chat.id;
  const userId = message.from?.id ?? chatId;
  const text = message.text.trim();

  saveTelegramChatId(userId, chatId).catch((err) =>
    console.error("saveTelegramChatId failed:", err.message)
  );

  try {
    if (text === "/new") {
      const archived = await archiveAndReset(userId);
      const reply = archived
        ? "New session started. Previous conversation has been archived."
        : "Nothing to archive — starting fresh.";
      if (IS_LOCAL) return res.json({ reply });
      await sendMessage(chatId, reply);
      return res.sendStatus(200);
    }

    const reply = await askClaude(text, userId);
    if (IS_LOCAL) return res.json({ reply });
    await sendMessage(chatId, reply);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    if (IS_LOCAL) return res.status(500).json({ error: err.message });
    const errorMsg = DEBUG_TELEGRAM
      ? `Error: ${err.message}`
      : "Sorry, something went wrong. Please try again.";
    await sendMessage(chatId, errorMsg);
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
