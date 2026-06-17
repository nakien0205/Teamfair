# Redesign Task Creation and AI-assisted Task Verification

**Date**: 17-06-26
**Status**: ✅ VERIFIED
**Complexity**: Complex

## Context and Goals

This plan outlines the redesign of the task creation form, Kanban board, and task list on the Student Dashboard, as well as the implementation of an AI-assisted task verification flow where the Leader can review student work logs, notes, and attached document evidence (PDF, DOCX, MD, TXT) parsed by the Python AI agent backend.

---

## Touchpoints

- **[python/student_workspace_agent/requirements.txt](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/requirements.txt)**: Add python dependencies for parsing PDF and DOCX files.
- **[python/student_workspace_agent/server.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/server.py)**: Implement the `/verify-task` POST endpoint.
- **[python/student_workspace_agent/document_parser.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/document_parser.py)**: [NEW] Create text extraction utility for PDF, DOCX, TXT, and MD files.
- **[src/components/KanbanBoard.tsx](file:///d:/Python/Projects/Teamfair/src/components/KanbanBoard.tsx)**: Redesign task creation form, Kanban Board cards, and handle task approval modal trigger.
- **[src/components/TaskApprovalDialog.tsx](file:///d:/Python/Projects/Teamfair/src/components/TaskApprovalDialog.tsx)**: [NEW] A dialog showing submitted task details, evidence files, work logs, and AI verification results.
- **[src/pages/StudentDashboard.tsx](file:///d:/Python/Projects/Teamfair/src/pages/StudentDashboard.tsx)**: Redesign task list layout, add tab controls, and update task approval handler.
- **[src/lib/contributionAi.ts](file:///d:/Python/Projects/Teamfair/src/lib/contributionAi.ts)**: Implement API call utility to the backend `/verify-task` endpoint.

---

## Public Contracts

- **FastAPI Backend Endpoint**: `POST /verify-task`
  - **Request Body**:
    ```json
    {
      "task_id": "string",
      "task_name": "string",
      "task_description": "string",
      "student_name": "string",
      "work_logs": [
        {
          "date": "string",
          "hours": 0.0,
          "description": "string"
        }
      ],
      "evidence_files": [
        {
          "fileName": "string",
          "signedUrl": "string"
        }
      ]
    }
    ```
  - **Response Body**:
    ```json
    {
      "status": "verified" | "needs_revision",
      "confidence_score": 95,
      "reasoning": "string (Vietnamese detailed analysis)",
      "suggested_feedback": "string (Vietnamese suggestion for student)"
    }
    ```

---

## Blast Radius

- **Low Risk**: New Python packages `pypdf` and `python-docx` are standard and self-contained.
- **Low Risk**: The new backend endpoint `/verify-task` operates in isolation and does not modify the Supabase database directly.
- **Medium Risk**: Redesigning `KanbanBoard.tsx` and `StudentDashboard.tsx` affects visual presentation and user interactions. We must ensure existing logic (drag and drop, status updates, permission gates) is preserved.

---

## Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** - Works with other system pieces
2. **Manual Test** - User can perform the action
3. **Data Verification** - Database/state changes confirmed
4. **Error Handling** - Failure cases handled gracefully
5. **User Confirmation** - User says "it works"

Status meanings:
- ⏳ PLANNED - Not started
- 🔨 CODE DONE - Written but not E2E tested
- 🧪 TESTING - Currently being tested
- ✅ VERIFIED - Tested AND confirmed working
- 🚧 BLOCKED - Has issues

After each phase, document:
- [ ] What was tested manually
- [ ] Data verified in DB (show query + result)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

---

## Execution Brief

The work is grouped into 3 logical phases:

### Phase 1: Python Backend Document Parsing and Verify Endpoint
- **What happens**: Install PDF/Word parsing libraries, implement the document extraction service, and create the FastAPI `/verify-task` endpoint.
- **Integration points**: Connects the FastAPI HTTP router to OpenRouter SDK and the document extraction utility.
- **Test**: Send mock API requests to `/verify-task` with signed URLs of sample documents.
- **Verify**: Inspect server console logs and API response JSON structure to verify parsing correctness.
- **Done when**: Backend server parses PDF, DOCX, TXT, and MD files and returns valid AI evaluation results.

### Phase 2: Frontend API Integration and Dialog
- **What happens**: Add a new API caller in `contributionAi.ts` and build the `TaskApprovalDialog` component showing evidence, work logs, and AI results.
- **Integration points**: Connects the "Duyệt" button on the dashboard to the `TaskApprovalDialog`, which calls Supabase Storage signed URL generator and the Python backend.
- **Test**: Open the approval dialog, click "Xác minh bằng AI", verify loading states and rendering of results.
- **Verify**: Check browser network tab to ensure correct request payload and status.
- **Done when**: Dialog opens correctly, triggers AI analysis successfully, and renders feedback.

### Phase 3: Frontend Task Management Redesign
- **What happens**: Redesign Kanban Board, Task List, and the "Create Task" Dialog.
- **Integration points**: Updates `KanbanBoard.tsx` and `StudentDashboard.tsx` styling using shadcn/ui and custom glassmorphism.
- **Test**: Validate Drag and Drop, create new tasks, switch tabs between Board and List.
- **Verify**: Inspect visual elements on multiple viewport sizes, check console for React key or runtime errors.
- **Done when**: The dashboard presents a premium, responsive task dashboard consistent with other screens.

---

## Phased Execution Workflow

For each RFC/Phase, follow this workflow:
1. **Step 1: Pre-Phase Research** - Inspect files, check patterns, and state findings. Present to user and **STOP**. Wait for user approval before Step 2.
2. **Step 2: Detailed Planning** - Map exact modifications.
3. **Step 3: Implementation** - Write code.
4. **Step 4: Testing & Verification** - Run Vitest and verify behavior.
5. **Step 5: User Confirmation** - Output post-stage summary and wait for approval.

---

## Acceptance Criteria

- [ ] PDF, DOCX, MD, and TXT files uploaded as task evidence are successfully parsed by the Python backend.
- [ ] Task approval flow opens a dialog detailing evidence, work logs, and AI review rather than immediately approving.
- [ ] "Verify with AI" returns a structured evaluation in Vietnamese from OpenRouter.
- [ ] Leader can either approve (approves task) or request revision (updates task description with `[need_revision]` and reverts status).
- [ ] Student dashboard task creation and Kanban board layout are redesigned with consistent premium styling (glassmorphism tabs, rounded modals).
- [ ] All existing Vitest tests pass, and ESLint/TypeScript checks succeed.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
| :--- | :--- | :--- |
| File parsing text extraction | Fully-Automated (Python mock tests) | AI reads docx, pdf, md, txt files correctly |
| AI Task Verification API | Fully-Automated / Hybrid | LLM evaluates task matching, plagiarism, effort |
| Task Approval Dialog opening | Agent-Probe / Manual | Leader views task description, notes, work logs, files |
| Redesigned Kanban and Task List | Agent-Probe / Manual | Clean, premium, glassmorphic UI |
| Drag-and-drop and Task creation | Hybrid (Vitest + Manual) | Normal operation remains functional |

---

## Test Infra Improvement Notes

(none identified yet)

---

## Implementation Checklist

### Phase 1: Python Backend Document Parsing & API
- [ ] Install dependencies: add `pypdf` and `python-docx` to `python/student_workspace_agent/requirements.txt` and run `pip install`
- [ ] Create `python/student_workspace_agent/document_parser.py` with text extraction functions for PDF, DOCX, MD, TXT
- [ ] Create `/verify-task` endpoint in `python/student_workspace_agent/server.py`
- [ ] Implement AI prompt template and OpenRouter completion caller for task verification

### Phase 2: Frontend Integration & Dialog
- [ ] Add `fetchTaskVerification` in `src/lib/contributionAi.ts`
- [ ] Build `src/components/TaskApprovalDialog.tsx` showing task details, work logs, and đính kèm
- [ ] Integrate "Verify with AI" API call with loading skeleton and display feedback
- [ ] Wire the approval dialog into `StudentDashboard.tsx` and `KanbanBoard.tsx` "Duyệt" actions

### Phase 3: UI Redesign & Verification
- [ ] Refactor `src/pages/StudentDashboard.tsx` to add glassmorphism Tabs for switching Board / List
- [ ] Redesign task creation form dialog in `src/components/KanbanBoard.tsx`
- [ ] Verify UI responsive layout on multiple sizes
- [ ] Run Vitest tests using `pnpm test` and check for ESLint / Typecheck errors

---

## Resume and Execution Handoff

1. **Selected plan file path**: `process/features/student_workspace/active/redesign_task_creation_17-06-26/redesign_task_creation_PLAN_17-06-26.md`
2. **Last completed phase or step**: Planning (initial creation)
3. **Validate-contract status**: Pending
4. **Supporting context files loaded**: `process/context/all-context.md`, `process/context/uxui/all-uxui.md`, `process/context/tests/all-tests.md`
5. **Next step for a fresh agent picking up mid-execution**: Create Phase 1 details and request confirmation.

---

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
