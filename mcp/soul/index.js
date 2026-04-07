import { getSoulManifest, updateSoulManifest } from "./db.js";

export const tools = [
  {
    name: "updateSoulManifest",
    description:
      "Update your own soul manifest — your core truths, boundaries, vibe, and continuity prompt. Only do this intentionally and always tell the user when you do.",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The full updated soul manifest text",
        },
      },
      required: ["text"],
    },
  },
];

export async function run(name, input, userId) {
  if (name === "updateSoulManifest") {
    await updateSoulManifest(userId, input.text);
    return "Soul manifest updated.";
  }
  throw new Error(`Unknown tool: ${name}`);
}

export { getSoulManifest };
