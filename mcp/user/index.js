import { getUserAbout, updateUserAbout, markUserAboutComplete } from "./db.js";

export const tools = [
  {
    name: "updateUserAbout",
    description:
      "Update the user's about profile. Call this incrementally as you learn new things about the user — you don't need to wait until you have everything. Write it as a natural prose description in third person (e.g. 'The user is Fredrik, a software engineer who...').",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Full updated prose description of the user",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "markUserAboutComplete",
    description:
      "Mark the user profile as complete once you have gathered: name, occupation, free time/hobbies, core values, what inspires them, some likes and dislikes, and what they want more of in life.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export async function run(name, input, userId) {
  switch (name) {
    case "updateUserAbout":
      await updateUserAbout(userId, input.prompt);
      return "User profile updated.";
    case "markUserAboutComplete":
      await markUserAboutComplete(userId);
      return "User profile marked as complete.";
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export { getUserAbout };
