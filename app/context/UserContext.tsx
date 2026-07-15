"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiFetch, setToken, removeToken, getToken } from "../../lib/api";
import { toast } from "../../lib/swal";

export type Role = "teacher" | "student" | "admin";

export type CourseLevel = string;

export interface Meeting {
  id: string;
  subject: string;
  joinUrl: string;
  startDateTime: string;
  endDateTime: string;
  passcode: string;
  createdAt: number;
}

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
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
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
  answers?: Record<number, number> | number[];
}

export interface LessonSegment {
  id: string;
  title: string;
  duration: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl?: string;
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
  loadingData: boolean;
  login: (role: Role, name: string, username: string, userId?: string) => void;
  logout: () => void;
  register: (data: Credential) => Promise<{ success: boolean; error?: string }>;
  updateDisplayName: (name: string) => void;
  updatePassword: (oldPw: string, newPw: string) => Promise<{ success: boolean; error?: string }>;
  meetings: Meeting[];
  addMeeting: (meeting: Meeting) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  courses: Course[];
  createCourse: (data: Partial<Course>) => Promise<{success: boolean; error?: string}>;
  assignments: Assignment[];
  addAssignment: (assignment: Assignment) => void;
  submissions: StudentSubmission[];
  addSubmission: (submission: StudentSubmission) => void;
  lessons: Lesson[];
  addLesson: (lesson: Omit<Lesson, "id">) => Promise<{ success: boolean; error?: string }>;
  updateLesson: (lesson: Lesson) => void;
  appUsers: AppUser[];
  addAppUser: (user: AppUser) => void;
  updateAppUser: (user: AppUser) => void;
  deleteAppUser: (userId: string) => void;
  refreshData: () => Promise<void>;
  enrollments: Enrollment[];
  enrollInCourse: (courseId: string, enrollCode?: string) => Promise<{ success: boolean; error?: string }>;
  teacherAddStudent: (courseId: string, studentId: string) => Promise<{ success: boolean; error?: string }>;
  teacherRemoveStudent: (courseId: string, studentId: string) => Promise<{ success: boolean; error?: string }>;
  updateCourseSettings: (courseId: string, isOpen: boolean, enrollCode: string | null) => Promise<{ success: boolean; error?: string }>;
  levels: CourseLevelOption[];
  addLevel: (value: string, label: string) => Promise<{ success: boolean; error?: string }>;
  deleteLevel: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

interface AllDataResponse {
  courses: Course[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  meetings: Meeting[];
  appUsers: AppUser[];
  enrollments?: Enrollment[];
}

interface LevelsResponse {
  levels: CourseLevelOption[];
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("student");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [levels, setLevels] = useState<CourseLevelOption[]>([]);
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
      setLessons(data.lessons);
      setAssignments(data.assignments);
      setSubmissions(data.submissions);
      setMeetings(data.meetings);
      setAppUsers(data.appUsers);
      setEnrollments(data.enrollments || []);
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

  const login = (selectedRole: Role, name: string, username: string, id?: string) => {
    setRole(selectedRole);
    setDisplayName(name);
    setCurrentUsername(username);
    if (id) setUserId(id);
    setIsAuthenticated(true);
  };

  const logout = () => {
    removeToken();
    setIsAuthenticated(false);
    setRole("student");
    setDisplayName("ผู้ใช้");
    setCurrentUsername("");
    setUserId(null);
    setCourses([]);
    setAssignments([]);
    setSubmissions([]);
    setLessons([]);
    setMeetings([]);
    setAppUsers([]);
    setEnrollments([]);
    setLevels([]);
  };

  const addMeeting = async (meeting: Meeting) => {
    const loadingToast = toast.loading("กำลังสร้างคลาสเรียนสด...");
    try {
      const { error } = await apiFetch("/api/meetings", {
        method: "POST",
        body: JSON.stringify({
          id: meeting.id,
          subject: meeting.subject,
          joinUrl: meeting.joinUrl,
          startDateTime: meeting.startDateTime,
          endDateTime: meeting.endDateTime,
          passcode: meeting.passcode,
        }),
      });
      loadingToast.close();
      if (error) {
        toast.error("สร้างคลาสเรียนสดไม่สำเร็จ: " + error);
      } else {
        setMeetings((prev) => [meeting, ...prev]);
        toast.success("สร้างคลาสเรียนสดสำเร็จ!");
      }
    } catch (err: unknown) {
      loadingToast.close();
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("สร้างคลาสเรียนสดไม่สำเร็จ: " + message);
    }
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

  const addLesson = async (lesson: Omit<Lesson, "id">): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังเพิ่มบทเรียน...");
    try {
      const id = "lesson-" + Math.random().toString(36).substring(2, 9);
      const { error } = await apiFetch("/api/lessons", {
        method: "POST",
        body: JSON.stringify({
          id,
          courseId: lesson.courseId,
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

  const updateCourseSettings = async (courseId: string, isOpen: boolean, enrollCode: string | null): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังอัปเดตการตั้งค่าคอร์ส...");
    try {
      const { error } = await apiFetch("/api/courses", {
        method: "PUT",
        body: JSON.stringify({ id: courseId, isOpen, enrollCode }),
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

  const register = async (data: Credential): Promise<{ success: boolean; error?: string }> => {
    const loadingToast = toast.loading("กำลังสมัครสมาชิก...");
    try {
      const { data: result, error } = await apiFetch<{
        token: string;
        user: { id: string; username: string; displayName: string; role: Role };
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
        loadingData,
        login,
        logout,
        meetings,
        addMeeting,
        darkMode,
        toggleDarkMode,
        courses,
        createCourse,
        assignments,
        addAssignment,
        submissions,
        addSubmission,
        lessons,
        addLesson,
        updateLesson,
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
