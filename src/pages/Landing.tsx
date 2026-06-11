import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import LanguageSwitcherButton from '@/components/LanguageSwitcherButton';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { t, tr } from "@/lib/i18n";
import { dashboardPathForRole } from '@/lib/dashboardPath';
import {
  Users, ArrowRight, BarChart3, CheckCircle,
  LayoutDashboard, FileText, CheckSquare,
  SplitSquareHorizontal, Star, ShieldCheck, Scale, History, FileArchive,
  GraduationCap, UserCog, FileSignature, LogOut
} from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { session, profile, signOut } = useAuth();

  const handleDashboardRedirect = () => {
    if (session && profile) {
      navigate(dashboardPathForRole(profile.role));
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* 1. Navigation bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Users className="h-6 w-6" />
            <span className="font-display text-xl font-bold tracking-tight">TeamFair</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#tong-quan" className="hover:text-indigo-600 transition-colors">{tr(language, "Tổng quan", "Overview")}</a>
            <a href="#cach-hoat-dong" className="hover:text-indigo-600 transition-colors">{tr(language, "Cách hoạt động", "How it Works")}</a>
            <a href="#tinh-nang" className="hover:text-indigo-600 transition-colors">{tr(language, "Tính năng", "Features")}</a>
            <a href="#vai-tro" className="hover:text-indigo-600 transition-colors">{tr(language, "Đối tượng sử dụng", "Target Users")}</a>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block"><LanguageSwitcherButton /></div>
            {session && profile ? (
              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-slate-200 hover:bg-slate-100 p-0 overflow-hidden">
                      <Avatar className="h-full w-full">
                        <AvatarImage src="" alt={profile.full_name} />
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 font-medium">
                          {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile.full_name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDashboardRedirect} className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>{tr(language, "Vào Dashboard", "Go to Dashboard")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button className="hidden sm:flex bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all" onClick={handleDashboardRedirect}>
                  {tr(language, "Vào Dashboard", "Go to Dashboard")}
                </Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" className="hidden sm:inline-flex text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors" onClick={() => navigate('/login')}>
                  {tr(language, "Đăng nhập", "Log in")}
                </Button>
                <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 hover:-translate-y-0.5 transition-all" onClick={() => navigate('/login')}>
                  {tr(language, "Bắt đầu ngay", "Start now")}
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section id="tong-quan" className="relative pt-20 pb-24 md:pt-32 md:pb-36 overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white">
        {/* Soft background circles */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-300/20 rounded-full blur-3xl -z-10 animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-violet-300/20 rounded-full blur-3xl -z-10 animate-float-delayed"></div>

        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* Hero Text */}
            <div className="lg:w-1/2 text-center lg:text-left z-10">
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-6">
                <Badge variant="secondary" className="bg-indigo-100/80 text-indigo-700 hover:bg-indigo-200 px-3 py-1 text-sm rounded-full border border-indigo-200/50 backdrop-blur-sm transition-colors">
                  {tr(language, "Minh bạch đóng góp", "Transparent Contribution")}
                </Badge>
                <Badge variant="secondary" className="bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200 px-3 py-1 text-sm rounded-full border border-emerald-200/50 backdrop-blur-sm transition-colors">
                  {tr(language, "Giảm tranh cãi", "Reduced Disputes")}
                </Badge>
              </div>

              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 text-slate-900 leading-[1.1]">
                {tr(language, "Công bằng hơn trong", "Fairer in")} <br className="hidden lg:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">
                  {tr(language, "đánh giá teamwork", "teamwork evaluation")}
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                {tr(language, "TeamFair giúp giảng viên theo dõi tiến độ nhóm, xem minh chứng làm việc, phân tích điểm đóng góp và chấm điểm bằng rubric một cách minh bạch.", "TeamFair helps instructors track group progress, view work evidence, analyze contribution points, and grade using rubrics transparently.")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {session ? (
                  <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-base h-14 px-8 rounded-full shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-1 transition-all" onClick={handleDashboardRedirect}>
                    {tr(language, "Vào Workspace", "Go to Workspace")} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                ) : (
                  <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-base h-14 px-8 rounded-full shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-1 transition-all" onClick={() => navigate('/login')}>
                    {tr(language, "Tạo Workspace miễn phí", "Create free Workspace")} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
                <Button size="lg" variant="outline" className="text-base h-14 px-8 rounded-full border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 hover:-translate-y-1 transition-all shadow-sm" onClick={() => {
                  document.getElementById('cach-hoat-dong')?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  {tr(language, "Xem cách hoạt động", "See how it works")}
                </Button>
              </div>
            </div>

            {/* Hero Visual Mockup */}
            <div className="lg:w-1/2 w-full relative z-10 perspective-1000 mt-10 lg:mt-0">
              {/* Main Dashboard Panel */}
              <div className="w-full max-w-lg mx-auto lg:ml-auto relative animate-float">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 rounded-3xl transform translate-x-3 translate-y-3 -z-10 blur-md"></div>
                <div className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl p-4 md:p-6 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400"></div>

                  {/* Mockup Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="font-semibold text-slate-900">{tr(language, "Project Workspace", "Project Workspace")}</span>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">{tr(language, "Đang diễn ra", "In Progress")}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Top Left Card - Task Progress */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 col-span-2 md:col-span-1 hover:border-indigo-200 transition-colors">
                      <div className="flex items-center text-sm font-medium text-slate-500 mb-2">
                        <CheckSquare className="w-4 h-4 mr-2 text-indigo-500" /> {tr(language, "Tiến độ Task", "Task Progress")}
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mb-2">24<span className="text-sm text-slate-400 font-normal">/30</span></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full w-[80%]"></div>
                      </div>
                    </div>

                    {/* Top Right Card - Evidence */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 col-span-2 md:col-span-1 hover:border-violet-200 transition-colors">
                      <div className="flex items-center text-sm font-medium text-slate-500 mb-2">
                        <FileArchive className="w-4 h-4 mr-2 text-violet-500" /> {tr(language, "Minh chứng", "Evidence")}
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mb-2">18 <span className="text-sm text-slate-400 font-normal">{tr(language, "files", "files")}</span></div>
                      <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white"></div>
                        ))}
                      </div>
                    </div>

                    {/* Full Width Card - Contribution Score */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-5 shadow-sm border border-indigo-100 col-span-2 relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500/5 rounded-tl-full"></div>
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="flex items-center text-sm font-semibold text-indigo-900">
                          <BarChart3 className="w-4.5 h-4.5 mr-2 text-indigo-600" /> {tr(language, "Contribution Score", "Contribution Score")}
                        </div>
                        <div className="text-2xl font-black text-indigo-600">87%</div>
                      </div>
                      <div className="space-y-3 relative z-10">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">{tr(language, "Nguyễn Văn A", "Nguyễn Văn A")}</span>
                            <span className="font-bold text-indigo-700"> {tr(language, "45%", "45%")}</span>
                          </div>
                          <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full w-[45%]"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">{tr(language, "Trần Thị B", "Trần Thị B")}</span>
                            <span className="font-bold text-emerald-600"> {tr(language, "42%", "42%")}</span>
                          </div>
                          <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full w-[42%]"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Element 1 - Peer Review */}
                <div className="absolute -left-8 md:-left-12 top-24 bg-white rounded-xl p-3 md:p-4 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-3 animate-float-delayed z-20 hover:scale-105 transition-transform">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Star className="w-4 h-4 md:w-5 md:h-5"/></div>
                  <div>
                    <div className="text-xs md:text-sm font-bold text-slate-900">{tr(language, "Peer Review", "Peer Review")}</div>
                    <div className="text-[10px] md:text-xs text-slate-500">{tr(language, "Hoàn thành 4/4 •", "Completed 4/4 •")} <span className="text-amber-600 font-semibold">4.6/5</span></div>
                  </div>
                </div>

                {/* Floating Element 2 - Rubric Grade */}
                <div className="absolute -right-4 md:-right-10 bottom-12 bg-white rounded-xl p-3 md:p-4 shadow-xl shadow-indigo-200/40 border border-indigo-50 flex items-center gap-3 animate-float-slow z-20 hover:scale-105 transition-transform">
                  <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><FileSignature className="w-4 h-4 md:w-5 md:h-5"/></div>
                  <div>
                    <div className="text-xs md:text-sm font-bold text-slate-900">{tr(language, "Rubric Grade", "Rubric Grade")}</div>
                    <div className="text-[10px] md:text-xs text-slate-500">{tr(language, "Trạng thái:", "Status:")} <span className="text-indigo-600 font-semibold bg-indigo-50 px-1 rounded">{tr(language, "Bản nháp", "Draft")}</span></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Problem Section */}
      <section className="py-20 md:py-28 bg-white border-y border-slate-100 relative">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{tr(language, "Vấn đề trong teamwork sinh viên", "Problems in Student Teamwork")}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{tr(language, "Những khó khăn thường gặp khiến việc đánh giá làm việc nhóm thiếu chính xác và dễ gây bất mãn.", "Common challenges that make group evaluation inaccurate and prone to dissatisfaction.")}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              { title: tr(language, "Chia điểm không công bằng", "Unequal Grading"), desc: tr(language, "Một số thành viên đóng góp ít nhưng vẫn nhận điểm như cả nhóm.", "Some members contribute little but still receive the same grade as the entire group."), icon: Scale, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", hoverShadow: "hover:shadow-rose-100/50" },
              { title: tr(language, "Thiếu minh chứng làm việc", "Lack of Work Evidence"), desc: tr(language, "Giảng viên khó biết ai thật sự làm gì, làm khi nào và đóng góp bao nhiêu.", "Instructors find it difficult to know who actually did what, when, and how much they contributed."), icon: FileArchive, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", hoverShadow: "hover:shadow-amber-100/50" },
              { title: tr(language, "Khó theo dõi tiến độ", "Difficulty Tracking Progress"), desc: tr(language, "Nhóm làm việc rời rạc, task không rõ ràng, deadline dễ bị trễ.", "Groups work in a scattered manner, tasks are unclear, and deadlines are easily missed."), icon: History, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", hoverShadow: "hover:shadow-blue-100/50" },
              { title: tr(language, "Mâu thuẫn trong nhóm", "Conflicts Within the Group"), desc: tr(language, "Thiếu dữ liệu minh bạch khiến việc đánh giá dễ gây tranh cãi.", "Lack of transparent data makes evaluation prone to disputes."), icon: Users, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100", hoverShadow: "hover:shadow-purple-100/50" }
            ].map((item, i) => (
              <div key={i} className={`bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg ${item.hoverShadow} hover:border-slate-200 transition-all duration-300 group`}>
                <div className={`${item.bg} ${item.color} ${item.border} border w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Solution Section */}
      <section id="cach-hoat-dong" className="py-20 md:py-28 bg-slate-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{tr(language, "TeamFair biến teamwork thành quá trình có dữ liệu", "TeamFair makes teamwork a data-driven process")}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{tr(language, "Giải pháp toàn diện giúp minh bạch hóa quá trình làm việc nhóm thông qua 3 trụ cột chính.", "A comprehensive solution that helps transparentize the group work process through 3 main pillars.")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-indigo-200 via-emerald-200 to-violet-200 -z-10 opacity-50"></div>

            <div className="text-center relative group">
              <div className="bg-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md border border-indigo-100 rotate-3 group-hover:rotate-0 group-hover:-translate-y-2 transition-all duration-300">
                <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center">
                  <CheckSquare className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
              <h3 className="font-bold text-xl text-slate-900 mb-3">{tr(language, "1. Theo dõi công việc", "1. Task Tracking")}</h3>
              <p className="text-slate-600 mb-4 px-2">{tr(language, "Quản lý Task, Deadline, Trạng thái và Người phụ trách một cách rõ ràng.", "Manage tasks, deadlines, statuses, and responsible persons clearly.")}</p>
            </div>

            <div className="text-center relative group">
              <div className="bg-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md border border-emerald-100 -rotate-3 group-hover:rotate-0 group-hover:-translate-y-2 transition-all duration-300">
                <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center">
                  <FileText className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
              <h3 className="font-bold text-xl text-slate-900 mb-3">{tr(language, "2. Ghi nhận minh chứng", "2. Evidence Collection")}</h3>
              <p className="text-slate-600 mb-4 px-2">{tr(language, "Lưu trữ File nộp, Evidence, Work logs và Activity history của từng cá nhân.", "Store submitted files, evidence, work logs, and activity histories of each individual.")}</p>
            </div>

            <div className="text-center relative group">
              <div className="bg-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md border border-violet-100 rotate-3 group-hover:rotate-0 group-hover:-translate-y-2 transition-all duration-300">
                <div className="bg-violet-50 w-16 h-16 rounded-2xl flex items-center justify-center">
                  <Scale className="w-8 h-8 text-violet-600" />
                </div>
              </div>
              <h3 className="font-bold text-xl text-slate-900 mb-3">{tr(language, "3. Chấm điểm công bằng", "3. Fair Grading")}</h3>
              <p className="text-slate-600 mb-4 px-2">{tr(language, "Hỗ trợ Contribution score, Peer review, Rubric grading và Feedback.", "Supports contribution scores, peer reviews, rubric grading, and feedback.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Core Features Section */}
      <section id="tinh-nang" className="py-20 md:py-28 bg-white border-y border-slate-100 relative">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)] opacity-50"></div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="mb-16 md:text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{tr(language, "Tính năng cốt lõi", "Core Features")}</h2>
            <p className="text-lg text-slate-600">{tr(language, "Mọi công cụ cần thiết để quản lý, theo dõi và đánh giá đồ án nhóm được tích hợp trong một nền tảng duy nhất.", "All necessary tools for managing, tracking, and evaluating group projects are integrated into a single platform.")}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {[
              { title: { vi: "Quản lý dự án", en: "Project Management" }, desc: { vi: "Admin tạo dự án, phân công giảng viên, quản lý nhóm và sinh viên.", en: "Admin creates projects, assigns instructors, manages teams and students." }, icon: LayoutDashboard },
              { title: { vi: "Quản lý nhóm", en: "Team Management" }, desc: { vi: "Theo dõi thành viên, nhóm, vai trò và tiến độ làm việc của từng nhóm.", en: "Track members, teams, roles, and progress of each team." }, icon: Users },
              { title: { vi: "Quản lý Task", en: "Task Management" }, desc: { vi: "Sinh viên tạo task, phân công người làm, đặt deadline và cập nhật trạng thái.", en: "Students create tasks, assign people to do them, set deadlines, and update their status." }, icon: CheckSquare },
              { title: { vi: "Minh chứng & Work Logs", en: "Evidence & Work Logs" }, desc: { vi: "Lưu lại file, link, mô tả công việc và lịch sử hoạt động của từng thành viên.", en: "Store files, links, task descriptions, and activity history of each member." }, icon: FileArchive },
              { title: { vi: "Peer Review", en: "Peer Review" }, desc: { vi: "Thành viên đánh giá chéo để phản ánh mức độ đóng góp thực tế trong nhóm.", en: "Members review each other to reflect their actual contribution within the team." }, icon: Star },
              { title: { vi: "Contribution Score", en: "Contribution Score" }, desc: { vi: "Tổng hợp task, deadline, evidence, work log và peer review để hỗ trợ đánh giá.", en: "Aggregate tasks, deadlines, evidence, work logs, and peer reviews to support evaluation." }, icon: BarChart3 },
              { title: { vi: "Rubric Management", en: "Rubric Management" }, desc: { vi: "Giảng viên upload Excel/CSV rubric, hệ thống chuyển thành bảng chấm điểm tương tác.", en: "Instructors upload Excel/CSV rubrics, and the system converts them into interactive grading tables." }, icon: FileSignature },
              { title: { vi: "Split-screen Grading", en: "Split-screen Grading" }, desc: { vi: "Giảng viên vừa xem bài nộp của sinh viên, vừa chấm rubric trên cùng một màn hình.", en: "Instructors can view student submissions and grade rubrics on the same screen." }, icon: SplitSquareHorizontal },
              { title: { vi: "Báo cáo & Xuất điểm", en: "Report & Export Grades" }, desc: { vi: "Tổng hợp kết quả chấm, contribution score và feedback để hỗ trợ báo cáo cuối kỳ.", en: "Aggregate grading results, contribution scores, and feedback to support final semester reporting." }, icon: FileText }
            ].map((item, i) => (
              <Card key={i} className="border-slate-100 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200 hover:shadow-indigo-100/50 transition-all duration-300 bg-white/80 backdrop-blur-sm group">
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 transition-colors duration-300">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900">{item.title[language as keyof typeof item.title] || item.title.en}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-600 text-sm leading-relaxed">{item.desc[language as keyof typeof item.desc] || item.desc.en}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Role-based Features */}
      <section id="vai-tro" className="py-20 md:py-28 bg-indigo-50/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16 md:mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{language === "vi" ? "Phù hợp cho mọi vai trò" : "Suitable for All Roles"}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{language === "vi" ? "Trải nghiệm được tối ưu riêng biệt cho từng đối tượng sử dụng hệ thống." : "Experience optimized for each type of system user."}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Student */}
            <div id="sinh-vien" className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 hover:-translate-y-1 transition-all duration-300 group">
    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
      <GraduationCap className="w-8 h-8" />
    </div>
    <h3 className="text-2xl font-bold text-slate-900 mb-2">{language === "vi" ? "Miễn phí" : "FREE"}</h3>
    <div className="flex items-baseline gap-1 mb-6 text-sm text-slate-500 font-medium">
      <span className="text-xl font-bold text-blue-600">{language === "vi" ? "0đ/tháng" : "$0/month"}</span>
      <span>{language === "vi" ? "· mãi miễn phí" : "· forever free"}</span>
    </div>
    <ul className="space-y-4">
      {[
        /* --- NHÓM & THÀNH VIÊN --- */
        { type: "section", text: language === "vi" ? "NHÓM & THÀNH VIÊN" : "TEAM & MEMBERS" },
        { type: "check", text: language === "vi" ? "1 nhóm · tối đa 6 thành viên" : "1 team · max 6 members" },
        { type: "check", text: language === "vi" ? "Tối đa 20 task/nhóm" : "Max 20 tasks/team" },
        { type: "check", text: language === "vi" ? "Phân công nhiệm vụ + set deadline" : "Assign tasks + set deadlines"},

        /* --- THEO DÕI & SUBMIT --- */
        { type: "section", text: language === "vi" ? "THEO DÕI & SUBMIT" : "TRACK & SUBMIT" },
        { type: "check", text: language === "vi" ? "Tiến độ tổng quan (% hoàn thành)" : "Overall progress (% completed)" },
        { type: "check", text: language === "vi" ? "Submit file trong task (200 MB storage)" : "Submit files in tasks (200 MB storage)" },
        { type: "check", text: language === "vi" ? "Kết nối 1 giảng viên xem tiến độ" : "Connect 1 instructor to view progress" },

        /* --- BỊ KHÓA — CẦN NÂNG CẤP --- */
        { type: "section", text: language === "vi" ? "BỊ KHÓA — CẦN NÂNG CẤP" : "LOCKED — UPGRADE REQUIRED" },
        { type: "lock", text: language === "vi" ? "Biểu đồ đóng góp cá nhân" : "Individual contribution chart" },
        { type: "lock", text: language === "vi" ? "Thống kê đúng/trễ hạn từng người" : "On-time/late statistics per person" },
        { type: "lock", text: language === "vi" ? "Reminder tự động (app + email)" : "Automated reminders (app + email)" },
        { type: "lock", text: language === "vi" ? "Xuất báo cáo cho giảng viên" : "Export reports for instructors" },
        { type: "lock", text: language === "vi" ? "Nhiều nhóm/project song song" : "Multiple groups/projects in parallel" },
        { type: "lock", text: language === "vi" ? "Gantt chart & milestone" : "Gantt chart & milestones" }
      ].map((item, i) => (
        <li key={i} className="flex items-start">
          {item.type === "section" ? (
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block mt-2 mb-1 w-full">{item.text}</span>
          ) : (
            <>
              <CheckCircle className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${item.type === "lock" ? "text-slate-300 opacity-60" : "text-blue-500"}`} />
              <span className={`leading-snug ${item.type === "lock" ? "text-slate-400 line-through decoration-slate-200" : "text-slate-700"}`}>{item.text}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  </div>

            {/* Lecturer */}
            <div id="giang-vien" className="bg-white p-8 rounded-3xl border-2 border-indigo-200 relative shadow-xl shadow-indigo-100/80 md:-translate-y-4 hover:-translate-y-6 transition-transform duration-300 group">
    <div className="absolute top-0 right-0 p-5">
      <Badge className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-none shadow-sm px-3 py-1">{language === "vi" ? "Phổ biến nhất" : "Recommended"}</Badge>
    </div>
    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
      <UserCog className="w-8 h-8" />
    </div>
    <h3 className="text-2xl font-bold text-slate-900 mb-1">{language === "vi" ? "PRO GROUP" : "PRO GROUP"}</h3>
    <div className="flex flex-col mb-6 text-xs text-indigo-600 font-semibold">
      <span className="text-lg font-bold text-indigo-600">{language === "vi" ? "69.000đ/nhóm/tháng" : "$3.5/team/month"}</span>
      <span>{language === "vi" ? "~11.500đ/người (nhóm 6)" : "~$0.6/person (team of 6)"}</span>
    </div>
    <ul className="space-y-4">
      {[
        /* --- NHÓM & PHÂN CÔNG --- */
        { type: "section", text: language === "vi" ? "NHÓM & PHÂN CÔNG" : "TEAM & ASSIGNMENT" },
        { type: "check", text: language === "vi" ? "Tối đa 30 thành viên + phân nhóm con" : "Max 30 members + sub-teams" },
        { type: "check", text: language === "vi" ? "Không giới hạn task + subtask phân cấp" : "Unlimited hierarchical tasks & subtasks" },
        { type: "check", text: language === "vi" ? "Độ ưu tiên task (Cao / Trung bình / Thấp)" : "Task priority (High / Medium / Low)" },
        { type: "check", text: language === "vi" ? "Label/tag phân loại task theo danh mục" : "Labels/tags to categorize tasks" },

        /* --- MINH BẠCH & TRÁCH NHIỆM --- */
        { type: "section", text: language === "vi" ? "MINH BẠCH & TRÁCH NHIỆM" : "TRANSPARENCY & ACCOUNTABILITY" },
        { type: "star", text: language === "vi" ? "Biểu đồ đóng góp cá nhân theo timeline" : "Individual contribution chart by timeline" },
        { type: "star", text: language === "vi" ? "Thống kê đúng hạn / trễ hạn từng thành viên" : "On-time / late stats per member" },
        { type: "star", text: language === "vi" ? "Reminder tự động (3 ngày · 1 ngày · đúng hạn) qua app + email" : "Auto reminders (3 days · 1 day · due) via app + email" },

        /* --- BÁO CÁO & GIẢNG VIÊN --- */
        { type: "section", text: language === "vi" ? "BÁO CÁO & GIẢNG VIÊN" : "REPORTS & INSTRUCTORS" },
        { type: "star", text: language === "vi" ? "Xuất báo cáo tiến độ nhóm PDF cho GV" : "Export team progress PDF report for instructors" },
        { type: "check", text: language === "vi" ? "Kết nối không giới hạn giảng viên" : "Connect unlimited instructors" },
        { type: "check", text: language === "vi" ? "Submit có cấu trúc + lịch sử phiên bản" : "Structured submission + version history" },
        { type: "check", text: language === "vi" ? "Bình luận & đính kèm trong từng task" : "Comments & attachments in each task" },

        /* --- TIỆN ÍCH BỔ SUNG --- */
        { type: "section", text: language === "vi" ? "TIỆN ÍCH BỔ SUNG" : "ADD-ONS" },
        { type: "check", text: language === "vi" ? "Sync Google Calendar" : "Sync Google Calendar" },
        { type: "check", text: language === "vi" ? "Storage 5 GB/nhóm" : "5 GB storage/team" },
        // 4 DÒNG BỊ KHÓA ĐƯỢC BỔ SUNG Ở ĐÂY:
        { type: "lock", text: language === "vi" ? "Nhiều nhóm/project song song" : "Multiple groups/projects in parallel" },
        { type: "lock", text: language === "vi" ? "Dashboard tổng quan đa project" : "Multi-project overview dashboard" },
        { type: "lock", text: language === "vi" ? "Gantt chart nâng cao + Milestone" : "Advanced Gantt chart + Milestones" },
        { type: "lock", text: language === "vi" ? "Phân tích workload toàn cục" : "Global workload analysis" }
      ].map((item, i) => (
        <li key={i} className="flex items-start">
          {item.type === "section" ? (
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block mt-2 mb-1 w-full">{item.text}</span>
          ) : (
            <>
              {item.type === "lock" ? (
                <CheckCircle className="w-5 h-5 text-slate-300 opacity-60 mr-3 flex-shrink-0 mt-0.5" />
              ) : item.type === "star" ? (
                <Star className="w-5 h-5 text-indigo-600 fill-indigo-600 mr-3 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-indigo-500 mr-3 flex-shrink-0 mt-0.5" />
              )}
              <span className={`leading-snug ${
                item.type === "lock"
                  ? "text-slate-400 line-through decoration-slate-200 font-normal"
                  : item.type === "star"
                    ? "text-slate-900 font-semibold"
                    : "text-slate-800 font-medium"
              }`}>{item.text}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  </div>

            {/* Admin */}
            <div className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-sm hover:shadow-xl hover:shadow-emerald-50/60 hover:-translate-y-1 transition-all duration-300 group relative">
    <div className="absolute top-0 right-0 p-5">
      <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-none shadow-sm px-3 py-1">{language === "vi" ? "Dành cho Leader" : "For Leaders"}</Badge>
    </div>
    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
      <ShieldCheck className="w-8 h-8" />
    </div>
    <h3 className="text-2xl font-bold text-slate-900 mb-1">{language === "vi" ? "PRO MAX" : "PRO MAX"}</h3>
    <div className="flex flex-col mb-6 text-xs text-emerald-600 font-semibold">
      <span className="text-lg font-bold text-emerald-600">{language === "vi" ? "129.000đ/tháng" : "$6.5/month"}</span>
      <span className="text-slate-500 font-normal">{language === "vi" ? "Gói cá nhân leader — bao phủ tất cả nhóm không giới hạn" : "Individual leader plan — covers all unlimited teams"}</span>
    </div>
    <ul className="space-y-4">
      {[
        /* --- BAO GỒM TOÀN BỘ PRO GROUP --- */
        { type: "section", text: language === "vi" ? "BAO GỒM TOÀN BỘ PRO GROUP" : "INCLUDES EVERYTHING IN PRO GROUP" },
        { type: "check", text: language === "vi" ? "Tất cả tính năng Pro Group cho mọi nhóm" : "All Pro Group features for every team" },
        { type: "check", text: language === "vi" ? "Thành viên trong nhóm không cần trả thêm" : "Team members pay no extra fees" },

        /* --- QUẢN LÝ ĐA PROJECT --- */
        { type: "section", text: language === "vi" ? "QUẢN LÝ ĐA PROJECT" : "MULTI-PROJECT MANAGEMENT" },
        { type: "star", text: language === "vi" ? "Không giới hạn nhóm/project song song" : "Unlimited parallel groups/projects" },
        { type: "star", text: language === "vi" ? "Dashboard tổng quan tất cả project — 1 màn hình" : "All-project overview dashboard — 1 screen" },
        { type: "star", text: language === "vi" ? "Phân tích workload toàn cục (ai đang quá tải trên mọi nhóm)" : "Global workload analysis" },

        /* --- CÔNG CỤ QUẢN LÝ NÂNG CAO --- */
        { type: "section", text: language === "vi" ? "CÔNG CỤ QUẢN LÝ NÂNG CAO" : "ADVANCED MANAGEMENT TOOLS" },
        { type: "star", text: language === "vi" ? "Gantt chart nâng cao + Milestone + Task dependencies" : "Advanced Gantt chart + Milestones + Task dependencies" },
        { type: "star", text: language === "vi" ? "Template project (lưu & tái sử dụng cấu trúc)" : "Project templates (save & reuse structure)" },
        { type: "check", text: language === "vi" ? "Recurring task (task lặp theo chu kỳ — họp hàng tuần…)" : "Recurring tasks (weekly meetings...)" },
        { type: "check", text: language === "vi" ? "Custom role thành viên (Reviewer, Observer…)" : "Custom member roles (Reviewer, Observer...)" },

        /* --- BÁO CÁO & LƯU TRỮ --- */
        { type: "section", text: language === "vi" ? "BÁO CÁO & LƯU TRỮ" : "REPORTS & STORAGE" },
        { type: "check", text: language === "vi" ? "Xuất báo cáo đa định dạng PDF + Excel" : "Export multi-format reports (PDF + Excel)" },
        { type: "check", text: language === "vi" ? "Archive & tìm kiếm toàn bộ lịch sử project" : "Archive & search full project history" },
        { type: "check", text: language === "vi" ? "Storage 20 GB" : "20 GB Storage" },
        { type: "check", text: language === "vi" ? "Priority support — phản hồi < 24h" : "Priority support — response < 24h" },
        { type: "check", text: language === "vi" ? "Custom branding nhóm (màu sắc, avatar)" : "Custom team branding (colors, avatar)" }
      ].map((item, i) => (
        <li key={i} className="flex items-start">
          {item.type === "section" ? (
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block mt-2 mb-1 w-full">{item.text}</span>
          ) : (
            <>
              {item.type === "star" ? (
                <Star className="w-5 h-5 text-emerald-600 fill-emerald-600 mr-3 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0 mt-0.5" />
              )}
              <span className={`text-slate-700 leading-snug ${item.type === "star" ? "font-semibold text-slate-900" : ""}`}>{item.text}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  </div>
</div>
</div>
      </section>

      {/* 7. Rubric Grading Showcase */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-white to-indigo-50/50 overflow-hidden relative">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="lg:w-5/12 space-y-6 z-10">
              <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-white px-3 py-1.5 text-sm font-semibold rounded-full shadow-sm">{language === "vi" ? "Split-screen Workspace" : "Split-screen Workspace"}</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">{language === "vi" ? "Chấm điểm rubric dễ hơn, minh bạch hơn" : "Easier, More Transparent Rubric Grading"}</h2>
              <p className="text-lg text-slate-600 leading-relaxed">{language === "vi" ? "Giảng viên không cần mở nhiều tab. TeamFair cho phép xem bài nộp và chấm rubric cùng lúc trong một workspace tập trung giúp tiết kiệm thời gian đáng kể." : "Lecturers don't need to open multiple tabs. TeamFair allows viewing submissions and grading rubrics simultaneously in a centralized workspace, saving significant time."}</p>

              <ul className="space-y-4 pt-4">
                {[
                  language === "vi" ? "Upload rubric nhanh chóng từ file Excel/CSV" : "Quickly upload rubrics from Excel/CSV files",
                  language === "vi" ? "Hệ thống tự chuyển thành bảng chấm tương tác" : "System automatically converts to interactive grading table",
                  language === "vi" ? "Lưu bản nháp chấm điểm trước khi gửi" : "Save draft grades before submitting",
                  language === "vi" ? "Gửi điểm chính thức và feedback cho sinh viên" : "Submit final grades and provide feedback to students",
                  language === "vi" ? "Xem lại lịch sử chấm điểm dễ dàng" : "Easily review grading history"
                ].map((item, i) => (
                  <li key={i} className="flex items-start text-slate-700">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mr-3.5 shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:w-7/12 w-full relative z-10 perspective-1000">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-[2.5rem] blur-xl opacity-30 animate-float-slow"></div>
              <div className="bg-white p-2 md:p-3 rounded-[2rem] border border-slate-200/50 shadow-2xl relative flex h-[500px] animate-float">
                {/* Mock Split Screen */}
                <div className="w-1/2 bg-slate-50/50 rounded-l-[1.5rem] border-r border-slate-200 p-5 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center"><FileText className="w-3.5 h-3.5 mr-1.5"/>{language === "vi" ? "Tài liệu nộp" : "Submitted Documents"}</div>
                    <Badge variant="secondary" className="bg-white text-slate-500 border border-slate-200 shadow-sm text-[10px]">Group #04</Badge>
                  </div>

                  <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                    <div className="flex items-center text-slate-700 font-medium text-sm mb-4 border-b border-slate-100 pb-3 mt-1">
                      {language === "vi" ? "Báo cáo Cuối cùng_v2.pdf" : "Final_Report_v2.pdf"}
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="h-5 bg-slate-100 rounded w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-2.5 bg-slate-100 rounded w-full"></div>
                        <div className="h-2.5 bg-slate-100 rounded w-full"></div>
                        <div className="h-2.5 bg-slate-100 rounded w-5/6"></div>
                      </div>
                      <div className="h-32 bg-slate-50 border border-slate-100 rounded-lg w-full mt-4 flex items-center justify-center text-slate-300">
                        <FileText className="w-8 h-8 opacity-50"/>
                      </div>
                      <div className="space-y-2 mt-4">
                        <div className="h-2.5 bg-slate-100 rounded w-full"></div>
                        <div className="h-2.5 bg-slate-100 rounded w-4/5"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-1/2 bg-indigo-50/30 rounded-r-[1.5rem] p-5 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center"><SplitSquareHorizontal className="w-3.5 h-3.5 mr-1.5"/>{language === "vi" ? "Bảng chấm điểm" : "Grading Table"}</div>
                    <div className="text-xs font-bold text-indigo-700 bg-indigo-100/80 border border-indigo-200 px-2 py-1 rounded shadow-sm">{language === "vi" ? "Tổng: 8.5/10" : "Total: 8.5/10"}</div>
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer group">
                      <div className="text-sm font-bold text-slate-800 mb-3 flex justify-between">
                        <span className="group-hover:text-indigo-600 transition-colors">{language === "vi" ? "1. Giao diện (30%)" : "1. Interface (30%)"}</span>
                        <span className="text-indigo-600 bg-indigo-50 px-1.5 rounded">{language === "vi" ? "2.7/3.0" : "2.7/3.0"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-12 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                          <span className="text-[10px] uppercase font-semibold">{language === "vi" ? "Kém" : "Poor"}</span>
                          <span className="text-[10px]">{language === "vi" ? "0-1.5" : "0-1.5"}</span>
                        </div>
                        <div className="h-12 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                          <span className="text-[10px] uppercase font-semibold">{language === "vi" ? "Khá" : "Fair"}</span>
                          <span className="text-[10px]">{language === "vi" ? "1.6-2.5" : "1.6-2.5"}</span>
                        </div>
                        <div className="h-12 bg-indigo-50 rounded-lg border-2 border-indigo-500 flex flex-col items-center justify-center text-indigo-700 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-4 h-4 bg-indigo-500 rounded-bl-lg flex items-center justify-center">
                            <CheckCircle className="w-2.5 h-2.5 text-white -mt-0.5 -mr-0.5" />
                          </div>
                          <span className="text-[10px] uppercase font-bold">{language === "vi" ? "Tốt" : "Good"}</span>
                          <span className="text-[10px] font-medium">{language === "vi" ? "2.6-3.0" : "2.6-3.0"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:border-indigo-300 transition-colors cursor-pointer group">
                      <div className="text-sm font-bold text-slate-800 mb-3 flex justify-between">
                        <span className="group-hover:text-indigo-600 transition-colors">{language === "vi" ? "2. Chức năng (40%)" : "2. Features (40%)"}</span>
                        <span className="text-slate-400">-</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-12 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                          <span className="text-[10px] uppercase font-semibold">{language === "vi" ? "Kém" : "Poor"}</span>
                        </div>
                        <div className="h-12 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                          <span className="text-[10px] uppercase font-semibold">{language === "vi" ? "Khá" : "Fair"}</span>
                        </div>
                        <div className="h-12 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                          <span className="text-[10px] uppercase font-semibold">{language === "vi" ? "Tốt" : "Good"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                      <div className="text-sm font-bold text-slate-800 mb-3 flex justify-between">
                        <span>{language === "vi" ? "3. Báo cáo (30%)" : "3. Reports (30%)"}</span>
                        <span className="text-slate-400">-</span>
                      </div>
                      <div className="h-12 bg-slate-50 rounded-lg border border-slate-100"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Contribution Score Showcase */}
      <section className="py-20 md:py-28 bg-white border-y border-slate-100">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">
            <div className="lg:w-1/2 w-full relative perspective-1000">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 rounded-[3rem] blur-2xl animate-float-slow"></div>
              <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 border border-slate-100 relative z-10 animate-float">
                <div className="absolute -top-6 -right-6 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-500/40">
                  <BarChart3 className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-2xl text-slate-900 mb-8 flex items-center">
                  {language === "vi" ? "Chi tiết đóng góp" : "Contribution Details"} <Badge className="ml-3 bg-slate-100 text-slate-700 hover:bg-slate-200 border-none">{language === "vi" ? "Nhóm #04" : "Group #04"}</Badge>
                </h3>

                <div className="space-y-6">
                  <div className="group hover:bg-slate-50 -mx-4 px-4 py-2 rounded-xl transition-colors">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <div className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{language === "vi" ? "Nguyễn Văn A" : "Nguyen Van A"}</div>
                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                          <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-white font-medium shadow-sm">Leader</Badge>
                          <span>{language === "vi" ? "12 Tác vụ" : "12 Tasks"}</span> <span className="text-slate-300">•</span> <span>{language === "vi" ? "4 Bằng chứng" : "4 Evidence"}</span>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-indigo-600 tracking-tight">92%</div>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full w-[92%] relative">
                        <div className="absolute inset-0 bg-white/20 w-full h-full rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)'}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="group hover:bg-slate-50 -mx-4 px-4 py-2 rounded-xl transition-colors">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <div className="font-bold text-lg text-slate-900 group-hover:text-emerald-600 transition-colors">{language === "vi" ? "Trần Thị B" : "Tran Thi B"}</div>
                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                          <Badge variant="outline" className="border-slate-200 text-slate-600 bg-white font-medium shadow-sm">{language === "vi" ? "Thành viên" : "Member"}</Badge>
                          <span>{language === "vi" ? "9 Tác vụ" : "9 Tasks"}</span> <span className="text-slate-300">•</span> <span>{language === "vi" ? "3 Bằng chứng" : "3 Evidence"}</span>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-emerald-600 tracking-tight">81%</div>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 shadow-inner">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full w-[81%]"></div>
                    </div>
                  </div>

                  <div className="group p-4 bg-rose-50/80 rounded-xl border border-rose-100 mt-8 relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                    <div className="flex justify-between items-end mb-3 pl-2">
                      <div>
                        <div className="font-bold text-lg text-rose-900">{language === "vi" ? "Lê Văn C" : "Le Van C"}</div>
                        <div className="text-sm text-rose-700/80 mt-1 flex items-center gap-2 font-medium">
                          <span className="flex items-center bg-white border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-xs shadow-sm"><ShieldCheck className="w-3 h-3 mr-1"/> {language === "vi" ? "Cần xem xét" : "Needs Review"}</span>
                          <span>{language === "vi" ? "2 Tác vụ" : "2 Tasks"}</span>
                        </div>
                      </div>
                      <div className="text-3xl font-black text-rose-600 tracking-tight">43%</div>
                    </div>
                    <div className="h-4 bg-white rounded-full overflow-hidden p-0.5 border border-rose-100 ml-2 shadow-inner">
                      <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full w-[43%]"></div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{language === "vi" ? "Các yếu tố đánh giá" : "Evaluation Factors"}</div>
                  <div className="flex flex-wrap gap-2">
                    {["Task hoàn thành", "Deadline", "Evidence", "Work logs", "Peer review"].map((tag, i) => (
                      <span key={i} className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors cursor-default">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-1/2 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">{language === "vi" ? "Contribution Score giúp nhìn rõ ai đã đóng góp" : "Contribution Score helps you see who has contributed"}</h2>
              <p className="text-lg text-slate-600 leading-relaxed">{language === "vi" ? "Hệ thống tổng hợp dữ liệu từ nhiều nguồn để tạo ra điểm số đóng góp tham khảo cho từng sinh viên một cách trực quan, giúp phát hiện sớm các trường hợp chênh lệch trong nhóm." : "The system aggregates data from multiple sources to create a reference contribution score for each student, helping to identify early on any discrepancies within the team."}</p>

              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-5 mt-8 shadow-sm">
                <div className="flex items-start">
                  <div className="bg-white p-2 rounded-xl text-amber-600 mr-4 shrink-0 shadow-sm border border-amber-100">
                    <Scale className="w-6 h-6" />
                  </div>
                  <p className="text-amber-800 text-sm md:text-base font-medium leading-relaxed">
                    <strong className="block mb-1 text-amber-900">{language === "vi" ? "Lưu ý quan trọng:" : "Important Note:"}</strong>
                    {language === "vi" ? "Contribution Score không thay thế quyết định của giảng viên. Đây là dữ liệu hỗ trợ mạnh mẽ để việc đánh giá cá nhân trở nên minh bạch và thuyết phục hơn." : "Contribution Score does not replace the instructor's decision. This is strong support data to make individual evaluation more transparent and convincing."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Trust / Fairness Section */}
      <section className="py-20 md:py-28 bg-slate-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16 md:mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{language === "vi" ? "Minh bạch dữ liệu, giảm tranh cãi" : "Transparent Data, Reduced Disputes"}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{language === "vi" ? "Các nguyên tắc cốt lõi giúp TeamFair xây dựng môi trường đánh giá công bằng và đáng tin cậy." : "The core principles help TeamFair build a fair and trustworthy evaluation environment."}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: { vi: "Chấm điểm dựa trên bằng chứng", en: "Grading Based on Evidence" }, desc: { vi: "Mỗi đóng góp đều có task cụ thể, log công việc hoặc evidence đi kèm rõ ràng.", en: "Each contribution has a specific task, work log, or accompanying evidence." }, icon: FileArchive, bg: "bg-blue-100", text: "text-blue-600", shadow: "shadow-blue-100" },
              { title: { vi: "Có đánh giá chéo", en: "Peer Review" }, desc: { vi: "Thu thập Peer review giúp phản ánh góc nhìn đa chiều từ các thành viên trong nhóm.", en: "Collecting peer reviews helps reflect diverse perspectives from team members." }, icon: Users, bg: "bg-emerald-100", text: "text-emerald-600", shadow: "shadow-emerald-100" },
              { title: { vi: "Quyền kiểm soát", en: "Control" }, desc: { vi: "Hệ thống chỉ cung cấp gợi ý, giảng viên luôn là người ra quyết định đánh giá cuối cùng.", en: "The system only provides suggestions, the instructor always makes the final evaluation decision." }, icon: UserCog, bg: "bg-indigo-100", text: "text-indigo-600", shadow: "shadow-indigo-100" },
              { title: { vi: "Lịch sử rõ ràng", en: "Clear History" }, desc: { vi: "TeamFair lưu vết toàn bộ quá trình làm việc, nộp bài và kết quả chấm điểm của từng nhóm.", en: "TeamFair tracks the entire workflow, submissions, and grading results of each team." }, icon: History, bg: "bg-violet-100", text: "text-violet-600", shadow: "shadow-violet-100" }
            ].map((item, i) => (
              <div key={i} className="text-center group bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-slate-100">
                <div className={`${item.bg} ${item.text} w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg ${item.shadow} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                  <item.icon className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 mb-3">{item.title[language as keyof typeof item.title] || item.title.en}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.desc[language as keyof typeof item.desc] || item.desc.en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-[2.5rem] p-10 md:p-16 lg:p-20 shadow-2xl shadow-indigo-200">
            {/* Decorative blurred circles */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

            <div className="relative z-10 text-center max-w-3xl mx-auto">
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <Badge variant="outline" className="border-white/20 bg-white/10 text-indigo-50 backdrop-blur-md px-3 py-1 font-medium rounded-full"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> {language === 'vi' ? 'Chấm điểm dựa trên rubric' : 'Rubric-based grading'}</Badge>
                <Badge variant="outline" className="border-white/20 bg-white/10 text-indigo-50 backdrop-blur-md px-3 py-1 font-medium rounded-full"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> {language === 'vi' ? 'Dựa trên bằng chứng' : 'Evidence-driven'}</Badge>
                <Badge variant="outline" className="border-white/20 bg-white/10 text-indigo-50 backdrop-blur-md px-3 py-1 font-medium rounded-full"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> {language === 'vi' ? 'Điểm đóng góp' : 'Contribution score'}</Badge>
              </div>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight leading-[1.15]">{language === 'vi' ? 'Chấm teamwork minh bạch hơn với TeamFair' : 'Grade teamwork more transparently with TeamFair'}</h2>
              <p className="text-lg md:text-xl text-indigo-100/90 mb-10 leading-relaxed max-w-2xl mx-auto">
                {language === 'vi' ? 'Theo dõi tiến độ, xem minh chứng, phân tích contribution score và chấm rubric trong một workspace tập trung.' : 'Track progress, view evidence, analyze contribution scores, and grade rubrics in a centralized workspace.'}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                {session ? (
                  <Button size="lg" className="bg-white text-indigo-700 hover:bg-slate-50 text-base font-semibold h-14 px-8 rounded-full shadow-xl shadow-indigo-900/20 hover:shadow-2xl hover:shadow-indigo-900/40 hover:-translate-y-1 transition-all" onClick={handleDashboardRedirect}>
                    {language === 'vi' ? 'Mở Dashboard của bạn' : 'Open Your Dashboard'} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                ) : (
                  <>
                    <Button size="lg" className="bg-white text-indigo-700 hover:bg-slate-50 text-base font-semibold h-14 px-8 rounded-full shadow-xl shadow-indigo-900/20 hover:shadow-2xl hover:shadow-indigo-900/40 hover:-translate-y-1 transition-all" onClick={() => navigate('/login')}>
                      {language === 'vi' ? 'Bắt đầu với TeamFair' : 'Get Started with TeamFair'}
                    </Button>
                    <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:border-white text-base font-semibold h-14 px-8 rounded-full bg-transparent backdrop-blur-sm transition-all hover:-translate-y-1" onClick={() => navigate('/login')}>
                      {language === 'vi' ? 'Đăng nhập' : 'Log in'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="bg-slate-50 py-12 md:py-16 border-t border-slate-200">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
            <div className="col-span-1 lg:col-span-2">
              <div className="flex items-center gap-2 text-indigo-600 mb-4">
                <Users className="h-6 w-6" />
                <span className="font-display text-xl font-bold tracking-tight text-slate-900">TeamFair</span>
              </div>
              <p className="text-slate-500 text-sm leading-[1.6] max-w-xs mb-6">
                {language === 'vi' ? 'Minh bạch hóa teamwork, hỗ trợ giảng viên đánh giá công bằng hơn.' : 'Transparency in teamwork, helping instructors assess more fairly.'}
              </p>
            </div>

            <div>
              <h4 className="text-slate-900 font-semibold mb-4 text-sm uppercase tracking-wider">{language === 'vi' ? 'Sản phẩm' : 'Products'}</h4>
              <ul className="space-y-3 text-slate-500 text-sm">
                <li><a href="#tinh-nang" className="hover:text-indigo-600 transition-colors">{language === 'vi' ? 'Tính năng' : 'Features'}</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">{language === 'vi' ? 'Rubric' : 'Rubric'}</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">{language === 'vi' ? 'Điểm đóng góp' : 'Contribution Score'}</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">{language === 'vi' ? 'Quản lý nhiệm vụ' : 'Task Management'}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-slate-900 font-semibold mb-4 text-sm uppercase tracking-wider">{language === 'vi' ? 'Người dùng' : 'Users'}</h4>
              <ul className="space-y-3 text-slate-500 text-sm">
                <li><a href="#sinh-vien" className="hover:text-indigo-600 transition-colors">{language === 'vi' ? 'Sinh viên' : 'Students'}</a></li>
                <li><a href="#giang-vien" className="hover:text-indigo-600 transition-colors">{language === 'vi' ? 'Giảng viên' : 'Instructors'}</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">{language === 'vi' ? 'Quản trị viên' : 'Administrators'}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-slate-900 font-semibold mb-4 text-sm uppercase tracking-wider">{language === 'vi' ? 'Hệ thống' : 'System'}</h4>
              <ul className="space-y-3 text-slate-500 text-sm">
                <li><button className="hover:text-indigo-600 transition-colors text-left" onClick={() => navigate('/login')}>{language === 'vi' ? 'Đăng nhập' : 'Log in'}</button></li>
                <li><button className="hover:text-indigo-600 transition-colors text-left" onClick={() => navigate('/login')}>{language === 'vi' ? 'Bắt đầu' : 'Get Started'}</button></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
            <p>{language === 'vi' ? '© 2026 TeamFair. Được xây dựng cho đánh giá teamwork công bằng.' : '© 2026 TeamFair. Built for fair teamwork assessment.'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;