import { describe, expect, it } from "vitest";
import { isTaskVisibleToViewer } from "./taskVisibility";

describe("task visibility", () => {
  it("VIS-01 exact assignee-ID match", () => {
    expect(
      isTaskVisibleToViewer(
        { assigneeId: "user-1", assignedTo: "Ada Lovelace" },
        { id: "user-1", name: "Ada Lovelace" },
      ),
    ).toBe(true);
  });

  it("VIS-02 assignee-ID mismatch", () => {
    expect(
      isTaskVisibleToViewer(
        { assigneeId: "user-2", assignedTo: "Grace Hopper" },
        { id: "user-1", name: "Ada Lovelace" },
      ),
    ).toBe(false);
  });

  it("VIS-03 ID precedence over name fallback", () => {
    expect(
      isTaskVisibleToViewer(
        { assigneeId: "user-2", assignedTo: " Ada Lovelace " },
        { id: "user-1", name: "ada lovelace" },
      ),
    ).toBe(false);

    expect(
      isTaskVisibleToViewer(
        { assigneeId: "", assignedTo: "Ada Lovelace" },
        { id: "user-1", name: "Ada Lovelace" },
      ),
    ).toBe(false);
    expect(isTaskVisibleToViewer({ assigneeId: "   " }, { id: "   " })).toBe(false);
    expect(isTaskVisibleToViewer({ assigneeId: "USER-1" }, { id: "user-1" })).toBe(false);
    expect(isTaskVisibleToViewer({ assigneeId: "user-1" }, { id: null })).toBe(false);
  });

  it("VIS-04 normalized legacy-name match", () => {
    expect(
      isTaskVisibleToViewer(
        { assigneeId: undefined, assignedTo: "  Ada Lovelace  " },
        { id: "user-1", name: "ada lovelace" },
      ),
    ).toBe(true);

    expect(
      isTaskVisibleToViewer(
        { assigneeId: null, assignedTo: "GRACE HOPPER" },
        { id: "user-2", name: " grace hopper " },
      ),
    ).toBe(true);
  });

  it("VIS-05 blank and unequal legacy names", () => {
    expect(
      isTaskVisibleToViewer(
        { assignedTo: "Ada Lovelace" },
        { id: "user-1", name: "Grace Hopper" },
      ),
    ).toBe(false);
    expect(isTaskVisibleToViewer({ assignedTo: "" }, { name: "" })).toBe(false);
    expect(isTaskVisibleToViewer({ assignedTo: "   " }, { name: "Ada Lovelace" })).toBe(false);
    expect(isTaskVisibleToViewer({ assignedTo: "Ada Lovelace" }, { name: undefined })).toBe(false);
  });
});
