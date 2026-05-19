import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { isDemoSession } from "@/lib/demoSession";

export interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_trace: unknown[] | null;
  reasoning: string | null;
  used_heavy: boolean;
  created_at: string;
}

function canPersistChat(): boolean {
  return isSupabaseConfigured && !isDemoSession();
}

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function loadChatHistory(groupId: string): Promise<ChatMessageRow[]> {
  if (!canPersistChat()) return [];
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_trace, reasoning, used_heavy, created_at")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Failed to load chat history:", error.message);
    return [];
  }
  return (data ?? []) as ChatMessageRow[];
}

export async function insertChatMessage(
  groupId: string,
  msg: {
    role: "user" | "assistant";
    content: string;
    tool_trace?: unknown[];
    reasoning?: string | null;
    used_heavy?: boolean;
  },
): Promise<void> {
  if (!canPersistChat()) return;
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase.from("chat_messages").insert({
    user_id: userId,
    group_id: groupId,
    role: msg.role,
    content: msg.content,
    tool_trace: msg.tool_trace ?? null,
    reasoning: msg.reasoning ?? null,
    used_heavy: msg.used_heavy ?? false,
  });

  if (error) {
    console.warn("Failed to insert chat message:", error.message);
  }
}

export async function clearChatHistory(groupId: string): Promise<void> {
  if (!canPersistChat()) return;
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("user_id", userId)
    .eq("group_id", groupId);

  if (error) {
    console.warn("Failed to clear chat history:", error.message);
  }
}
