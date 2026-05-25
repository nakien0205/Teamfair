import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Folder, Calendar, History, Settings, Plus, Copy, Trash2, ArrowLeft, Loader2, Users, Compass, Laptop, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";

const ProjectManagement: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { groups, setCurrentGroupIndex, createProject, joinProject, currentUserName } = useTeam();
  const { user, profile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<string>("All Projects");
  const [showAddOptions, setShowAddOptions] = useState<boolean>(false);
  const [hoveredButton, setHoveredButton] = useState<"create" | "join" | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isJoinOpen, setIsJoinOpen] = useState<boolean>(false);
  const [projectName, setProjectName] = useState<string>("");
  const [projectIdInput, setProjectIdInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
        await createProject(name);
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
        description: tr(language, "Vui lòng nhập Project ID hợp lệ.", "Please enter a valid Project ID."),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Simulate loading for 1.2s then join
    setTimeout(async () => {
      try {
        await joinProject(trimmedId);
        setIsLoading(false);
        setIsJoinOpen(false);
        setProjectIdInput("");
        setShowAddOptions(false);

        toast({
          title: tr(language, "Tham gia dự án thành công!", "Successfully Joined Project!"),
          description: tr(
            language,
            "Bạn hiện là thành viên của dự án này.",
            "You are now a member of this project."
          ),
        });
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

  const determineUserRole = (group: any, index: number) => {
    const isDemo = sessionStorage.getItem("demo_session") || !user?.id;
    if (isDemo) {
      if (group.id === "g1") return "Owner";
      if (group.id === "g2") return "Member";
      if (group.id === "g3") return "Member";
      // Fallback for demo groups created dynamically
      const isLeader = group.members?.some((m: any) => m.name === currentUserName && m.role === "Leader");
      return isLeader ? "Owner" : "Member";
    }

    // Real Supabase Auth mapping
    const member = group.members?.find(
      (m: any) => m.id === user?.id || (profile?.full_name && m.name === profile.full_name)
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
    const redirectPath = role === "lecturer" || role === "admin" ? "/dashboard-lecturer" : "/dashboard-student";

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

  const sidebarItems = [
    { name: "All Projects", labelVi: "Tất cả dự án", labelEn: "All Projects", icon: Folder },
    { name: "Global Calendar", labelVi: "Lịch chung", labelEn: "Global Calendar", icon: Calendar },
    { name: "Activity Logs", labelVi: "Nhật ký hoạt động", labelEn: "Activity Logs", icon: History },
    { name: "Workspace Settings", labelVi: "Cấu hình Workspace", labelEn: "Workspace Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
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
                    setActiveTab(item.name);
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
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 group relative overflow-hidden ${
                    isActive
                      ? "text-white bg-indigo-600/10 border-l-[3px] border-indigo-500 shadow-inner shadow-indigo-500/5"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-l-[3px] border-transparent"
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${
                      isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"
                    }`}
                  />
                  {label}
                  {isActive && (
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
            onClick={() => signOut().then(() => navigate("/login"))}
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
            {groups.length > 0 && (
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
          {groups.length === 0 ? (
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
                      className={`relative flex flex-col items-center justify-center p-8 w-60 aspect-square rounded-2xl border-2 border-indigo-500/40 bg-slate-900 hover:bg-indigo-950/15 hover:border-indigo-500 font-semibold text-white transition-all duration-300 shadow-lg shadow-indigo-950/20 overflow-hidden group ${
                        hoveredButton === "join" ? "opacity-30 blur-[0.5px] border-slate-800" : "opacity-100"
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
                      className={`relative flex flex-col items-center justify-center p-8 w-60 aspect-square rounded-2xl border-2 border-emerald-500/40 bg-slate-900 hover:bg-emerald-950/15 hover:border-emerald-500 font-semibold text-white transition-all duration-300 shadow-lg shadow-emerald-950/20 overflow-hidden group ${
                        hoveredButton === "create" ? "opacity-30 blur-[0.5px] border-slate-800" : "opacity-100"
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
                      className={`relative flex flex-col items-center justify-center p-6 w-52 aspect-square rounded-2xl border-2 border-indigo-500/40 bg-slate-955 hover:bg-indigo-950/15 hover:border-indigo-500 font-semibold text-white transition-all duration-300 shadow-md ${
                        hoveredButton === "join" ? "opacity-30 border-slate-900" : "opacity-100"
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
                      className={`relative flex flex-col items-center justify-center p-6 w-52 aspect-square rounded-2xl border-2 border-emerald-500/40 bg-slate-955 hover:bg-emerald-950/15 hover:border-emerald-500 font-semibold text-white transition-all duration-300 shadow-md ${
                        hoveredButton === "create" ? "opacity-30 border-slate-900" : "opacity-100"
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
                {groups.map((group, index) => {
                  const role = determineUserRole(group, index);
                  const color = getProjectColor(group.id);
                  const createdAt = (group as any).created_at
                    ? new Date((group as any).created_at).toISOString().split("T")[0]
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
                            className={`backdrop-blur-md font-semibold text-xs py-1 px-2.5 rounded-lg border-0 shadow-md ${
                              role === "Owner" || role === "Lecturer"
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
                          {/* Project ID */}
                          <div className="bg-slate-950/60 border border-slate-900/60 rounded-xl p-3 flex items-center justify-between gap-2 shadow-inner">
                            <span className="text-[10px] font-mono text-slate-400 truncate flex-1 tracking-tight select-all">
                              {group.id}
                            </span>
                            <button
                              onClick={() => handleCopyId(group.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/20 border border-transparent hover:border-indigo-500/20 transition-all duration-200 cursor-pointer shrink-0"
                              title="Copy Project ID"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>

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
                          onClick={() => handleLaunchWorkspace(index, group.name)}
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
              {tr(language, "Project ID (UUID)", "Project ID (UUID)")}
            </label>
            <Input
              id="join-project-id"
              placeholder="e.g. f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
              value={projectIdInput}
              onChange={(e) => setProjectIdInput(e.target.value)}
              disabled={isLoading}
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition-all py-5 font-mono text-sm"
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
    </div>
  );
};

export default ProjectManagement;
