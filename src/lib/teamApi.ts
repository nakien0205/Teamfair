import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { MemberStat, ProjectInvite } from "@/context/TeamContext";

export type TeamApiAction =
  | "create_invite"
  | "list_invites"
  | "revoke_invite"
  | "join_with_invite"
  | "process_join_request"
  | "submit_student_report"
  | "save_lecturer_evaluation"
  | "approve_task"
  | "calculate_contribution_snapshot";

export type TeamApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export class TeamApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TeamApiError";
    this.code = code;
  }
}

export type JoinInviteResult = {
  group_id: string;
  group_name: string;
  approval_mode: "auto" | "requires_approval";
  status: "success" | "pending_approval";
  request_id?: string;
};

export type ContributionSnapshotMember = Pick<MemberStat, "id" | "name" | "role" | "completedTasks" | "contributionPercent"> & {
  contributionScore: number;
};

export function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase();
}

export function calculateContributionScore(input: Pick<MemberStat, "completedTasks" | "contributionPercent">): number {
  const taskScore = Math.min(input.completedTasks * 20, 40);
  const contributionScore = Math.min(input.contributionPercent * 0.6, 60);
  return Math.round(taskScore + contributionScore);
}

export async function invokeTeamApi<T>(action: TeamApiAction, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<TeamApiResponse<T>>("team-api", {
    body: { action, payload },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const response = (await error.context.json()) as TeamApiResponse<T>;
        if (response && !response.ok) {
          throw new TeamApiError(response.error.code, response.error.message);
        }
      } catch (parseError) {
        if (parseError instanceof TeamApiError) throw parseError;
      }
    }

    if (error instanceof FunctionsFetchError) {
      throw new TeamApiError("invoke_failed", "Không thể kết nối đến API dự án. Vui lòng thử lại sau.");
    }

    if (error instanceof FunctionsRelayError) {
      throw new TeamApiError("invoke_failed", "API dự án chưa sẵn sàng. Vui lòng thử lại sau.");
    }

    throw new TeamApiError("invoke_failed", error.message);
  }

  if (!data) {
    throw new TeamApiError("empty_response", "Không nhận được phản hồi từ API.");
  }

  if (!data.ok) {
    throw new TeamApiError(data.error.code, data.error.message);
  }

  return data.data;
}

export async function createInviteViaApi(payload: {
  groupId: string;
  expiresAt: string | null;
  maxUses: number | null;
  approvalMode: "auto" | "requires_approval";
}): Promise<ProjectInvite> {
  return invokeTeamApi<ProjectInvite>("create_invite", payload);
}

export async function listInvitesViaApi(groupId: string): Promise<ProjectInvite[]> {
  return invokeTeamApi<ProjectInvite[]>("list_invites", { groupId });
}

export async function revokeInviteViaApi(inviteId: string): Promise<void> {
  await invokeTeamApi<{ invite_id: string }>("revoke_invite", { inviteId });
}

export async function joinWithInviteViaApi(inviteCode: string): Promise<JoinInviteResult> {
  return invokeTeamApi<JoinInviteResult>("join_with_invite", {
    inviteCode: normalizeInviteCode(inviteCode),
  });
}
