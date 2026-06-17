### RESEARCH Mode: Used to inspect the codebase and understand how things work without making changes.
Example: Investigating how Supabase RLS policies are set up for rubric_grades in 
supabase/migrations/
 to see why a student cannot view their score.

### PLAN Mode: Used to write a step-by-step technical plan before coding.
Example: Writing a design plan to add a new "Join Request" notification type, listing every file we need to change and how we will test it.

### EXECUTE Mode: Used to write the actual code and run tests after you have approved the plan.
Example: Writing the React frontend components, Zustand store changes, and Supabase database queries once you approve the "Join Request" plan.

### FAST Mode: A compressed mode for straightforward features. It runs research, planning, and coding together but still pauses to show you the plan before writing code.
Example: Adding a new status color (e.g., "In Review") to the Kanban board cards.

### QUICK FIX Mode: For very minor, low-risk changes that do not need a plan.
Example: Fixing a spelling error in a label or resolving a simple ESLint warning.