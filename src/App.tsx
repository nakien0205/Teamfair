import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TeamProvider } from "@/context/TeamContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import StudentWorkspace from "./pages/StudentDashboard";
import StudentOverview from "./pages/StudentOverview";
import StudentMyGroup from "./pages/StudentMyGroup";
import StudentMyTasks from "./pages/StudentMyTasks";
import StudentTaskDetail from "./pages/StudentTaskDetail";
import StudentTaskSubmit from "./pages/StudentTaskSubmit";
import StudentWorkLogs from "./pages/StudentWorkLogs";
import StudentPeerReview from "./pages/StudentPeerReview";
import StudentMyContribution from "./pages/StudentMyContribution";
import StudentFeedback from "./pages/StudentFeedback";
import StudentAppeals from "./pages/StudentAppeals";
import LecturerDashboard from "./pages/LecturerDashboard";
import LecturerRubricsList from "./pages/LecturerRubricsList";
import LecturerRubricUpload from "./pages/LecturerRubricUpload";
import LecturerRubricPreview from "./pages/LecturerRubricPreview";
import LecturerRubricGrade from "./pages/LecturerRubricGrade";
import LecturerRubricDetail from "./pages/LecturerRubricDetail";
import LecturerRubricEdit from "./pages/LecturerRubricEdit";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ProjectManagement from "./pages/ProjectManagement";
import * as Sentry from "@sentry/react";
import SentryErrorBoundaryFallback from "@/components/SentryErrorBoundaryFallback";

import LecturerLayout from "./layouts/LecturerLayout";
import LecturerGroupsPage from "./pages/LecturerGroupsPage";
import LecturerGroupDetailPage from "./pages/LecturerGroupDetailPage";
import LecturerProgressPage from "./pages/LecturerProgressPage";
import LecturerReportsPage from "./pages/LecturerReportsPage";
import LecturerStudentEvaluationsPage from "./pages/LecturerStudentEvaluationsPage";
import LecturerContributionPage from "./pages/LecturerContributionPage";
import LecturerExportReportsPage from "./pages/LecturerExportReportsPage";
import LecturerDocumentsPage from "./pages/LecturerDocumentsPage";
import LecturerActivityPage from "./pages/LecturerActivityPage";
import LecturerGradingProjectGroups from "./pages/LecturerGradingProjectGroups";

import StudentLayout from "./layouts/StudentLayout";
import StudentDocuments from "./pages/StudentDocuments";
import LeaderTasks from "./pages/LeaderTasks";
import LeaderSubmissions from "./pages/LeaderSubmissions";
import LeaderEvaluations from "./pages/LeaderEvaluations";
import LeaderProgress from "./pages/LeaderProgress";

const queryClient = new QueryClient();

const App = () => (
  <Sentry.ErrorBoundary
    fallback={({ error, componentStack, resetError }) => (
      <SentryErrorBoundaryFallback
        error={error}
        componentStack={componentStack}
        resetError={resetError}
      />
    )}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <TeamProvider>
              <NotificationProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/dashboard-student" element={<Navigate to="/student/dashboard" replace />} />
                    
                    {/* Student Workspace Routes wrapped in StudentLayout */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute allowedRoles={["student"]}>
                          <StudentLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route path="student/dashboard" element={<StudentOverview />} />
                      <Route path="student/my-group" element={<StudentMyGroup />} />
                      <Route path="student/my-tasks" element={<StudentMyTasks />} />
                      <Route path="student/tasks/:taskId" element={<StudentTaskDetail />} />
                      <Route path="student/tasks/:taskId/submit" element={<StudentTaskSubmit />} />
                      <Route path="student/work-logs" element={<StudentWorkLogs />} />
                      <Route path="student/peer-review" element={<StudentPeerReview />} />
                      <Route path="student/my-contribution" element={<StudentMyContribution />} />
                      <Route path="student/feedback" element={<StudentFeedback />} />
                      <Route path="student/appeals" element={<StudentAppeals />} />
                      <Route path="student/workspace" element={<StudentWorkspace />} />
                      <Route path="student/documents" element={<StudentDocuments />} />
                      <Route path="leader/tasks" element={<LeaderTasks />} />
                      <Route path="leader/submissions" element={<LeaderSubmissions />} />
                      <Route path="leader/member-evaluations" element={<LeaderEvaluations />} />
                      <Route path="leader/progress-report" element={<LeaderProgress />} />
                    </Route>
                    <Route path="/dashboard-lecturer" element={<Navigate to="/lecturer/dashboard" replace />} />
                    
                    {/* Lecturer Workspace Routes wrapped in LecturerLayout */}
                    <Route
                      path="/lecturer"
                      element={
                        <ProtectedRoute allowedRoles={["lecturer", "admin"]}>
                          <LecturerLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route path="dashboard" element={<LecturerDashboard />} />
                      <Route path="groups" element={<LecturerGroupsPage />} />
                      <Route path="groups/:groupId" element={<LecturerGroupDetailPage />} />
                      <Route path="progress" element={<LecturerProgressPage />} />
                      <Route path="reports" element={<LecturerReportsPage />} />
                      
                      <Route path="rubrics" element={<LecturerRubricsList />} />
                      <Route path="rubrics/upload" element={<LecturerRubricUpload />} />
                      <Route path="rubrics/preview" element={<LecturerRubricPreview />} />
                      <Route path="rubrics/:rubricId" element={<LecturerRubricDetail />} />
                      <Route path="rubrics/:rubricId/edit" element={<LecturerRubricEdit />} />
                      
                      <Route path="grading" element={<Navigate to="/lecturer/rubrics?tab=grading" replace />} />
                      <Route path="grading/projects/:projectId/groups/:groupId" element={<LecturerGradingProjectGroups />} />
                      <Route path="grading/projects/:projectId/groups/:groupId/rubrics/:rubricId" element={<LecturerRubricGrade />} />
                      
                      <Route path="student-evaluations" element={<LecturerStudentEvaluationsPage />} />
                      <Route path="contribution" element={<LecturerContributionPage />} />
                      <Route path="export-reports" element={<LecturerExportReportsPage />} />
                      
                      <Route path="documents" element={<LecturerDocumentsPage />} />
                      <Route path="activity" element={<LecturerActivityPage />} />
                    </Route>

                    <Route
                      path="/projects"
                      element={
                        <ProtectedRoute>
                          <ProjectManagement />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/project-management-sandbox" element={<Navigate to="/projects" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </NotificationProvider>
            </TeamProvider>
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
