import { useNavigate } from 'react-router-dom';
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
  PlayCircle,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import LanguageSwitcherButton from '@/components/LanguageSwitcherButton';
import { useLanguage } from '@/context/LanguageContext';
import { tr } from '@/lib/i18n';

const Landing = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const painPoints = [
    {
      icon: Users,
      title: tr(language, 'Nhóm im lặng', 'Silent workload'),
      desc: tr(
        language,
        'Thành viên làm nhiều không có bằng chứng, người ít đóng góp vẫn khó phát hiện sớm.',
        'Students who carry the work lack evidence, while low contribution stays hidden too long.',
      ),
      metric: '4.7/5',
      metricLabel: tr(language, 'độ rõ ràng khi review', 'peer clarity score'),
    },
    {
      icon: ClipboardList,
      title: tr(language, 'Nước rút cuối kỳ', 'Last-week panic'),
      desc: tr(
        language,
        'Task, deadline và phản hồi nằm rải rác khiến nhóm chỉ thấy rủi ro khi đã muộn.',
        'Tasks, deadlines, and feedback scatter across tools until risk appears too late.',
      ),
      metric: '23m',
      metricLabel: tr(language, 'tiết kiệm mỗi lần kiểm tra', 'saved per review'),
    },
    {
      icon: BarChart3,
      title: tr(language, 'Tranh cãi điểm số', 'Grade disputes'),
      desc: tr(
        language,
        'Giảng viên cần một hồ sơ đóng góp rõ ràng thay vì chỉ dựa vào cảm nhận cuối dự án.',
        'Lecturers need a clear contribution record instead of end-of-project guesswork.',
      ),
      metric: '12',
      metricLabel: tr(language, 'lớp học thử nghiệm', 'course pilots'),
    },
  ];

  const workflow = [
    {
      icon: ClipboardList,
      title: tr(language, 'Lập kế hoạch', 'Plan work'),
      desc: tr(language, 'Tạo task, deadline và vai trò rõ ràng cho từng thành viên.', 'Create tasks, deadlines, and roles for every teammate.'),
    },
    {
      icon: CheckCircle,
      title: tr(language, 'Ghi nhận tiến độ', 'Log progress'),
      desc: tr(language, 'Theo dõi việc hoàn thành và điểm nghẽn theo thời gian thực.', 'Track completion and blockers as the project moves.'),
    },
    {
      icon: MessageSquareText,
      title: tr(language, 'Review đồng đội', 'Review peers'),
      desc: tr(language, 'Thu thập đánh giá ẩn danh có cấu trúc, không phải cảm tính rời rạc.', 'Collect structured anonymous feedback, not scattered opinions.'),
    },
    {
      icon: Brain,
      title: tr(language, 'Giải thích đóng góp', 'Explain contribution'),
      desc: tr(language, 'AI tóm tắt tín hiệu để nhóm và giảng viên hiểu điểm số.', 'AI summarizes signals so teams and lecturers understand the score.'),
    },
  ];

  const audiences = [
    {
      icon: GraduationCap,
      label: tr(language, 'Sinh viên', 'Students'),
      title: tr(language, 'Biết mình đang đứng ở đâu', 'Know where you stand'),
      desc: tr(language, 'Xem task, phản hồi và mức đóng góp trước khi nộp bài.', 'See tasks, feedback, and contribution level before submission.'),
    },
    {
      icon: Crown,
      label: tr(language, 'Nhóm trưởng', 'Team leaders'),
      title: tr(language, 'Thấy blocker sớm hơn', 'Spot blockers early'),
      desc: tr(language, 'Ưu tiên việc quan trọng và cân bằng lại workload khi còn kịp.', 'Prioritize critical work and rebalance workload while there is time.'),
    },
    {
      icon: BadgeCheck,
      label: tr(language, 'Giảng viên', 'Lecturers'),
      title: tr(language, 'Chấm điểm có bằng chứng', 'Grade with evidence'),
      desc: tr(language, 'Xem báo cáo đóng góp, peer review và lịch sử task trong một nơi.', 'Review contribution reports, peer feedback, and task history in one place.'),
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
    <main className="min-h-screen overflow-hidden bg-[#080716] text-white">
      <section className="relative min-h-[100dvh] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(156,92,255,0.52),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(49,137,255,0.5),transparent_28%),linear-gradient(135deg,#070615_0%,#11124b_52%,#14091f_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:52px_52px] opacity-35" />
        <div className="absolute -right-28 top-24 h-72 w-72 rounded-full border border-cyan-300/20 bg-cyan-300/10 blur-3xl" />
        <div className="absolute -left-24 bottom-20 h-80 w-80 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 blur-3xl" />

        <nav className="container relative z-10 mx-auto flex items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080716]"
            aria-label="TeamFair home"
          >
            <span className="grid h-10 w-10 place-items-center rounded-md border border-white/[0.15] bg-white/10 shadow-[0_0_28px_rgba(88,166,255,0.28)] backdrop-blur">
              <Users className="h-5 w-5 text-cyan-100" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">TEAMFAIR</span>
          </button>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="hidden border border-white/10 bg-white/5 text-white hover:bg-white/[0.12] hover:text-white sm:inline-flex"
            >
              {tr(language, 'Đăng nhập', 'Sign in')}
            </Button>
            <LanguageSwitcherButton />
          </div>
        </nav>

        <div className="container relative z-10 mx-auto grid min-h-[calc(100dvh-5rem)] items-center gap-12 px-6 py-16 lg:grid-cols-[0.86fr_1.14fr] lg:py-10">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm font-medium text-cyan-100 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              {tr(language, 'Workspace chấm điểm nhóm công bằng', 'Fair teamwork grading workspace')}
            </p>
            <h1 className="text-balance font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {tr(language, 'Group projects, graded fairly', 'Group projects, graded fairly')}
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-slate-200 md:text-xl">
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
                className="h-12 rounded-md bg-cyan-300 px-7 text-base font-semibold text-[#070615] shadow-[0_0_30px_rgba(103,232,249,0.34)] hover:bg-cyan-200"
              >
                {tr(language, 'Bắt đầu miễn phí', 'Start free')}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-md border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/[0.12] hover:text-white"
              >
                <a href="#workflow">
                  <PlayCircle className="h-5 w-5" />
                  {tr(language, 'Xem cách hoạt động', 'See how it works')}
                </a>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-3xl">
            <div className="absolute -inset-5 rounded-lg bg-gradient-to-br from-fuchsia-500/30 via-blue-500/20 to-cyan-300/30 blur-2xl" />
            <div className="relative rounded-lg border border-white/[0.16] bg-white/[0.08] p-4 shadow-[0_30px_100px_rgba(42,67,255,0.28)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-medium text-cyan-100">{tr(language, 'Dự án UX Research', 'UX Research Project')}</p>
                  <p className="text-xs text-slate-300">{tr(language, 'Tuần 7 - contribution snapshot', 'Week 7 - contribution snapshot')}</p>
                </div>
                <span className="rounded-md bg-fuchsia-300/[0.15] px-3 py-1 text-xs font-medium text-fuchsia-100">
                  AI review
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  {[
                    [tr(language, 'Prototype flow', 'Prototype flow'), '86%', 'bg-cyan-300'],
                    [tr(language, 'Interview notes', 'Interview notes'), '64%', 'bg-blue-300'],
                    [tr(language, 'Final report', 'Final report'), '41%', 'bg-fuchsia-300'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-md border border-white/10 bg-[#0b0d2a]/80 p-4">
                      <div className="mb-3 flex items-center justify-between text-sm">
                        <span className="text-slate-100">{label}</span>
                        <span className="font-medium text-white">{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${color}`} style={{ width: value }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border border-cyan-200/20 bg-cyan-200/10 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-sm font-medium text-cyan-50">{tr(language, 'Điểm đóng góp', 'Contribution score')}</span>
                    <Layers3 className="h-5 w-5 text-cyan-100" />
                  </div>
                  <div className="grid place-items-center">
                    <div className="grid h-40 w-40 place-items-center rounded-full border-[12px] border-cyan-300/90 bg-[#07112f] shadow-[0_0_48px_rgba(103,232,249,0.32)]">
                      <div className="text-center">
                        <p className="font-display text-4xl font-semibold">82</p>
                        <p className="text-xs text-cyan-100">{tr(language, 'cân bằng', 'balanced')}</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-6 text-slate-200">
                    {tr(
                      language,
                      'AI phát hiện workload ổn định nhưng cần review phần báo cáo cuối.',
                      'AI found stable workload, with final report review still needed.',
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-[#0b0a1c] px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(72,95,255,0.2),transparent_25%),radial-gradient(circle_at_88%_88%,rgba(179,90,255,0.18),transparent_30%)]" />
        <div className="container relative mx-auto">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="mb-4 text-sm font-medium text-cyan-200">{tr(language, 'Vấn đề thật', 'The real problem')}</p>
              <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
                {tr(language, 'Group work breaks at the same points', 'Group work breaks at the same points')}
              </h2>
              <p className="mt-5 max-w-xl text-pretty leading-7 text-slate-300">
                {tr(
                  language,
                  'TeamFair gom tín hiệu rời rạc thành một hồ sơ đóng góp dễ đọc cho cả sinh viên và giảng viên.',
                  'TeamFair turns scattered signals into a readable contribution record for students and lecturers.',
                )}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {painPoints.map((item) => (
                <article key={item.title} className="rounded-lg border border-white/[0.12] bg-white/[0.07] p-5 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-cyan-200/[0.35] hover:bg-white/[0.1]">
                  <item.icon className="mb-8 h-6 w-6 text-cyan-200" />
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.desc}</p>
                  <div className="mt-7 border-t border-white/10 pt-4">
                    <p className="font-display text-3xl font-semibold text-white">{item.metric}</p>
                    <p className="text-xs text-slate-400">{item.metricLabel}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="relative bg-[#f6f4ff] px-6 py-24 text-[#101126]">
        <div className="container mx-auto grid gap-12 lg:grid-cols-[1.18fr_0.82fr] lg:items-center">
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-4 rounded-lg bg-gradient-to-tr from-blue-500/[0.18] via-fuchsia-500/[0.16] to-cyan-300/20 blur-xl" />
            <div className="relative grid gap-4 rounded-lg border border-[#d8d4ff] bg-white/80 p-4 shadow-[0_24px_70px_rgba(67,56,202,0.18)] backdrop-blur">
              <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-md bg-[#111240] p-5 text-white">
                  <p className="mb-4 text-sm text-cyan-200">{tr(language, 'Task board', 'Task board')}</p>
                  {workflow.slice(0, 3).map((step, index) => (
                    <div key={step.title} className="mb-3 rounded-md border border-white/10 bg-white/[0.08] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{step.title}</span>
                        <span className="text-xs text-cyan-200">0{index + 1}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{step.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="rounded-md border border-[#d9d3ff] bg-[#fafaff] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-medium">{tr(language, 'Peer feedback', 'Peer feedback')}</p>
                      <MessageSquareText className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="space-y-3">
                      {[78, 64, 91].map((width, index) => (
                        <div key={width} className="h-3 rounded-full bg-indigo-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-fuchsia-500" style={{ width: `${width - index * 4}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md bg-gradient-to-br from-[#312e81] to-[#6d28d9] p-5 text-white">
                    <div className="flex items-start gap-3">
                      <Brain className="mt-1 h-5 w-5 text-cyan-200" />
                      <p className="text-sm leading-6">
                        {tr(
                          language,
                          'AI summary: đóng góp ổn định, cần phản hồi rõ hơn ở phần slide cuối.',
                          'AI summary: contribution is steady, final slide feedback needs more clarity.',
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="mb-4 text-sm font-semibold text-indigo-600">{tr(language, 'Workflow', 'Workflow')}</p>
            <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
              {tr(language, 'From task to fair score', 'From task to fair score')}
            </h2>
            <p className="mt-5 text-pretty text-lg leading-8 text-slate-700">
              {tr(
                language,
                'Một luồng duy nhất cho planning, tiến độ, peer review và giải thích điểm đóng góp.',
                'One flow for planning, progress, peer review, and contribution explanations.',
              )}
            </p>
            <div className="mt-8 grid gap-3">
              {workflow.map((step, index) => (
                <div key={step.title} className="flex gap-4 rounded-md border border-indigo-100 bg-white/70 p-4">
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

      <section className="relative bg-[#0a0820] px-6 py-24">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(48,70,255,0.18),transparent_34%),radial-gradient(circle_at_76%_28%,rgba(211,109,255,0.22),transparent_30%)]" />
        <div className="container relative mx-auto">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-medium text-cyan-200">{tr(language, 'Cho mọi vai trò', 'For every role')}</p>
            <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
              {tr(language, 'Built for every side of the group project', 'Built for every side of the group project')}
            </h2>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {audiences.map((item, index) => (
              <article
                key={item.label}
                className={`rounded-lg border border-white/[0.12] bg-white/[0.07] p-6 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-blue-200/[0.35] ${
                  index === 1 ? 'lg:mt-10' : ''
                }`}
              >
                <div className="mb-10 flex items-center justify-between">
                  <span className="rounded-md bg-white/10 px-3 py-1 text-sm text-slate-200">{item.label}</span>
                  <item.icon className="h-6 w-6 text-cyan-200" />
                </div>
                <h3 className="text-balance font-display text-2xl font-semibold">{item.title}</h3>
                <p className="mt-4 leading-7 text-slate-300">{item.desc}</p>
                <div className="mt-8 rounded-md border border-white/10 bg-[#090a2a] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-cyan-100">
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                    {tr(language, 'Workspace sau đăng nhập', 'Workspace after sign-in')}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="h-14 rounded-md bg-blue-400/25" />
                    <span className="h-14 rounded-md bg-fuchsia-400/25" />
                    <span className="h-14 rounded-md bg-cyan-300/25" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8ff] px-6 py-24 text-[#0d1026]">
        <div className="container mx-auto">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-4 text-sm font-semibold text-indigo-600">{tr(language, 'Subscription', 'Subscription')}</p>
              <h2 className="max-w-3xl text-balance font-display text-4xl font-semibold leading-tight md:text-5xl">
                {tr(language, 'Choose the workspace that fits your course', 'Choose the workspace that fits your course')}
              </h2>
            </div>
            <p className="max-w-md text-pretty leading-7 text-slate-600">
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
                className={`flex min-h-[31rem] flex-col rounded-lg border p-6 shadow-[0_22px_55px_rgba(67,56,202,0.12)] ${
                  plan.featured
                    ? 'border-indigo-300 bg-gradient-to-br from-[#19164a] via-[#312e81] to-[#7c3aed] text-white'
                    : 'border-indigo-100 bg-white text-[#0d1026]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium ${plan.featured ? 'text-cyan-100' : 'text-indigo-600'}`}>
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

      <section className="relative overflow-hidden bg-[#090719] px-6 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(80,118,255,0.34),transparent_38%),linear-gradient(180deg,rgba(137,70,255,0.16),transparent_62%)]" />
        <div className="container relative mx-auto">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-5 text-sm font-medium text-cyan-200">
              {tr(language, 'Không cần thẻ cho Starter', 'No credit card for Starter')} · EN / VI
            </p>
            <h2 className="text-balance font-display text-4xl font-semibold leading-tight md:text-6xl">
              {tr(language, 'Make group credit visible before grades are due.', 'Make group credit visible before grades are due.')}
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
