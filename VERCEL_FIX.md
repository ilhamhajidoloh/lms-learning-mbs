# แก้ปัญหา Vercel Cold Start และ Session Lost + Slow Data Loading

## ปัญหาที่พบ
1. ⏱️ **Cold Start ช้า** - เมื่อไม่มีคนใช้งานนาน Vercel Serverless Function จะหยุดทำงาน (sleep) และเมื่อมีคนเข้าใช้ครั้งแรกจะโหลดช้ามาก
2. 🔄 **Session หาย** - เมื่อกด refresh หลังจากไม่ได้ใช้งานนาน จะกลับไปหน้า login ทั้งๆ ที่ยัง login อยู่
3. 🐌 **Login ช้า** - ตอน login ต้องโหลดข้อมูลทั้งหมด (courses, lessons, assignments, submissions, users, levels) ทำให้ใช้เวลานาน 10-20 วินาที
4. 🔒 **Login แล้วติดหน้า login** - Login สำเร็จมี token แล้วแต่ไม่ redirect ไปหน้าถัดไป เพราะ middleware ต้องการ cookie แต่ setToken() เซ็ตแค่ localStorage

## วิธีแก้ไข

### 1. สร้าง Middleware สำหรับตรวจสอบ Authentication
- ไฟล์: `front-lms/middleware.ts`
- ป้องกันการเข้าถึงหน้าที่ต้อง login โดยไม่มี token
- Redirect ไปหน้า login ถ้าไม่มี token
- ป้องกันการเข้าหน้า login ซ้ำถ้า login แล้ว

### 2. ปรับปรุง Database Connection Pool
- ไฟล์: `front-lms/lib/db.ts`
- เพิ่ม connection pooling configuration:
  - `max: 20` - จำนวน connection สูงสุด
  - `idleTimeoutMillis: 30000` - ปิด connection ที่ไม่ได้ใช้งานหลัง 30 วินาที
  - `connectionTimeoutMillis: 10000` - timeout 10 วินาที
  - `allowExitOnIdle: true` - สำคัญสำหรับ serverless
- เพิ่ม keep-alive ping ทุก 1 นาที เพื่อป้องกัน connection timeout

### 3. ปรับปรุง API Fetch
- ไฟล์: `front-lms/lib/api.ts`
- เพิ่ม timeout 30 วินาที
- จัดการ 401 Unauthorized อัตโนมัติ (token หมดอายุ)
- Redirect ไปหน้า login เมื่อ session หมดอายุ
- แสดง error message ที่เหมาะสม
- **แก้ไข setToken()** - เซ็ตทั้ง localStorage และ cookie (สำหรับ middleware)
- **แก้ไข removeToken()** - ลบทั้ง localStorage และ cookie

### 4. ปรับปรุง Session Restore
- ไฟล์: `front-lms/app/context/UserContext.tsx`
- เพิ่ม error handling ที่ดีขึ้น
- Redirect ไปหน้า login เมื่อ restore session ไม่สำเร็จ
- Log error เพื่อ debug

### 5. สร้าง Health Check Endpoint
- ไฟล์: `front-lms/app/api/health/route.ts`
- Endpoint สำหรับตรวจสอบว่าระบบทำงานปกติ
- ใช้ ping database เพื่อ wake up serverless function
- สามารถใช้ external monitoring service (เช่น UptimeRobot) ping endpoint นี้ทุก 5 นาทีเพื่อป้องกัน cold start

### 6. Warm Up Function + Lazy Loading
- ไฟล์: `front-lms/app/login/page.tsx`
- เพิ่ม useEffect เพื่อ ping `/api/health` เมื่อเข้าหน้า login
- Wake up serverless function ก่อนที่ user จะกด login
- **แก้ไข handleLogin()** - redirect ก่อน แล้วค่อยโหลดข้อมูลใน background (ไม่ await refreshData)

### 7. Vercel Configuration
- ไฟล์: `front-lms/vercel.json`
- ตั้ง maxDuration = 30 วินาที สำหรับ API routes
- ปิด cache สำหรับ API responses

### 8. Next.js Configuration
- ไฟล์: `front-lms/next.config.ts`
- เพิ่ม `serverExternalPackages: ["pg"]` เพื่อ optimize PostgreSQL driver
- เพิ่ม `optimizePackageImports` สำหรับ lucide-react

