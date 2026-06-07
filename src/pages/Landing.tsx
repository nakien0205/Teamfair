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
  ClipboardCheck,
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

const HeroReviewDemo = ({ language }: { language: Language }) => {
  const demoRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.hero-cursor, .hero-loading', { autoAlpha: 0 });
        gsap.set('.hero-analysis, .hero-review-note', { autoAlpha: 1, y: 0 });
        gsap.set('.hero-score-value', { textContent: '38' });
        gsap.set('.hero-low-row', { backgroundColor: '#fff1f2', borderColor: '#fb7185' });
        gsap.set('.hero-low-bar', { scaleX: 0.38 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set('.hero-cursor', { x: -160, y: 175, autoAlpha: 0 });
        gsap.set('.hero-loading, .hero-analysis, .hero-review-note', { autoAlpha: 0, y: 10 });
        gsap.set('.hero-score-value', { textContent: '82' });
        gsap.set('.hero-low-bar', { scaleX: 0.72, transformOrigin: 'left center' });

        const tl = gsap.timeline({
          repeat: -1,
          repeatDelay: 1.1,
          defaults: { ease: 'power2.out' },
        });

        tl.to('.hero-cursor', { autoAlpha: 1, duration: 0.2 })
          .to('.hero-cursor', { x: 0, y: 0, duration: 0.85 })
          .to('.hero-ai-button', { scale: 0.96, duration: 0.12 })
          .to('.hero-ai-button', { scale: 1, duration: 0.18 })
          .to('.hero-loading', { autoAlpha: 1, y: 0, duration: 0.25 }, '<')
          .to('.hero-dot', { y: -5, repeat: 3, yoyo: true, stagger: 0.08, duration: 0.18 })
          .to('.hero-analysis', { autoAlpha: 1, y: 0, duration: 0.35 })
          .to('.hero-low-row', { backgroundColor: '#fff1f2', borderColor: '#fb7185', duration: 0.35 }, '<')
          .to('.hero-low-bar', { scaleX: 0.38, duration: 0.65 }, '<')
          .to('.hero-score-value', { textContent: 38, snap: { textContent: 1 }, duration: 0.7 }, '<')
          .fromTo('.hero-score-ring', { scale: 1.03 }, { scale: 1, duration: 0.45 }, '<')
          .to('.hero-review-note', { autoAlpha: 1, y: 0, duration: 0.35 })
          .to({}, { duration: 1.35 })
          .to('.hero-review-note, .hero-analysis, .hero-loading', { autoAlpha: 0, y: 10, duration: 0.25 })
          .to('.hero-low-row', { backgroundColor: '#ffffff', borderColor: '#e7e2d8', duration: 0.25 }, '<')
          .to('.hero-low-bar', { scaleX: 0.72, duration: 0.35 }, '<')
          .to('.hero-score-value', { textContent: 82, snap: { textContent: 1 }, duration: 0.35 }, '<')
          .to('.hero-cursor', { x: -160, y: 175, autoAlpha: 0, duration: 0.3 }, '<');
      });

      return () => mm.revert();
    },
    { scope: demoRef },
  );

  return (
    <div
      ref={demoRef}
      className="relative mx-auto w-full max-w-3xl rounded-lg border border-[#e7e2d8] bg-white p-4 shadow-[0_28px_90px_rgba(25,25,25,0.12)]"
    >
      <div className="mb-4 flex items-center justify-between border-b border-[#eee9df] pb-4">
        <div>
          <p className="text-sm font-semibold text-[#191919]">{tr(language, 'Dự án UX Research', 'UX Research Project')}</p>
          <p className="text-xs text-[#78736b]">{tr(language, 'Tuần 7 - hồ sơ đóng góp', 'Week 7 - contribution record')}</p>
        </div>
        <button
          type="button"
          className="hero-ai-button inline-flex h-9 items-center gap-2 rounded-md bg-[#191919] px-3 text-xs font-semibold text-white"
        >
          <Brain className="h-4 w-4" />
          AI review
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {[
            [tr(language, 'User A - prototype flow', 'User A - prototype flow'), '86', 'bg-[#2eaadc]', 'scaleX(0.86)'],
            [tr(language, 'User C - interview notes', 'User C - interview notes'), '79', 'bg-[#f0b429]', 'scaleX(0.79)'],
            [tr(language, 'User B - final report', 'User B - final report'), '72', 'bg-[#eb5757]', 'scaleX(0.72)'],
          ].map(([label, value, color, scale], index) => (
            <div
              key={label}
              className={`rounded-md border border-[#e7e2d8] bg-white p-4 ${index === 2 ? 'hero-low-row' : ''}`}
            >
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium text-[#252525]">{label}</span>
                <span className="font-semibold text-[#191919]">{value}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f1eee8]">
                <div
                  className={`h-full origin-left rounded-full ${color} ${index === 2 ? 'hero-low-bar' : ''}`}
                  style={{ transform: scale }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-[#e7e2d8] bg-[#fbfaf7] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#191919]">{tr(language, 'Điểm đóng góp', 'Contribution score')}</span>
            <Layers3 className="h-5 w-5 text-[#78736b]" />
          </div>
          <div className="grid place-items-center">
            <div className="hero-score-ring grid h-36 w-36 place-items-center rounded-full border-[12px] border-[#191919] bg-white">
              <div className="text-center">
                <p className="hero-score-value font-display text-4xl font-semibold text-[#191919]">82</p>
                <p className="text-xs font-medium text-[#78736b]">{tr(language, 'điểm', 'score')}</p>
              </div>
            </div>
          </div>
          <div className="hero-loading mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-[#78736b]">
            <span>{tr(language, 'AI đang kiểm tra', 'AI reviewing')}</span>
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="hero-dot h-1.5 w-1.5 rounded-full bg-[#191919]" />
            ))}
          </div>
          <div className="hero-analysis mt-4 rounded-md border border-[#f3c2c2] bg-[#fff7f7] p-3 text-sm leading-6 text-[#6f1d1d]">
            {tr(
              language,
              'User B thiếu bằng chứng cho phần báo cáo cuối và ít phản hồi peer review.',
              'User B has missing evidence for the final report and low peer-review participation.',
            )}
          </div>
        </div>
      </div>

      <div className="hero-review-note mt-4 rounded-md border border-[#191919] bg-[#191919] p-4 text-sm leading-6 text-white">
        {tr(
          language,
          'AI review: User B chưa hoàn thành vai trò báo cáo cuối, nên điểm đóng góp giảm xuống 38%.',
          'AI review: User B did not complete the final-report role, so the contribution score drops to 38%.',
        )}
      </div>

      <MousePointer2 className="hero-cursor pointer-events-none absolute right-10 top-16 h-7 w-7 fill-[#191919] text-[#191919]" />
    </div>
  );
};

const WorkflowSection = ({ language, workflow }: { language: Language; workflow: WorkflowStep[] }) => {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.workflow-panel, .workflow-proof, .workflow-peer, .workflow-ai-result', { autoAlpha: 1, y: 0 });
        gsap.set('.workflow-bar', { scaleX: 1 });
        gsap.set('.workflow-step', { borderColor: '#d9d3c9', backgroundColor: '#ffffff' });
        gsap.set('.workflow-step-final', { borderColor: '#191919', backgroundColor: '#f7f3ea' });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set('.workflow-proof, .workflow-peer, .workflow-ai-result', { autoAlpha: 0, y: 16 });
        gsap.set('.workflow-bar', { scaleX: 0.15, transformOrigin: 'left center' });

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
          .to('.workflow-step-0', { borderColor: '#191919', backgroundColor: '#f7f3ea', duration: 0.25 }, '<')
          .to('.workflow-proof', { autoAlpha: 1, y: 0, duration: 0.35 })
          .to('.workflow-step-1', { borderColor: '#191919', backgroundColor: '#f7f3ea', duration: 0.25 }, '<')
          .to('.workflow-bar', { scaleX: 1, stagger: 0.1, duration: 0.45 })
          .to('.workflow-peer', { autoAlpha: 1, y: 0, duration: 0.35 }, '<0.1')
          .to('.workflow-step-2', { borderColor: '#191919', backgroundColor: '#f7f3ea', duration: 0.25 }, '<')
          .to('.workflow-ai-result', { autoAlpha: 1, y: 0, duration: 0.35 })
          .to('.workflow-step-3', { borderColor: '#191919', backgroundColor: '#f7f3ea', duration: 0.25 }, '<');
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section id="workflow" ref={sectionRef} className="scroll-mt-24 bg-[#fbfaf7] px-6 py-24 text-[#191919]">
      <div className="container mx-auto grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div className="relative order-2 lg:order-1">
          <div className="grid gap-4 rounded-lg border border-[#e7e2d8] bg-white p-4 shadow-[0_24px_70px_rgba(25,25,25,0.08)]">
            <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
              <div className="workflow-panel rounded-md border border-[#e7e2d8] bg-[#f7f3ea] p-5">
                <p className="mb-4 text-sm font-semibold text-[#78736b]">{tr(language, 'Task board', 'Task board')}</p>
                {[
                  [tr(language, 'User A', 'User A'), tr(language, 'Prototype flow', 'Prototype flow'), 'Done'],
                  [tr(language, 'User C', 'User C'), tr(language, 'Interview notes', 'Interview notes'), 'Done'],
                  [tr(language, 'User B', 'User B'), tr(language, 'Final report', 'Final report'), 'Missing'],
                ].map(([owner, task, state]) => (
                  <div key={task} className="mb-3 rounded-md border border-[#ddd7ca] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[#191919]">{task}</span>
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${state === 'Missing' ? 'bg-[#ffe8e8] text-[#a52a2a]' : 'bg-[#e7f5e7] text-[#1f6f3d]'}`}>
                        {state === 'Missing' ? tr(language, 'Thiếu', 'Missing') : tr(language, 'Xong', 'Done')}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#78736b]">{owner}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="workflow-proof rounded-md border border-[#e7e2d8] bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-semibold">{tr(language, 'Evidence check', 'Evidence check')}</p>
                    <ClipboardCheck className="h-5 w-5 text-[#78736b]" />
                  </div>
                  <div className="space-y-3">
                    {[0.9, 0.78, 0.34].map((scale, index) => (
                      <div key={scale} className="h-3 rounded-full bg-[#f1eee8]">
                        <div
                          className={`workflow-bar h-full origin-left rounded-full ${index === 2 ? 'bg-[#eb5757]' : 'bg-[#2eaadc]'}`}
                          style={{ transform: `scaleX(${scale})` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="workflow-peer rounded-md border border-[#e7e2d8] bg-[#fffdf7] p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#191919]">
                    <MessageSquareText className="h-5 w-5" />
                    {tr(language, 'Peer feedback', 'Peer feedback')}
                  </div>
                  <p className="text-sm leading-6 text-[#5f5a52]">
                    {tr(
                      language,
                      '2 thành viên báo rằng User B chưa nhận phần viết báo cáo cuối.',
                      '2 teammates reported that User B did not take the final report writing role.',
                    )}
                  </p>
                </div>

                <div className="workflow-ai-result rounded-md border border-[#191919] bg-[#191919] p-5 text-white">
                  <div className="flex items-start gap-3">
                    <Brain className="mt-1 h-5 w-5" />
                    <p className="text-sm leading-6">
                      {tr(
                        language,
                        'AI kết luận: User B thiếu bằng chứng và nhận ít xác nhận peer review, điểm đóng góp còn 38%.',
                        'AI conclusion: User B lacks evidence and peer confirmation, leaving a 38% contribution score.',
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#78736b]">{tr(language, 'Workflow', 'Workflow')}</p>
          <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
            {tr(language, 'Từ task đến điểm công bằng', 'From task to fair score')}
          </h2>
          <p className="mt-5 text-pretty text-lg leading-8 text-[#5f5a52]">
            {tr(
              language,
              'Một luồng rõ ràng: giao việc, ghi bằng chứng, lấy peer review, rồi để AI giải thích điểm đóng góp.',
              'One clear flow: assign work, record evidence, collect peer review, then let AI explain the contribution score.',
            )}
          </p>
          <div className="mt-8 grid gap-3">
            {workflow.map((step, index) => (
              <div
                key={step.title}
                className={`workflow-step workflow-step-${index} ${index === workflow.length - 1 ? 'workflow-step-final' : ''} flex gap-4 rounded-md border border-[#e7e2d8] bg-white p-4 transition-colors`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#191919] text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5f5a52]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

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
      title: tr(language, 'Dành cho sinh viên', 'For students'),
      desc: tr(
        language,
        'Nhóm im lặng khiến sinh viên khó chứng minh ai đã thật sự gánh phần việc nào trước khi peer review.',
        'Quiet teams make it hard to prove who carried the work before peer review.',
      ),
      metric: '4.7/5',
      metricLabel: tr(language, 'độ rõ ràng khi review', 'peer clarity score'),
    },
    {
      icon: ClipboardList,
      title: tr(language, 'Dành cho nhóm trưởng', 'For team leaders'),
      desc: tr(
        language,
        'Task rải rác làm nhóm trưởng khó thấy thành viên không hoạt động và blocker cho tới tuần deadline.',
        'Scattered tasks hide inactive members and blockers until deadline week.',
      ),
      metric: '23m',
      metricLabel: tr(language, 'tiết kiệm mỗi lần kiểm tra', 'saved per review'),
    },
    {
      icon: BarChart3,
      title: tr(language, 'Dành cho giảng viên', 'For lecturers'),
      desc: tr(
        language,
        'Điểm cuối kỳ cần lịch sử task, peer feedback và bằng chứng trong một hồ sơ duy nhất.',
        'Final grades need task history, peer feedback, and evidence in one place.',
      ),
      metric: '12',
      metricLabel: tr(language, 'lớp học thử nghiệm', 'course pilots'),
    },
  ];

  const workflow = [
    {
      icon: ClipboardList,
      title: tr(language, 'Giao việc có chủ sở hữu', 'Assign owned tasks'),
      desc: tr(language, 'Mỗi task có người phụ trách, deadline và bằng chứng cần nộp.', 'Each task gets an owner, deadline, and expected evidence.'),
    },
    {
      icon: CheckCircle,
      title: tr(language, 'Ghi bằng chứng khi làm', 'Track evidence'),
      desc: tr(language, 'Cập nhật việc đã làm, blocker và proof khi dự án vẫn đang chạy.', 'Track completed work, blockers, and proof while the project is still active.'),
    },
    {
      icon: MessageSquareText,
      title: tr(language, 'Lấy peer review có cấu trúc', 'Collect structured peer review'),
      desc: tr(language, 'Thu phản hồi rõ ràng trước khi việc chấm điểm thành tranh cãi.', 'Collect structured feedback before grading becomes a dispute.'),
    },
    {
      icon: Brain,
      title: tr(language, 'AI giải thích điểm', 'AI explains the score'),
      desc: tr(language, 'AI so sánh task, bằng chứng và peer feedback để giải thích điểm đóng góp.', 'AI compares tasks, evidence, and peer feedback to explain contribution scores.'),
    },
  ];

  const audiences = [
    {
      icon: GraduationCap,
      label: tr(language, 'Sinh viên', 'Students'),
      title: tr(language, 'Biết điểm dựa trên điều gì', 'Know what the score is based on'),
      desc: tr(language, 'Xem task được giao, bằng chứng còn thiếu, peer feedback và điểm đóng góp trước khi nộp bài.', 'See assigned work, missing proof, peer feedback, and your contribution score before submission.'),
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
      name: 'Starter',
      price: tr(language, 'Miễn phí', 'Free'),
      desc: tr(language, 'Dành cho một dự án nhóm nhỏ.', 'For one small group project.'),
      cta: tr(language, 'Bắt đầu miễn phí', 'Start free'),
      features: [
        tr(language, 'Theo dõi task cốt lõi', 'Core task tracking'),
        tr(language, 'Workspace cho sinh viên', 'Student workspace'),
        tr(language, 'Peer review cơ bản', 'Basic peer review'),
      ],
    },
    {
      icon: WalletCards,
      name: 'Plus',
      price: '$6',
      suffix: tr(language, '/ sinh viên / môn', '/ student / course'),
      desc: tr(language, 'Thêm AI report và xuất dữ liệu cho giảng viên.', 'Add AI reports and lecturer exports.'),
      cta: tr(language, 'Chọn Plus', 'Choose Plus'),
      featured: true,
      features: [
        tr(language, 'Tất cả trong Starter', 'Everything in Starter'),
        tr(language, 'AI contribution report', 'AI contribution reports'),
        tr(language, 'Xuất báo cáo cho lớp học', 'Lecturer-ready exports'),
      ],
    },
    {
      icon: Building2,
      name: 'Campus',
      price: tr(language, 'Tùy chỉnh', 'Custom'),
      desc: tr(language, 'Cho khoa, bộ môn và nhiều lớp học.', 'For departments and multi-course programs.'),
      cta: tr(language, 'Liên hệ', 'Talk to us'),
      features: [
        tr(language, 'Thanh toán tập trung', 'Centralized billing'),
        tr(language, 'Onboarding cho lớp học', 'Course onboarding'),
        tr(language, 'Hỗ trợ ưu tiên', 'Priority support'),
      ],
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaf7] text-[#191919]">
      <nav className="sticky top-0 z-50 border-b border-[#e7e2d8] bg-[#fbfaf7]/90 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919] focus-visible:ring-offset-2"
            aria-label="TeamFair home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-md border border-[#d9d3c9] bg-white">
              <Users className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">TEAMFAIR</span>
          </button>

          <div className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-[#5f5a52] transition hover:text-[#191919]">
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="hidden text-[#191919] hover:bg-[#f1eee8] hover:text-[#191919] sm:inline-flex"
            >
              {tr(language, 'Đăng nhập', 'Sign in')}
            </Button>
            <Button size="sm" onClick={() => navigate('/login')} className="hidden rounded-md bg-[#191919] text-white hover:bg-[#2b2b2b] sm:inline-flex">
              {tr(language, 'Bắt đầu', 'Start free')}
            </Button>
            <LanguageSwitcherButton />
          </div>
        </div>
      </nav>

      <section className="relative px-6 py-16 md:py-24">
        <div className="container mx-auto grid min-h-[calc(100dvh-4rem)] items-center gap-12 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#e7e2d8] bg-white px-3 py-2 text-sm font-semibold text-[#5f5a52]">
              <Sparkles className="h-4 w-4 text-[#f0b429]" />
              {tr(language, 'Workspace chấm điểm nhóm công bằng', 'Fair teamwork grading workspace')}
            </p>
            <h1 className="text-balance font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {tr(language, 'Group projects, graded fairly', 'Group projects, graded fairly')}
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-[#5f5a52] md:text-xl">
              {tr(
                language,
                'TeamFair theo dõi task, peer feedback và tín hiệu AI để biến đóng góp nhóm thành bằng chứng rõ ràng.',
                'TeamFair tracks tasks, peer feedback, and AI contribution signals so group work becomes clear evidence.',
              )}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate('/login')}
                className="h-12 rounded-md bg-[#191919] px-7 text-base font-semibold text-white hover:bg-[#2b2b2b]"
              >
                {tr(language, 'Bắt đầu miễn phí', 'Start free')}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-md border-[#d9d3c9] bg-white px-7 text-base text-[#191919] hover:bg-[#f1eee8] hover:text-[#191919]"
              >
                <a href="#workflow">
                  <PlayCircle className="h-5 w-5" />
                  {tr(language, 'Xem cách hoạt động', 'See how it works')}
                </a>
              </Button>
            </div>
          </div>

          <HeroReviewDemo language={language} />
        </div>
      </section>

      <section id="problem" className="scroll-mt-24 border-y border-[#e7e2d8] bg-white px-6 py-24">
        <div className="container mx-auto">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#78736b]">{tr(language, 'Vấn đề thật', 'The real problem')}</p>
              <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
                {tr(language, 'Ai cũng cần nhìn thấy phần việc thật', 'Every role needs a clear record')}
              </h2>
              <p className="mt-5 max-w-xl text-pretty leading-7 text-[#5f5a52]">
                {tr(
                  language,
                  'TeamFair gom tín hiệu rời rạc thành một hồ sơ đóng góp dễ đọc cho sinh viên, nhóm trưởng và giảng viên.',
                  'TeamFair turns scattered signals into a readable contribution record for students, team leaders, and lecturers.',
                )}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {painPoints.map((item) => (
                <article key={item.title} className="rounded-lg border border-[#e7e2d8] bg-[#fbfaf7] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#191919]">
                  <item.icon className="mb-8 h-6 w-6 text-[#191919]" />
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5f5a52]">{item.desc}</p>
                  <div className="mt-7 border-t border-[#e7e2d8] pt-4">
                    <p className="font-display text-3xl font-semibold">{item.metric}</p>
                    <p className="text-xs text-[#78736b]">{item.metricLabel}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <WorkflowSection language={language} workflow={workflow} />

      <section id="roles" className="scroll-mt-24 bg-[#191919] px-6 py-24 text-white">
        <div className="container mx-auto">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#c6c0b6]">{tr(language, 'Cho mọi vai trò', 'For every role')}</p>
            <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
              {tr(language, 'Mỗi người thấy đúng thứ họ cần', 'Each role sees what matters')}
            </h2>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {audiences.map((item, index) => (
              <article
                key={item.label}
                className={`rounded-lg border border-white/15 bg-white/[0.06] p-6 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.1] ${
                  index === 1 ? 'lg:mt-10' : ''
                }`}
              >
                <div className="mb-10 flex items-center justify-between">
                  <span className="rounded-md bg-white/10 px-3 py-1 text-sm text-[#e7e2d8]">{item.label}</span>
                  <item.icon className="h-6 w-6 text-[#f0b429]" />
                </div>
                <h3 className="text-balance font-display text-2xl font-semibold">{item.title}</h3>
                <p className="mt-4 leading-7 text-[#d5d0c7]">{item.desc}</p>
                <div className="mt-8 rounded-md border border-white/10 bg-white/[0.06] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-white">
                    <span className="h-2 w-2 rounded-full bg-[#2eaadc]" />
                    {tr(language, 'Workspace sau đăng nhập', 'Workspace after sign-in')}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="h-14 rounded-md bg-[#2eaadc]/30" />
                    <span className="h-14 rounded-md bg-[#f0b429]/30" />
                    <span className="h-14 rounded-md bg-[#eb5757]/30" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 bg-[#fbfaf7] px-6 py-24 text-[#191919]">
        <div className="container mx-auto">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#78736b]">{tr(language, 'Subscription', 'Subscription')}</p>
              <h2 className="max-w-3xl text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
                {tr(language, 'Chọn workspace phù hợp với lớp học', 'Choose the workspace that fits your course')}
              </h2>
            </div>
            <p className="max-w-md text-pretty leading-7 text-[#5f5a52]">
              {tr(
                language,
                'Bắt đầu với tracking cốt lõi, sau đó thêm AI report, export cho giảng viên và hỗ trợ theo lớp.',
                'Start with core tracking, then add AI reports, lecturer exports, and course-level support.',
              )}
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`flex min-h-[31rem] flex-col rounded-lg border p-6 ${
                  plan.featured
                    ? 'border-[#191919] bg-[#191919] text-white'
                    : 'border-[#e7e2d8] bg-white text-[#191919]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${plan.featured ? 'text-[#f0b429]' : 'text-[#78736b]'}`}>
                      {plan.featured ? tr(language, 'Đề xuất', 'Recommended') : tr(language, 'Gói', 'Plan')}
                    </p>
                    <h3 className="mt-3 font-display text-2xl font-semibold">{plan.name}</h3>
                  </div>
                  <span className={`grid h-11 w-11 place-items-center rounded-md ${plan.featured ? 'bg-white/[0.12] text-[#f0b429]' : 'bg-[#f7f3ea] text-[#191919]'}`}>
                    <plan.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-8">
                  <span className="font-display text-5xl font-semibold">{plan.price}</span>
                  {'suffix' in plan && <span className={`ml-2 text-sm ${plan.featured ? 'text-[#d5d0c7]' : 'text-[#78736b]'}`}>{plan.suffix}</span>}
                  <p className={`mt-4 min-h-12 leading-7 ${plan.featured ? 'text-[#d5d0c7]' : 'text-[#5f5a52]'}`}>{plan.desc}</p>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle className={`h-4 w-4 ${plan.featured ? 'text-[#f0b429]' : 'text-[#191919]'}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-auto h-11 rounded-md ${
                    plan.featured
                      ? 'bg-white text-[#191919] hover:bg-[#f1eee8]'
                      : 'bg-[#191919] text-white hover:bg-[#2b2b2b]'
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

      <section className="relative overflow-hidden bg-white px-6 py-20">
        <div className="container mx-auto">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-5 text-sm font-semibold text-[#78736b]">
              {tr(language, 'Không cần thẻ cho Starter', 'No credit card for Starter')} - EN / VI
            </p>
            <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-6xl">
              {tr(language, 'Làm rõ đóng góp trước khi chấm điểm', 'Make contribution visible before grades are due')}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-[#5f5a52]">
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
                className="h-12 rounded-md bg-[#191919] px-7 text-base font-semibold text-white hover:bg-[#2b2b2b]"
              >
                {tr(language, 'Tạo workspace', 'Create workspace')}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="h-12 rounded-md border-[#d9d3c9] bg-white px-7 text-base text-[#191919] hover:bg-[#f1eee8] hover:text-[#191919]"
              >
                {tr(language, 'Đăng nhập', 'Sign in')}
              </Button>
            </div>
          </div>

          <footer className="mt-16 flex flex-col gap-4 border-t border-[#e7e2d8] pt-8 text-sm text-[#78736b] md:flex-row md:items-center md:justify-between">
            <p>© 2026 TeamFair</p>
            <div className="flex flex-wrap gap-5">
              <span aria-disabled="true">{tr(language, 'Chính sách riêng tư', 'Privacy')}</span>
              <span aria-disabled="true">{tr(language, 'Điều khoản', 'Terms')}</span>
              <a className="transition hover:text-[#191919]" href="mailto:hello@teamfair.app">
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
