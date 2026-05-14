"""CLI: run from repo `python` directory — `python -m student_workspace_agent ...`"""


import argparse
import sys
from pathlib import Path

from .agent import run_agent
from .store import StudentWorkspaceStore


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    p = argparse.ArgumentParser(description="Teamfair student workspace agent (OpenRouter + tools).")
    p.add_argument("--message", "-m", required=True, help="User instruction for the agent.")
    p.add_argument("--snapshot", type=Path, help="Load workspace JSON snapshot before running.")
    p.add_argument("--save-snapshot", type=Path, help="Write workspace JSON after the run.")
    p.add_argument("--heavy", action="store_true", help="Final answer uses deepseek-v4-pro synthesis pass.")
    p.add_argument("--max-rounds", type=int, default=12, help="Max tool-call rounds (default 12).")
    args = p.parse_args()

    if args.snapshot:
        store = StudentWorkspaceStore.load_json(args.snapshot)
    else:
        store = StudentWorkspaceStore()

    # run_agent max_tool_rounds - I need to pass it to run_agent
    text = run_agent(
        args.message,
        store=store,
        use_heavy=args.heavy,
        max_tool_rounds=args.max_rounds,
    )
    if args.save_snapshot:
        store.save_json(args.save_snapshot)
    sys.stdout.write(text + "\n")


if __name__ == "__main__":
    main()
