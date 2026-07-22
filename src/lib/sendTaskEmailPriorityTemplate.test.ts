import { describe, expect, it } from "vitest";
import { renderTaskPriorityRow } from "../../supabase/functions/send-task-email/priorityTemplate";

describe("task email priority row", () => {
  it.each([undefined, null, "", "   "])("omits absent priority %#", (priority) => {
    const html = renderTaskPriorityRow(priority);

    expect(html).toBe("");
    expect(html).not.toContain("Medium");
    expect(html).not.toContain("Mức độ ưu tiên:");
  });

  it.each(["Low", "Medium", "High"])("preserves %s", (priority) => {
    const html = renderTaskPriorityRow(priority);

    expect(html).toContain(`<div class="task-value">${priority}</div>`);
  });
});
