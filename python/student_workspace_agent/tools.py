"""OpenAI Chat Completions `tools` definitions (JSON Schema)."""

TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "list_groups",
            "description": "List thesis groups (id, name) and the current group index.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_current_group",
            "description": "Switch the active group by index (0-based).",
            "parameters": {
                "type": "object",
                "properties": {"index": {"type": "integer", "minimum": 0}},
                "required": ["index"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "List tasks for the current group. Optional filter by Kanban status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["Todo", "In Progress", "Done"],
                        "description": "If set, only tasks in this column.",
                    }
                },
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task (starts as Todo, not approved). Logs activity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "assignedTo": {"type": "string"},
                    "contributionPercent": {"type": "integer", "minimum": 0, "maximum": 100},
                    "deadline": {"type": "string", "description": "YYYY-MM-DD"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["Low", "Medium", "High"]},
                },
                "required": ["name", "assignedTo", "contributionPercent", "deadline"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_status",
            "description": "Move a task on the Kanban board and append an activity log line.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string"},
                    "status": {"type": "string", "enum": ["Todo", "In Progress", "Done"]},
                    "actor": {"type": "string", "description": "Student name performing the change."},
                },
                "required": ["task_id", "status", "actor"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_fields",
            "description": "Partial update of task fields (name, deadline, assignee, priority, description, contributionPercent, approved). Recalculates member contributions if approved changes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string"},
                    "name": {"type": "string"},
                    "assignedTo": {"type": "string"},
                    "deadline": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["Low", "Medium", "High"]},
                    "contributionPercent": {"type": "integer", "minimum": 0, "maximum": 100},
                    "approved": {"type": "boolean"},
                },
                "required": ["task_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "append_task_evidence_meta",
            "description": "Attach evidence metadata (file name + timestamp) to a task; no binary upload.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string"},
                    "fileName": {"type": "string"},
                },
                "required": ["task_id", "fileName"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "approve_task",
            "description": "Lecturer-style approval flag on a task; triggers contribution recalculation.",
            "parameters": {
                "type": "object",
                "properties": {"task_id": {"type": "string"}},
                "required": ["task_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Remove a task from the current group; recalculates contributions.",
            "parameters": {
                "type": "object",
                "properties": {"task_id": {"type": "string"}},
                "required": ["task_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_calendar_events",
            "description": "List project calendar events (meetings, milestones, manual entries).",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_date": {"type": "string", "description": "Optional YYYY-MM-DD inclusive lower bound."},
                    "to_date": {"type": "string", "description": "Optional YYYY-MM-DD inclusive upper bound."},
                },
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Add a calendar / timeline event.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "type": {"type": "string", "enum": ["Meeting", "Task Deadline", "Milestone"]},
                    "date": {"type": "string"},
                    "time": {"type": "string"},
                    "description": {"type": "string"},
                    "createdBy": {"type": "string", "enum": ["Leader", "Member"]},
                },
                "required": ["title", "type", "date", "time", "description", "createdBy"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_calendar_event",
            "description": "Patch fields on a calendar event by id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "string"},
                    "title": {"type": "string"},
                    "type": {"type": "string", "enum": ["Meeting", "Task Deadline", "Milestone"]},
                    "date": {"type": "string"},
                    "time": {"type": "string"},
                    "description": {"type": "string"},
                    "createdBy": {"type": "string", "enum": ["Leader", "Member"]},
                },
                "required": ["event_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_calendar_event",
            "description": "Remove a calendar event by id.",
            "parameters": {
                "type": "object",
                "properties": {"event_id": {"type": "string"}},
                "required": ["event_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_contribution_snapshot",
            "description": "Member stats, approved-task rollups, and lecturer scores for the current group.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_activity_log",
            "description": "Recent activity log lines for the current group.",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20}},
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "draft_peer_report",
            "description": "Validate and return a peer report payload (does not persist).",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_student": {"type": "string"},
                    "to_student": {"type": "string"},
                    "reason": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["from_student", "to_student", "reason", "notes"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "submit_student_report",
            "description": "Persist a student-to-student report to the local store (mirrors TeamContext addReport).",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_student": {"type": "string"},
                    "to_student": {"type": "string"},
                    "reason": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["from_student", "to_student", "reason", "notes"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_materials",
            "description": "List shared materials (metadata only).",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_material",
            "description": "Register a material file metadata row (no binary upload).",
            "parameters": {
                "type": "object",
                "properties": {
                    "fileName": {"type": "string"},
                    "size": {"type": "integer", "minimum": 0},
                    "uploadedBy": {"type": "string"},
                },
                "required": ["fileName", "size", "uploadedBy"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_material",
            "description": "Remove a material row by id.",
            "parameters": {
                "type": "object",
                "properties": {"material_id": {"type": "string"}},
                "required": ["material_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_verified_badges",
            "description": "List verified badges awarded to students.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_badge_status",
            "description": "Summarize badges and recent lecturer reviews (read-only synthesis inputs).",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
]
