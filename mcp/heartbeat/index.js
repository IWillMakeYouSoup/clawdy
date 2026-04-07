import { listJobs, createJob, updateJob, deleteJob } from "./db.js";

export const tools = [
  {
    name: "listHeartbeats",
    description: "List all scheduled heartbeat jobs for the user.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "createHeartbeat",
    description:
      "Create a scheduled job that runs on a cron schedule. Use standard 5-field cron expressions (minute hour day month weekday). Unless the user specifies a timezone, always use 'Europe/Paris' (CET/CEST). Set respondToUser=false for background tasks the user doesn't need to be notified about — e.g. silent planning, preparation, or maintenance tasks. These run and complete without sending a Telegram message. Use this proactively when setting up tasks that are meant to prepare things for the user rather than inform them.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "A short readable label, e.g. 'Morning check-in'" },
        cronExpression: {
          type: "string",
          description: "5-field cron expression, e.g. '0 7 * * 1-5' for weekdays at 7am",
        },
        timezone: {
          type: "string",
          description: "IANA timezone, e.g. 'Europe/Stockholm'. Defaults to CET (Europe/Paris).",
        },
        prompt: {
          type: "string",
          description:
            "Instruction for what Claude should do when this job runs, e.g. 'Give the user a brief morning nudge about their top goals.' For silent jobs, describe the task to perform, e.g. 'Review the user's goals and add suggested next actions.'",
        },
        respondToUser: {
          type: "boolean",
          description: "If false, the job runs silently without sending a Telegram message. Defaults to true.",
        },
      },
      required: ["name", "cronExpression", "prompt"],
    },
  },
  {
    name: "updateHeartbeat",
    description: "Update a heartbeat job — change its schedule, prompt, or enable/disable it.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job ID to update" },
        name: { type: "string" },
        cronExpression: { type: "string" },
        timezone: { type: "string" },
        prompt: { type: "string" },
        enabled: { type: "boolean", description: "Pause (false) or resume (true) the job" },
        respondToUser: {
          type: "boolean",
          description: "If false, the job runs silently without sending a Telegram message. Useful for background planning or preparation tasks.",
        },
      },
      required: ["jobId"],
    },
  },
  {
    name: "deleteHeartbeat",
    description: "Permanently delete a heartbeat job.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job ID to delete" },
      },
      required: ["jobId"],
    },
  },
];

export async function run(name, input, userId) {
  switch (name) {
    case "listHeartbeats":
      return JSON.stringify(await listJobs(userId), null, 2);
    case "createHeartbeat": {
      const jobId = await createJob(userId, input);
      return `Heartbeat job created with ID: ${jobId}`;
    }
    case "updateHeartbeat": {
      const { jobId, ...fields } = input;
      await updateJob(userId, jobId, fields);
      return "Heartbeat job updated.";
    }
    case "deleteHeartbeat":
      await deleteJob(userId, input.jobId);
      return "Heartbeat job deleted.";
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
