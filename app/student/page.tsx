"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import LoadingScreen from "../components/LoadingScreen";
import Swal from "sweetalert2";
import { tx } from "../lib/theme";
import { StudentHeader } from "./_components/StudentHeader";
import { DashboardTab } from "./_components/DashboardTab";
import { CoursesTab } from "./_components/CoursesTab";
import { StudyTab } from "./_components/StudyTab";
import { ProfileTab } from "./_components/ProfileTab";

export default function StudentDashboard() {
  const { role, isAuthenticated, displayName, logout, darkMode, toggleDarkMode, assignments, submissions, addSubmission, chapters, topics, lessons, courses, loadingData, enrollInCourse, currentUserId } = useUser();
  const router = useRouter();
  const [tab,          setTab]          = useState<"dashboard"|"courses"|"study"|"profile">("dashboard");
  const [search,       setSearch]       = useState("");
  const [levelFilter,  setLevelFilter]  = useState<string>("all");
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [studyTab,     setStudyTab]     = useState<"overview"|"resources"|"tasks">("overview");

  // Student task states
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // File submission state
  const [fileNameInput, setFileNameInput] = useState("");

  // Interactive Quiz state
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  const enrolledCourses = courses.filter(c => c.isEnrolled);

  const handleEnroll = async (courseId: string, requiresCode: boolean) => {
    if (requiresCode) {
      const { value: code } = await Swal.fire({
        title: 'ป้อนรหัสเข้าเรียน (Enroll Code)',
        text: 'วิชานี้ต้องใส่รหัสเข้าเรียนจากครูผู้สอนในการลงทะเบียน',
        input: 'text',
        inputPlaceholder: 'กรอกรหัสเข้าเรียน...',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันการลงทะเบียน',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
          if (!value) {
            return 'กรุณากรอกรหัสผ่านก่อนลงทะเบียนครับ';
          }
        }
      });
      if (code) {
        await enrollInCourse(courseId, code);
      }
    } else {
      const result = await Swal.fire({
        title: 'ยืนยันการลงทะเบียน',
        text: 'คุณต้องการลงทะเบียนเข้าเรียนในวิชานี้ใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
      });
      if (result.isConfirmed) {
        await enrollInCourse(courseId);
      }
    }
  };

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "student") {
      router.push(role === "admin" ? "/admin" : "/teacher");
    }
  }, [isAuthenticated, role, router, loadingData]);

  if (loadingData) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || role !== "student") {
    return null;
  }

  const visibleCourses = courses.filter(c => c.isEnrolled || c.isOpen || c.enrollCodeRequired);

  const filtered = visibleCourses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) &&
    (levelFilter === "all" || c.level === levelFilter)
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>

      <StudentHeader
        displayName={displayName}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        logout={logout}
        tab={tab}
        setTab={setTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        router={router}
      />

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ─── 1. TAB: DASHBOARD ─── */}
        {tab === "dashboard" && (
          <DashboardTab
            displayName={displayName}
            enrolledCourses={enrolledCourses}
            setTab={setTab}
            setSelectedCourseId={setSelectedCourseId}
          />
        )}

        {/* ─── 2. TAB: COURSES ─── */}
        {tab === "courses" && (
          <CoursesTab
            courses={courses}
            filtered={filtered}
            search={search}
            setSearch={setSearch}
            levelFilter={levelFilter}
            setLevelFilter={setLevelFilter}
            setSelectedCourseId={setSelectedCourseId}
            setTab={setTab}
            handleEnroll={handleEnroll}
          />
        )}

        {/* ─── 3. TAB: STUDY (INTERACTIVE STUDY ROOM) ─── */}
        {tab === "study" && (
          <StudyTab
            enrolledCourses={enrolledCourses}
            courses={courses}
            chapters={chapters}
            topics={topics}
            lessons={lessons}
            assignments={assignments}
            submissions={submissions}
            currentUserId={currentUserId}
            displayName={displayName}
            addSubmission={addSubmission}
            setTab={setTab}
            selectedCourseId={selectedCourseId}
            setSelectedCourseId={setSelectedCourseId}
            activeLessonId={activeLessonId}
            setActiveLessonId={setActiveLessonId}
            selectedAssignmentId={selectedAssignmentId}
            setSelectedAssignmentId={setSelectedAssignmentId}
            studyTab={studyTab}
            setStudyTab={setStudyTab}
            fileNameInput={fileNameInput}
            setFileNameInput={setFileNameInput}
            currentQuizQuestionIndex={currentQuizQuestionIndex}
            setCurrentQuizQuestionIndex={setCurrentQuizQuestionIndex}
            quizAnswers={quizAnswers}
            setQuizAnswers={setQuizAnswers}
          />
        )}

        {/* ─── 4. TAB: PROFILE (ACHIEVEMENT DASHBOARD) ─── */}
        {tab === "profile" && (
          <ProfileTab displayName={displayName} />
        )}

      </main>

      {/* FOOTER */}
      <footer className="py-8 border-t text-center text-xs mt-12" style={{ borderColor: tx.borderS, color: tx.faint }}>
        <p>© 2026 Math by Seng — Premium Student Area Platform</p>
      </footer>
    </div>
  );
}
