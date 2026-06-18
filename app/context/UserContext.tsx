"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiFetch, setToken, removeToken, getToken } from "../../lib/api";

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
  answers?: Record<number, number>;
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
  updateLesson: (lesson: Lesson) => void;
  appUsers: AppUser[];
  addAppUser: (user: AppUser) => void;
  updateAppUser: (user: AppUser) => void;
  deleteAppUser: (userId: string) => void;
  refreshData: () => Promise<void>;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

interface AllDataResponse {
  courses: Course[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: StudentSubmission[];
  meetings: Meeting[];
  appUsers: AppUser[];
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
  const [displayName, setDisplayName] = useState("ผู้ใช้");
  const [currentUsername, setCurrentUsername] = useState("");

  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await apiFetch<AllDataResponse>("/api/data");
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
    } catch (err) {
      console.error("fetchAllData error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const createCourse = async (data: Partial<Course>): Promise<{success: boolean; error?: string}> => {
    if (!userId) return { success: false, error: "Not logged in" };
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
      if (error) return { success: false, error };
      await fetchAllData();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
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
  };

  const addMeeting = async (meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev]);
    await apiFetch("/api/meetings", {
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
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const addAssignment = async (assignment: Assignment) => {
    setAssignments((prev) => [assignment, ...prev]);
    await apiFetch("/api/assignments", {
      method: "POST",
      body: JSON.stringify({
        id: assignment.id,
        courseId: assignment.courseId,
        type: assignment.type,
        title: assignment.title,
        dueDate: assignment.dueDate,
        points: assignment.points,
        instructions: assignment.instructions,
        timeLimit: assignment.timeLimit,
        questions: assignment.questions,
      }),
    });
  };

  const addSubmission = async (submission: StudentSubmission) => {
    setSubmissions((prev) => [submission, ...prev]);
    await apiFetch("/api/submissions", {
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
  };

  const updateLesson = async (updatedLesson: Lesson) => {
    setLessons((prev) => prev.map((l) => (l.id === updatedLesson.id ? updatedLesson : l)));
    await apiFetch("/api/lessons", {
      method: "PUT",
      body: JSON.stringify({
        id: updatedLesson.id,
        title: updatedLesson.title,
        description: updatedLesson.description,
        videoUrl: updatedLesson.videoUrl,
      }),
    });
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
    setDisplayName(name);
    setAppUsers((prev) =>
      prev.map((u) => (u.username === currentUsername ? { ...u, displayName: name } : u))
    );
    await apiFetch("/api/profiles", {
      method: "PUT",
      body: JSON.stringify({ displayName: name }),
    });
  };

  const updatePassword = async (
    oldPw: string,
    newPw: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await apiFetch("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
    });
    if (error) return { success: false, error };
    return { success: true };
  };

  const register = async (data: Credential): Promise<{ success: boolean; error?: string }> => {
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

    if (error || !result) {
      return { success: false, error: error ?? "เกิดข้อผิดพลาด" };
    }

    setToken(result.token);
    setRole(result.user.role as Role);
    setDisplayName(result.user.displayName);
    setCurrentUsername(result.user.username);
    setUserId(result.user.id);
    setIsAuthenticated(true);
    return { success: true };
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
        updateLesson,
        appUsers,
        addAppUser,
        updateAppUser,
        deleteAppUser,
        register,
        updateDisplayName,
        updatePassword,
        refreshData: fetchAllData,
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
