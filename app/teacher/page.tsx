"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser, type QuizQuestion, type Assignment, type StudentSubmission, type Lesson } from "../context/UserContext";
import LoadingScreen from "../components/LoadingScreen";
import { tx } from "../lib/theme";
import { TeacherHeader } from "./_components/TeacherHeader";
import { CourseCreationModal } from "./_components/CourseCreationModal";
import { DashboardTab } from "./_components/DashboardTab";
import { CoursesTab } from "./_components/CoursesTab";
import { LessonEditModal } from "./_components/LessonEditModal";
import { AssignmentFormModal } from "./_components/AssignmentFormModal";
import { CourseEnrollSettingsModal } from "./_components/CourseEnrollSettingsModal";
import { AddLessonModal } from "./_components/AddLessonModal";
import { AddStudentModal } from "./_components/AddStudentModal";

export default function TeacherDashboard() {
  const { role, isAuthenticated, displayName, logout, darkMode, toggleDarkMode, assignments, addAssignment, submissions, lessons, addLesson, updateLesson, courses, currentUserId, createCourse, loadingData, enrollments, teacherAddStudent, teacherRemoveStudent, updateCourseSettings, appUsers, levels, chapters, addChapter, topics, addTopic } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "courses" | "students">("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Course Creation state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseGradient, setCourseGradient] = useState("from-indigo-600 to-purple-600");
  const [courseLevelValue, setCourseLevelValue] = useState("");
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [chosenStudentId, setChosenStudentId] = useState("");

  // Modal states for Refactoring
  const [showEnrollSettingsModal, setShowEnrollSettingsModal] = useState(false);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [addLessonTitle, setAddLessonTitle] = useState("");
  const [addLessonDescription, setAddLessonDescription] = useState("");
  const [addLessonVideoUrl, setAddLessonVideoUrl] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);

  const handleCreateLesson = async (e: FormEvent, customTopicId?: string) => {
    e.preventDefault();
    const topicIdToUse = customTopicId || selectedTopicId;
    if (!addLessonTitle.trim() || !topicIdToUse) return;
    const res = await addLesson({
      topicId: topicIdToUse,
      title: addLessonTitle.trim(),
      description: addLessonDescription.trim(),
      videoUrl: addLessonVideoUrl.trim() || undefined,
    });
    if (res.success) {
      setAddLessonTitle("");
      setAddLessonDescription("");
      setAddLessonVideoUrl("");
      setSelectedTopicId("");
      setShowAddLessonModal(false);
    }
  };


  const handleCreateCourse = async (e: FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) return;

    const selectedLevel = levels.find((lvl) => lvl.value === courseLevelValue);
    if (!selectedLevel) {
      setCourseError("กรุณาเลือกระดับชั้นเรียน");
      return;
    }

    setCourseSaving(true);
    setCourseError("");

    if (createCourse) {
      const { success, error } = await createCourse({
        title: courseTitle,
        level: selectedLevel.value,
        levelLabel: selectedLevel.label,
        gradientClass: courseGradient,
      });

      if (success) {
        setShowCourseForm(false);
        setCourseTitle("");
        setCourseDesc("");
        setCourseGradient("from-indigo-600 to-purple-600");
        setCourseLevelValue("");
      } else {
        setCourseError(error || "Unknown error occurred");
      }
    } else {
      setCourseError("createCourse is not available");
    }
    setCourseSaving(false);
  };

  // Course Detail states
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"assignments" | "lessons" | "students">("assignments");
  const [viewingAssignmentId, setViewingAssignmentId] = useState<string | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);

  // Lesson Edit states
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonDescription, setEditLessonDescription] = useState("");
  const [editLessonVideoUrl, setEditLessonVideoUrl] = useState("");

  // Assignment Form state
  const [showForm, setShowForm] = useState(false);
  const [assignType, setAssignType] = useState<"file" | "quiz">("file");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignPoints, setAssignPoints] = useState(10);
  const [assignDueDate, setAssignDueDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignTimeLimit, setAssignTimeLimit] = useState(15);
  const [assignLessonId, setAssignLessonId] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    { question: "", questionType: "multiple_choice" as const, options: ["", "", "", ""], correctIndex: 0, explanation: "", points: 1, required: true }
  ]);

  const handleUpdateQuestion = (index: number, updatedQuestion: QuizQuestion) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      copy[index] = updatedQuestion;
      if (assignType === "quiz") {
        const total = copy.reduce((sum, q) => sum + (q.points !== undefined && !isNaN(Number(q.points)) ? Number(q.points) : 1), 0);
        setAssignPoints(total);
      }
      return copy;
    });
  };

  const handleAddQuestion = () => {
    setQuizQuestions(prev => {
      const next: QuizQuestion[] = [
        ...prev,
        { question: "", questionType: "multiple_choice", options: ["", "", "", ""], correctIndex: 0, explanation: "", points: 1, required: true }
      ];
      if (assignType === "quiz") {
        const total = next.reduce((sum, q) => sum + (q.points !== undefined && !isNaN(Number(q.points)) ? Number(q.points) : 1), 0);
        setAssignPoints(total);
      }
      return next;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setQuizQuestions(prev => {
      const next = prev.filter((_, idx) => idx !== index);
      if (assignType === "quiz") {
        const total = next.reduce((sum, q) => sum + (q.points !== undefined && !isNaN(Number(q.points)) ? Number(q.points) : 1), 0);
        setAssignPoints(total);
      }
      return next;
    });
  };

  const teacherCourses = courses.filter(c => c.instructorId === currentUserId);
  const selectedCourse = selectedCourseId ? teacherCourses.find(c => c.id === selectedCourseId) || null : null;
  
  // Filter topics by selected course
  const courseChapters = React.useMemo(() => {
    return selectedCourse ? chapters.filter(ch => ch.courseId === selectedCourse.id) : [];
  }, [selectedCourse, chapters]);

  const courseTopics = React.useMemo(() => {
    return courseChapters.length > 0 ? topics.filter(t => courseChapters.some(ch => ch.id === t.chapterId)) : [];
  }, [courseChapters, topics]);
  
  // Filter lessons by course topics
  const selectedCourseLessons = React.useMemo(() => {
    return courseTopics.length > 0 ? lessons.filter(lesson => courseTopics.some(t => t.id === lesson.topicId)) : [];
  }, [courseTopics, lessons]);

  const effectiveAssignLessonId = assignLessonId && selectedCourseLessons.some(lesson => lesson.id === assignLessonId)
    ? assignLessonId
    : (selectedCourseLessons[0]?.id ?? "");

  const handleCreateAssignment = (e: FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim()) return;

    const targetLessonId = assignLessonId || effectiveAssignLessonId;

    const newAssignment: Assignment = {
      id: "assign-" + Math.random().toString(36).substring(2, 9),
      courseId: selectedCourseId || "",
      lessonId: targetLessonId || undefined,
      type: assignType,
      title: assignTitle,
      dueDate: assignDueDate,
      points: Number(assignPoints),
      createdAt: Date.now(),
      ...(assignType === "file"
        ? { instructions: assignInstructions }
        : { timeLimit: Number(assignTimeLimit), questions: quizQuestions }
      )
    };

    addAssignment(newAssignment);

    // Reset Form
    setAssignTitle("");
    setAssignPoints(10);
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    setAssignDueDate(`${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`);
    setAssignInstructions("");
    setAssignTimeLimit(15);
    setAssignLessonId("");
    setQuizQuestions([{ question: "", questionType: "multiple_choice", options: ["", "", "", ""], correctIndex: 0, explanation: "", required: true }]);
    setShowForm(false);
  };

  useEffect(() => {
    if (loadingData) return;
    if (!isAuthenticated) {
      router.push("/login");
    } else if (role !== "teacher") {
      router.push(role === "admin" ? "/admin" : "/student");
    }
  }, [isAuthenticated, role, router, loadingData]);

  if (loadingData) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || role !== "teacher") {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: tx.base, color: tx.primary }}>
      {/* HEADER */}
      <TeacherHeader
        tab={tab}
        setTab={setTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        displayName={displayName}
        logout={logout}
        router={router}
      />

      {/* COURSE CREATION MODAL */}
      {showCourseForm && (
        <CourseCreationModal
          setShowCourseForm={setShowCourseForm}
          courseTitle={courseTitle}
          setCourseTitle={setCourseTitle}
          courseDesc={courseDesc}
          setCourseDesc={setCourseDesc}
          courseLevelValue={courseLevelValue}
          setCourseLevelValue={setCourseLevelValue}
          levels={levels}
          courseGradient={courseGradient}
          setCourseGradient={setCourseGradient}
          courseSaving={courseSaving}
          courseError={courseError}
          handleCreateCourse={handleCreateCourse}
        />
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "dashboard" && (
          <DashboardTab
            displayName={displayName}
            teacherCourses={teacherCourses}
            setShowCourseForm={setShowCourseForm}
            setTab={setTab}
            setSelectedCourseId={setSelectedCourseId}
            setDetailTab={setDetailTab}
          />
        )}

        {tab === "courses" && (
          <CoursesTab
            selectedCourseId={selectedCourseId}
            teacherCourses={teacherCourses}
            setSelectedCourseId={setSelectedCourseId}
            setShowForm={setShowForm}
            setShowCourseForm={setShowCourseForm}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            setShowEnrollSettingsModal={setShowEnrollSettingsModal}
            assignments={assignments}
            submissions={submissions}
            viewingAssignmentId={viewingAssignmentId}
            setViewingAssignmentId={setViewingAssignmentId}
            lessons={lessons}
            chapters={chapters}
            topics={topics}
            setShowAddLessonModal={setShowAddLessonModal}
            setEditingLesson={setEditingLesson}
            setEditLessonTitle={setEditLessonTitle}
            setEditLessonDescription={setEditLessonDescription}
            setEditLessonVideoUrl={setEditLessonVideoUrl}
            enrollments={enrollments}
            viewingStudentId={viewingStudentId}
            setViewingStudentId={setViewingStudentId}
            setShowAddStudentModal={setShowAddStudentModal}
            teacherRemoveStudent={teacherRemoveStudent}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="py-6 mt-12 border-t text-center text-xs" style={{ borderColor: tx.borderS, color: tx.faint }}>
        <p>© 2026 Math by Seng — Teacher Workspace Console</p>
      </footer>

      {/* Lesson Edit Modal */}
      {editingLesson && (
        <LessonEditModal
          editingLesson={editingLesson}
          setEditingLesson={setEditingLesson}
          editLessonTitle={editLessonTitle}
          setEditLessonTitle={setEditLessonTitle}
          editLessonDescription={editLessonDescription}
          setEditLessonDescription={setEditLessonDescription}
          editLessonVideoUrl={editLessonVideoUrl}
          setEditLessonVideoUrl={setEditLessonVideoUrl}
          updateLesson={updateLesson}
        />
      )}

      {/* Creation Form Modal */}
      {showForm && (
        <AssignmentFormModal
          setShowForm={setShowForm}
          lessons={selectedCourseLessons}
          assignLessonId={effectiveAssignLessonId}
          setAssignLessonId={setAssignLessonId}
          assignType={assignType}
          setAssignType={setAssignType}
          assignTitle={assignTitle}
          setAssignTitle={setAssignTitle}
          assignPoints={assignPoints}
          setAssignPoints={setAssignPoints}
          assignDueDate={assignDueDate}
          setAssignDueDate={setAssignDueDate}
          assignInstructions={assignInstructions}
          setAssignInstructions={setAssignInstructions}
          assignTimeLimit={assignTimeLimit}
          setAssignTimeLimit={setAssignTimeLimit}
          quizQuestions={quizQuestions}
          handleCreateAssignment={handleCreateAssignment}
          handleAddQuestion={handleAddQuestion}
          handleRemoveQuestion={handleRemoveQuestion}
          handleUpdateQuestion={handleUpdateQuestion}
        />
      )}

      {/* Course Enrollment Settings Modal */}
      {showEnrollSettingsModal && selectedCourse && (
        <CourseEnrollSettingsModal
          selectedCourse={selectedCourse}
          setShowEnrollSettingsModal={setShowEnrollSettingsModal}
          updateCourseSettings={updateCourseSettings}
        />
      )}

      {/* Add Lesson Modal */}
      {showAddLessonModal && (
        <AddLessonModal
          setShowAddLessonModal={setShowAddLessonModal}
          addLessonTitle={addLessonTitle}
          setAddLessonTitle={setAddLessonTitle}
          addLessonDescription={addLessonDescription}
          setAddLessonDescription={setAddLessonDescription}
          addLessonVideoUrl={addLessonVideoUrl}
          setAddLessonVideoUrl={setAddLessonVideoUrl}
          handleCreateLesson={handleCreateLesson}
          topics={topics}
          chapters={chapters}
          selectedCourseId={selectedCourseId}
          selectedTopicId={selectedTopicId}
          setSelectedTopicId={setSelectedTopicId}
          addChapter={addChapter}
          addTopic={addTopic}
        />
      )}

      {/* Direct Add Student Modal */}
      {showAddStudentModal && (
        <AddStudentModal
          setShowAddStudentModal={setShowAddStudentModal}
          chosenStudentId={chosenStudentId}
          setChosenStudentId={setChosenStudentId}
          appUsers={appUsers}
          enrollments={enrollments}
          selectedCourseId={selectedCourseId}
          teacherAddStudent={teacherAddStudent}
        />
      )}
    </div>
  );
}
