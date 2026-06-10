import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Brain,
  Building2,
  CheckCircle,
  ClipboardList,
  Crown,
  GraduationCap,
  Layers3,
  MessageSquareText,
  MousePointer2,
  PlayCircle,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcherButton from '@/components/LanguageSwitcherButton';
import type { Language } from '@/context/LanguageContext';
import { useLanguage } from '@/context/LanguageContext';
import { tr } from '@/lib/i18n';

gsap.registerPlugin(useGSAP, ScrollTrigger);

type WorkflowStep = {
  icon: typeof ClipboardList;
  title: string;
  desc: string;
};

/* ------------------------------------------------------------------ */
/*  Hero – animated AI-review demo                                     */
/* ------------------------------------------------------------------ */
const HeroReviewDemo = ({ language }: { language: Language }) => {
  const demoRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      /* ---- reduced-motion: skip animation, show final state ---- */
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.hero-cursor', { autoAlpha: 0 });
        gsap.set('.hero-loading', { autoAlpha: 0 });
        gsap.set('.hero-star', { autoAlpha: 1, scale: 1 });
        gsap.set('.hero-review-a, .hero-review-b, .hero-review-c', { autoAlpha: 0 });
        gsap.set('.hero-user-a-bar', { scaleX: 0.92, transformOrigin: 'left center' });
        gsap.set('.hero-user-b-bar', { scaleX: 0.73, transformOrigin: 'left center' });
        gsap.set('.hero-user-c-bar', { scaleX: 0.40, transformOrigin: 'left center' });
        gsap.set('.hero-user-a-pct', { textContent: '92' });
        gsap.set('.hero-user-b-pct', { textContent: '73' });
        gsap.set('.hero-user-c-pct', { textContent: '40' });
      });

      /* ---- normal motion: full animation ---- */
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        /* initial state — everything hidden / zeroed */
        gsap.set('.hero-cursor', { x: -160, y: 0, autoAlpha: 0 });
        gsap.set('.hero-loading, .hero-review-a, .hero-review-b, .hero-review-c', { autoAlpha: 0, y: 10 });
        gsap.set('.hero-dot', { y: 0 });
        gsap.set('.hero-star', { autoAlpha: 1, scale: 1 });
        gsap.set('.hero-user-a-bar, .hero-user-b-bar, .hero-user-c-bar', { scaleX: 0, transformOrigin: 'left center' });
        gsap.set('.hero-user-a-pct, .hero-user-b-pct, .hero-user-c-pct', { textContent: '0' });
        gsap.set('.hero-user-a, .hero-user-b, .hero-user-c', {
          backgroundColor: 'rgba(11,13,42,0.8)',
          borderColor: 'rgba(255,255,255,0.1)',
        });

        const tl = gsap.timeline({
          repeat: -1,
          repeatDelay: 1.5,
          defaults: { ease: 'power2.out' },
        });

        /* ---------- cursor appears below User C ---------- */
        tl.to('.hero-cursor', { autoAlpha: 1, duration: 0.3 })

          /* ======== User A sequence ======== */
          .to('.hero-cursor', { x: -160, y: -240, duration: 0.55 })
          .to('.hero-user-a', { backgroundColor: 'rgba(34,211,238,0.16)', borderColor: 'rgba(103,232,249,0.8)', duration: 0.2 }, '<0.35')
          .to('.hero-cursor', { scale: 0.85, duration: 0.08 })
          .to('.hero-cursor', { scale: 1, duration: 0.1 })
          /* move to Gemini star */
          .to('.hero-cursor', { x: 160, y: -130, duration: 0.6 })
          .to('.hero-cursor', { scale: 0.85, duration: 0.08 })
          .to('.hero-cursor', { scale: 1, duration: 0.1 })
          .to('.hero-star', { scale: 0.8, duration: 0.1 }, '<')
          .to('.hero-star', { autoAlpha: 0, scale: 0.6, duration: 0.15 })
          /* loading dots */
          .to('.hero-loading', { autoAlpha: 1, y: 0, duration: 0.5 }, '<')
          .to('.hero-dot', { y: -5, repeat: 2, yoyo: true, stagger: 0.08, duration: 0.16 })
          .to('.hero-loading', { autoAlpha: 0, y: 8, duration: 0.5 })
          .set('.hero-dot', { y: 0 })
          /* star reappears */
          .to('.hero-star', { autoAlpha: 1, scale: 1, duration: 0.2 }, '<')
          /* bar fills + counter */
          .to('.hero-user-a-bar', { scaleX: 0.92, duration: 0.6 }, '<')
          .to('.hero-user-a-pct', { textContent: 92, snap: { textContent: 1 }, duration: 0.6 }, '<')
          /* review text */
          .to('.hero-review-a', { autoAlpha: 1, y: 0, duration: 1 }, '<0.1')
          .to({}, { duration: 0.8 })
          /* fade review + unhighlight */
          .to('.hero-review-a', { autoAlpha: 0, y: 10, duration: 0.5 })
          .to('.hero-user-a', { backgroundColor: 'rgba(11,13,42,0.8)', borderColor: 'rgba(255,255,255,0.1)', duration: 0.2 }, '<')

          /* ======== User B sequence ======== */
          .to('.hero-cursor', { x: -160, y: -155, duration: 0.55 })
          .to('.hero-user-b', { backgroundColor: 'rgba(244,63,94,0.16)', borderColor: 'rgba(251,113,133,0.8)', duration: 0.2 }, '<0.35')
          .to('.hero-cursor', { scale: 0.85, duration: 0.08 })
          .to('.hero-cursor', { scale: 1, duration: 0.1 })
          .to('.hero-cursor', { x: 160, y: -130, duration: 0.6 })
          .to('.hero-cursor', { scale: 0.85, duration: 0.08 })
          .to('.hero-cursor', { scale: 1, duration: 0.1 })
          .to('.hero-star', { scale: 0.8, duration: 0.1 }, '<')
          .to('.hero-star', { autoAlpha: 0, scale: 0.6, duration: 0.15 })
          .to('.hero-loading', { autoAlpha: 1, y: 0, duration: 0.5 }, '<')
          .to('.hero-dot', { y: -5, repeat: 2, yoyo: true, stagger: 0.08, duration: 0.16 })
          .to('.hero-loading', { autoAlpha: 0, y: 8, duration: 0.5 })
          .set('.hero-dot', { y: 0 })
          .to('.hero-star', { autoAlpha: 1, scale: 1, duration: 0.2 }, '<')
          .to('.hero-user-b-bar', { scaleX: 0.73, duration: 0.6 }, '<')
          .to('.hero-user-b-pct', { textContent: 73, snap: { textContent: 1 }, duration: 0.6 }, '<')
          .to('.hero-review-b', { autoAlpha: 1, y: 0, duration: 1 }, '<0.1')
          .to({}, { duration: 0.8 })
          .to('.hero-review-b', { autoAlpha: 0, y: 10, duration: 0.5 })
          .to('.hero-user-b', { backgroundColor: 'rgba(11,13,42,0.8)', borderColor: 'rgba(255,255,255,0.1)', duration: 0.2 }, '<')

          /* ======== User C sequence ======== */
          .to('.hero-cursor', { x: -160, y: -70, duration: 0.55 })
          .to('.hero-user-c', { backgroundColor: 'rgba(148,163,184,0.16)', borderColor: 'rgba(148,163,184,0.8)', duration: 0.2 }, '<0.35')
          .to('.hero-cursor', { scale: 0.85, duration: 0.08 })
          .to('.hero-cursor', { scale: 1, duration: 0.1 })
          .to('.hero-cursor', { x: 160, y: -130, duration: 0.6 })
          .to('.hero-cursor', { scale: 0.85, duration: 0.08 })
          .to('.hero-cursor', { scale: 1, duration: 0.1 })
          .to('.hero-star', { scale: 0.8, duration: 0.1 }, '<')
          .to('.hero-star', { autoAlpha: 0, scale: 0.6, duration: 0.15 })
          .to('.hero-loading', { autoAlpha: 1, y: 0, duration: 0.5 }, '<')
          .to('.hero-dot', { y: -5, repeat: 2, yoyo: true, stagger: 0.08, duration: 0.16 })
          .to('.hero-loading', { autoAlpha: 0, y: 8, duration: 0.5 })
          .set('.hero-dot', { y: 0 })
          .to('.hero-star', { autoAlpha: 1, scale: 1, duration: 0.2 }, '<')
          .to('.hero-user-c-bar', { scaleX: 0.40, duration: 0.6 }, '<')
          .to('.hero-user-c-pct', { textContent: 40, snap: { textContent: 1 }, duration: 0.6 }, '<')
          .to('.hero-review-c', { autoAlpha: 1, y: 0, duration: 1 }, '<0.1')
          .to({}, { duration: 0.8 })
          /* reset everything for loop */
          .to('.hero-review-c', { autoAlpha: 0, y: 10, duration: 0.5 })
          .to('.hero-user-c', { backgroundColor: 'rgba(11,13,42,0.8)', borderColor: 'rgba(255,255,255,0.1)', duration: 0.2 }, '<')
          .to('.hero-cursor', { autoAlpha: 0, duration: 0.3 }, '<')
          /* drain all progress bars and counters back to 0 incrementally */
          .to('.hero-user-a-bar', { scaleX: 0, duration: 0.6 })
          .to('.hero-user-a-pct', { textContent: 0, snap: { textContent: 1 }, duration: 0.6 }, '<')
          .to('.hero-user-b-bar', { scaleX: 0, duration: 0.6 }, '<')
          .to('.hero-user-b-pct', { textContent: 0, snap: { textContent: 1 }, duration: 0.6 }, '<')
          .to('.hero-user-c-bar', { scaleX: 0, duration: 0.6 }, '<')
          .to('.hero-user-c-pct', { textContent: 0, snap: { textContent: 1 }, duration: 0.6 }, '<')
          .set('.hero-cursor', { x: -160, y: 0 });
      });

      return () => mm.revert();
    },
    { scope: demoRef },
  );

  return (
    <div
      ref={demoRef}
      className="relative mx-auto w-full min-w-0 max-w-[326px] overflow-hidden rounded-lg border border-white/[0.16] bg-white/[0.08] p-4 shadow-[0_30px_100px_rgba(42,67,255,0.28)] backdrop-blur-xl sm:max-w-3xl"
    >
      <div className="mb-4 flex items-center justify-between border-b border-[#eee9df] pb-4">
        <div>
          <p className="text-sm font-semibold text-cyan-100">{tr(language, 'Dự án khởi nghiệp', 'Startup Project')}</p>
          <p className="text-xs text-slate-300">{tr(language, 'Tuần 7 - hồ sơ đóng góp', 'Week 7 - contribution record')}</p>
        </div>
        <span className="rounded-md bg-fuchsia-300/[0.15] px-3 py-1 text-xs font-medium text-fuchsia-100">
          AI scoring
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        {/* ---- user cards with progress bars ---- */}
        <div className="space-y-3">
          {([
            [tr(language, 'Kiên - Thiết kế UI', 'Jack - UI development'), '92', 'bg-cyan-300', 'hero-user-a', 'hero-user-a-bar', 'hero-user-a-pct'],
            [tr(language, 'Huyền - Báo cáo bài báo', 'Kathy - Paper report'), '73', 'bg-fuchsia-300', 'hero-user-b', 'hero-user-b-bar', 'hero-user-b-pct'],
            [tr(language, 'Thịnh - Đề xuất doanh nghiệp', 'Bruce - Business proposal'), '40', 'bg-indigo-300', 'hero-user-c', 'hero-user-c-bar', 'hero-user-c-pct'],
          ] as const).map(([label, _value, color, rowClass, barClass, pctClass]) => (
            <div
              key={label}
              className={`${rowClass} rounded-md border border-white/10 bg-[#0b0d2a]/80 p-4 transition-colors`}
            >
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-100">{label}</span>
                <span className="font-semibold text-white">
                  <span className={pctClass}>0</span>%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`${barClass} h-full origin-left rounded-full ${color}`}
                  style={{ transform: 'scaleX(0)' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ---- contribution score ring + reviews ---- */}
        <div className="rounded-md border border-cyan-200/20 bg-cyan-200/10 p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-cyan-50">{tr(language, 'Điểm đóng góp', 'Contribution score')}</span>
            <Layers3 className="h-5 w-5 text-cyan-100" />
          </div>
          <div className="grid place-items-center">
            <div className="hero-score-ring relative grid h-36 w-36 place-items-center rounded-full border-[12px] border-cyan-300/90 bg-[#07112f] shadow-[0_0_48px_rgba(103,232,249,0.32)]">
              <Sparkles className="hero-star absolute h-12 w-12 text-cyan-100 drop-shadow-[0_0_18px_rgba(103,232,249,0.8)]" />
              <div className="hero-loading absolute inset-0 grid place-items-center">
                <div className="flex items-center justify-center gap-2">
                  {[0, 1, 2].map((dot) => (
                    <span key={dot} className="hero-dot h-2 w-2 rounded-full bg-cyan-100" />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 min-h-[7rem]">
            <div className="hero-review-a rounded-md border border-cyan-200/30 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50">
              {tr(
                language,
                'Đánh giá Kiên: bằng chứng rõ, có MVP.',
                'Jack review: clear evidence, has MVP.',
              )}
            </div>
            <div className="hero-review-b rounded-md border border-fuchsia-200/30 bg-fuchsia-300/10 p-3 text-sm leading-6 text-fuchsia-50">
              {tr(
                language,
                'Đánh giá Huyền: thiếu phần báo cáo cuối.',
                'Kathy review: missing final-report work.',
              )}
            </div>
            <div className="hero-review-c rounded-md border border-indigo-200/30 bg-indigo-300/10 p-3 text-sm leading-6 text-amber-50">
              {tr(
                language,
                'Đánh giá Thịnh: bằng chứng yếu, đề xuất kinh doanh thiếu dữ liệu hỗ trợ.',
                'Bruce review: weak evidence, business proposal lacks supporting data.',
              )}
            </div>
          </div>
        </div>
      </div>

      <MousePointer2 className="hero-cursor pointer-events-none absolute left-1/2 top-[23rem] h-7 w-7 fill-white text-white drop-shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Workflow section – scroll-triggered                                */
/* ------------------------------------------------------------------ */
const WorkflowSection = ({ language, workflow }: { language: Language; workflow: WorkflowStep[] }) => {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.workflow-panel, .workflow-proof, .workflow-ai-result', { autoAlpha: 1, y: 0 });
        gsap.set('.workflow-bar', { scaleX: 1 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set('.workflow-proof, .workflow-ai-result', { autoAlpha: 0, y: 16 });
        gsap.set('.workflow-bar', { scaleX: 0, transformOrigin: 'left center' });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 72%',
            end: 'bottom 34%',
            toggleActions: 'restart none none reverse',
          },
        });

        tl.from('.workflow-panel', { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.35 })
          .to('.workflow-proof', { autoAlpha: 1, y: 0, duration: 0.35 })
          .to('.workflow-bar', { scaleX: 1, stagger: 0.06, duration: 0.35 })
          .to('.workflow-ai-result', { autoAlpha: 1, y: 0, duration: 0.35 });
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section id="workflow" ref={sectionRef} className="scroll-mt-24 bg-[#f6f4ff] py-24 text-[#101126]">
      <div className="container mx-auto grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-4 rounded-lg bg-gradient-to-tr from-blue-500/[0.18] via-fuchsia-500/[0.16] to-cyan-300/20 blur-xl" />
          <div className="relative grid gap-4 rounded-lg border border-[#d8d4ff] bg-white/80 p-4 shadow-[0_24px_70px_rgba(67,56,202,0.18)] backdrop-blur">
            <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
              {/* ---- task board ---- */}
              <div className="workflow-panel rounded-md bg-[#111240] p-5 text-white">
                <p className="mb-4 text-sm font-semibold text-cyan-200">{tr(language, 'Bảng công việc', 'Task board')}</p>
                {([
                  [tr(language, 'Kiên', 'Jack'), tr(language, 'Thiết kế UI', 'UI development'), 'Done'] as const,
                  [tr(language, 'Huyền', 'Kathy'), tr(language, 'Báo cáo bài báo', 'Paper report'), 'Ongoing'] as const,
                  [tr(language, 'Thịnh', 'Bruce'), tr(language, 'Đề xuất doanh nghiệp', 'Business proposal'), 'Missing'] as const,
                ]).map(([owner, task, state]) => {
                  const stateStyle =
                    state === 'Missing'
                      ? 'bg-[#ffe8e8] text-[#a52a2a]'
                      : state === 'Ongoing'
                        ? 'bg-[#fef3c7] text-[#92400e]'
                        : 'bg-[#e7f5e7] text-[#1f6f3d]';
                  const stateLabel =
                    state === 'Missing'
                      ? tr(language, 'Thiếu', 'Missing')
                      : state === 'Ongoing'
                        ? tr(language, 'Đang làm', 'Ongoing')
                        : tr(language, 'Xong', 'Done');
                  return (
                    <div key={task} className="mb-3 rounded-md border border-white/10 bg-white/[0.08] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">{task}</span>
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stateStyle}`}>{stateLabel}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{owner}</p>
                    </div>
                  );
                })}
              </div>

              {/* ---- evidence check + AI summary ---- */}
              <div className="space-y-4">
                <div className="workflow-proof rounded-md border border-[#d9d3ff] bg-[#fafaff] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-semibold">{tr(language, 'Kiểm tra bằng chứng', 'Evidence check')}</p>
                    <span className="rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      {tr(language, '6 bằng chứng', '6 evidence')}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: tr(language, 'Kiên', 'Jack'), segments: ['bg-emerald-500', 'bg-emerald-500', 'bg-emerald-500'] },
                      { label: tr(language, 'Huyền', 'Kathy'), segments: ['bg-amber-400'] },
                      { label: tr(language, 'Thịnh', 'Bruce'), segments: ['bg-red-500', 'bg-emerald-500'] },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>{row.label}</span>
                          <span className="text-slate-400">
                            {row.segments.length} {row.segments.length > 1 ? tr(language, 'files', 'files') : tr(language, 'file', 'file')}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          {row.segments.map((color, i) => (
                            <div key={i} className={`workflow-bar h-3.5 w-8 rounded-md ${color}`} style={{ transform: 'scaleX(0)' }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="workflow-ai-result rounded-md bg-gradient-to-br from-[#312e81] to-[#6d28d9] p-5 text-white">
                  <div className="flex items-start gap-3">
                    <Brain className="mt-1 h-5 w-5 text-cyan-200" />
                    <p className="text-sm leading-6">
                      {tr(
                        language,
                        'AI kết luận: Bản báo cáo của Huyền còn thiếu phần Trích dẫn trong khi bằng chứng đầu tiên của Thịnh không hỗ trợ đề xuất của anh ấy.',
                        "AI review: User Kathy report lacks the References section while the evidence from User Bruce first evidence does not support his proposal.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- right column: steps list ---- */}
        <div className="order-1 lg:order-2">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-indigo-600">{tr(language, 'Workflow', 'Workflow')}</p>
          <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
            {tr(language, 'Từ công việc nhóm đến đánh giá minh bạch', 'From teamwork to dreamwork')}
          </h2>
          <p className="mt-5 text-pretty text-lg leading-8 text-slate-700">
            {tr(
              language,
              'Một quy trình rõ ràng để giao việc, theo dõi tiến độ, lưu bằng chứng và đánh giá đóng góp của từng thành viên.',
              "A clear flow for assigning tasks, tracking progress, documenting progress, and evaluating each team member's contribution.",
            )}
          </p>
          <div className="mt-8 grid gap-3">
            {workflow.map((step, index) => (
              <div
                key={step.title}
                className={`workflow-step workflow-step-${index} flex gap-4 rounded-md border border-[#dbe5eb] bg-[#fafaff] p-4 transition-colors duration-200 hover:border-[#b4cbd9] hover:bg-[#eef7ff]`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-indigo-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Landing component                                             */
/* ------------------------------------------------------------------ */
const Landing = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const navItems = [
    { label: tr(language, 'Vấn đề', 'Problem'), href: '#problem' },
    { label: tr(language, 'Workflow', 'Workflow'), href: '#workflow' },
    { label: tr(language, 'Vai trò', 'Roles'), href: '#roles' },
    { label: tr(language, 'Gói dịch vụ', 'Pricing'), href: '#pricing' },
  ];

  const painPoints = [
    {
      icon: Users,
      title: tr(language, 'Sinh viên', 'Students'),
      desc: tr(
        language,
        'Làm nhiều nhưng khó chứng minh?\nTeamfair lưu lại công việc, tài liệu và tiến độ để công sức của bạn được ghi nhận rõ ràng',
        'Did the work, but cannot prove it?\nTeamfair records tasks, files, and progress so your effort is easy to verify.',
      ),
    },
    {
      icon: ClipboardList,
      title: tr(language, 'Nhóm trưởng', 'Team leaders'),
      desc: tr(
        language,
        'Theo dõi cả nhóm bằng một cú click\nDễ phát hiện ai đang chậm tiến độ, ai đang “mất tích” trước khi deadline tới',
        'Track the whole team in one click\nSpot who is falling behind or going quiet before the deadline.',
      ),
    },
    {
      icon: BarChart3,
      title: tr(language, 'Giảng viên', 'Lecturers'),
      desc: tr(
        language,
        'Chấm điểm dựa trên dữ liệu thật\nTheo dõi lịch sử làm việc, đánh giá đồng đội và mức độ đóng góp của từng sinh viên',
        "Grade with real evidence\nReview work history, peer feedback, and each student's contribution level.",
      ),
    },
  ];

  const workflow = [
    {
      icon: ClipboardList,
      title: tr(language, 'Mỗi công việc đều có người chịu trách nhiệm', 'Assign owned tasks'),
      desc: tr(language, 'Mỗi nhiệm vụ có người phụ trách, deadline và bằng chứng cần nộp.', 'Each task gets an owner, deadline, and expected evidence.'),
    },
    {
      icon: CheckCircle,
      title: tr(language, 'Lưu tiến độ và file minh chứng', 'Track evidence'),
      desc: tr(language, 'Cập nhật việc đã làm, blocker và proof khi dự án vẫn đang chạy.', 'Track completed work, blockers, and proof while the project is still active.'),
    },
    {
      icon: MessageSquareText,
      title: tr(language, 'Peer review rõ ràng trước khi chấm điểm', 'Collect peer review'),
      desc: tr(language, 'Giúp phản hồi rõ ràng trước khi việc chấm điểm thành tranh cãi.', 'Help provide clear feedback before grading becomes a dispute.'),
    },
    {
      icon: Brain,
      title: tr(language, 'AI tổng hợp mức độ đóng góp', 'AI explains the score'),
      desc: tr(language, 'Teamfair AI giúp phân tích công việc, tiến độ và phản hồi đồng đội để hỗ trợ giảng viên đánh giá công bằng hơn.', 'AI compares tasks, evidence, and peer feedback to explain contribution scores.'),
    },
  ];

  const audiences = [
    {
      icon: GraduationCap,
      label: tr(language, 'Sinh viên', 'Students'),
      title: tr(language, 'Biết điểm dựa trên điều gì', 'Know what the score is based on'),
      desc: tr(language, 'Xem nhiệm vụ được giao, bằng chứng còn thiếu, đánh giá đồng đội và điểm đóng góp trước khi nộp bài.', 'See assigned work, missing proof, peer feedback, and your contribution score before submission.'),
    },
    {
      icon: Crown,
      label: tr(language, 'Nhóm trưởng', 'Team leaders'),
      title: tr(language, 'Sửa lệch workload sớm', 'Fix imbalance early'),
      desc: tr(language, 'Phát hiện thành viên im lặng hoặc quá tải và cân bằng lại việc trước deadline.', 'Find inactive or overloaded members early and rebalance work before the deadline.'),
    },
    {
      icon: BadgeCheck,
      label: tr(language, 'Giảng viên', 'Lecturers'),
      title: tr(language, 'Chấm bằng chứng, không đoán', 'Grade with evidence, not guesswork'),
      desc: tr(language, 'Xem một hồ sơ đóng góp thay vì phải gom screenshot và phản ánh cảm tính.', 'Review one contribution record instead of chasing screenshots and subjective complaints.'),
    },
  ];

  const plans = [
    {
      icon: Sparkles,
      name: 'Free',
      price: '0đ',
      suffix: tr(language, '/ tháng', '/ month'),
      desc: tr(language, 'Dùng mãi miễn phí cho một nhóm sinh viên.', 'Free forever for one student team.'),
      cta: tr(language, 'Bắt đầu miễn phí', 'Start free'),
      features: [
        tr(language, '1 nhóm, tối đa 6 thành viên', '1 team, up to 6 members'),
        tr(language, '20 task cho mỗi nhóm', '20 tasks per team'),
        tr(language, 'Theo dõi tiến độ cơ bản', 'Basic progress tracking'),
      ],
    },
    {
      icon: WalletCards,
      name: 'Pro Group',
      price: '69.000đ',
      suffix: tr(language, '/ nhóm / tháng', '/ team / month'),
      desc: tr(language, 'Khoảng 11.500đ mỗi người với nhóm 6; hoặc 590.000đ mỗi học kỳ.', 'About 11,500 VND per person for a team of 6; or 590,000 VND per semester.'),
      cta: tr(language, 'Chọn Pro Group', 'Choose Pro Group'),
      featured: true,
      features: [
        tr(language, 'Tối đa 30 thành viên', 'Up to 30 members'),
        tr(language, 'Không giới hạn task và project', 'Unlimited tasks and projects'),
        tr(language, 'AI phân tích tiến độ và đóng góp', 'AI progress and contribution insights'),
      ],
    },
    {
      icon: Building2,
      name: 'Class Pack',
      price: '790.000đ',
      suffix: tr(language, '/ học kỳ', '/ semester'),
      desc: tr(language, 'Cho một lớp học 30-60 sinh viên và một giảng viên.', 'For one class of 30-60 students and one lecturer.'),
      cta: tr(language, 'Liên hệ cho lớp học', 'Talk to us'),
      features: [
        tr(language, 'Bao gồm Pro Group cho cả lớp', 'Includes Pro Group for the whole class'),
        tr(language, 'GV quản lý tất cả nhóm', 'Lecturer manages every team'),
        tr(language, 'Xuất báo cáo và bảng điểm', 'Export reports and grade sheets'),
      ],
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#080716] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080716]/90 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080716]"
            aria-label="TeamFair home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-md border border-white/[0.15] bg-white/10 shadow-[0_0_28px_rgba(88,166,255,0.28)]">
              <Users className="h-5 w-5 text-cyan-100" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">TEAMFAIR</span>
          </button>

          <div className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-slate-300 transition hover:text-white">
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="hidden border border-white/10 bg-white/5 text-white hover:bg-white/[0.12] hover:text-white sm:inline-flex"
            >
              {tr(language, 'Đăng nhập', 'Sign in')}
            </Button>
            <Button size="sm" onClick={() => navigate('/login')} className="hidden rounded-md bg-cyan-300 text-[#070615] hover:bg-cyan-200 sm:inline-flex">
              {tr(language, 'Bắt đầu', 'Start free')}
            </Button>
            <LanguageSwitcherButton />
          </div>
        </div>
      </nav>

      {/* ---- hero ---- */}
      <section className="relative overflow-hidden py-14 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(156,92,255,0.52),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(49,137,255,0.5),transparent_28%),linear-gradient(135deg,#070615_0%,#11124b_52%,#14091f_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:52px_52px] opacity-35" />
        <div className="absolute -right-28 top-24 h-72 w-72 rounded-full border border-cyan-300/20 bg-cyan-300/10 blur-3xl" />
        <div className="absolute -left-24 bottom-20 h-80 w-80 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 blur-3xl" />
        <div className="container relative z-10 mx-auto grid min-w-0 items-center gap-12 lg:min-h-[620px] lg:grid-cols-[0.88fr_1.12fr]">
          <div className="w-full min-w-0 max-w-[326px] sm:max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm font-semibold text-cyan-100 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              {tr(language, 'Không gian chấm điểm nhóm công bằng', 'Fair teamwork grading workspace')}
            </p>
            <h1 className="text-balance font-display text-4xl font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              {tr(language, 'Teamwork, but fair', 'Teamwork, but fair')}
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-slate-200 md:text-xl">
              {tr(
                language,
                'Teamfair giúp sinh viên và giảng viên theo dõi công việc, xác minh đóng góp của từng cá nhân và hạn chế những thành viên ỷ lại trong nhóm',
                'TeamFair helps students and lecturers track task, validated contributions of each individuals, and limit free-rider within the project',
              )}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate('/login')}
                className="h-12 w-full rounded-md bg-cyan-300 px-7 text-base font-semibold text-[#070615] shadow-[0_0_30px_rgba(103,232,249,0.34)] hover:bg-cyan-200 sm:w-auto"
              >
                {tr(language, 'Tạo workspace miễn phí', 'Create free workspace')}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-md border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/[0.12] hover:text-white sm:w-auto"
              >
                <a href="#workflow">
                  <PlayCircle className="h-5 w-5" />
                  {tr(language, 'Xem cách Teamfair hoạt động', 'See how Teamfair works')}
                </a>
              </Button>
            </div>
          </div>

          <HeroReviewDemo language={language} />
        </div>
      </section>

      {/* ---- problem section ---- */}
      <section id="problem" className="relative scroll-mt-24 border-y border-white/10 bg-[#0b0a1c] py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(72,95,255,0.2),transparent_25%),radial-gradient(circle_at_88%_88%,rgba(179,90,255,0.18),transparent_30%)]" />
        <div className="container relative mx-auto">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-cyan-200">{tr(language, 'Vấn đề thật', 'The real problem')}</p>
              <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
                {tr(language, 'Đừng để công sức biến mất trong dự án nhóm', "Don't let your hard work go to waste in a group project")}
              </h2>
              <p className="mt-5 max-w-xl text-pretty leading-7 text-slate-300">
                {tr(
                  language,
                  'Teamfair tự động minh bạch hóa mọi đóng góp, giúp giảng viên đánh giá công bằng và chính xác hơn.',
                  'Teamfair automatically makes all contributions transparent, helping lecturer to evaluate them more fairly and accurately.',
                )}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {painPoints.map((item) => (
                <article
                  key={item.title}
                  className="flex min-h-[21rem] flex-col rounded-lg border border-white/[0.12] bg-white/[0.07] p-5 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-cyan-200/[0.35] hover:bg-white/[0.1]"
                >
                  <div className="mb-7 flex items-center justify-between">
                    <item.icon className="h-6 w-6 text-cyan-200" />
                    <span className="h-px flex-1 bg-gradient-to-r from-cyan-200/40 to-transparent" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <ul className="mt-4 flex-1 space-y-3">
                    {item.desc.split('\n').map((point) => (
                      <li key={point} className="grid grid-cols-[auto_1fr] gap-3 text-sm leading-6 text-slate-300">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.75)]" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7 border-t border-white/10 pt-4">
                    <p className="font-display text-3xl font-semibold">{item.metric}</p>
                    <p className="text-xs text-slate-400">{item.metricLabel}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <WorkflowSection language={language} workflow={workflow} />


      {/* ---- pricing section ---- */}
      <section id="pricing" className="scroll-mt-24 bg-[#f7f8ff] py-24 text-[#0d1026]">
        <div className="container mx-auto">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-indigo-600">{tr(language, 'Subscription', 'Subscription')}</p>
              <h2 className="max-w-3xl text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
                {tr(language, 'Chọn gói phù hợp với lớp học', 'Choose the workspace that fits your course')}
              </h2>
            </div>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`flex min-h-[31rem] flex-col rounded-lg border p-6 shadow-[0_22px_55px_rgba(67,56,202,0.10)] ${
                  plan.featured
                    ? 'border-indigo-300 bg-gradient-to-br from-[#19164a] via-[#312e81] to-[#7c3aed] text-white'
                    : 'border-indigo-200 bg-gradient-to-br from-[#f0eeff] to-[#e8e4ff] text-[#0d1026]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${plan.featured ? 'text-cyan-100' : 'text-indigo-600'}`}>
                      {plan.featured ? tr(language, 'Đề xuất', 'Recommended') : tr(language, 'Gói', 'Plan')}
                    </p>
                    <h3 className="mt-3 font-display text-2xl font-semibold">{plan.name}</h3>
                  </div>
                  <span className={`grid h-11 w-11 place-items-center rounded-md ${plan.featured ? 'bg-white/[0.12] text-cyan-100' : 'bg-indigo-50 text-indigo-600'}`}>
                    <plan.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-8">
                  <span className="font-display text-5xl font-semibold">{plan.price}</span>
                  {'suffix' in plan && <span className={`ml-2 text-sm ${plan.featured ? 'text-slate-200' : 'text-slate-500'}`}>{plan.suffix}</span>}
                  <p className={`mt-4 min-h-12 leading-7 ${plan.featured ? 'text-slate-200' : 'text-slate-600'}`}>{plan.desc}</p>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle className={`h-4 w-4 ${plan.featured ? 'text-cyan-200' : 'text-indigo-600'}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-auto h-11 rounded-md ${
                    plan.featured
                      ? 'bg-cyan-300 text-[#070615] hover:bg-cyan-200'
                      : 'bg-[#111240] text-white hover:bg-[#252468]'
                  }`}
                  onClick={() => navigate('/login')}
                >
                  {plan.cta}
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA + footer ---- */}
      <section className="relative overflow-hidden bg-[#090719] py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(80,118,255,0.34),transparent_38%),linear-gradient(180deg,rgba(137,70,255,0.16),transparent_62%)]" />
        <div className="container relative mx-auto">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-6xl">
              {tr(language, 'Làm rõ đóng góp trước khi chấm điểm', 'Make contribution visible before grades are due')}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-300">
              {tr(
                language,
                'TeamFair cho sinh viên, nhóm trưởng và giảng viên một hồ sơ chung về đóng góp.',
                'TeamFair gives students, team leaders, and lecturers one shared record of contribution.',
              )}
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate('/login')}
                className="h-12 rounded-md bg-cyan-300 px-7 text-base font-semibold text-[#070615] hover:bg-cyan-200"
              >
                {tr(language, 'Tạo workspace', 'Create workspace')}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="h-12 rounded-md border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/[0.12] hover:text-white"
              >
                {tr(language, 'Đăng nhập', 'Sign in')}
              </Button>
            </div>
          </div>

          <footer className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
            <p>© 2026 TeamFair</p>
            <div className="flex flex-wrap gap-5">
              <span aria-disabled="true">{tr(language, 'Chính sách riêng tư', 'Privacy')}</span>
              <span aria-disabled="true">{tr(language, 'Điều khoản', 'Terms')}</span>
              <a className="transition hover:text-white" href="mailto:hello@teamfair.app">
                Contact
              </a>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
};

export default Landing;