### 9. Optimize Database Queries
- ไฟล์: `front-lms/app/api/data/route.ts`
- เปลี่ยนจาก subquery เป็น LEFT JOIN สำหรับนับจำนวน lessons
- เพิ่ม LIMIT สำหรับ assignments (1000), submissions (500-1000), users (500-1000)
- ปรับปรุง query plans เพื่อลดการใช้ resources

### 10. Optimize Database Indexes
- ไฟล์: `front-lms/optimize-indexes.sql`
- เพิ่ม composite indexes สำหรับ queries ที่ใช้บ่อย
- เพิ่ม ANALYZE เพื่ออัปเดต query planner statistics
- ช่วยให้ PostgreSQL เลือก execution plan ที่เหมาะสมที่สุด

### 11. Cache Levels API
- ไฟล์: `front-lms/app/api/levels/route.ts`
- เพิ่ม cache 60 วินาที (ข้อมูล levels เปลี่ยนไม่บ่อย)
- เพิ่ม LIMIT 100 เพื่อป้องกันการโหลดข้อมูลเยอะเกินไป

## คำแนะนำเพิ่มเติม

### การรัน Optimize Indexes (สำคัญ!)
**ต้องรันคำสั่งนี้ใน Database ก่อน deploy** เพื่อสร้าง indexes ที่จำเป็น:
```bash
# ถ้าใช้ PostgreSQL local
psql $DATABASE_URL -f front-lms/optimize-indexes.sql

# หรือใช้ Vercel Postgres Dashboard
# Copy คำสั่งจากไฟล์ optimize-indexes.sql แล้ววางใน SQL Editor
```

### การใช้งาน External Monitoring (แนะนำ)
1. ไปที่ [UptimeRobot](https://uptimerobot.com/) หรือ [Cron-job.org](https://cron-job.org/)
2. สร้าง HTTP Monitor ที่ ping `https://yourdomain.vercel.app/api/health` ทุก 5 นาที
3. จะช่วยให้ serverless function ไม่ sleep และลด cold start

### Environment Variables ที่ควรตั้งใน Vercel
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secure-secret-here
DATABASE_SSL=true
```

### ตรวจสอบว่าแก้ไขปัญหาได้แล้ว
1. ✅ ทดสอบไม่ใช้งานเว็บ 15 นาที แล้ว refresh หน้า → ไม่ควรกลับไป login
2. ✅ Cold start ควรเร็วขึ้น (จาก 10-15 วินาที → 3-5 วินาที)
3. ✅ Login ควรเร็วขึ้น (จาก 10-20 วินาที → 2-3 วินาที) - redirect ทันที ไม่ต้องรอโหลดข้อมูล
4. ✅ Token expire จะ redirect ไป login อัตโนมัติ
5. ✅ Session จะถูกเก็บไว้จนกว่า token จะหมดอายุ (7 วัน)
6. ✅ Login แล้ว redirect ไปหน้าถัดไปทันที (ไม่ติดหน้า login)

## สรุปการปรับปรุง Performance

### Database Query Optimization
- ✅ เปลี่ยน subquery → LEFT JOIN (ลด nested queries)
- ✅ เพิ่ม LIMIT สำหรับข้อมูลขนาดใหญ่
- ✅ เพิ่ม composite indexes 15+ indexes
- ✅ Optimize enrollments query (ลด JOIN ที่ไม่จำเป็น)

### Connection Pool Management
- ✅ max: 20 connections
- ✅ idleTimeoutMillis: 30000ms
- ✅ allowExitOnIdle: true (สำคัญสำหรับ serverless)
- ✅ Keep-alive ping ทุก 1 นาที

### API Improvements
- ✅ Timeout 30 วินาที
- ✅ Auto handle 401 Unauthorized
- ✅ Better error messages
- ✅ Cache levels API (60s)

### Expected Performance Improvements
- 🚀 Login time: **70-80% เร็วขึ้น** (10-20s → 2-3s) - redirect ทันที
- 🚀 Cold start: **50-60% เร็วขึ้น** (10-15s → 3-5s)
- 🚀 Session persistence: **100% ทำงานได้** (ไม่หายตอน refresh)
- 🚀 Login redirect: **100% ทำงานได้** (ไม่ติดหน้า login)

## การ Deploy
```bash
cd front-lms
git add .
git commit -m "Fix Vercel cold start and session lost issues"
git push
```

Vercel จะ auto-deploy หลังจาก push ไปที่ Git repository
