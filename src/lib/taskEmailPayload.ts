import type { Task } from "@/context/TeamContext";

export interface RevisionTaskEmailInput {
  assigneeId: string;
  task: Pick<Task, "name" | "description" | "deadline" | "priority">;
  groupName?: string;
  feedback: string;
}

export function buildRevisionTaskEmailPayload(input: RevisionTaskEmailInput) {
  return {
    assigneeId: input.assigneeId,
    taskName: input.task.name,
    taskDescription: input.task.description || "",
    deadline: input.task.deadline || "",
    priority: input.task.priority,
    groupName: input.groupName || "",
    type: "revision" as const,
    feedback: input.feedback,
  };
}
