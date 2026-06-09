import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LecturerGradingEvidenceView } from "@/components/rubrics/LecturerGradingEvidenceView";
import { createTaskEvidenceSignedUrl } from "@/lib/taskSubmissions";

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({ language: "vi" }),
}));

vi.mock("@/context/TeamContext", () => ({
  useTeam: () => ({
    reports: [],
    groups: [
      {
        id: "group-1",
        name: "Capstone Group",
        members: [
          {
            id: "student-1",
            name: "Ada Lovelace",
            role: "Member",
            contributionPercent: 50,
          },
        ],
        tasks: [
          {
            id: "task-1",
            name: "Research brief",
            assignedTo: "Ada Lovelace",
            assigneeId: "student-1",
            status: "Done",
            contributionPercent: 50,
            approved: false,
            deadline: "2026-06-15",
            evidence: [
              {
                fileName: "demo.pdf",
                uploadTime: new Date("2026-06-09T08:00:00.000Z"),
                storagePath: "group-1/task-1/student-1/demo.pdf",
                fileSize: 1200,
                mimeType: "application/pdf",
              },
            ],
          },
        ],
      },
    ],
  }),
}));

vi.mock("@/lib/taskSubmissions", () => ({
  createTaskEvidenceSignedUrl: vi.fn().mockResolvedValue("https://signed.example/demo.pdf"),
}));

describe("LecturerGradingEvidenceView", () => {
  it("resolves private task evidence storage paths to signed preview URLs", async () => {
    render(<LecturerGradingEvidenceView groupId="group-1" />);

    fireEvent.click(screen.getAllByText("demo.pdf")[0]);

    await waitFor(() => {
      expect(createTaskEvidenceSignedUrl).toHaveBeenCalledWith("group-1/task-1/student-1/demo.pdf", 600);
    });

    const preview = await screen.findByTitle("demo.pdf");
    expect(preview).toHaveAttribute("src", "https://signed.example/demo.pdf");
  });
});
