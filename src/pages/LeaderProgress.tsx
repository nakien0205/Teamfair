import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users, BarChart3, AlertCircle, Award } from 'lucide-react';
import { supabase } from "@/lib/supabaseClient"; 
import { useTeam } from "@/context/TeamContext"; 
import { tr } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";

// 🌟 BẢNG MÀU TƯƠNG PHẢN CỰC MẠNH (Đã đồng bộ):
const COLORS = [
  '#dc2626', // 1. Đỏ đậm (Crimson Red)
  '#22c55e', // 2. Xanh lá neon (Bright Green)
  '#eab308', // 3. Vàng nghệ (Amber Yellow)
  '#6366f1', // 4. Xanh chàm (Indigo Blue)
  '#f97316', // 5. Cam cháy (Vibrant Orange)
  '#0d9488', // 6. Xanh ngọc sẫm (Dark Teal)
  '#ec4899', // 7. Hồng cánh sen (Vibrant Pink)
  '#8b5cf6', // 8. Tím sẫm (Violet Purple)
  '#14b8a6', // 9. Xanh ngọc sáng (Light Teal)
  '#b91c1c'  // 10. Đỏ đô (Maroon)
];

const LeaderProgress = () => {
  const { language } = useLanguage();
  const teamContext = useTeam(); 

  // Tự động tìm mảng chứa danh sách nhóm trong TeamContext để đồng bộ sidebar
  const groupsList = teamContext.groups || [];
  const activeIndex = teamContext.currentGroupIndex ?? 0;
  const currentGroupId = groupsList[activeIndex]?.id;

  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const getProgressData = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        if (teamContext?.dataLoading) return;

        if (!currentGroupId) {
          setErrorMsg(tr(language, "Không tìm thấy thông tin nhóm hiện tại đang đứng.", "Current group information not found."));
          return;
        }

        // BƯỚC 1: Lấy danh sách thành viên của đúng nhóm đang đứng
        const { data: members, error: memError } = await supabase
          .from('group_members')
          .select(`
            student_id,
            users:student_id ( full_name )
          `)
          .eq('group_id', currentGroupId);

        if (memError) throw memError;

        if (!members || members.length === 0) {
          setErrorMsg(tr(language, "Nhóm hiện tại không tìm thấy thành viên.", "No members found for the current group."));
          return;
        }

        // BƯỚC 2: Lấy danh sách task kèm cột contribution_percent (điểm đóng góp)
        const { data: tasks, error: taskError } = await supabase
          .from('tasks')
          .select('id, assignee_id, contribution_percent')
          .eq('group_id', currentGroupId);

        if (taskError) throw taskError;

        // BƯỚC 3: Tổng hợp dữ liệu vẽ đồ thị
        const formattedData = members.map((member) => {
          const studentId = member.student_id;
          const userObj = Array.isArray(member.users) ? member.users[0] : member.users;
          const fullName = userObj?.full_name || tr(language, "Thành viên ẩn danh", "Anonymous Member");

          // Lọc các task thuộc về thành viên hiện tại
          const memberTasks = tasks ? tasks.filter(t => t.assignee_id === studentId) : [];
          const taskCount = memberTasks.length;
          
          // Tính tổng điểm đóng góp thực tế của thành viên từ các task
          const contributionScore = memberTasks.reduce((sum, item) => {
            const points = item.contribution_percent !== null && item.contribution_percent !== undefined 
              ? Number(item.contribution_percent) 
              : 0;
            return sum + points;
          }, 0);

          return {
            name: fullName,
            taskCount: taskCount,
            contributionScore: contributionScore // Đảm bảo thuộc tính trùng khớp hoàn toàn với đồ thị hiển thị bên dưới
          };
        });

        setChartData(formattedData);
      } catch (error) {
        console.error("Error loading progress page:", error);
        setErrorMsg(tr(language, "Có lỗi xảy ra khi tải dữ liệu từ hệ thống.", "An error occurred while loading data from the system."));
      } finally {
        setLoading(false);
      }
    };

    getProgressData();
  }, [currentGroupId, language, teamContext?.dataLoading]);

  // CUSTOM LABEL BIỂU ĐỒ TRÁI: Điểm số đóng góp gốc
  const renderCustomizedScoreLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
    if (value === undefined || value === null || value === 0) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-bold tracking-tight drop-shadow-sm">
        {value}
      </text>
    );
  };

  // CUSTOM LABEL BIỂU ĐỒ PHẢI: Số % công việc
  const renderCustomizedPercentLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (!percent || percent === 0) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-bold drop-shadow-sm">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading || teamContext?.dataLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <p className="text-sm text-slate-500 font-medium animate-pulse">
          {tr(language, "Đang tổng hợp báo cáo trực quan...", "Synchronizing chart data...")}
        </p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="container mx-auto px-6 py-12 max-w-xl text-center space-y-4">
        <div className="inline-flex p-3 bg-amber-50 rounded-full text-amber-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{tr(language, "Thông báo tiến độ", "Progress Report Status")}</h2>
        <p className="text-slate-500 text-sm">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-6 max-w-6xl space-y-8 animate-fade-in">
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <BarChart3 className="text-sky-500 h-6 w-6" />
          {tr(language, "Báo cáo tiến độ nhóm", "Group Progress Report")}
        </h1>
        <p className="text-sm text-slate-500">
          {tr(language, "Phân tích trực quan khối lượng công việc và năng suất đóng góp thực tế", "Visually analyze workload and actual productivity")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Biểu đồ trái: Điểm Đóng Góp */}
        <Card className="rounded-2xl border border-slate-100 bg-white shadow-md shadow-slate-100/40 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50">
          <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100/60">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-500" />
              {tr(language, "Điểm số đóng góp thành viên", "Member Contribution Score")}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {tr(language, "Điểm đóng góp tích lũy hiển thị trên hệ thống", "Accumulated contribution score displayed on the system")}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  label={renderCustomizedScoreLabel}
                  outerRadius={95}
                  innerRadius={50}
                  paddingAngle={0} 
                  dataKey="contributionScore"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      className="transition-all duration-300 cursor-pointer focus:outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  formatter={(value) => [value, tr(language, "Điểm đóng góp", "Contribution Score")]} 
                />
                <Legend 
                  iconType="circle" 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} 
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Biểu đồ phải: Số Lượng Task */}
        <Card className="rounded-2xl border border-slate-100 bg-white shadow-md shadow-slate-100/40 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50">
          <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100/60">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              {tr(language, "Số lượng nhiệm vụ đảm nhận (Tasks)", "Assigned Tasks Quantity")}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {tr(language, "Tỷ trọng phân chia đầu việc giữa các thành viên trong nhóm", "Workload distribution among group members")}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  label={renderCustomizedPercentLabel}
                  outerRadius={95}
                  innerRadius={0}
                  paddingAngle={0} 
                  dataKey="taskCount"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      className="transition-all duration-300 cursor-pointer focus:outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  formatter={(value) => [`${value} ${tr(language, "nhiệm vụ", "tasks")}`, tr(language, "Số lượng Task", "Task Count")]} 
                />
                <Legend 
                  iconType="circle" 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} 
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeaderProgress;