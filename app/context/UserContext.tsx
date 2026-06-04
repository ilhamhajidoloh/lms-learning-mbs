"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Role = "teacher" | "student" | "admin";

export type CourseLevel = "m4" | "m5" | "m6" | "exam";

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
  timeLimit?: number; // in minutes
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
}

interface UserContextProps {
  role: Role;
  isAuthenticated: boolean;
  displayName: string;
  currentUsername: string;
  login: (role: Role, name: string, username: string) => void;
  logout: () => void;
  credentials: Credential[];
  register: (data: Credential) => { success: boolean; error?: string };
  updateDisplayName: (name: string) => void;
  updatePassword: (oldPw: string, newPw: string) => { success: boolean; error?: string };
  meetings: Meeting[];
  addMeeting: (meeting: Meeting) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  courses: Course[];
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
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

const MOCK_TIME_BASE = new Date("2026-06-03T12:00:00+07:00").getTime();

const INITIAL_COURSES: Course[] = [
  {
    id: "calc-101",
    title: "แคลคูลัส 101 สำหรับ ม.ปลาย",
    level: "m6",
    levelLabel: "มัธยมศึกษาตอนปลาย",
    gradientClass: "from-indigo-500 to-purple-600",
    lessonsCount: 3,
    instructor: "ครูเซ็ง (Seng)",
    progress: 45,
  },
  {
    id: "math-m4-t1",
    title: "สรุปเนื้อหาคณิตศาสตร์ ม.4 เทอม 1 & 2",
    level: "m4",
    levelLabel: "มัธยมศึกษาปีที่ 4",
    gradientClass: "from-blue-500 to-indigo-600",
    lessonsCount: 3,
    instructor: "ครูเซ็ง (Seng)",
    progress: 72,
  },
  {
    id: "alevel-math1",
    title: "ตะลุยโจทย์ A-Level คณิต 1 เข้มข้น",
    level: "exam",
    levelLabel: "เตรียมสอบเข้ามหาวิทยาลัย",
    gradientClass: "from-fuchsia-500 to-pink-600",
    lessonsCount: 3,
    instructor: "ครูเซ็ง (Seng)",
    progress: 61,
  },
];

const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: "assign-calc-1",
    courseId: "calc-101",
    type: "file",
    title: "การบ้านบทที่ 1: การหาลิมิตด้วยวิธีสังยุค (Conjugate)",
    dueDate: "2026-06-10",
    points: 10,
    instructions: "ให้นักเรียนแสดงวิธีทำอย่างละเอียดในแบบฝึกหัดท้ายบทข้อ 1 ถึงข้อ 5 ในสไลด์บรรยาย ถ่ายรูปหรือสแกนเป็นไฟล์ PDF ส่งเข้ามาในระบบ",
    createdAt: MOCK_TIME_BASE - 86400000,
  },
  {
    id: "assign-calc-2",
    courseId: "calc-101",
    type: "quiz",
    title: "ควิซท้ายบทที่ 1: ความต่อเนื่องของฟังก์ชัน",
    dueDate: "2026-06-15",
    points: 10,
    timeLimit: 15,
    questions: [
      {
        question: "พิจารณาฟังก์ชัน f(x) = (x² - 9) / (x - 3) เมื่อ x ≠ 3. หากฟังก์ชันนี้ต่อเนื่องที่ x = 3 แล้ว f(3) ควรมีค่าเท่าใด?",
        options: ["A) f(3) = 3", "B) f(3) = 6", "C) f(3) = 9", "D) ไม่สามารถหาค่าได้"],
        correctIndex: 1,
        explanation: "ลิมิตของ f(x) เมื่อ x เข้าใกล้ 3 คือ lim (x+3) = 6. ดังนั้น f(3) ต้องเท่ากับ 6 ฟังก์ชันจึงจะต่อเนื่องสมบูรณ์ที่จุดนี้",
      },
      {
        question: "ข้อใดเป็นเงื่อนไขที่จำเป็นสำหรับความต่อเนื่องของฟังก์ชัน f ที่จุด x = a?",
        options: [
          "A) f(a) หาค่าได้ และ lim(x->a) f(x) หาค่าได้",
          "B) lim(x->a) f(x) = f(a)",
          "C) lim(x->a+) f(x) = lim(x->a-) f(x)",
          "D) ถูกทุกข้อ",
        ],
        correctIndex: 3,
        explanation: "เงื่อนไขทั้ง 3 ข้อในตัวเลือก A, B, C ล้วนจำเป็นต่อความต่อเนื่องของฟังก์ชันทั้งหมด",
      },
    ],
    createdAt: MOCK_TIME_BASE - 172800000,
  },
];

