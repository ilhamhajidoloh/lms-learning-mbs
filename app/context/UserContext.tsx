"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiFetch, setToken, removeToken, getToken } from "../../lib/api";
import { toast } from "../../lib/swal";

export type Role = "teacher" | "student" | "admin";

export type CourseLevel = string;

export interface Course {
  id: string;
  title: string;
  level: CourseLevel;
  levelLabel: string;
  gradientClass: string;
  lessonsCount: number;
  instructor: string;
  instructorId: string;
  progress: number;
  isOpen?: boolean;
  enrollCode?: string;
  enrollCodeRequired?: boolean;
  isEnrolled?: boolean;
  showScores?: boolean;
  sequentialLessons?: boolean;
  quizReviewMode?: "full" | "answers_only" | "none";
}

export type QuestionType = "multiple_choice" | "fill_blank" | "matching" | "essay";

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuizQuestion {
  question: string;
  questionType: QuestionType;
  required?: boolean;
  // For multiple choice
  options?: string[];
  correctIndex?: number; // Legacy: single correct answer
  correctIndices?: number[]; // New: supports multiple correct answers
  // For fill in the blank & essay
  correctAnswer?: string;
  // For matching
  matchingPairs?: MatchingPair[];
  explanation: string;
  points?: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  lessonId?: string;
  type: "file" | "quiz";
  title: string;
  dueDate: string;
  points: number;
  instructions?: string;
  timeLimit?: number;
  questions?: QuizQuestion[];
  createdAt: number;
  showScores?: boolean;
  quizReviewMode?: "full" | "answers_only" | "none";
  isOpen?: boolean;
  allowEditSubmission?: boolean;
  allowCancelSubmission?: boolean;
  quizAttemptLimit?: number;
  openAt?: string;
  closeAt?: string;
}

export interface StudentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submittedAt: number;
  type: "file" | "quiz";
  fileName?: string;
  score?: number;
  questionScores?: number[];
  previousScore?: number;
  answers?: Record<number, number | number[] | string | Record<number, number>> | (number | number[] | string | Record<number, number>)[];
}

export interface Chapter {
  id: string;
  courseId: string;
  title: string;
  order: number;
}

export interface Topic {
  id: string;
  chapterId: string;
  title: string;
  order: number;
}

export interface LessonSegment {
  id: string;
  title: string;
  duration: string;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  description: string;
  videoUrl?: string;
  isPublished?: boolean;
  isLocked?: boolean;
  subLessons?: LessonSegment[];
}

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  createdAt: number;
}

export interface Credential {
  username: string;
  password: string;
  role: Role;
  displayName: string;
  email?: string;
}

export interface CourseLevelOption {
  id: string;
  value: string;
  label: string;
}

export interface Enrollment {
  courseId: string;
  studentId?: string;
  progress: number;
  studentName?: string;
  studentUsername?: string;
}

