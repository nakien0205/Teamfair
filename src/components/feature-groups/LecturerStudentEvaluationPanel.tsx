import { useEffect, useMemo, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/lib/i18n";
import { Star } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

const LecturerStudentEvaluationPanel = () => {
  const { groups, addLecturerStudentEvaluation } = useTeam();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { sendNotification } = useNotifications();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const group = useMemo(() => {
    if (selectedGroupId) return groups.find(g => g.id === selectedGroupId) || null;
    return groups[0] || null;
  }, [groups, selectedGroupId]);

  const [studentName, setStudentName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [awardBadge, setAwardBadge] = useState(true);

  useEffect(() => {
    setStudentName("");
    setRating(0);
    setComment("");
    setAwardBadge(true);
  }, [selectedGroupId]);

  const memberOptions = useMemo(() => group?.members?.map(m => m.name) || [], [group?.members]);
  const awardLabel = t(language, "awardContributionBadge");
  const title = t(language, "lecturerStudentEvaluationTitle");

  const getValidation = () => {
    if (!studentName) {
      return {
        title: language === "vi" ? "Lỗi" : "Error",
        description: language === "vi" ? "Vui lòng chọn sinh viên" : "Please select a student",
      };
    }
    if (rating === 0) {
      return {
        title: language === "vi" ? "Lỗi" : "Error",
        description: language === "vi" ? "Vui lòng chọn số sao" : "Please choose a star rating",
      };
    }
    return null;
  };

  const getSavedToastDescription = () => {
    if (awardBadge) {
      return language === "vi" ? "Đã trao contribution badge cho sinh viên" : "Contribution badge awarded to the student";
    }
    return language === "vi" ? "Đã lưu đánh giá (không trao badge)" : "Review saved (no badge awarded)";
  };

  const submit = () => {
    const validation = getValidation();
    if (validation) {
      toast({ title: validation.title, description: validation.description, variant: "destructive" });
      return;
    }

    addLecturerStudentEvaluation({ studentName, rating, comment, awardBadge });

    const targetStudent = group?.members?.find(m => m.name === studentName);
    if (targetStudent?.id) {
      const msg = language === "vi"
        ? `Giảng viên đã đánh giá hiệu suất của bạn: ${rating} sao. ${awardBadge ? "Bạn nhận được badge Verified!" : ""}`
        : `Lecturer published your performance review: ${rating} stars. ${awardBadge ? "You received a Verified badge!" : ""}`;
      void sendNotification(targetStudent.id, "Lecturer", msg, group?.id);
    } else {
      console.warn("[Evaluation] Could not resolve student UUID for notification:", studentName);
    }

    toast({
      title: language === "vi" ? "Đã lưu" : "Saved",
      description: getSavedToastDescription(),
    });
    setStudentName("");
    setRating(0);
    setComment("");
    setAwardBadge(true);
  };

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="font-display text-lg font-semibold mb-4">{title}</h2>

      {groups.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          {language === "vi" ? "Bạn hiện chưa quản lý nhóm sinh viên nào." : "You do not manage any student groups yet."}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{language === "vi" ? "Chọn nhóm / dự án" : "Select group / project"}</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder={language === "vi" ? "Chọn nhóm" : "Pick a group"} />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{language === "vi" ? "Chọn sinh viên" : "Select student"}</Label>
            <Select value={studentName} onValueChange={setStudentName}>
              <SelectTrigger>
                <SelectValue placeholder={language === "vi" ? "Chọn sinh viên" : "Pick a student"} />
              </SelectTrigger>
              <SelectContent>
                {memberOptions.map(n => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{language === "vi" ? "Đánh giá sao" : "Star rating"}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${
                      s <= rating ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <div className="font-medium text-sm">{awardLabel}</div>
              <div className="text-xs text-muted-foreground">
                {language === "vi" ? "Có/Không trao badge Verified" : "Toggle whether a verified badge is issued"}
              </div>
            </div>
            <Switch checked={awardBadge} onCheckedChange={setAwardBadge} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{language === "vi" ? "Nhận xét" : "Comment"}</Label>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={language === "vi" ? "Nhập comment cho đóng góp..." : "Write a comment about the contribution..."}
            className="min-h-[140px]"
          />

          <Button onClick={submit} className="w-full">
            {language === "vi" ? "Lưu đánh giá" : "Save review"}
          </Button>
        </div>
      </div>
      )}
    </section>
  );
};

export default LecturerStudentEvaluationPanel;