const INITIAL_SUBMISSIONS: StudentSubmission[] = [
  {
    id: "sub-calc1-std1",
    assignmentId: "assign-calc-1",
    studentId: "std-1",
    studentName: "สมชาย ใจดี",
    submittedAt: MOCK_TIME_BASE - 7200000,
    type: "file",
    fileName: "calculus_hw1_somchai.pdf",
  },
  {
    id: "sub-calc1-std2",
    assignmentId: "assign-calc-1",
    studentId: "std-2",
    studentName: "กัญญา รักเรียน",
    submittedAt: MOCK_TIME_BASE - 86400000,
    type: "file",
    fileName: "kanya_limit_study.pdf",
  },
  {
    id: "sub-calc1-std4",
    assignmentId: "assign-calc-1",
    studentId: "std-4",
    studentName: "นภา ลอยฟ้า",
    submittedAt: MOCK_TIME_BASE - 14400000,
    type: "file",
    fileName: "napa_limit_ans.pdf",
  },
  {
    id: "sub-calc2-std1",
    assignmentId: "assign-calc-2",
    studentId: "std-1",
    studentName: "สมชาย ใจดี",
    submittedAt: MOCK_TIME_BASE - 3600000,
    type: "quiz",
    score: 1,
    answers: { 0: 1, 1: 0 },
  },
  {
    id: "sub-calc2-std2",
    assignmentId: "assign-calc-2",
    studentId: "std-2",
    studentName: "กัญญา รักเรียน",
    submittedAt: MOCK_TIME_BASE - 80000000,
    type: "quiz",
    score: 2,
    answers: { 0: 1, 1: 3 },
  },
  {
    id: "sub-calc2-std3",
    assignmentId: "assign-calc-2",
    studentId: "std-3",
    studentName: "วิชัย เพียรพยายาม",
    submittedAt: MOCK_TIME_BASE - 1800000,
    type: "quiz",
    score: 1,
    answers: { 0: 1, 1: 1 },
  },
  {
    id: "sub-calc2-std4",
    assignmentId: "assign-calc-2",
    studentId: "std-4",
    studentName: "นภา ลอยฟ้า",
    submittedAt: MOCK_TIME_BASE - 10800000,
    type: "quiz",
    score: 2,
    answers: { 0: 1, 1: 3 },
  },
];

const INITIAL_CREDENTIALS: Credential[] = [
  { username: "admin",   password: "admin@2026", role: "admin",   displayName: "ผู้ดูแลระบบ"        },
  { username: "kruseng", password: "math@2026",  role: "teacher", displayName: "ครูเซ็ง (Seng)"    },
  { username: "phumin",  password: "math@2026",  role: "student", displayName: "น้องภูมินทร์ (ม.6)" },
];

const INITIAL_APP_USERS: AppUser[] = [
  { id: "admin-1",   username: "admin",   displayName: "ผู้ดูแลระบบ",         role: "admin",   createdAt: MOCK_TIME_BASE - 864000000 },
  { id: "teacher-1", username: "kruseng", displayName: "ครูเซ็ง (Seng)",       role: "teacher", createdAt: MOCK_TIME_BASE - 604800000 },
  { id: "std-1",     username: "phumin",  displayName: "น้องภูมินทร์ (ม.6)",   role: "student", createdAt: MOCK_TIME_BASE - 432000000 },
  { id: "std-2",     username: "somchai", displayName: "สมชาย ใจดี",           role: "student", createdAt: MOCK_TIME_BASE - 345600000 },
  { id: "std-3",     username: "kanya",   displayName: "กัญญา รักเรียน",       role: "student", createdAt: MOCK_TIME_BASE - 259200000 },
  { id: "std-4",     username: "wichai",  displayName: "วิชัย เพียรพยายาม",    role: "student", createdAt: MOCK_TIME_BASE - 172800000 },
  { id: "std-5",     username: "napa",    displayName: "นภา ลอยฟ้า",           role: "student", createdAt: MOCK_TIME_BASE - 86400000  },
];

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("student");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const courses = INITIAL_COURSES;
  
  // Initialize with some premium mock assignments
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);

  const [displayName,      setDisplayName]      = useState("ผู้ใช้");
  const [currentUsername,  setCurrentUsername]  = useState("");

  const login = (selectedRole: Role, name: string, username: string) => {
    setRole(selectedRole);
    setDisplayName(name);
    setCurrentUsername(username);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const addMeeting = (meeting: Meeting) => {
    setMeetings((prev) => [meeting, ...prev]);
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const addAssignment = (assignment: Assignment) => {
    setAssignments((prev) => [assignment, ...prev]);
  };

  const [submissions, setSubmissions] = useState<StudentSubmission[]>(INITIAL_SUBMISSIONS);

  const addSubmission = (submission: StudentSubmission) => {
    setSubmissions((prev) => [submission, ...prev]);
  };

  const [lessons, setLessons] = useState<Lesson[]>([
    // calc-101 lessons
    {
      id: "les-calc-1",
      courseId: "calc-101",
      title: "บทที่ 1: ลิมิตและความต่อเนื่องของฟังก์ชัน",
      description: "เรียนรู้นิยามของลิมิต การหาค่าลิมิตซ้ายขวา และเงื่อนไขความต่อเนื่อง 3 ข้อเพื่อวิเคราะห์ฟังก์ชันเชิงลึก",
      videoUrl: "https://www.youtube.com/watch?v=riXcZT2ICjA",
      subLessons: [
        { id: "les-calc-1-1", title: "1.1 นิยามของลิมิต", duration: "11:20" },
        { id: "les-calc-1-2", title: "1.2 ลิมิตซ้ายและขวา", duration: "14:05" },
        { id: "les-calc-1-3", title: "1.3 ความต่อเนื่อง of ฟังก์ชัน", duration: "16:40" },
      ],
    },
    {
      id: "les-calc-2",
      courseId: "calc-101",
      title: "บทที่ 2: อนุพันธ์ของฟังก์ชัน",
      description: "ทำความเข้าใจอัตราการเปลี่ยนแปลงเฉลี่ยและชั่วขณะ อนุพันธ์ ณ จุดใดๆ และสูตรการดิฟเฟอเรนชิเอตแบบต่างๆ",
      videoUrl: "https://www.youtube.com/watch?v=WUvTyaaNkzM",
      subLessons: [
        { id: "les-calc-2-1", title: "2.1 ความหมายของอนุพันธ์", duration: "12:15" },
        { id: "les-calc-2-2", title: "2.2 กฎการหาอนุพันธ์", duration: "18:30" },
        { id: "les-calc-2-3", title: "2.3 การประยุกต์ของอนุพันธ์", duration: "15:10" },
      ],
    },
    {
      id: "les-calc-3",
      courseId: "calc-101",
      title: "บทที่ 3: ปริพันธ์ (Integrals)",
      description: "ศึกษาเรื่องปฏิยานุพันธ์ การอินทิเกรตแบบจำกัดเขตและไม่จำกัดเขต ตลอดจนการประยุกต์หาพื้นที่และปริมาตรใต้โค้ง",
      videoUrl: "https://www.youtube.com/watch?v=rfG8ce4nNh0",
      subLessons: [
        { id: "les-calc-3-1", title: "3.1 ปฏิยานุพันธ์เบื้องต้น", duration: "13:05" },
        { id: "les-calc-3-2", title: "3.2 ปริพันธ์จำกัดเขต", duration: "17:25" },
        { id: "les-calc-3-3", title: "3.3 พื้นที่ใต้กราฟ", duration: "14:50" },
      ],
    },
    // math-m4-t1 lessons
    {
      id: "les-m4-1",
      courseId: "math-m4-t1",
      title: "บทที่ 1: เซต (Sets)",
      description: "ปูพื้นฐานเรื่องเซต สมาชิก เอกภพสัมพัทธ์ การดำเนินการทางเซต (ยูเนียน อินเตอร์เซกชัน คอมพลีเมนต์ ผลต่าง) และแผนภาพเวนน์-ออยเลอร์",
      videoUrl: "https://www.youtube.com/watch?v=aBastmRnXnA"
    },
    {
      id: "les-m4-2",
      courseId: "math-m4-t1",
      title: "บทที่ 2: ตรรกศาสตร์ (Logic)",
      description: "ศึกษาประพจน์ ตัวเชื่อมประพจน์ ตารางค่าความจริง สัจนิรันดร์ การอ้างเหตุผล และตัวบ่งปริมาณ",
      videoUrl: "https://www.youtube.com/watch?v=0DPnHhBPMR0"
    },
    {
      id: "les-m4-3",
      courseId: "math-m4-t1",
      title: "บทที่ 3: จำนวนจริง (Real Numbers)",
      description: "เจาะลึกโครงสร้างจำนวนจริง สมบัติการเท่ากันและการคูณ การแยกตัวประกอบพหุนาม สมการและอสมการพหุนาม ค่าสัมบูรณ์",
      videoUrl: "https://www.youtube.com/watch?v=H4pOa9lG0Hg"
    },
    // alevel-math1 lessons
    {
      id: "les-alevel-1",
      courseId: "alevel-math1",
      title: "บทที่ 1: สรุปเทคนิคฟังก์ชันตรีโกณมิติ",
      description: "วิเคราะห์ฟังก์ชันไซน์ คอส แทน เอกลักษณ์ตรีโกณมิติ สูตรมุม 2 เท่า 3 เท่า และสมการตรีโกณมิติแนวข้อสอบจริง",
      videoUrl: "https://www.youtube.com/watch?v=yBw67Fb31Cs"
    },
    {
      id: "les-alevel-2",
      courseId: "alevel-math1",
      title: "บทที่ 2: ตะลุยโจทย์เมทริกซ์และเวกเตอร์",
      description: "หาดีเทอร์มิแนนต์ อินเวอร์สการคูณ การแก้ระบบสมการด้วยกฎของคราเมอร์และการดำเนินการตามแถว พร้อมเวกเตอร์ 2 มิติและ 3 มิติ",
      videoUrl: "https://www.youtube.com/watch?v=fNk_zzaMoSs"
    },
    {
      id: "les-alevel-3",
      courseId: "alevel-math1",
      title: "บทที่ 3: แนวข้อสอบสถิติและการกระจายตัว",
      description: "ค่ากลางของข้อมูล ค่าการวัดการกระจาย สัมประสิทธิ์การกระจาย คะแนนมาตรฐาน (z-score) และการแจกแจงแบบปกติเชิงโค้ง",
      videoUrl: "https://www.youtube.com/watch?v=Kas0tIxDvrg"
    }
  ]);

  const updateLesson = (updatedLesson: Lesson) => {
    setLessons((prev) => prev.map((l) => (l.id === updatedLesson.id ? updatedLesson : l)));
  };

  const [appUsers, setAppUsers] = useState<AppUser[]>(INITIAL_APP_USERS);

  const addAppUser = (user: AppUser) => {
    setAppUsers((prev) => [...prev, user]);
  };

  const updateAppUser = (updated: AppUser) => {
    setAppUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const deleteAppUser = (userId: string) => {
    setAppUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const [credentials, setCredentials] = useState<Credential[]>(INITIAL_CREDENTIALS);

  const updateDisplayName = (name: string) => {
    setDisplayName(name);
    setCredentials(prev => prev.map(c =>
      c.username === currentUsername ? { ...c, displayName: name } : c
    ));
    setAppUsers(prev => prev.map(u =>
      u.username === currentUsername ? { ...u, displayName: name } : u
    ));
  };

  const updatePassword = (oldPw: string, newPw: string): { success: boolean; error?: string } => {
    const cred = credentials.find(c => c.username === currentUsername);
    if (!cred) return { success: false, error: "ไม่พบบัญชีผู้ใช้" };
    if (cred.password !== oldPw) return { success: false, error: "รหัสผ่านเดิมไม่ถูกต้อง" };
    setCredentials(prev => prev.map(c =>
      c.username === currentUsername ? { ...c, password: newPw } : c
    ));
    return { success: true };
  };

  const register = (data: Credential): { success: boolean; error?: string } => {
    if (credentials.some(c => c.username === data.username)) {
      return { success: false, error: "Username นี้มีในระบบแล้ว" };
    }
    setCredentials(prev => [...prev, data]);
    setAppUsers(prev => [...prev, {
      id:          "usr-" + Math.random().toString(36).substring(2, 9),
      username:    data.username,
      displayName: data.displayName,
      role:        data.role,
      createdAt:   Date.now(),
    }]);
    return { success: true };
  };

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
        login,
        logout,
        meetings,
        addMeeting,
        darkMode,
        toggleDarkMode,
        courses,
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
        credentials,
        register,
        updateDisplayName,
        updatePassword,
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


