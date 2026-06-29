import StudentShell from "@/components/student/StudentShell";
import ProjectCalendar from "@/components/ProjectCalendar";
import { Card, CardContent } from "@/components/ui/card";
import { useTeam } from "@/context/TeamContext";

const CalendarPage = () => {
  const { studentRole } = useTeam();

  return (
    
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <CardContent className="p-6">
            <ProjectCalendar 
              isLeader={studentRole === "Leader"} 
              locked={false} 
            />
          </CardContent>
        </Card>
      </div>
    
  );
};

export default CalendarPage;