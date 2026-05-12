import { useMemo } from "react";
import { useTeam } from "@/context/TeamContext";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/lib/i18n";
import { Star } from "lucide-react";

type Props = {
  currentUserName: string;
};

const VERIFIED_LINK = "https://www.linkedin.com/";

const VerifiedBadgesSection = ({ currentUserName }: Props) => {
  const { studentBadges } = useTeam();
  const { language } = useLanguage();

  const badges = useMemo(() => studentBadges.filter(b => b.studentName === currentUserName), [studentBadges, currentUserName]);
  const title = t(language, "verifiedBadgesTitle");

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="font-display text-lg font-semibold mb-4">{title}</h2>

      {badges.length === 0 ? (
        <p className="text-muted-foreground text-sm">{language === "vi" ? "Chưa có badge nào." : "No badges yet."}</p>
      ) : (
        <div className="space-y-4">
          {badges
            .slice()
            .sort((a, b) => b.awardedAt.getTime() - a.awardedAt.getTime())
            .map(b => (
              <div key={b.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-success/10 text-success rounded-full px-2 py-0.5">
                        Verified
                      </span>
                      {renderStars(b.rating)}
                    </div>
                    <div className="text-sm font-medium">{b.comment.trim() ? b.comment : "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {language === "vi"
                        ? `Phát hành: ${b.awardedAt.toLocaleDateString("vi-VN")}`
                        : `Issued: ${b.awardedAt.toLocaleDateString("en-US")}`}
                    </div>
                  </div>
                  <a
                    href={VERIFIED_LINK}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline whitespace-nowrap"
                  >
                    {language === "vi" ? "Xem trên LinkedIn" : "View on LinkedIn"}
                  </a>
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
};

export default VerifiedBadgesSection;

