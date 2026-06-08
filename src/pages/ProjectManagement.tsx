import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Folder, Calendar, History, Settings, Plus, Copy, Trash2, ArrowLeft, Loader2, Users, Compass, Laptop, LogOut, CheckCircle, XCircle, Clock, Inbox, Mail, MailOpen, Bell, Check, AlertTriangle, UserX, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeam, type Group, type MemberStat } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationContext";
import { tr } from "@/lib/i18n";
import { OnboardingNameModal } from "@/components/OnboardingNameModal";
import { SettingsModal } from "@/components/SettingsModal";
import { supabase } from "@/lib/supabaseClient";

const ProjectManagement: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { groups, setCurrentGroupIndex, createProject, joinProject, currentUserName, dataLoading, pendingJoinRequests, fetchPendingJoinRequests, approveJoinRequest, rejectJoinRequest } = useTeam();
  const { user, profile, signOut, updateProfileName } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [activeTab, setActiveTab] = useState<string>("All Projects");
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");
  const [showAddOptions, setShowAddOptions] = useState<boolean>(false);
  const [hoveredButton, setHoveredButton] = useState<"create" | "join" | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isJoinOpen, setIsJoinOpen] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>("");
  const [projectIdInput, setProjectIdInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [dismissedFreestyle, setDismissedFreestyle] = useState<boolean>(false);
  const [approvalLoading, setApprovalLoading] = useState<string | null>(null);

  // Workspace Settings — account fields state
  const [wsName, setWsName] = useState("");
  const [wsNameLoading, setWsNameLoading] = useState(false);
  const [wsCopied, setWsCopied] = useState(false);

  // Delete Account states
  const [deleteAccountStep, setDeleteAccountStep] = useState<"none" | "confirm_name" | "leader_warning">("none");
  const [deleteAccountNameInput, setDeleteAccountNameInput] = useState("");
  const [deleteAccountSilent, setDeleteAccountSilent] = useState(false);
  const [deleteAccountProceedInput, setDeleteAccountProceedInput] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [ledProjects, setLedProjects] = useState<Array<{ id: string; name: string; memberCount: number }>>([]);

  useEffect(() => {
    if (user?.id) {
      const persisted = sessionStorage.getItem(`teamfair_dismissed_freestyle_${user.id}`) === "true";
      setDismissedFreestyle(persisted);
    }
  }, [user?.id]);

  // Sync wsName from profile
  useEffect(() => {
    if (profile?.full_name) {
      setWsName(profile.full_name);
    }
  }, [profile?.full_name]);

  // Cooldown calculation for display name
  const lastNameChange = profile?.last_name_change_at ? new Date(profile.last_name_change_at) : null;
  const cooldownEnd = lastNameChange ? new Date(lastNameChange.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const isCooldownActive = cooldownEnd ? now < cooldownEnd : false;
  const remainingMs = cooldownEnd ? cooldownEnd.getTime() - now.getTime() : 0;
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  // Workspace Settings handlers
  const handleWsSaveName = async () => {
    if (isCooldownActive) {
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: tr(
          language,
          `Bạn chỉ có thể đổi tên sau ${remainingDays} ngày nữa.`,
          `You can change your name again in ${remainingDays} days.`
        ),
        variant: "destructive",
      });
      return;
    }
    const trimmed = wsName.trim();
    if (!trimmed) {
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: tr(language, "Vui lòng nhập tên hợp lệ", "Please enter a valid name"),
        variant: "destructive",
      });
      return;
    }
    setWsNameLoading(true);
    try {
      await updateProfileName(trimmed);
      toast({
        title: tr(language, "Thành công!", "Success!"),
        description: tr(language, "Cập nhật hồ sơ thành công!", "Profile updated successfully!"),
      });
    } catch (err) {
      console.error("Error updating profile:", err);
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setWsNameLoading(false);
    }
  };

  const handleWsCopyUid = () => {
    if (!profile?.id) return;
    void navigator.clipboard.writeText(profile.id);
    setWsCopied(true);
    toast({
      title: tr(language, "Đã sao chép UID!", "UID Copied!"),
    });
    setTimeout(() => setWsCopied(false), 2000);
  };

  // Delete Account: Step 1 -> check if name matches -> check if Leader of any project
  const handleDeleteAccountVerifyName = async () => {
    if (deleteAccountNameInput !== profile?.full_name) {
      toast({
        title: tr(language, "Lỗi xác minh", "Verification Error"),
        description: tr(language, "Tên không khớp. Vui lòng nhập chính xác tên hiển thị của bạn.", "Name does not match. Please type your exact display name."),
        variant: "destructive",
      });
      return;
    }

    // Check if user is Leader of any projects
    if (user?.id) {
      try {
        const { data, error } = await supabase
          .from("group_members")
          .select("group_id, groups:group_id(project_name)")
          .eq("student_id", user.id)
          .eq("role", "Leader");

        if (!error && data && data.length > 0) {
          // Also check groups where user is lecturer_id
          const { data: lecturerGroups } = await supabase
            .from("groups")
            .select("id, project_name")
            .eq("lecturer_id", user.id);

          // Merge and deduplicate
          const allLedIds = new Set<string>();
          const allLed: Array<{ id: string; name: string; memberCount: number }> = [];

          for (const row of (data as unknown as Array<{ group_id: string; groups: { project_name: string } | null }>)) {
            if (!allLedIds.has(row.group_id)) {
              allLedIds.add(row.group_id);
              allLed.push({ id: row.group_id, name: row.groups?.project_name || "Unknown", memberCount: 0 });
            }
          }
          for (const row of (lecturerGroups || [])) {
            if (!allLedIds.has(row.id)) {
              allLedIds.add(row.id);
              allLed.push({ id: row.id, name: row.project_name, memberCount: 0 });
            }
          }

          // Fetch member counts
          for (const proj of allLed) {
            const { count } = await supabase
              .from("group_members")
              .select("*", { count: "exact", head: true })
              .eq("group_id", proj.id);
            proj.memberCount = count || 0;
          }

          setLedProjects(allLed);
          setDeleteAccountStep("leader_warning");
          setDeleteAccountProceedInput("");
          return;
        }

        // Also check lecturer_id only groups
        const { data: lecturerOnlyGroups } = await supabase
          .from("groups")
          .select("id, project_name")
          .eq("lecturer_id", user.id);

        if (lecturerOnlyGroups && lecturerOnlyGroups.length > 0) {
          const allLed: Array<{ id: string; name: string; memberCount: number }> = [];
          for (const row of lecturerOnlyGroups) {
            const { count } = await supabase
              .from("group_members")
              .select("*", { count: "exact", head: true })
              .eq("group_id", row.id);
            allLed.push({ id: row.id, name: row.project_name, memberCount: count || 0 });
          }
          setLedProjects(allLed);
          setDeleteAccountStep("leader_warning");
          setDeleteAccountProceedInput("");
          return;
        }
      } catch (err) {
        console.error("Error checking leader status:", err);
      }
    }

    // Not a leader of any project — execute deletion directly
    await executeAccountDeletion();
  };

  // Execute the actual account deletion
  const executeAccountDeletion = async () => {
    setDeleteAccountLoading(true);
    try {
      // 1. Call the RPC to clean all public.* data
      const { data: deletedUserId, error: rpcError } = await supabase.rpc("delete_user_account", {
        p_silent: deleteAccountSilent,
      });
      if (rpcError) throw new Error(rpcError.message);

      // 2. Call the Edge Function to delete auth.users
      try {
        await supabase.functions.invoke("delete-user-auth", {
          body: { user_id: deletedUserId || user?.id },
        });
      } catch (edgeErr) {
        // Edge function failure is non-fatal — public data is already gone
        console.warn("Edge function delete-user-auth failed (auth row may remain orphaned):", edgeErr);
      }

      // 3. Sign out and redirect
      await signOut();
      navigate("/");
    } catch (err) {
      console.error("Account deletion failed:", err);
      toast({
        title: tr(language, "Lỗi xóa tài khoản", "Account Deletion Failed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  // Fetch pending join requests for current user (applicant view)
  const [myPendingRequests, setMyPendingRequests] = useState<Array<{ id: string; group_name: string; created_at: string }>>([]);

  useEffect(() => {
    if (!user?.id) return;
    // Load applicant's own pending requests
    const loadMyRequests = async () => {
      try {
        const { data, error } = await supabase
          .from("join_requests")
          .select("id, group_id, created_at, groups:group_id(project_name)")
          .eq("user_id", user.id)
          .eq("status", "pending");
        if (!error && data) {
          setMyPendingRequests((data as unknown as Array<{ id: string; created_at: string; groups: { project_name: string } | null }>).map((r) => ({
            id: r.id,
            group_name: r.groups?.project_name || "Unknown",
            created_at: r.created_at,
          })));
        }
      } catch (err) {
        console.error("Error loading pending requests:", err);
      }
    };
    void loadMyRequests();
  }, [user?.id, groups]);

  // UID search & membership additions state
  const [isUidAddOpen, setIsUidAddOpen] = useState<boolean>(false);
  const [newCreatedGroupId, setNewCreatedGroupId] = useState<string | null>(null);
  const [uidInput, setUidInput] = useState<string>("");
  interface SearchedUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
  }

  interface AddedMember extends SearchedUser {
    projectRole: string;
  }

  const [searchedUser, setSearchedUser] = useState<SearchedUser | null>(null);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [addedMembers, setAddedMembers] = useState<AddedMember[]>([]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({
      title: tr(language, "Đã sao chép Project ID!", "Project ID Copied!"),
      description: tr(
        language,
        "Bạn có thể chia sẻ ID này để người khác tham gia.",
        "You can now share this ID with others to join."
      ),
    });
  };

  const handleSearchUid = async () => {
    const trimmed = uidInput.trim();
    if (!trimmed) return;
    setSearchLoading(true);
    setSearchedUser(null);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, role")
        .eq("id", trimmed)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSearchedUser(data);
      } else {
        toast({
          title: tr(language, "Không tìm thấy", "User Not Found"),
          description: tr(language, "Không có người dùng nào khớp với UID này.", "No active user matches this UID."),
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast({
        title: tr(language, "Lỗi tìm kiếm", "Search Error"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMemberByUid = async () => {
    if (!searchedUser || !newCreatedGroupId) return;
    setSearchLoading(true);
    try {
      const projectRole = searchedUser.role === "lecturer" ? "Lecturer" : "Member";
      const { error } = await supabase
        .from("group_members")
        .insert({
          group_id: newCreatedGroupId,
          student_id: searchedUser.id,
          role: projectRole
        });
      if (error) throw error;

      toast({
        title: tr(language, "Đã thêm thành viên!", "Member Added!"),
        description: `${searchedUser.full_name} has been added to the project.`,
      });

      setAddedMembers(prev => [...prev, { ...searchedUser, projectRole }]);
      setSearchedUser(null);
      setUidInput("");
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast({
        title: tr(language, "Không thể thêm", "Could Not Add Member"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!newCreatedGroupId) return;
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", newCreatedGroupId)
        .eq("student_id", memberId);
      if (error) throw error;

      toast({
        title: tr(language, "Đã xóa thành viên", "Member Removed"),
        description: "The user was removed from the project group.",
      });
      setAddedMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast({
        title: tr(language, "Lỗi xóa thành viên", "Error Removing Member"),
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCreateProject = () => {
    const name = projectName.trim();
    if (!name) {
      toast({
        title: tr(language, "Lỗi xác thực", "Validation Error"),
        description: tr(language, "Vui lòng nhập tên dự án hợp lệ.", "Please enter a valid project name."),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Simulate loading for 1.2s then create
    setTimeout(async () => {
      try {
        const newId = await createProject(name);
        setIsLoading(false);
        setIsCreateOpen(false);
        setProjectName("");
        setShowAddOptions(false);

        toast({
          title: tr(language, "Tạo dự án thành công!", "Project Created Successfully!"),
          description: tr(
            language,
            `Dự án "${name}" hiện đã sẵn sàng.`,
            `Project "${name}" is now ready.`
          ),
        });

        // Set up membership editing step
        setNewCreatedGroupId(newId);
        setAddedMembers([]);
        setSearchedUser(null);
        setUidInput("");
        setIsUidAddOpen(true);
      } catch (err) {
        setIsLoading(false);
        toast({
          title: tr(language, "Lỗi tạo dự án", "Error Creating Project"),
          description: String(err),
          variant: "destructive",
        });
      }
    }, 1200);
  };

  const handleJoinProject = () => {
    const trimmedId = projectIdInput.trim();
    if (!trimmedId) {
      toast({
        title: tr(language, "Lỗi xác thực", "Validation Error"),
        description: tr(language, "Vui lòng nhập mã mời hợp lệ.", "Please enter a valid invite code."),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Simulate loading for 1.2s then join
    setTimeout(async () => {
      try {
        const result = await joinProject(trimmedId);
        setIsLoading(false);
        setIsJoinOpen(false);
        setProjectIdInput("");
        setShowAddOptions(false);

        if (result.status === "pending_approval") {
          toast({
            title: tr(language, "Yêu cầu tham gia đã gửi!", "Join Request Sent!"),
            description: tr(
              language,
              `Yêu cầu tham gia dự án "${result.groupName}" đã được gửi và đang chờ phê duyệt.`,
              `Your request to join "${result.groupName}" has been sent and is pending approval.`
            ),
          });
        } else {
          toast({
            title: tr(language, "Tham gia dự án thành công!", "Successfully Joined Project!"),
            description: tr(
              language,
              "Bạn hiện là thành viên của dự án này.",
              "You are now a member of this project."
            ),
          });

          // Launch workspace immediately!
          if (result.groupIndex !== undefined) {
            handleLaunchWorkspace(result.groupIndex, result.groupName);
          }
        }
      } catch (err) {
        setIsLoading(false);
        toast({
          title: tr(language, "Lỗi tham gia dự án", "Error Joining Project"),
          description: String(err),
          variant: "destructive",
        });
      }
    }, 1200);
  };

  const determineUserRole = (group: Group & { lecturer_id?: string }, index: number) => {
    const isDemo = !user?.id;
    if (isDemo) {
      const isLeader = group.members?.some((m) => m.name === currentUserName && m.role === "Leader");
      return isLeader ? "Owner" : "Member";
    }

    // Real Supabase Auth mapping
    const member = group.members?.find(
      (m) => m.id === user?.id || (profile?.full_name && m.name === profile.full_name)
    );

    if (member) {
      return member.role === "Leader" ? "Owner" : "Member";
    }

    // Check if user is the lecturer of this project
    if (group.lecturer_id === user?.id || profile?.role === "lecturer") {
      return "Lecturer";
    }

    return "Member";
  };

  const getProjectColor = (id: string) => {
    const colors = [
      "from-violet-600 to-indigo-600",
      "from-emerald-600 to-teal-600",
      "from-rose-600 to-pink-600",
      "from-amber-500 to-orange-600",
      "from-cyan-500 to-blue-600",
      "from-fuchsia-600 to-purple-600",
    ];
    let sum = 0;
    for (let i = 0; i < id.length; i++) {
      sum += id.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const handleLaunchWorkspace = (groupIndex: number, groupName: string) => {
    setCurrentGroupIndex(groupIndex);

    const role = profile?.role || (sessionStorage.getItem("demo_session") === "lecturer" ? "lecturer" : "student");
    const redirectPath = role === "lecturer" || role === "admin" ? "/dashboard-lecturer" : "/student/dashboard";

    toast({
      title: tr(language, "Khởi chạy Workspace!", "Workspace Launched!"),
      description: tr(
        language,
        `Đang vào môi trường dự án cho "${groupName}"...`,
        `Entering project environment for "${groupName}"...`
      ),
    });

    navigate(redirectPath);
  };

  // Find source project based on member/task/group name lookup
  const findSourceProject = (notifContent: string, senderName: string) => {
    // 1. Task Name search
    for (const group of groups) {
      if (group.tasks) {
        for (const task of group.tasks) {
          if (task.name && notifContent.toLowerCase().includes(task.name.toLowerCase())) {
            return group;
          }
        }
      }
    }

    // 2. Member Name search (exclude generic names)
    if (senderName && senderName !== "Lecturer" && senderName !== "System" && senderName !== "Hệ thống" && senderName !== "Giảng viên") {
      for (const group of groups) {
        if (group.members) {
          for (const member of group.members) {
            if (member.name && member.name.toLowerCase() === senderName.toLowerCase()) {
              return group;
            }
          }
        }
      }
    }

    // 3. Project Name search
    for (const group of groups) {
      if (group.name && notifContent.toLowerCase().includes(group.name.toLowerCase())) {
        return group;
      }
    }

    return null;
  };

  // Helper to format elapsed time in Viet/English
  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return tr(language, "Vừa xong", "Just now");
    if (diffMins < 60) return `${diffMins} ${tr(language, "phút trước", "m ago")}`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ${tr(language, "giờ trước", "h ago")}`;

    return d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAvatarGradient = (name: string) => {
    const hue = name.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 60) % 360}, 70%, 45%))`;
  };

  const sidebarItems = [
    { name: "All Projects", labelVi: "Tất cả dự án", labelEn: "All Projects", icon: Folder },
    { name: "Global Calendar", labelVi: "Lịch chung", labelEn: "Global Calendar", icon: Calendar },
    { name: "Activity Logs", labelVi: "Nhật ký hoạt động", labelEn: "Activity Logs", icon: History },
    { name: "Notification", labelVi: "Thông báo", labelEn: "Notification", icon: Bell },
    { name: "Workspace Settings", labelVi: "Cấu hình Workspace", labelEn: "Workspace Settings", icon: Settings },
  ];

  const isDemo = !user?.id;
  const myGroups = groups.filter(group => {
    if (isDemo) return true;
    if (profile?.role === "admin") return true;
    if (profile?.role === "lecturer") {
      const isOwner = group.lecturer_id === user?.id;
      const isMember = group.members?.some(m => m.id === user?.id);
      return isOwner || isMember;
    }
    return group.members?.some(m => m.id === user?.id);
  });

  const isNewUserOnboarding = !isDemo && myGroups.length === 0 && !dismissedFreestyle;

  if (dataLoading || (user?.id && !profile)) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased items-center justify-center relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[150px]" />
          <div className="absolute top-[40%] right-[-10%] w-[40%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
        </div>
        <div className="flex flex-col items-center gap-4 z-10 relative animate-pulse">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-600/20 border border-indigo-500/30 text-indigo-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm font-semibold tracking-wide">
            {tr(language, "Đang tải dự án...", "Loading projects...")}
          </p>
        </div>
      </div>
    );
  }

  if (isNewUserOnboarding) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white relative">
        <OnboardingNameModal />
        <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} defaultToMember={true} />

        {/* BACKGROUND DECORATIONS */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[150px]" />
          <div className="absolute top-[40%] right-[-10%] w-[40%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
        </div>

        <main className="flex-1 max-w-6xl mx-auto px-6 py-20 flex flex-col justify-center items-center z-10 relative">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-top duration-500">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/20">
                <Compass className="h-8 w-8 text-white" />
              </div>
              <span className="font-extrabold text-3xl tracking-tight bg-gradient-to-r from-white via-indigo-100 to-violet-200 bg-clip-text text-transparent">
                Teamfair Onboarding
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">
              {tr(language, "Chào mừng đến với Teamfair!", "Welcome to Teamfair!")}
            </h1>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              {tr(
                language,
                "Hãy chọn một trong ba phương thức sau đây để bắt đầu cộng tác và làm việc nhóm hiệu quả.",
                "Choose one of the three options below to start collaborating and managing teamwork effectively."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-12 animate-in fade-in zoom-in-95 duration-500 delay-150">
            {/* Option 1: Already have a team */}
            <button
              onClick={() => setIsJoinOpen(true)}
              className="group bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/60 rounded-3xl p-8 md:p-10 text-left flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] shadow-xl"
            >
              <div className="space-y-4">
                <div className="p-4 w-fit rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-100 group-hover:text-emerald-300 transition-colors">
                  {tr(language, "Đã có nhóm dự án", "Already have a team")}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {tr(
                    language,
                    "Nhập mã mời (Invite Code) do trưởng nhóm của bạn cung cấp để tham gia ngay.",
                    "Enter an Invite Code shared by your team leader to join their workspace."
                  )}
                </p>
              </div>
              <span className="block mt-6 text-xs font-bold text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                {tr(language, "Nhập Mã mời", "Enter Invite Code")} &rarr;
              </span>
            </button>

            {/* Option 2: Create a new project */}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="group bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/60 rounded-3xl p-8 md:p-10 text-left flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] shadow-xl"
            >
              <div className="space-y-4">
                <div className="p-4 w-fit rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                  <Laptop className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-100 group-hover:text-indigo-300 transition-colors">
                  {tr(language, "Tạo dự án mới", "Create a new project")}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {tr(
                    language,
                    "Tạo một không gian làm việc hoàn toàn mới và thêm các thành viên khác bằng UID của họ.",
                    "Start a brand new workspace as the owner, and add other members by their Supabase UIDs."
                  )}
                </p>
              </div>
              <span className="block mt-6 text-xs font-bold text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                {tr(language, "Tạo Không gian", "Create Workspace")} &rarr;
              </span>
            </button>

            {/* Option 3: Freestyle */}
            <button
              onClick={() => {
                if (user?.id) {
                  sessionStorage.setItem(`teamfair_dismissed_freestyle_${user.id}`, "true");
                }
                setDismissedFreestyle(true);
              }}
              className="group bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/60 rounded-3xl p-8 md:p-10 text-left flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] shadow-xl"
            >
              <div className="space-y-4">
                <div className="p-4 w-fit rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform duration-300">
                  <Compass className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-slate-100 group-hover:text-amber-300 transition-colors">
                  {tr(language, "Tự do khám phá", "Freestyle Mode")}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {tr(
                    language,
                    "Bỏ qua hướng dẫn thiết lập nhanh và truy cập trực tiếp trang danh sách quản lý dự án mẫu.",
                    "Skip quick setup instructions and enter directly to standard workspace dashboard controls."
                  )}
                </p>
              </div>
              <span className="block mt-6 text-xs font-bold text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                {tr(language, "Khám phá ngay", "Explore Dashboards")} &rarr;
              </span>
            </button>
          </div>

          <Button
            onClick={() => {
              navigate("/login", { replace: true });
              void signOut();
            }}
            variant="ghost"
            className="text-slate-500 hover:text-slate-300 gap-2 hover:bg-slate-900/30 rounded-xl"
          >
            <LogOut className="h-4.5 w-4.5" />
            {tr(language, "Đăng xuất", "Log Out")}
          </Button>

          {/* Dialog modals embedded */}
          {/* CREATE MODAL */}
          <Dialog open={isCreateOpen} onOpenChange={(open) => !isLoading && setIsCreateOpen(open)}>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 z-[9999]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
                  <Laptop className="h-5 w-5 text-indigo-400" />
                  {tr(language, "Tạo dự án mới", "Create a new project")}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-sm mt-1">
                  {tr(
                    language,
                    "Nhập tên cho không gian làm việc dự án mới của bạn. Bạn sẽ tự động được chỉ định làm Chủ sở hữu dự án.",
                    "Enter a name for your new project workspace. You will be automatically assigned as the project Owner."
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-2">
                <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">
                  {tr(language, "Tên dự án", "Project Name")}
                </label>
                <Input
                  id="new-project-name"
                  placeholder="e.g. NextGen Web App"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all py-5 font-medium"
                />
              </div>
              <DialogFooter className="flex items-center gap-2 sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isLoading}
                  className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
                >
                  {tr(language, "Hủy bỏ", "Cancel")}
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl px-5 transition-all flex items-center gap-2 border-0 shadow-lg shadow-indigo-600/10"
                  id="submit-create-project-btn"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      {tr(language, "Đang tạo...", "Creating...")}
                    </>
                  ) : (
                    tr(language, "Tạo dự án", "Create Project")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* JOIN MODAL */}
          <Dialog open={isJoinOpen} onOpenChange={(open) => !isLoading && setIsJoinOpen(open)}>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 z-[9999]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-400" />
                  {tr(language, "Tham gia dự án", "Join a project")}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-sm mt-1">
                  {tr(
                    language,
                    "Dán mã mời (Invite Code) do chủ sở hữu dự án cung cấp để tham gia vào không gian làm việc của họ.",
                    "Paste the Invite Code provided by the project owner to join their active workspace."
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-2">
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
                  {tr(language, "Mã mời (Invite Code)", "Invite Code")}
                </label>
                <Input
                  id="join-project-id"
                  placeholder="e.g. IV-A1B2C3"
                  value={projectIdInput}
                  onChange={(e) => setProjectIdInput(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition-all py-5 font-mono text-sm tracking-wider text-center"
                />
              </div>
              <DialogFooter className="flex items-center gap-2 sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setIsJoinOpen(false)}
                  disabled={isLoading}
                  className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
                >
                  {tr(language, "Hủy bỏ", "Cancel")}
                </Button>
                <Button
                  onClick={handleJoinProject}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-5 transition-all flex items-center gap-2 border-0 shadow-lg shadow-emerald-600/10"
                  id="submit-join-project-btn"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      {tr(language, "Đang tham gia...", "Joining...")}
                    </>
                  ) : (
                    tr(language, "Tham gia dự án", "Join Project")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* UID MEMBER ADD MODAL */}
          <Dialog open={isUidAddOpen} onOpenChange={(open) => !searchLoading && setIsUidAddOpen(open)}>
            <DialogContent className="sm:max-w-[460px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999] animate-in zoom-in-95 duration-200">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2">
                  <Users className="h-5.5 w-5.5 text-indigo-400" />
                  {tr(language, "Thêm thành viên", "Add Team Members")}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-sm mt-1">
                  {tr(
                    language,
                    "Tìm và thêm thành viên hoặc giảng viên vào dự án của bạn bằng UID của họ.",
                    "Search and add students or lecturers to your new project using their Supabase UID."
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                {/* Search Input Box */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">
                    {tr(language, "Nhập UID người dùng", "Enter User UID")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="e.g. f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
                      value={uidInput}
                      onChange={(e) => setUidInput(e.target.value)}
                      disabled={searchLoading}
                      className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all font-mono text-sm flex-1"
                    />
                    <Button
                      onClick={handleSearchUid}
                      disabled={searchLoading || !uidInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                    >
                      {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(language, "Tìm", "Search")}
                    </Button>
                  </div>
                </div>

                {/* Found User Result Card */}
                {searchedUser && (
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{searchedUser.full_name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{searchedUser.email}</p>
                      </div>
                      <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold text-[10px] uppercase py-0.5 px-2">
                        {searchedUser.role}
                      </Badge>
                    </div>
                    <Button
                      onClick={handleAddMemberByUid}
                      disabled={searchLoading}
                      className="w-full bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white font-bold rounded-xl py-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {searchLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "+ " + tr(language, "Thêm vào dự án", "Add to Project")}
                    </Button>
                  </div>
                )}

                {/* Added Members List */}
                {addedMembers.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {tr(language, "Thành viên đã thêm", "Added Members")} ({addedMembers.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {addedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="bg-slate-950/30 border border-slate-900 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="block font-bold text-slate-300 truncate">{member.full_name}</span>
                            <span className="block text-[10px] text-slate-500 truncate mt-0.5">{member.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-800 text-slate-400 border-0 text-[9px] uppercase py-0.5 px-1.5 font-semibold">
                              {member.projectRole}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2 border-t border-slate-800/60">
                <Button
                  onClick={() => {
                    setIsUidAddOpen(false);
                    setNewCreatedGroupId(null);
                    setAddedMembers([]);
                    window.location.reload();
                  }}
                  className="w-full bg-slate-850 hover:bg-slate-750 text-white font-bold rounded-xl py-3 border-0 shadow-md cursor-pointer"
                >
                  {tr(language, "Hoàn tất & Tiếp tục", "Complete & Continue")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      <OnboardingNameModal />
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} defaultToMember={true} />
      {/* BACKGROUND DECORATIONS */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[150px]" />
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800/80 p-6 flex flex-col justify-between shrink-0 z-10 relative">
        <div>
          {/* LOGO */}
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-indigo-200 to-violet-300 bg-clip-text text-transparent">
                Teamfair
              </span>
              <span className="block text-xs font-semibold text-indigo-400/80 uppercase tracking-widest mt-0.5">
                {tr(language, "Workspace", "Workspace")}
              </span>
            </div>
          </div>

          {/* NAV UTILITIES */}
          <nav className="space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              const label = tr(language, item.labelVi, item.labelEn);
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.name === "Workspace Settings") {
                      setActiveTab("Workspace Settings");
                      return;
                    }
                    setActiveTab(item.name);
                    if (item.name !== "Notification" && item.name !== "All Projects") {
                      toast({
                        title: tr(
                          language,
                          `Đã click tiện ích: "${label}"`,
                          `Clicked utility: "${label}"`
                        ),
                        description: tr(
                          language,
                          "Chức năng này thuộc giao diện mẫu.",
                          "This option is part of the layout template."
                        ),
                      });
                    }
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 group relative overflow-hidden ${isActive
                    ? "text-white bg-indigo-600/10 border-l-[3px] border-indigo-500 shadow-inner shadow-indigo-500/5"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-l-[3px] border-transparent"
                    }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"
                      }`}
                  />
                  {label}
                  {item.name === "Notification" && unreadCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full animate-pulse shadow-md shadow-rose-500/20">
                      {unreadCount}
                    </span>
                  )}
                  {isActive && item.name !== "Notification" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* PROFILE PREVIEW */}
        <div className="space-y-3">
          <div className="bg-slate-800/20 border border-slate-800/60 rounded-2xl p-4.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shrink-0">
                {(profile?.full_name || currentUserName || "User")
                  .split(" ")
                  .pop()
                  ?.substring(0, 2)
                  .toUpperCase() || "US"}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block font-semibold text-sm text-slate-200 truncate">
                  {profile?.full_name || currentUserName || "User"}
                </span>
                <span className="block text-xs text-slate-400 truncate uppercase tracking-wider font-bold">
                  {profile?.role === "lecturer"
                    ? tr(language, "Giảng viên", "Lecturer")
                    : profile?.role === "admin"
                      ? "Admin"
                      : tr(language, "Sinh viên", "Student")}
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={() => {
              navigate("/login", { replace: true });
              void signOut();
            }}
            variant="ghost"
            className="w-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-xl flex items-center gap-3.5 justify-start px-4 py-3 h-auto font-semibold text-sm"
          >
            <LogOut className="h-4.5 w-4.5" />
            {tr(language, "Đăng xuất", "Log Out")}
          </Button>
        </div>
      </aside>

      {/* MAIN MAIN AREA */}
      <main className="flex-1 p-10 flex flex-col justify-between overflow-y-auto z-10 relative">
        <div className="max-w-6xl w-full mx-auto">
          {/* HEADER */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                {tr(language, "Quản lý Dự án", "Project Dashboard")}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {tr(
                  language,
                  "Quản lý, khởi chạy và hợp tác trên các không gian làm việc dự án đang hoạt động.",
                  "Manage, launch, and collaborate across multiple active project workspaces."
                )}
              </p>
            </div>

            {/* ACTION TRIGGERS IN HEADER */}
            {myGroups.length > 0 && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowAddOptions(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-5 py-2 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/30 transition-all duration-300 flex items-center gap-2 group border-0"
                >
                  <Plus className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-90" />
                  {tr(language, "Thêm Dự án", "Add Project")}
                </Button>
              </div>
            )}
          </div>

          {/* MAIN WORKSPACE CONTENT */}
          {activeTab === "Workspace Settings" ? (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-violet-600/20 border border-indigo-500/30">
                  <Settings className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-300 bg-clip-text text-transparent">
                    {tr(language, "Cấu hình Tài khoản", "Account Settings")}
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {tr(language, "Quản lý thông tin hồ sơ cá nhân và tài khoản Teamfair.", "Manage your personal profile and Teamfair account.")}
                  </p>
                </div>
              </div>

              {/* Account Profile Card */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-lg">
                {/* Email (Read Only) */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Label>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-400 text-sm select-all">
                    {profile?.email || "—"}
                  </div>
                </div>

                {/* Supabase UID */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    UID
                  </Label>
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 shadow-inner">
                    <span className="font-mono text-xs text-slate-300 truncate tracking-tight select-all flex-1">
                      {profile?.id || "—"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleWsCopyUid}
                      className="p-1 h-auto hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                      {wsCopied ? <Check className="h-3.5 w-3.5 text-emerald-400 animate-in fade-in" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5" />
                    {tr(language, "Tên Hiển Thị", "Display Name")}
                  </Label>
                  <Input
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    disabled={wsNameLoading || isCooldownActive}
                    className={`bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all py-5 font-medium ${isCooldownActive ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                  {isCooldownActive && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        {tr(
                          language,
                          `Tên hiển thị chỉ được thay đổi 30 ngày một lần. Vui lòng quay lại sau ${remainingDays} ngày nữa.`,
                          `Display name can only be changed once every 30 days. Please return in ${remainingDays} days.`
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <Button
                  onClick={() => void handleWsSaveName()}
                  disabled={wsNameLoading || isCooldownActive || wsName.trim() === profile?.full_name}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl px-6 transition-all flex items-center gap-2 border-0 shadow-lg shadow-indigo-600/15"
                >
                  {wsNameLoading ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      {tr(language, "Đang lưu...", "Saving...")}
                    </>
                  ) : (
                    tr(language, "Lưu Thay Đổi", "Save Changes")
                  )}
                </Button>
              </div>

              {/* Delete Account Section */}
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 space-y-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <UserX className="h-4.5 w-4.5 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-rose-400">
                      {tr(language, "Xóa Tài khoản", "Delete me")}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {tr(
                        language,
                        "Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn. Hành động này không thể hoàn tác.",
                        "Permanently delete your account and all associated data. This action cannot be undone."
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setDeleteAccountStep("confirm_name");
                      setDeleteAccountNameInput("");
                      setDeleteAccountSilent(false);
                      setDeleteAccountProceedInput("");
                      setLedProjects([]);
                    }}
                    className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-600 hover:border-rose-500 hover:text-white text-rose-400 font-bold text-xs rounded-xl px-5 py-3 h-auto transition-all cursor-pointer shrink-0"
                    id="delete-account-btn"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {tr(language, "Xóa Tài khoản", "Delete me")}
                  </Button>
                </div>
              </div>

              {/* Delete Account Dialog — Step 1: Confirm Name */}
              <Dialog open={deleteAccountStep === "confirm_name"} onOpenChange={(open) => {
                if (!open && !deleteAccountLoading) {
                  setDeleteAccountStep("none");
                }
              }}>
                <DialogContent className="sm:max-w-[480px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999] animate-in zoom-in-95 duration-200">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight text-rose-500 flex items-center gap-2.5">
                      <AlertTriangle className="h-5.5 w-5.5 text-rose-500" />
                      {tr(language, "Xác nhận Xóa Tài khoản", "Confirm Account Deletion")}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 text-sm mt-1">
                      {tr(
                        language,
                        "Hành động này sẽ xóa vĩnh viễn tài khoản, tất cả dự án, và toàn bộ dữ liệu của bạn.",
                        "This action will permanently delete your account, all projects you lead, and all your data."
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 text-sm leading-relaxed">
                      {tr(
                        language,
                        "Cảnh báo: Tất cả dự án, nhiệm vụ, tài liệu và lịch sử của bạn sẽ bị xóa vĩnh viễn. Để tiếp tục, vui lòng nhập chính xác tên hiển thị bên dưới:",
                        "Warning: All your projects, tasks, materials, and history will be permanently purged. To proceed, please type your exact display name below:"
                      )}
                      <div className="mt-3 font-mono bg-slate-950/60 border border-slate-800 rounded px-3 py-1.5 text-center text-rose-400 font-bold select-all tracking-wide">
                        {profile?.full_name}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {tr(language, "Nhập tên hiển thị để xác nhận", "Display Name Verification")}
                      </Label>
                      <Input
                        required
                        autoFocus
                        value={deleteAccountNameInput}
                        onChange={(e) => setDeleteAccountNameInput(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 rounded-xl focus-visible:ring-rose-500 focus-visible:border-rose-500 py-5 text-center text-sm font-semibold"
                        placeholder={tr(language, "Nhập tên hiển thị tại đây...", "Type your display name here...")}
                      />
                    </div>

                    {/* Delete Silently Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer group select-none">
                      <input
                        type="checkbox"
                        checked={deleteAccountSilent}
                        onChange={(e) => setDeleteAccountSilent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                          {tr(language, "Xóa Âm thầm", "Delete Silently")}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {tr(
                            language,
                            "Không gửi thông báo nào đến các thành viên dự án. Họ sẽ không được thông báo về việc bạn rời đi.",
                            "No notifications will be sent to any project members. They will not be informed of your departure."
                          )}
                        </p>
                      </div>
                    </label>
                  </div>

                  <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2 border-t border-slate-800/60">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDeleteAccountStep("none")}
                      disabled={deleteAccountLoading}
                      className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
                    >
                      {tr(language, "Hủy bỏ", "Cancel")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleDeleteAccountVerifyName()}
                      disabled={deleteAccountLoading || deleteAccountNameInput !== profile?.full_name}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-5 border-0 shadow-lg shadow-rose-600/15 flex items-center gap-2"
                    >
                      {deleteAccountLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tr(language, "Tiếp tục", "Continue")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Account Dialog — Step 2: Leader Warning */}
              <Dialog open={deleteAccountStep === "leader_warning"} onOpenChange={(open) => {
                if (!open && !deleteAccountLoading) {
                  setDeleteAccountStep("none");
                }
              }}>
                <DialogContent className="sm:max-w-[520px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999] animate-in zoom-in-95 duration-200">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight text-amber-400 flex items-center gap-2.5">
                      <AlertTriangle className="h-5.5 w-5.5 text-amber-400 animate-pulse" />
                      {tr(language, "Cảnh báo: Bạn là Trưởng nhóm!", "Warning: You are a Project Leader!")}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 text-sm mt-1">
                      {tr(
                        language,
                        "Bạn hiện đang quản lý các dự án sau. Xóa tài khoản sẽ xóa vĩnh viễn tất cả các dự án này và đuổi mọi thành viên.",
                        "You are currently leading the following projects. Deleting your account will permanently delete all of them and kick every member."
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    {/* List of affected projects */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2.5 max-h-[200px] overflow-y-auto">
                      {ledProjects.map((proj) => (
                        <div
                          key={proj.id}
                          className="flex items-center justify-between bg-slate-950/40 border border-slate-800/60 rounded-xl px-3.5 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-amber-300 truncate">{proj.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{proj.memberCount} {tr(language, "thành viên", "members")}</p>
                          </div>
                          <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold uppercase py-0.5 px-2 shrink-0">
                            {tr(language, "Sẽ bị xóa", "Will be deleted")}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 text-sm leading-relaxed">
                      {tr(
                        language,
                        "Để xác nhận rằng bạn hiểu hệ quả, vui lòng nhập chính xác từ khóa bên dưới:",
                        "To confirm that you understand the consequences, please type the exact keyword below:"
                      )}
                      <div className="mt-3 font-mono bg-slate-950/60 border border-slate-800 rounded px-3 py-1.5 text-center text-rose-400 font-bold select-all tracking-wider text-base">
                        proceed
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {tr(language, "Nhập từ khóa xác nhận", "Confirmation Keyword")}
                      </Label>
                      <Input
                        required
                        autoFocus
                        value={deleteAccountProceedInput}
                        onChange={(e) => setDeleteAccountProceedInput(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 rounded-xl focus-visible:ring-rose-500 focus-visible:border-rose-500 py-5 font-mono text-center text-sm font-semibold"
                        placeholder={tr(language, "Nhập 'proceed' tại đây...", "Type 'proceed' here...")}
                      />
                    </div>
                  </div>

                  <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2 border-t border-slate-800/60">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setDeleteAccountStep("confirm_name");
                      }}
                      disabled={deleteAccountLoading}
                      className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50 flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {tr(language, "Quay lại", "Back")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void executeAccountDeletion()}
                      disabled={deleteAccountLoading || deleteAccountProceedInput !== "proceed"}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-5 border-0 shadow-lg shadow-rose-600/15 flex items-center gap-2"
                    >
                      {deleteAccountLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tr(language, "Tôi hiểu hệ quả, xóa tài khoản", "I understand, delete my account")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : activeTab === "Notification" ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Filter controls and mark all read */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNotifFilter("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                      notifFilter === "all"
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10 border border-indigo-500/20"
                        : "text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950/60 border border-transparent"
                    }`}
                  >
                    {tr(language, "Tất cả thông báo", "All Notifications")} ({notifications.length})
                  </button>
                  <button
                    onClick={() => setNotifFilter("unread")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 relative ${
                      notifFilter === "unread"
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10 border border-indigo-500/20"
                        : "text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950/60 border border-transparent"
                    }`}
                  >
                    {tr(language, "Chưa đọc", "Unread")} ({unreadCount})
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </button>
                </div>

                {unreadCount > 0 && (
                  <Button
                    onClick={markAllAsRead}
                    variant="ghost"
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20 rounded-xl flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    {tr(language, "Đánh dấu tất cả đã đọc", "Mark all as read")}
                  </Button>
                )}
              </div>

              {/* Notifications List */}
              {notifications.filter(n => notifFilter === "all" || !n.isRead).length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[350px] bg-slate-900/20 border-2 border-dashed border-slate-800/80 rounded-3xl p-8 shadow-inner animate-in fade-in duration-300">
                  <div className="p-5 rounded-full bg-slate-900 border border-slate-800 shadow-md text-slate-500 mb-4 animate-bounce">
                    <Mail className="h-10 w-10 opacity-60" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-200">
                    {tr(language, "Không có thông báo nào", "No Notifications Found")}
                  </h3>
                  <p className="text-sm text-slate-400 text-center max-w-xs mt-2">
                    {notifFilter === "unread"
                      ? tr(language, "Tất cả các thông báo của bạn đã được đọc.", "All of your notifications have been marked as read.")
                      : tr(language, "Hiện tại hộp thư thông báo của bạn trống.", "Your notification inbox is currently empty.")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {notifications
                    .filter(n => notifFilter === "all" || !n.isRead)
                    .map((notif) => {
                      const sourceGroup = findSourceProject(notif.content, notif.senderName);
                      const initials = notif.senderName.split(" ").pop()?.substring(0, 2).toUpperCase() || "US";
                      const isUnread = !notif.isRead;

                      return (
                        <div
                          key={notif.id}
                          onClick={() => isUnread && markAsRead(notif.id)}
                          className={`group relative bg-slate-900/40 hover:bg-slate-900/80 border rounded-2xl p-5 flex items-start gap-4 transition-all duration-300 transform hover:scale-[1.005] cursor-pointer shadow-lg select-none ${
                            isUnread
                              ? "border-indigo-500/30 hover:border-indigo-500/50 bg-indigo-950/5"
                              : "border-slate-800/80 hover:border-slate-700/80 opacity-70"
                          }`}
                        >
                          {/* Unread Left Border Highlight */}
                          {isUnread && (
                            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-indigo-500 rounded-l-2xl shadow-lg shadow-indigo-500/50" />
                          )}

                          {/* Avatar */}
                          <div
                            className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0 transition-transform duration-300 group-hover:scale-105"
                            style={{ background: getAvatarGradient(notif.senderName) }}
                          >
                            {initials}
                          </div>

                          {/* Content area */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-slate-100 group-hover:text-white transition-colors">
                                  {notif.senderName}
                                </span>

                                {/* Source Project Badge */}
                                {sourceGroup ? (
                                  <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-semibold tracking-wide uppercase py-0.5 px-2.5 rounded-lg">
                                    {tr(language, `Dự án: ${sourceGroup.name}`, `Project: ${sourceGroup.name}`)}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-slate-800 text-slate-400 border-0 text-[10px] font-semibold tracking-wide uppercase py-0.5 px-2.5 rounded-lg">
                                    {tr(language, "Chung", "General")}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {formatTime(notif.createdAt)}
                                </span>
                                {isUnread && (
                                  <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/50 animate-pulse shrink-0" />
                                )}
                              </div>
                            </div>

                            <p className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors leading-relaxed break-words font-medium">
                              {notif.content}
                            </p>
                          </div>

                          {/* Mark single as read hover action button */}
                          {isUnread && (
                            <div className="absolute right-4 bottom-4 sm:top-5 sm:bottom-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-all shadow-md">
                                <MailOpen className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : myGroups.length === 0 ? (
            /* EMPTY STATE OR REVEAL SPLIT BUTTON */
            <div className="flex items-center justify-center min-h-[450px]">
              {!showAddOptions ? (
                /* 1. Dotted Rounded Rectangle "+ Add Projects" */
                <button
                  onClick={() => setShowAddOptions(true)}
                  className="group w-full max-w-xl aspect-[16/10] border-2 border-dashed border-slate-800/80 hover:border-indigo-500/60 rounded-3xl p-8 flex flex-col items-center justify-center bg-slate-900/20 hover:bg-slate-900/40 shadow-inner transition-all duration-500 transform hover:scale-[1.01]"
                  id="add-projects-empty-btn"
                >
                  <div className="p-5 rounded-full bg-slate-900/80 border border-slate-800 group-hover:border-indigo-500/30 group-hover:bg-indigo-950/20 shadow-md transition-all duration-500 mb-5 relative overflow-hidden">
                    <Plus className="h-10 w-10 text-slate-400 group-hover:text-indigo-400 transition-colors duration-500 relative z-10" />
                    <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-200 group-hover:text-indigo-300 transition-colors duration-500">
                    {tr(language, "Thêm Dự án", "Add Projects")}
                  </h3>
                  <p className="text-sm text-slate-400 text-center max-w-xs mt-2 group-hover:text-slate-300 transition-colors duration-500">
                    {tr(
                      language,
                      "Bắt đầu bằng cách tạo một không gian làm việc mới hoặc tham gia vào nhóm dự án hiện có bằng ID.",
                      "Get started by creating a new workspace or joining an existing project group using an ID."
                    )}
                  </p>
                </button>
              ) : (
                /* 2. Split Button with Sibling Hover Opacity Drop */
                <div className="flex flex-col items-center gap-6 animate-in fade-in-0 zoom-in-95 duration-300">
                  <div className="flex items-center gap-4 bg-slate-900/40 p-4 rounded-3xl border border-slate-800/80 shadow-2xl relative group-hover-container">
                    {/* Create Button */}
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      onMouseEnter={() => setHoveredButton("create")}
                      onMouseLeave={() => setHoveredButton(null)}
                      className={`relative flex flex-col items-center justify-center p-8 w-60 aspect-square rounded-2xl border-2 border-indigo-500/40 bg-slate-900 hover:bg-indigo-950/15 hover:border-indigo-500 font-semibold text-white transition-all duration-300 shadow-lg shadow-indigo-950/20 overflow-hidden group ${hoveredButton === "join" ? "opacity-30 blur-[0.5px] border-slate-800" : "opacity-100"
                        }`}
                      id="create-project-split-btn"
                    >
                      <Laptop className="h-8 w-8 text-indigo-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
                      <span className="block text-slate-100 font-bold tracking-wide">
                        {tr(language, "Tạo dự án mới", "Create a new project")}
                      </span>
                      <span className="block text-xs text-indigo-300/70 font-medium text-center max-w-[140px] mt-2">
                        {tr(
                          language,
                          "Khởi tạo một workspace hoàn toàn mới với tư cách là chủ sở hữu.",
                          "Start a brand new workspace as the owner."
                        )}
                      </span>
                    </button>

                    {/* Join Button */}
                    <button
                      onClick={() => setIsJoinOpen(true)}
                      onMouseEnter={() => setHoveredButton("join")}
                      onMouseLeave={() => setHoveredButton(null)}
                      className={`relative flex flex-col items-center justify-center p-8 w-60 aspect-square rounded-2xl border-2 border-emerald-500/40 bg-slate-900 hover:bg-emerald-950/15 hover:border-emerald-500 font-semibold text-white transition-all duration-300 shadow-lg shadow-emerald-950/20 overflow-hidden group ${hoveredButton === "create" ? "opacity-30 blur-[0.5px] border-slate-800" : "opacity-100"
                        }`}
                      id="join-project-split-btn"
                    >
                      <Users className="h-8 w-8 text-emerald-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
                      <span className="block text-slate-100 font-bold tracking-wide">
                        {tr(language, "Tham gia dự án", "Join a project")}
                      </span>
                      <span className="block text-xs text-emerald-300/70 font-medium text-center max-w-[140px] mt-2">
                        {tr(
                          language,
                          "Kết nối tới dự án hiện có bằng mã ID dự án.",
                          "Connect to an existing workspace with a project ID."
                        )}
                      </span>
                    </button>
                  </div>

                  {/* Cancel / Return Button */}
                  <Button
                    variant="ghost"
                    onClick={() => setShowAddOptions(false)}
                    className="text-slate-400 hover:text-slate-200 gap-2 hover:bg-slate-900/60 rounded-xl"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {tr(language, "Quay lại", "Back to Add Projects")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ACTIVE PROJECTS GRID */
            <div className="space-y-6">
              {/* Pending Join Requests — applicant view */}
              {myPendingRequests.length > 0 && (
                <div className="space-y-3 mb-2">
                  {myPendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="bg-gradient-to-r from-amber-950/20 to-amber-900/10 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                        <Clock className="h-5 w-5 text-amber-400 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-amber-300">
                          {tr(language, "Yêu cầu tham gia đang chờ...", "Join request pending...")}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {tr(
                            language,
                            `Đang chờ Trưởng nhóm phê duyệt yêu cầu tham gia dự án "${req.group_name}"`,
                            `Waiting for the Project Leader to approve your request for "${req.group_name}"`
                          )}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Join Requests Management — Leader view */}
              {pendingJoinRequests.length > 0 && (
                <div className="bg-slate-900/40 border border-indigo-500/20 rounded-2xl p-5 space-y-4 mb-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-4.5 w-4.5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-slate-200">
                      {tr(language, "Yêu cầu tham gia", "Join Requests")} ({pendingJoinRequests.length})
                    </h3>
                  </div>
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                    {pendingJoinRequests.map((req) => {
                      const applicant = req.users && !Array.isArray(req.users) ? req.users : (Array.isArray(req.users) ? req.users[0] : null);
                      const applicantName = applicant?.full_name || "Unknown";
                      const applicantEmail = applicant?.email || "";
                      const nameInitials = applicantName.split(" ").pop()?.substring(0, 2).toUpperCase() || "??";
                      // Dynamic gradient based on name
                      const hue = applicantName.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;

                      return (
                        <div
                          key={req.id}
                          className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5 flex items-center gap-3 group hover:border-slate-700 transition-all"
                        >
                          {/* Gradient Avatar */}
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0"
                            style={{ background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 60) % 360}, 70%, 45%))` }}
                          >
                            {nameInitials}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-200 truncate">{applicantName}</p>
                            {applicantEmail && (
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">{applicantEmail}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-600 font-mono">{req.invite_id}</span>
                              <span className="text-[10px] text-slate-600">•</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(req.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={approvalLoading === req.id}
                              onClick={async () => {
                                setApprovalLoading(req.id);
                                try {
                                  await approveJoinRequest(req.id);
                                  toast({
                                    title: tr(language, "Đã phê duyệt!", "Approved!"),
                                    description: `${applicantName} ${tr(language, "đã được thêm vào dự án.", "has been added to the project.")}`,
                                  });
                                } catch (err) {
                                  toast({
                                    title: tr(language, "Lỗi", "Error"),
                                    description: String(err),
                                    variant: "destructive",
                                  });
                                } finally {
                                  setApprovalLoading(null);
                                }
                              }}
                              className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all"
                              title={tr(language, "Phê duyệt", "Approve")}
                            >
                              {approvalLoading === req.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={approvalLoading === req.id}
                              onClick={async () => {
                                setApprovalLoading(req.id);
                                try {
                                  await rejectJoinRequest(req.id);
                                  toast({
                                    title: tr(language, "Đã từ chối.", "Rejected."),
                                    description: `${applicantName} ${tr(language, "đã bị từ chối.", "was rejected.")}`,
                                  });
                                } catch (err) {
                                  toast({
                                    title: tr(language, "Lỗi", "Error"),
                                    description: String(err),
                                    variant: "destructive",
                                  });
                                } finally {
                                  setApprovalLoading(null);
                                }
                              }}
                              className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-all"
                              title={tr(language, "Từ chối", "Reject")}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* If split button opened when list is non-empty */}
              {showAddOptions && (
                <div className="bg-slate-900/30 border border-slate-800/80 p-8 rounded-3xl flex flex-col items-center gap-6 animate-in fade-in-0 duration-300 mb-8 shadow-inner">
                  <h3 className="font-bold text-slate-200">
                    {tr(language, "Bạn muốn thêm dự án theo cách nào?", "How would you like to add a project?")}
                  </h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      onMouseEnter={() => setHoveredButton("create")}
                      onMouseLeave={() => setHoveredButton(null)}
                      className={`relative flex flex-col items-center justify-center p-6 w-52 aspect-square rounded-2xl border-2 border-indigo-500/40 bg-slate-955 hover:bg-indigo-950/15 hover:border-indigo-500 font-semibold text-white transition-all duration-300 shadow-md ${hoveredButton === "join" ? "opacity-30 border-slate-900" : "opacity-100"
                        }`}
                    >
                      <Laptop className="h-7 w-7 text-indigo-400 mb-3" />
                      <span className="block text-sm text-slate-200 font-bold">
                        {tr(language, "Tạo dự án mới", "Create a new project")}
                      </span>
                    </button>

                    <button
                      onClick={() => setIsJoinOpen(true)}
                      onMouseEnter={() => setHoveredButton("join")}
                      onMouseLeave={() => setHoveredButton(null)}
                      className={`relative flex flex-col items-center justify-center p-6 w-52 aspect-square rounded-2xl border-2 border-emerald-500/40 bg-slate-955 hover:bg-emerald-950/15 hover:border-emerald-500 font-semibold text-white transition-all duration-300 shadow-md ${hoveredButton === "create" ? "opacity-30 border-slate-900" : "opacity-100"
                        }`}
                    >
                      <Users className="h-7 w-7 text-emerald-400 mb-3" />
                      <span className="block text-sm text-slate-200 font-bold">
                        {tr(language, "Tham gia dự án", "Join a project")}
                      </span>
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddOptions(false)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    {tr(language, "Hủy bỏ", "Cancel")}
                  </Button>
                </div>
              )}

              {/* GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myGroups.map((group) => {
                  const originalIndex = groups.findIndex(g => g.id === group.id);
                  const role = determineUserRole(group as Group & { lecturer_id?: string }, originalIndex);
                  const color = getProjectColor(group.id);
                  const createdAt = (group as Group & { created_at?: string }).created_at
                    ? new Date((group as Group & { created_at?: string }).created_at!).toISOString().split("T")[0]
                    : "2026-05-23";

                  return (
                    <div
                      key={group.id}
                      className="group bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-indigo-500/40 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 flex flex-col justify-between"
                    >
                      {/* Glassmorphic/Gradient Header */}
                      <div className={`h-28 bg-gradient-to-tr ${color} p-5 flex flex-col justify-between relative`}>
                        {/* Gradient glow inside */}
                        <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px]" />

                        <div className="flex justify-between items-start relative z-10">
                          <Badge
                            className={`backdrop-blur-md font-semibold text-xs py-1 px-2.5 rounded-lg border-0 shadow-md ${role === "Owner" || role === "Lecturer"
                              ? "bg-white/25 text-white"
                              : "bg-black/35 text-white"
                              }`}
                          >
                            {role === "Owner"
                              ? tr(language, "Chủ sở hữu", "Owner")
                              : role === "Lecturer"
                                ? tr(language, "Giảng viên", "Lecturer")
                                : tr(language, "Thành viên", "Member")}
                          </Badge>
                        </div>

                        <h3 className="font-extrabold text-lg text-white truncate drop-shadow-sm relative z-10 leading-tight">
                          {group.name}
                        </h3>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-4.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          {/* Members count & Created date */}
                          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-slate-500" />
                              <span>
                                {group.members?.length || 0}{" "}
                                {tr(language, "thành viên", "members")}
                              </span>
                            </div>
                            <span>
                              {tr(language, "Tạo", "Created")} {createdAt}
                            </span>
                          </div>
                        </div>

                        {/* Launch Workspace Button */}
                        <Button
                          onClick={() => handleLaunchWorkspace(originalIndex, group.name)}
                          className="w-full mt-2 bg-slate-800 hover:bg-indigo-600 border border-slate-700/60 hover:border-indigo-500/25 text-slate-200 hover:text-white rounded-xl py-2.5 transition-all duration-300 font-bold shadow-md hover:shadow-indigo-600/10 flex items-center justify-center gap-2 group/launch cursor-pointer"
                        >
                          {tr(language, "Vào Workspace", "Launch Workspace")}
                          <ArrowLeft className="h-4 w-4 rotate-180 transition-transform duration-300 group-hover/launch:translate-x-1" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-20 border-t border-slate-900 pt-6 max-w-6xl w-full mx-auto flex items-center justify-between text-xs font-semibold text-slate-500 z-10">
          <span>&copy; 2026 Teamfair. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer">
              {tr(language, "Điều khoản dịch vụ", "Terms of Service")}
            </span>
            <span className="hover:text-slate-400 cursor-pointer">
              {tr(language, "Chính sách bảo mật", "Privacy Policy")}
            </span>
          </div>
        </footer>
      </main>

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => !isLoading && setIsCreateOpen(open)}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
              <Laptop className="h-5 w-5 text-indigo-400" />
              {tr(language, "Tạo dự án mới", "Create a new project")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1">
              {tr(
                language,
                "Nhập tên cho không gian làm việc dự án mới của bạn. Bạn sẽ tự động được chỉ định làm Chủ sở hữu dự án.",
                "Enter a name for your new project workspace. You will be automatically assigned as the project Owner."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-2">
            <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">
              {tr(language, "Tên dự án", "Project Name")}
            </label>
            <Input
              id="new-project-name"
              placeholder="e.g. NextGen Web App"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isLoading}
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all py-5 font-medium"
            />
          </div>
          <DialogFooter className="flex items-center gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              disabled={isLoading}
              className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
            >
              {tr(language, "Hủy bỏ", "Cancel")}
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl px-5 transition-all flex items-center gap-2 border-0 shadow-lg shadow-indigo-600/10"
              id="submit-create-project-btn"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  {tr(language, "Đang tạo...", "Creating...")}
                </>
              ) : (
                tr(language, "Tạo dự án", "Create Project")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JOIN MODAL */}
      <Dialog open={isJoinOpen} onOpenChange={(open) => !isLoading && setIsJoinOpen(open)}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              {tr(language, "Tham gia dự án", "Join a project")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1">
              {tr(
                language,
                "Dán mã Project ID (UUID) do chủ sở hữu dự án cung cấp để tham gia vào không gian làm việc của họ.",
                "Paste the Project ID (UUID) provided by the project owner to join their active workspace."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-2">
            <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
              {tr(language, "Mã mời (Invite Code)", "Invite Code")}
            </label>
            <Input
              id="join-project-id"
              placeholder="e.g. IV-A1B2C3"
              value={projectIdInput}
              onChange={(e) => setProjectIdInput(e.target.value.toUpperCase())}
              disabled={isLoading}
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition-all py-5 font-mono text-sm tracking-wider text-center"
            />
          </div>
          <DialogFooter className="flex items-center gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsJoinOpen(false)}
              disabled={isLoading}
              className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
            >
              {tr(language, "Hủy bỏ", "Cancel")}
            </Button>
            <Button
              onClick={handleJoinProject}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-5 transition-all flex items-center gap-2 border-0 shadow-lg shadow-emerald-600/10"
              id="submit-join-project-btn"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  {tr(language, "Đang tham gia...", "Joining...")}
                </>
              ) : (
                tr(language, "Tham gia dự án", "Join Project")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UID MEMBER ADD MODAL */}
      <Dialog open={isUidAddOpen} onOpenChange={(open) => !searchLoading && setIsUidAddOpen(open)}>
        <DialogContent className="sm:max-w-[460px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999] animate-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2">
              <Users className="h-5.5 w-5.5 text-indigo-400" />
              {tr(language, "Thêm thành viên", "Add Team Members")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1">
              {tr(
                language,
                "Tìm và thêm thành viên hoặc giảng viên vào dự án của bạn bằng UID của họ.",
                "Search and add students or lecturers to your new project using their Supabase UID."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Search Input Box */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-indigo-400 uppercase tracking-widest block">
                {tr(language, "Nhập UID người dùng", "Enter User UID")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g. f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
                  value={uidInput}
                  onChange={(e) => setUidInput(e.target.value)}
                  disabled={searchLoading}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all font-mono text-sm flex-1"
                />
                <Button
                  onClick={handleSearchUid}
                  disabled={searchLoading || !uidInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(language, "Tìm", "Search")}
                </Button>
              </div>
            </div>

            {/* Found User Result Card */}
            {searchedUser && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-inner">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-200">{searchedUser.full_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{searchedUser.email}</p>
                  </div>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold text-[10px] uppercase py-0.5 px-2">
                    {searchedUser.role}
                  </Badge>
                </div>
                <Button
                  onClick={handleAddMemberByUid}
                  disabled={searchLoading}
                  className="w-full bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white font-bold rounded-xl py-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "+ " + tr(language, "Thêm vào dự án", "Add to Project")}
                </Button>
              </div>
            )}

            {/* Added Members List */}
            {addedMembers.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {tr(language, "Thành viên đã thêm", "Added Members")} ({addedMembers.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {addedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="bg-slate-950/30 border border-slate-900 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="block font-bold text-slate-300 truncate">{member.full_name}</span>
                        <span className="block text-[10px] text-slate-500 truncate mt-0.5">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-800 text-slate-400 border-0 text-[9px] uppercase py-0.5 px-1.5 font-semibold">
                          {member.projectRole}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2 border-t border-slate-800/60">
            <Button
              onClick={() => {
                setIsUidAddOpen(false);
                setNewCreatedGroupId(null);
                setAddedMembers([]);
                window.location.reload();
              }}
              className="w-full bg-slate-850 hover:bg-slate-750 text-white font-bold rounded-xl py-3 border-0 shadow-md cursor-pointer"
            >
              {tr(language, "Hoàn tất & Tiếp tục", "Complete & Continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectManagement;
