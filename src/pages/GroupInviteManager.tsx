import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Mail, Clock3, Copy, UserPlus, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { useTeam } from "@/context/TeamContext";

export type GroupEmailInvite = {
    id: string;
    group_id: string;
    invited_email: string;
    invited_user_id: string | null;
    invite_code: string;
    status: "pending" | "accepted" | "declined"; // Khớp chuẩn tập giá trị DB
    note: string | null;
    created_at: string;
};

// Hàm phụ tạo mã mời ngẫu nhiên phòng trường hợp chưa có mã mời tổng
function generateRandomInviteCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "IV-";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export function GroupInviteManager({ selectedGroup, user }: { selectedGroup: any; user: any; language?: any }) {
    const rawTeamContext = useTeam();
    
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>("Dự án hiện tại");
    const [inviteRows, setInviteRows] = useState<GroupEmailInvite[]>([]);
    const [inviteLoading, setInviteLoading] = useState(false);

    // State Form
    const [emailInput, setEmailInput] = useState("");
    const [noteInput, setNoteInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    // Hàm tải danh sách lời mời đã gửi
    const fetchInvites = async (id: string) => {
        setInviteLoading(true);
        try {
            const { data, error } = await supabase
                .from("group_email_invites")
                .select("*")
                .eq("group_id", id)
                .order("created_at", { ascending: false });
            if (!error && data) setInviteRows(data);
        } catch (err) {
            console.error(err);
        } finally {
            setInviteLoading(false);
        }
    };

    // Định danh Dự án thông minh từ Context hoặc Props
    useEffect(() => {
        if (rawTeamContext && Array.isArray(rawTeamContext.groups)) {
            const currentIndex = typeof rawTeamContext.currentGroupIndex === 'number' 
                ? rawTeamContext.currentGroupIndex 
                : 0;
            const currentGroup = rawTeamContext.groups[currentIndex];

            if (currentGroup && currentGroup.id) {
                setProjectId(currentGroup.id);
                setProjectName(currentGroup.project_name || currentGroup.name || "Dự án hiện tại");
                fetchInvites(currentGroup.id);
                return;
            }
        }

        if (selectedGroup?.id) {
            setProjectId(selectedGroup.id);
            setProjectName(selectedGroup.project_name || selectedGroup.name || "Dự án hiện tại");
            fetchInvites(selectedGroup.id);
        }
    }, [rawTeamContext, selectedGroup]);

    // Hành động gửi mail mời (Tự sinh mã mời nếu trống)
    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInput.trim()) {
            toast.error("Vui lòng nhập địa chỉ email");
            return;
        }
        if (!projectId) {
            toast.error("Không xác định được ID dự án hiện tại.");
            return;
        }

        setIsSubmitting(true);
        try {
            let validInviteCode = "";
            
            // Tìm thử xem hệ thống có mã tổng khả dụng chưa
            if (rawTeamContext?.activeInvites && rawTeamContext.activeInvites.length > 0) {
                const groupInvite = rawTeamContext.activeInvites.find((inv: any) => inv.group_id === projectId);
                if (groupInvite) {
                    validInviteCode = groupInvite.invite_code || groupInvite.id; 
                }
            }

            // ✨ Nếu chưa có mã tổng: Tự sinh ra một mã riêng biệt để tránh nghẽn luồng
            if (!validInviteCode) {
                validInviteCode = generateRandomInviteCode();
            }

            const { error } = await supabase.from("group_email_invites").insert([{
                group_id: projectId,
                invited_email: emailInput.trim().toLowerCase(), // Đưa về chữ thường để đồng bộ hóa
                invite_code: validInviteCode,
                created_by: user?.id,
                status: "pending",
                note: noteInput.trim() || null,
                created_at: new Date().toISOString()
            }]);

            if (error) throw error;

            toast.success(`Đã gửi lời mời tới ${emailInput}`);
            setEmailInput("");
            setNoteInput("");
            fetchInvites(projectId); // Cập nhật lại UI danh sách
        } catch (error: any) {
            console.error("Chi tiết lỗi gửi mời:", error);
            toast.error(error.message || "Lỗi hệ thống không thể chèn lời mời");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ✨ Hàm xử lý THU HỒI / XÓA lời mời
    const handleRevokeInvite = async (inviteId: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn thu hồi lời mời này không?")) return;
        setRevokingId(inviteId);
        try {
            const { error } = await supabase
                .from("group_email_invites")
                .delete()
                .eq("id", inviteId);

            if (error) throw error;
            toast.success("Đã thu hồi lời mời thành công.");
            if (projectId) fetchInvites(projectId);
        } catch (err: any) {
            console.error("Lỗi thu hồi:", err);
            toast.error("Không thể xóa lời mời.");
        } finally {
            setRevokingId(null);
        }
    };

    // Hàm render Badge trạng thái động linh hoạt
    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "accepted":
                return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Đã gia nhập</Badge>;
            case "declined":
                return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Đã từ chối</Badge>;
            default:
                return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 flex items-center gap-1"><Clock3 className="h-3 w-3 animate-pulse" /> Đang xử lý</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-[24px] border border-border/70 bg-card p-6 shadow-sm">
                <div className="mb-4">
                    <h2 className="text-xl font-semibold tracking-tight">Mời thành viên vào dự án</h2>
                    <p className="text-sm text-muted-foreground">Tên dự án: <span className="font-semibold text-indigo-600">{projectName}</span></p>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="email">Địa chỉ Email thành viên</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@company.com"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                disabled={isSubmitting}
                                className="rounded-xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="note">Ghi chú công việc (Tùy chọn)</Label>
                            <Input
                                id="note"
                                type="text"
                                placeholder="Ví dụ: Vị trí UI/UX Designer..."
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                disabled={isSubmitting}
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>
                        ) : (
                            <><UserPlus className="mr-2 h-4 w-4" /> Xác nhận gửi lời mời</>
                        )}
                    </Button>
                </form>
            </div>

            {/* DANH SÁCH LỜI MỜI ĐÃ GỬI VÀ QUẢN LÝ QUYỀN */}
            <div className="space-y-3">
                <h3 className="text-base font-medium">Danh sách lời mời đã gửi</h3>
                {inviteLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Đang tải danh sách...</div>
                ) : inviteRows.length > 0 ? (
                    <div className="space-y-2">
                        {inviteRows.map((invite) => (
                            <div key={invite.id} className="rounded-xl border border-border/60 bg-background p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">{invite.invited_email}</span>
                                        {renderStatusBadge(invite.status)}
                                    </div>
                                    {invite.note && <p className="text-xs text-muted-foreground italic">Ghi chú: {invite.note}</p>}
                                </div>
                                
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl h-8 text-xs text-gray-600"
                                        onClick={() => {
                                            void navigator.clipboard.writeText(invite.invite_code);
                                            toast.success("Đã sao chép mã mời thành công!");
                                        }}
                                    >
                                        <Copy className="mr-1 h-3 w-3" /> Copy Mã
                                    </Button>

                                    {/* Nút Thu hồi xuất hiện cho các lời mời chưa được đồng ý hoặc để dọn dẹp lời mời */}
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        disabled={revokingId === invite.id}
                                        className="rounded-xl h-8 text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 shadow-none hover:text-red-700"
                                        onClick={() => handleRevokeInvite(invite.id)}
                                    >
                                        {revokingId === invite.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <><Trash2 className="mr-1 h-3 w-3" /> Thu hồi</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Chưa có lời mời bằng Email nào được gửi từ dự án này.
                    </div>
                )}
            </div>
        </div>
    );
}