interface UserContextProps {
  role: Role;
  isAuthenticated: boolean;
  displayName: string;
  currentUsername: string;
  currentUserId: string | null;
  passwordChanged: boolean;
  loadingData: boolean;
  login: (role: Role, name: string, username: string, userId?: string, passwordChanged?: boolean) => void;
  logout: () => void;
  register: (data: Credential) => Promise<{ success: boolean; error?: string }>;
  updateDisplayName: (name: string) => void;
  updatePassword: (oldPw: string, newPw: string) => Promise<{ success: boolean; error?: string }>;
  darkMode: boolean;
  toggleDarkMode: () => void;
  courses: Course[];
  createCourse: (data: Partial<Course>) => Promise<{success: boolean; error?: string}>;
  chapters: Chapter[];
  addChapter: (courseId: string, title: string) => Promise<{ success: boolean; id?: string; error?: string }>;
  updateChapter: (id: string, title: string) => Promise<{ success: boolean; error?: string }>;
  deleteChapter: (id: string) => Promise<{ success: boolean; error?: string }>;
  topics: Topic[];
  addTopic: (chapterId: string, title: string) => Promise<{ success: boolean; id?: string; error?: string }>;
  updateTopic: (id: string, title: string) => Promise<{ success: boolean; error?: string }>;
  deleteTopic: (id: string) => Promise<{ success: boolean; error?: string }>;
  assignments: Assignment[];
  addAssignment: (assignment: Assignment) => void;
  updateAssignment: (assignment: Assignment) => Promise<{ success: boolean; error?: string }>;
  updateAssignmentSettings: (assignmentId: string, showScores?: boolean, quizReviewMode?: "full" | "answers_only" | "none") => Promise<{ success: boolean; error?: string }>;
  toggleAssignmentOpen: (assignmentId: string, isOpen: boolean) => Promise<{ success: boolean; error?: string }>;
  updateAssignmentAdvancedSettings: (assignmentId: string, settings: {
    dueDate?: string;
    allowEditSubmission?: boolean;
    allowCancelSubmission?: boolean;
    quizAttemptLimit?: number;
    openAt?: string;
    closeAt?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  editFileSubmission: (submissionId: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  cancelFileSubmission: (submissionId: string) => Promise<{ success: boolean; error?: string }>;
  submissions: StudentSubmission[];
  addSubmission: (submission: StudentSubmission) => void;
  gradeSubmission: (submissionId: string, score: number, questionScores?: number[]) => Promise<{ success: boolean; error?: string }>;
  cancelSubmissionScore: (submissionId: string) => Promise<{ success: boolean; error?: string }>;
  lessons: Lesson[];
  addLesson: (lesson: Omit<Lesson, "id">) => Promise<{ success: boolean; error?: string }>;
  updateLesson: (lesson: Lesson) => void;
  toggleLessonPublished: (lessonId: string, isPublished: boolean) => Promise<{ success: boolean; error?: string }>;
  toggleLessonLocked: (lessonId: string, isLocked: boolean) => Promise<{ success: boolean; error?: string }>;
  deleteLesson: (id: string) => Promise<{ success: boolean; error?: string }>;
  appUsers: AppUser[];
  addAppUser: (user: AppUser) => void;
  updateAppUser: (user: AppUser) => void;
  deleteAppUser: (userId: string) => void;
  refreshData: () => Promise<void>;
  enrollments: Enrollment[];
  enrollInCourse: (courseId: string, enrollCode?: string) => Promise<{ success: boolean; error?: string }>;
  teacherAddStudent: (courseId: string, studentId: string) => Promise<{ success: boolean; error?: string }>;
  teacherRemoveStudent: (courseId: string, studentId: string) => Promise<{ success: boolean; error?: string }>;
  updateCourseSettings: (courseId: string, isOpen: boolean, enrollCode: string | null, showScores?: boolean, sequentialLessons?: boolean, quizReviewMode?: "full" | "answers_only" | "none") => Promise<{ success: boolean; error?: string }>;
  levels: CourseLevelOption[];
  addLevel: (value: string, label: string) => Promise<{ success: boolean; error?: string }>;
  deleteLevel: (id: string) => Promise<{ success: boolean; error?: string }>;
  completedLessonIds: string[];
  toggleLessonComplete: (lessonId: string, completed: boolean) => Promise<void>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

interface AllDataResponse {
  courses: Course[];
  chapters: Chapter[];
  topics: Topic[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  appUsers: AppUser[];
  enrollments?: Enrollment[];
  completedLessonIds?: string[];
}

interface LevelsResponse {
  levels: CourseLevelOption[];
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("student");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [levels, setLevels] = useState<CourseLevelOption[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("ผู้ใช้");
  const [currentUsername, setCurrentUsername] = useState("");

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      const [{ data, error }, { data: levelsData, error: levelsError }] = await Promise.all([
        apiFetch<AllDataResponse>("/api/data"),
        apiFetch<LevelsResponse>("/api/levels"),
      ]);
      if (error || !data) {
        console.error("fetchAllData error:", error);
        return;
      }
      setCourses(data.courses);
      setChapters(data.chapters);
      setTopics(data.topics);
      setLessons(data.lessons);
      setAssignments(data.assignments);
      setSubmissions(data.submissions);
      setAppUsers(data.appUsers);
      setEnrollments(data.enrollments || []);
      setCompletedLessonIds(data.completedLessonIds || []);
      if (levelsError || !levelsData) {
        console.error("fetchAllData levels error:", levelsError);
      } else {
        setLevels(levelsData.levels);
      }
    } catch (err) {
      console.error("fetchAllData error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const addLevel = async (value: string, label: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังเพิ่มระดับชั้นเรียน...");
    try {
      const { error } = await apiFetch("/api/levels", {
        method: "POST",
        body: JSON.stringify({ value, label }),
      });
      loadingToast.close();
      if (error) {
        toast.error("เพิ่มระดับชั้นเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("เพิ่มระดับชั้นเรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("เพิ่มระดับชั้นเรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const deleteLevel = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังลบระดับชั้นเรียน...");
    try {
      const { error } = await apiFetch("/api/levels", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      loadingToast.close();
      if (error) {
        toast.error("ลบระดับชั้นเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ลบระดับชั้นเรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ลบระดับชั้นเรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const createCourse = async (data: Partial<Course>): Promise<{success: boolean; error?: string}> => {
    if (!userId) return { success: false, error: "Not logged in" };
    const loadingToast = toast.loading("กำลังบันทึกข้อมูลหลักสูตร...");
    try {
      const { error } = await apiFetch("/api/courses", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          level: data.level,
          levelLabel: data.levelLabel,
          gradientClass: data.gradientClass,
        }),
      });
      loadingToast.close();
      if (error) {
        toast.error("สร้างหลักสูตรไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("สร้างหลักสูตรสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("สร้างหลักสูตรไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const login = (selectedRole: Role, name: string, username: string, id?: string, passwordChanged?: boolean) => {
    setRole(selectedRole);
    setDisplayName(name);
    setCurrentUsername(username);
    if (id) setUserId(id);
    if (passwordChanged !== undefined) setPasswordChanged(passwordChanged);
    setIsAuthenticated(true);
  };

  const logout = () => {
    removeToken();
    setIsAuthenticated(false);
    setRole("student");
    setDisplayName("ผู้ใช้");
    setCurrentUsername("");
    setUserId(null);
    setPasswordChanged(true);
    setCourses([]);
    setAssignments([]);
    setSubmissions([]);
    setLessons([]);
    setAppUsers([]);
    setEnrollments([]);
    setCompletedLessonIds([]);
    setLevels([]);
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const addAssignment = async (assignment: Assignment) => {
    const loadingToast = toast.loading("กำลังสร้างงาน/แบบทดสอบ...");
    try {
      const { error } = await apiFetch("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          id: assignment.id,
          courseId: assignment.courseId,
          lessonId: assignment.lessonId,
          type: assignment.type,
          title: assignment.title,
          dueDate: assignment.dueDate,
          points: assignment.points,
          instructions: assignment.instructions,
          timeLimit: assignment.timeLimit,
          questions: assignment.questions,
        }),
      });
      loadingToast.close();
      if (error) {
        toast.error("สร้างงาน/แบบทดสอบไม่สำเร็จ: " + error);
      } else {
        setAssignments((prev) => [assignment, ...prev]);
        toast.success("สร้างงาน/แบบทดสอบสำเร็จ!");
      }
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("สร้างงาน/แบบทดสอบไม่สำเร็จ: " + message);
    }
  };

  const updateAssignment = async (assignment: Assignment): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังบันทึกการแก้ไขงาน/แบบทดสอบ...");
    try {
      const { error } = await apiFetch("/api/assignments", {
        method: "PUT",
        body: JSON.stringify({
          id: assignment.id,
          title: assignment.title,
          lessonId: assignment.lessonId,
          points: assignment.points,
          dueDate: assignment.dueDate,
          instructions: assignment.instructions,
          timeLimit: assignment.timeLimit,
          questions: assignment.questions,
        }),
      });
      loadingToast.close();
      if (error) {
        toast.error("บันทึกการแก้ไขไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("บันทึกการแก้ไขงาน/แบบทดสอบสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("บันทึกการแก้ไขไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const updateAssignmentSettings = async (
    assignmentId: string,
    showScores?: boolean,
    quizReviewMode?: "full" | "answers_only" | "none"
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/assignments", {
        method: "PUT",
        body: JSON.stringify({ id: assignmentId, showScores, quizReviewMode }),
      });
      if (error) {
        toast.error("บันทึกการตั้งค่าไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                ...(showScores !== undefined ? { showScores } : {}),
                ...(quizReviewMode !== undefined ? { quizReviewMode } : {}),
              }
            : a
        )
      );
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("บันทึกการตั้งค่าไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const toggleAssignmentOpen = async (assignmentId: string, isOpen: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/assignments", {
        method: "PUT",
        body: JSON.stringify({ id: assignmentId, isOpen }),
      });
      if (error) {
        toast.error("อัปเดตสถานะงานไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, isOpen } : a))
      );
      toast.success(isOpen ? "เปิดงานนี้แล้ว (นักเรียนส่งงานได้)" : "ปิดงานนี้แล้ว (นักเรียนส่งงานไม่ได้)");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("อัปเดตสถานะงานไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const updateAssignmentAdvancedSettings = async (
    assignmentId: string,
    settings: {
      dueDate?: string;
      allowEditSubmission?: boolean;
      allowCancelSubmission?: boolean;
      quizAttemptLimit?: number;
      openAt?: string;
      closeAt?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/assignments", {
        method: "PUT",
        body: JSON.stringify({ id: assignmentId, ...settings }),
      });
      if (error) {
        toast.error("บันทึกการตั้งค่าไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("บันทึกการตั้งค่างานสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("บันทึกการตั้งค่าไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const editFileSubmission = async (submissionId: string, fileName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/submissions", {
        method: "PUT",
        body: JSON.stringify({ submissionId, fileName }),
      });
      if (error) {
        toast.error("แก้ไขไฟล์ที่ส่งไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                fileName,
                previousScore: s.score ?? s.previousScore,
                score: undefined,
                submittedAt: Date.now(),
              }
            : s
        )
      );
      toast.success("แก้ไขไฟล์ที่ส่งสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("แก้ไขไฟล์ที่ส่งไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const cancelFileSubmission = async (submissionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/submissions", {
        method: "DELETE",
        body: JSON.stringify({ submissionId }),
      });
      if (error) {
        toast.error("ยกเลิกการส่งไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      toast.success("ยกเลิกการส่งไฟล์เรียบร้อยแล้ว");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ยกเลิกการส่งไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const addSubmission = async (submission: StudentSubmission) => {
    const loadingToast = toast.loading("กำลังส่งงาน/คำตอบ...");
    try {
      const { error } = await apiFetch("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          assignmentId: submission.assignmentId,
          type: submission.type,
          fileName: submission.fileName,
          score: submission.score,
          questionScores: submission.questionScores,
          answers: submission.answers,
          submittedAt: submission.submittedAt,
        }),
      });
      loadingToast.close();
      if (error) {
        toast.error("ส่งงานไม่สำเร็จ: " + error);
      } else {
        setSubmissions((prev) => [submission, ...prev]);
        toast.success("ส่งงานสำเร็จเรียบร้อย!");
      }
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ส่งงานไม่สำเร็จ: " + message);
    }
  };

  const gradeSubmission = async (submissionId: string, score: number, questionScores?: number[]): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังบันทึกคะแนน...");
    try {
      const { error } = await apiFetch("/api/submissions", {
        method: "PUT",
        body: JSON.stringify({ submissionId, score, ...(questionScores ? { questionScores } : {}) }),
      });
      loadingToast.close();
      if (error) {
        toast.error("ให้คะแนนงานไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ให้คะแนนงานสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ให้คะแนนงานไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const cancelSubmissionScore = async (submissionId: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังยกเลิกคะแนน...");
    try {
      const { error } = await apiFetch("/api/submissions", {
        method: "PUT",
        body: JSON.stringify({ submissionId, reset: true }),
      });
      loadingToast.close();
      if (error) {
        toast.error("ยกเลิกคะแนนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ยกเลิกคะแนนเรียบร้อยแล้ว!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ยกเลิกคะแนนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const toggleLessonPublished = async (lessonId: string, isPublished: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/lessons", {
        method: "PUT",
        body: JSON.stringify({ id: lessonId, isPublished }),
      });
      if (error) {
        toast.error("อัปเดตการมองเห็นบทเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success(isPublished ? "เปิดการมองเห็นบทเรียนแล้ว" : "ซ่อนบทเรียนเรียบร้อยแล้ว");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("อัปเดตไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const toggleLessonLocked = async (lessonId: string, isLocked: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/lessons", {
        method: "PUT",
        body: JSON.stringify({ id: lessonId, isLocked }),
      });
      if (error) {
        toast.error("อัปเดตการล็อกบทเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success(isLocked ? "ล็อกบทเรียนเรียบร้อยแล้ว" : "ปลดล็อกบทเรียนเรียบร้อยแล้ว");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("อัปเดตไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const addLesson = async (lesson: Omit<Lesson, "id">): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังเพิ่มบทเรียน...");
    try {
      const id = "lesson-" + Math.random().toString(36).substring(2, 9);
      const { error } = await apiFetch("/api/lessons", {
        method: "POST",
        body: JSON.stringify({
          id,
          topicId: lesson.topicId,
          title: lesson.title,
          description: lesson.description,
          videoUrl: lesson.videoUrl,
        }),
      });
      loadingToast.close();
      if (error) {
        toast.error("เพิ่มบทเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("เพิ่มบทเรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("เพิ่มบทเรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const addChapter = async (courseId: string, title: string): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      const id = "chap-" + Math.random().toString(36).substring(2, 9);
      const { data, error } = await apiFetch<{ id: string }>("/api/chapters", {
        method: "POST",
        body: JSON.stringify({ id, courseId, title }),
      });
      if (error || !data) {
        return { success: false, error: error || "Failed to create chapter" };
      }
      await fetchAllData();
      return { success: true, id: data.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  };

  const addTopic = async (chapterId: string, title: string): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      const id = "topic-" + Math.random().toString(36).substring(2, 9);
      const { data, error } = await apiFetch<{ id: string }>("/api/topics", {
        method: "POST",
        body: JSON.stringify({ id, chapterId, title }),
      });
      if (error || !data) {
        return { success: false, error: error || "Failed to create topic" };
      }
      await fetchAllData();
      return { success: true, id: data.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  };

  const updateChapter = async (id: string, title: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/chapters", {
        method: "PUT",
        body: JSON.stringify({ id, title }),
      });
      if (error) {
        toast.error("แก้ไขชื่อหน่วยเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("แก้ไขชื่อหน่วยเรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("แก้ไขชื่อหน่วยเรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const deleteChapter = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังลบหน่วยเรียน...");
    try {
      const { error } = await apiFetch(`/api/chapters?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      loadingToast.close();
      if (error) {
        toast.error("ลบหน่วยเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ลบหน่วยเรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ลบหน่วยเรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const updateTopic = async (id: string, title: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await apiFetch("/api/topics", {
        method: "PUT",
        body: JSON.stringify({ id, title }),
      });
      if (error) {
        toast.error("แก้ไขชื่อเรื่องไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("แก้ไขชื่อเรื่องสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("แก้ไขชื่อเรื่องไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const deleteTopic = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังลบเรื่อง...");
    try {
      const { error } = await apiFetch(`/api/topics?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      loadingToast.close();
      if (error) {
        toast.error("ลบเรื่องไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ลบเรื่องสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ลบเรื่องไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const updateLesson = async (updatedLesson: Lesson) => {
    const loadingToast = toast.loading("กำลังบันทึกข้อมูลบทเรียน...");
    try {
      const { error } = await apiFetch("/api/lessons", {
        method: "PUT",
        body: JSON.stringify({
          id: updatedLesson.id,
          title: updatedLesson.title,
          description: updatedLesson.description,
          videoUrl: updatedLesson.videoUrl,
        }),
      });
      loadingToast.close();
      if (error) {
        toast.error("บันทึกบทเรียนไม่สำเร็จ: " + error);
      } else {
        setLessons((prev) => prev.map((l) => (l.id === updatedLesson.id ? updatedLesson : l)));
        toast.success("บันทึกบทเรียนสำเร็จ!");
      }
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("บันทึกบทเรียนไม่สำเร็จ: " + message);
    }
  };

  const deleteLesson = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังลบบทเรียน...");
    try {
      const { error } = await apiFetch(`/api/lessons?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      loadingToast.close();
      if (error) {
        toast.error("ลบบทเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ลบบทเรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ลบบทเรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const addAppUser = (user: AppUser) => {
    setAppUsers((prev) => [...prev, user]);
  };

  const updateAppUser = (updated: AppUser) => {
    setAppUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const deleteAppUser = (uid: string) => {
    setAppUsers((prev) => prev.filter((u) => u.id !== uid));
  };

  const updateDisplayName = async (name: string) => {
    const loadingToast = toast.loading("กำลังบันทึกชื่อแสดงผล...");
    try {
      const { error } = await apiFetch("/api/profiles", {
        method: "PUT",
        body: JSON.stringify({ displayName: name }),
      });
      loadingToast.close();
      if (error) {
        toast.error("บันทึกชื่อไม่สำเร็จ: " + error);
      } else {
        setDisplayName(name);
        setAppUsers((prev) =>
          prev.map((u) => (u.username === currentUsername ? { ...u, displayName: name } : u))
        );
        toast.success("บันทึกชื่อแสดงผลใหม่สำเร็จ!");
      }
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("บันทึกชื่อไม่สำเร็จ: " + message);
    }
  };

  const updatePassword = async (
    oldPw: string,
    newPw: string
  ): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังเปลี่ยนรหัสผ่าน...");
    try {
      const { error } = await apiFetch("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      loadingToast.close();
      if (error) {
        toast.error("เปลี่ยนรหัสผ่านไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      setPasswordChanged(true);
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("เปลี่ยนรหัสผ่านไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const enrollInCourse = async (courseId: string, enrollCode?: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังลงทะเบียนเรียน...");
    try {
      const { error } = await apiFetch("/api/courses/enroll", {
        method: "POST",
        body: JSON.stringify({ courseId, enrollCode }),
      });
      loadingToast.close();
      if (error) {
        toast.error("ลงทะเบียนเรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ลงทะเบียนเรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ลงทะเบียนเรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const teacherAddStudent = async (courseId: string, studentId: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังเพิ่มผู้เรียนเข้าคอร์ส...");
    try {
      const { error } = await apiFetch("/api/courses/enroll", {
        method: "POST",
        body: JSON.stringify({ courseId, studentId }),
      });
      loadingToast.close();
      if (error) {
        toast.error("เพิ่มผู้เรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("เพิ่มผู้เรียนสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("เพิ่มผู้เรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const teacherRemoveStudent = async (courseId: string, studentId: string): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังลบผู้เรียนออกจากคอร์ส...");
    try {
      const { error } = await apiFetch("/api/courses/enroll", {
        method: "DELETE",
        body: JSON.stringify({ courseId, studentId }),
      });
      loadingToast.close();
      if (error) {
        toast.error("ลบผู้เรียนไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("ลบผู้เรียนออกจากคอร์สสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("ลบผู้เรียนไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const updateCourseSettings = async (
    courseId: string,
    isOpen: boolean,
    enrollCode: string | null,
    showScores?: boolean,
    sequentialLessons?: boolean,
    quizReviewMode?: "full" | "answers_only" | "none"
  ): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังอัปเดตการตั้งค่าคอร์ส...");
    try {
      const { error } = await apiFetch("/api/courses", {
        method: "PUT",
        body: JSON.stringify({ id: courseId, isOpen, enrollCode, showScores, sequentialLessons, quizReviewMode }),
      });
      loadingToast.close();
      if (error) {
        toast.error("อัปเดตการตั้งค่าไม่สำเร็จ: " + error);
        return { success: false, error };
      }
      await fetchAllData();
      toast.success("อัปเดตการตั้งค่าสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("อัปเดตการตั้งค่าไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  const toggleLessonComplete = async (lessonId: string, completed: boolean) => {
    try {
      const { data, error } = await apiFetch<{ progress: number }>("/api/lessons/complete", {
        method: "POST",
        body: JSON.stringify({ lessonId, completed }),
      });
      if (error) {
        toast.error("บันทึกสถานะการเรียนไม่สำเร็จ: " + error);
        return;
      }
      setCompletedLessonIds((prev) =>
        completed ? [...prev, lessonId] : prev.filter((id) => id !== lessonId)
      );

      if (data) {
        // Try to find courseId via topic chain first
        const lesson = lessons.find((l) => l.id === lessonId);
        let courseId: string | null = null;
        if (lesson) {
          const topic = topics.find((t) => t.id === lesson.topicId);
          if (topic) {
            const chapter = chapters.find((ch) => ch.id === topic.chapterId);
            if (chapter) courseId = chapter.courseId;
          }
          // Fallback: lesson may have courseId directly (via course_id column)
          if (!courseId) {
            const lessonWithCourse = lesson as unknown as { courseId?: string };
            courseId = lessonWithCourse.courseId ?? null;
          }
        }

        if (courseId) {
          setCourses((prev) =>
            prev.map((c) => (c.id === courseId ? { ...c, progress: data.progress } : c))
          );
        } else {
          // Cannot find courseId locally - refresh all data to sync progress
          await fetchAllData();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
      toast.error("บันทึกสถานะการเรียนไม่สำเร็จ: " + message);
    }
  };

  const register = async (data: Credential): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังสมัครสมาชิก...");
    try {
      const { data: result, error } = await apiFetch<{
        token: string;
        user: { id: string; username: string; displayName: string; role: Role; passwordChanged: boolean };
      }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          displayName: data.displayName,
          email: data.email,
          role: data.role,
        }),
      });
      loadingToast.close();
      if (error || !result) {
        const msg = error ?? "เกิดข้อผิดพลาด";
        toast.error("สมัครสมาชิกไม่สำเร็จ: " + msg);
        return { success: false, error: msg };
      }

      setToken(result.token);
      setRole(result.user.role as Role);
      setDisplayName(result.user.displayName);
      setCurrentUsername(result.user.username);
      setUserId(result.user.id);
      setPasswordChanged(result.user.passwordChanged);
      setIsAuthenticated(true);
      toast.success("สมัครสมาชิกสำเร็จ!");
      return { success: true };
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("สมัครสมาชิกไม่สำเร็จ: " + message);
      return { success: false, error: message };
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const token = getToken();
      if (!token) {
        setLoadingData(false);
        return;
      }

      const { data: user, error } = await apiFetch<{
        id: string;
        username: string;
        displayName: string;
        role: Role;
        passwordChanged: boolean;
      }>("/api/auth/me");

      if (error || !user) {
        removeToken();
        setLoadingData(false);
        return;
      }

      setRole(user.role);
      setDisplayName(user.displayName);
      setCurrentUsername(user.username);
      setUserId(user.id);
      setPasswordChanged(user.passwordChanged);
      setIsAuthenticated(true);
      await fetchAllData();
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", darkMode);
    }
  }, [darkMode]);

   return (
    <UserContext.Provider
      value={{
        role,
        isAuthenticated,
        displayName,
        currentUsername,
        currentUserId: userId,
        passwordChanged,
        loadingData,
        login,
        logout,
        darkMode,
        toggleDarkMode,
        courses,
        createCourse,
        chapters,
        addChapter,
        updateChapter,
        deleteChapter,
        topics,
        addTopic,
        updateTopic,
        deleteTopic,
        assignments,
        addAssignment,
        updateAssignment,
        updateAssignmentSettings,
        toggleAssignmentOpen,
        updateAssignmentAdvancedSettings,
        editFileSubmission,
        cancelFileSubmission,
        submissions,
        addSubmission,
        gradeSubmission,
        cancelSubmissionScore,
        lessons,
        addLesson,
        updateLesson,
        toggleLessonPublished,
        toggleLessonLocked,
        deleteLesson,
        appUsers,
        addAppUser,
        updateAppUser,
        deleteAppUser,
        register,
        updateDisplayName,
        updatePassword,
        refreshData: fetchAllData,
        enrollments,
        enrollInCourse,
        teacherAddStudent,
        teacherRemoveStudent,
        updateCourseSettings,
        levels,
        addLevel,
        deleteLevel,
        completedLessonIds,
        toggleLessonComplete,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
