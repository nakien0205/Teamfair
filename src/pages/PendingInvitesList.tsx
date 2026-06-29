import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext"; 
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Check, X, MailOpen } from "lucide-react";

interface InviteItem {
  id: string;
  group_id: string;
  invite_code: string;
  note: string | null;
  created_at: string;
  projectName?: string; 
}

export function PendingInvitesList() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loadingFetch, setLoadingFetch] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 1. Hàm lấy danh sách lời mời và map theo cột 'project_name'
  const fetchPendingInvites = useCallback(async () => {
    if (!user?.email) return;

    try {
      setLoadingFetch(true);

      const { data: inviteData, error: inviteError } = await supabase
        .from("group_email_invites")
        .select("id, group_id, invite_code, note, created_at")
        .eq("invited_email", user.email)
        .eq("status", "pending");

      if (inviteError) throw inviteError;

      if (!inviteData || inviteData.length === 0) {
        setInvites([]);
        return;
      }

      // Vòng lặp quét bảng groups lấy cột 'project_name'
      const formattedInvites = await Promise.all(
        inviteData.map(async (invite) => {
          const { data: groupData } = await supabase
            .from("groups")
            .select("project_name") // ✨ Sửa từ 'name' thành 'project_name' theo đúng DB của bạn
            .eq("id", invite.group_id)
            .maybeSingle();
            
          return {
            ...invite,
            projectName: groupData?.project_name || "Dự án không tên"
          };
        })
      );

      setInvites(formattedInvites);
    } catch (err) {
      console.error("Lỗi lấy danh sách lời mời:", err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFetch(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchPendingInvites();
  }, [fetchPendingInvites]);

  // 2. Xử lý khi bấm nút "Chấp nhận" - Thêm bản ghi vào bảng group_members
  const handleAccept = async (invite: InviteItem) => {
    if (!user) return;
    setProcessingId(invite.id);

    try {
      // Bước A: Kiểm tra xem user đã nằm trong bảng group_members của nhóm này chưa
      const { data: existingMember } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", invite.group_id)
        .eq("student_id", user.id)
        .maybeSingle();

      if (existingMember) {
        toast.error("Bạn đã là thành viên của dự án này!");
        await supabase.from("group_email_invites").update({ status: "accepted" }).eq("id", invite.id);
        fetchPendingInvites();
        return;
      }

      // Bước B: Chèn một bản ghi thành viên mới vào đúng bảng 'group_members'
      const { error: insertMemberError } = await supabase
        .from("group_members")
        .insert([
          {
            group_id: invite.group_id,
            student_id: user.id, // ✨ ĐÃ ĐỔI: Chỗ này sửa thành student_id theo đúng DB của bạn
            role: "Member"
          }
        ]);

      if (insertMemberError) throw insertMemberError;

      // Bước C: Cập nhật trạng thái lời mời sang 'accepted'
      const { error: updateInviteError } = await supabase
        .from("group_email_invites")
        .update({ 
          status: "accepted",
          invited_user_id: user.id 
        })
        .eq("id", invite.id);

      if (updateInviteError) throw updateInviteError;

      toast.success("Gia nhập nhóm thành công!");
      fetchPendingInvites();

      // Tải lại trang sau 1 giây để cập nhật lại giao diện tổng quan
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      const errorObj = err as { message?: string };
      console.error("Lỗi xử lý gia nhập nhóm:", err);
      toast.error(errorObj.message || "Không thể chấp nhận lời mời, vui lòng thử lại.");
    } finally {
      setProcessingId(null);
    }
  };

  // 3. Xử lý khi bấm nút "Từ chối"
  // Xử lý Từ chối lời mời bằng cách XÓA bản ghi khỏi DB để né check constraint
  const handleDecline = async (inviteId: string) => {
    if (!user?.id) return;
    setProcessingId(inviteId); // Khóa nút bấm để tránh người dùng click spam
    
    try {
      // Thay vì .update() sang 'declined' bị dính lỗi constraint
      // Ta thực hiện xóa thẳng bản ghi này để giải phóng lời mời
      const { error } = await supabase
        .from("group_email_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
      
      toast.success("Đã từ chối lời mời.");
      fetchPendingInvites(); // Tải lại danh sách lời mời ngay trên UI
    } catch (err) {
      const errorObj = err as { message?: string };
      console.error("Lỗi chi tiết khi từ chối lời mời:", err);
      toast.error(`Lỗi hệ thống: ${errorObj.message || "Không thể xử lý từ chối"}`);
    } finally {
      setProcessingId(null); // Mở khóa nút bấm
    }
  };

  if (loadingFetch) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-muted-foreground animate-pulse">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang kiểm tra lời mời...
      </div>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="p-6 rounded-[24px] border border-amber-200 bg-amber-50/40 max-w-2xl mx-auto my-6 shadow-sm space-y-4">
      <div className="flex items-center space-x-2 text-amber-800">
        <MailOpen className="h-5 w-5" />
        <h3 className="text-md font-semibold">Bạn có lời mời vào dự án mới ({invites.length})</h3>
      </div>

      <div className="divide-y divide-amber-100">
        {invites.map((invite) => (
          <div key={invite.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 first:pt-0 last:pb-0">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">
                Dự án: <span className="text-indigo-600 font-bold">{invite.projectName}</span>
              </p>
              {invite.note && (
                <p className="text-xs text-gray-500 italic bg-white px-2 py-1 rounded border border-gray-100 max-w-md">
                  Ghi chú: {invite.note}
                </p>
              )}
              <p className="text-[10px] text-gray-400">
                Mã lời mời: <code className="bg-gray-100 px-1 rounded">{invite.invite_code}</code>
              </p>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(invite.id)}
                disabled={processingId !== null}
                className="rounded-xl border-gray-300 hover:bg-red-50 text-gray-700 hover:text-red-600 h-8 text-xs"
              >
                <X className="mr-1 h-3 w-3" /> Từ chối
              </Button>
              <Button
                size="sm"
                onClick={() => handleAccept(invite)}
                disabled={processingId !== null}
                className="rounded-xl bg-green-600 hover:bg-green-700 text-white h-8 text-xs font-medium"
              >
                {processingId === invite.id ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Đang xử lý...</>
                ) : (
                  <><Check className="mr-1 h-3 w-3" /> Chấp nhận</>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}