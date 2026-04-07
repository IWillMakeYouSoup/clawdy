import {
  listGoals,
  createGoal,
  addAction,
  completeAction,
  updateGoalState,
  completeGoal,
  archiveGoal,
} from "./db.js";

export const tools = [
  {
    name: "listGoals",
    description: "List all active (non-archived) goals for the user.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "createGoal",
    description:
      "Save a new trackable goal for the user. Call this when the user confirms they want to save a goal.",
    input_schema: {
      type: "object",
      properties: {
        shortDescription: { type: "string", description: "A concise description of the goal" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags e.g. ['work', 'wellbeing']",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Priority level",
        },
        targetDate: {
          type: "string",
          description: "Optional target date in YYYY-MM-DD format",
        },
        completionDefinition: {
          type: "string",
          description: "Description of when this goal should be considered done",
        },
      },
      required: ["shortDescription", "priority"],
    },
  },
  {
    name: "addAction",
    description: "Add a concrete action step to an existing goal.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "The goal ID" },
        shortDescription: { type: "string", description: "Short description of the action" },
      },
      required: ["goalId", "shortDescription"],
    },
  },
  {
    name: "completeAction",
    description: "Mark an action on a goal as completed.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "The goal ID" },
        actionId: { type: "string", description: "The action ID" },
      },
      required: ["goalId", "actionId"],
    },
  },
  {
    name: "updateGoalState",
    description: "Update the current state narrative of a goal.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "The goal ID" },
        state: { type: "string", description: "Current state description" },
      },
      required: ["goalId", "state"],
    },
  },
  {
    name: "completeGoal",
    description: "Mark a goal as completed and archive it.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "The goal ID" },
      },
      required: ["goalId"],
    },
  },
  {
    name: "archiveGoal",
    description: "Archive a goal that has been abandoned without being completed.",
    input_schema: {
      type: "object",
      properties: {
        goalId: { type: "string", description: "The goal ID" },
      },
      required: ["goalId"],
    },
  },
];

export async function run(name, input, userId) {
  switch (name) {
    case "listGoals":
      return JSON.stringify(await listGoals(userId), null, 2);
    case "createGoal": {
      const goalId = await createGoal(userId, input);
      return `Goal created with ID: ${goalId}`;
    }
    case "addAction": {
      const actionId = await addAction(userId, input.goalId, input.shortDescription);
      return `Action added with ID: ${actionId}`;
    }
    case "completeAction":
      await completeAction(userId, input.goalId, input.actionId);
      return "Action marked as completed.";
    case "updateGoalState":
      await updateGoalState(userId, input.goalId, input.state);
      return "Goal state updated.";
    case "completeGoal":
      await completeGoal(userId, input.goalId);
      return "Goal marked as completed and archived.";
    case "archiveGoal":
      await archiveGoal(userId, input.goalId);
      return "Goal archived.";
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
