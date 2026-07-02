# Video Guide implementation Plan

Add a "Video Guide" section to the bottom of the Landing page and a navigation link in the header. Show a video player to guide users on how to use TeamFair.

## Touchpoints
- `src/pages/Landing.tsx` (edit)
- `public/guide.mp4` (copy from root)

## Public Contracts
- None. Component is internal to Landing page.

## Blast Radius
- 1 file modified (`src/pages/Landing.tsx`).
- 1 static asset added (`public/guide.mp4`).
- Risk Class: Low (UI/UX only, no database/auth impact).

## Verification Evidence
| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Navigation Scroll | Manual/Visual | Link clicks smooth-scroll to `#video-guide` |
| Video Playback | Manual/Visual | Video controls work, video plays properly |
| Type check & Lint | Fully-Automated | No TypeScript/ESlint compilation or style issues |

## Test Infra Improvement Notes
(none identified yet)

## Resume and Execution Handoff
1. selected plan file path: `process/general-plans/active/video-guide_02-07-26/video-guide_PLAN_02-07-26.md`
2. last completed phase or step: Plan Mode (approval pending)
3. validate-contract status: skipped with reason (UI change only)
4. supporting context files loaded: `process/context/all-context.md`, `process/context/uxui/all-uxui.md`
5. next step for a fresh agent picking up mid-execution: Once approved, copy `guide.mp4` to `public/` and modify `src/pages/Landing.tsx` to add link and section.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
