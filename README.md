<div align="center">

# 🏢 AttendX Enterprise HR & Workforce Management System

### *Next-Generation, Cloud-Native Human Capital & Multi-Location Workforce Platform*

<br />

[![Developed by Kalpa Wishvajith](https://img.shields.io/badge/DEVELOPED%20BY-KALPA%20WISHVAJITH-0284c7?style=for-the-badge&logo=codeforces&logoColor=white)](#-engineering-attribution)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.19-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![React Native](https://img.shields.io/badge/Mobile-React_Native_%2F_KMP-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)

<br />

## ⚡ DEVELOPED BY :- KALPA WISHVAJITH ⚡

*Engineered with precision for distributed enterprise workforce operations, sub-meter GPS attendance gating, bulk roster scheduling, statutory payroll compliance, and multi-tier organizational governance.*

---

[📄 **Download Comprehensive PDF Manual**](./AttendX_HRMS_Comprehensive_System_Documentation.pdf) &bull;
[🏛️ **Architecture**](#-system-architecture) &bull;
[✨ **Core Modules**](#-core-functional-modules) &bull;
[🗄️ **Database Schema**](#-database-schema--prisma-models) &bull;
[🚀 **Quick Start**](#-getting-started--installation) &bull;
[📱 **Mobile App**](#-mobile-companion-ecosystem)

---

</div>

<br />

## 📖 Executive Summary

The **AttendX HR & Workforce Management System** is a complete, enterprise-grade Human Capital Management (HCM) software suite designed to eliminate attendance fraud, automate complex rotational work shifts, handle statutory leave calculations, govern multi-tier overtime approvals, and compute automated payroll with statutory deductions (EPF, ETF, Taxes). 

With full multi-location support, employees can punch in using sub-meter GPS geofencing or physical gate QR scanners, while managers and HR directors have instant operational visibility via real-time analytical dashboards.

---

## 📄 Comprehensive System Documentation PDF

A full 11-page master specification document is included in this repository:

👉 **[`AttendX_HRMS_Comprehensive_System_Documentation.pdf`](./AttendX_HRMS_Comprehensive_System_Documentation.pdf)**

*Includes:*
- Full System Architecture Topology & Data Flow Diagrams
- Mathematical Haversine Geofencing Formulation
- Shift Scheduling & Recurrence Algorithms
- Statutory Payroll, EPF (8% / 12%), ETF (3%), and Tax Mechanics
- Complete 28-Model Database Entity-Relationship Reference
- REST API Contract & KMP Mobile Specification
- Automated Cloud Database Backup & Disaster Recovery Runbooks
- **Official Attribution & Watermark: `DEVELOPED BY :- KALPA WISHVAJITH`**

---

## 🏛️ System Architecture

AttendX utilizes a modern serverless decoupled architecture optimized for real-time responsiveness and bulletproof transactional integrity:

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT PLATFORMS                                   |
|   Admin & HR Dashboard (Next.js)  |  Employee Self-Service  |  AttendX Mobile (RN/KMP)|
+-------------------------------------------+-------------------------------------------+
                                            | HTTPS / WSS / JWT Session
+-------------------------------------------v-------------------------------------------+
|                               NEXT.JS SERVERLESS BACKEND                              |
|  - Attendance Distance Engine (Haversine)   - Bulk Roster Generator (Recurrent)       |
|  - Auto-Checkout Cron Watchdog              - Leave Balance & Probation Engine        |
|  - Overtime Multi-Tier Approval Pipeline   - Statutory Payroll Calculation Core       |
|  - Digital Payslip Renderer (PDFKit/jsPDF)  - Push Notification & WhatsApp Dispatcher |
+-------------------------------------------+-------------------------------------------+
                                            | Prisma ORM (Connection Pooler)
+-------------------------------------------v-------------------------------------------+
|                          SUPABASE / POSTGRESQL CLOUD DATABASE                         |
|  - 28 Relational Entities                   - Row Level Security (RLS)                |
|  - Realtime Changefeed Event Bus            - S3 Document Storage Buckets             |
|  - Automated SQL Backups to Cloud           - Point-in-Time Soft Deletion Recovery    |
+---------------------------------------------------------------------------------------+
```

---

## ✨ Core Functional Modules

### 1. 📍 Sub-Meter Geofenced Attendance Engine
- **Haversine Distance Validation:** Validates exact employee mobile/web coordinates against office boundary radius in meters.
- **Biometric & Gate QR Scanner:** Physical terminal kiosk support (`GateQRScanner.tsx`) enabling dynamic cryptographic QR code scanning at security gates.
- **Attendance States:** Automatic classification into `PRESENT`, `LATE`, `ABSENT`, `HALF_DAY`, `SHORT_LEAVE`, and `ON_LEAVE`.
- **Automated Checkouts:** Per-user auto checkout configuration (`autoCheckoutHours`) and nightly cron sweepers.
- **Late Attendance Tracker:** Tracks cumulative and consecutive late strikes with automated warnings.

### 2. 📅 Multi-Shift & Bulk Roster Management
- **Bulk Scheduling:** Rapidly assign shifts to dozens of employees simultaneously filtered by department or physical branch.
- **Flexible Recurrence Patterns:**
  - *Daily Repeat:* Continuous uninterrupted daily schedule.
  - *Repeat by Shift Days:* Matches designated business days (e.g., Monday through Friday).
  - *Day by Day (Custom):* Selective manual day allocation (e.g., Mon, Wed, Sat) with ongoing recurrence or fixed deadlines.
- **Off-Day & Shift Swap Requests:** Structured multi-level workflow (Employee -> Department Head Recommendation -> HR Final Review).

### 3. 🏖️ Smart Probation & Leave Governance
- **Probation Policy Engine:** Dynamically calculates 90-day probation status from `User.joinDate`.
- **Half-Day Quotas:** Allows new probationary recruits **one half-day leave per month** while locking full-day annual leaves until probation graduation.
- **Gate Passes & Short Leaves:** Digital exit pass creation with security gate checkout logs and maximum duration enforcement.

### 4. ⏱️ Overtime (OT) Automation
- **Dual Review Workflows:** Pre-approval and post-shift overtime claims with task references and manager verification.
- **Direct Payroll Feed:** Verified OT hours automatically feed into the monthly payroll calculation engine.

### 5. 💰 Automated Payroll & Payslips
- **Comprehensive Salary Configuration:** Base pay, attendance allowances, performance bonuses, and custom allowances.
- **Statutory Deductions:** Exact calculation of Employee EPF (8%), Employer EPF (12%), Employer ETF (3%), and PAYE tax brackets.
- **Salary Advances & Welfare Deductions:** Approved cash advances and cafeteria/seafood purchases automatically deducted.
- **Digital PDF Payslips:** High-fidelity payslip generation with instant employee download portal.
- **Real-Time Daily Salary Banner:** Displays accrued earnings in real-time on employee self-service dashboard.

### 6. 🍲 Corporate Welfare & Operations
- **Food & Meal Ordering:** Daily cafeteria meal catalog with ordering cutoffs and headcount reports.
- **Seafood & Staff Purchase Scheme:** Internal grocery ordering with dispatch tracking and monthly credit ledger settlement.
- **Company Documents & Policies:** Corporate document library with mandatory employee acknowledgement modals.
- **Department Communication:** Department chat channels, notice board announcements, and read status tracking.

### 7. 🛡️ System Administration & Disaster Recovery
- **5-Tier Role-Based Access Control:** `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SECTIONAL_HEAD`, and `EMPLOYEE`.
- **Automated SQL Database Backup:** Automated and on-demand full database snapshots with local and Google Drive synchronization.
- **Soft Deletion & Trash Recovery:** Accidentally deleted accounts or shifts can be restored instantly from the Trash Registry.

---

## 🗄️ Database Schema & Prisma Models

The database is built on **PostgreSQL** using **Prisma ORM** with 28 fully relational models:

| Model Category | Primary Entities | Key Capabilities |
| :--- | :--- | :--- |
| **Authentication & Users** | `User`, `Department`, `Location` | Roles, hierarchical departments, multi-branch assignment, sequential IDs. |
| **Attendance & Geofencing** | `Attendance`, `LateAttendanceTracker`, `DailyReport` | GPS coordinates, distance calculation, late strikes, punch logs. |
| **Scheduling & Shifts** | `WorkShift`, `Roster`, `OffDayRequest` | Shift templates, recurrence rules, bulk assignments, swap requests. |
| **Leaves & Gate Passes** | `LeaveRequest`, `LeaveBalance`, `LeaveType`, `GatePassRequest`, `ShortLeaveRequest` | Multi-category quotas, probation policy gate, gate QR checkout. |
| **Overtime & Payroll** | `OTRequest`, `SalaryConfig`, `Payroll`, `SalaryAdvanceRequest` | Dynamic allowances, statutory EPF/ETF, salary advance tracking. |
| **Corporate Welfare** | `FoodOrder`, `SeafoodOrder`, `SeafoodItem`, `PendingBillAccount`, `PendingBillPayment` | Cafeteria ordering, grocery dispatch, monthly salary deductions. |
| **Documents & Notices** | `CompanyDocument`, `DocumentAcknowledgement`, `DepartmentNotice`, `DepartmentMessage` | Mandatory policy popups, acknowledgement audit trail, department chat. |
| **System & Recovery** | `SystemSetting`, `TrashRecord`, `NotificationSubscription` | Point-in-time entity restoration, web push notification subscriptions. |

---

## 📱 Mobile Companion Ecosystem

The project features a dedicated mobile companion application (`attendx-mobile`):
- **Stack:** React Native / Expo with TypeScript.
- **Features:** Geofenced punch-in/out, background location tasks, QR code gate pass display, task management, and payslip viewing.
- **Cross-Platform KMP Specification:** Includes master architectural prompt guide for Kotlin Multiplatform (`AttendX_KMP_Spec_Prompt.txt`) targeting Android & iOS with Compose Multiplatform.

---

## 🚀 Getting Started & Installation

### Prerequisites
- Node.js 18.x or 20.x
- PostgreSQL database (or Supabase account)
- pnpm / npm / yarn

### 1. Clone the Repository
```bash
git clone https://github.com/midiz-io/HR-Management-System.git
cd HR-Management-System
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your database and Supabase credentials:
```bash
cp .env.example .env
```

Key environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### 3. Install Dependencies & Generate Prisma Client
```bash
npm install
npx prisma generate
```

### 4. Run Database Migrations
```bash
npx prisma db push
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👨‍💻 Engineering Attribution

<div align="center">

### DEVELOPED BY :- KALPA WISHVAJITH
**Lead Full-Stack Software Engineer & System Architect**

*Designed, architected, and engineered for high-availability enterprise environments.*

GitHub: [@midiz-io](https://github.com/midiz-io) &bull; Repository: [HR-Management-System](https://github.com/midiz-io/HR-Management-System)

---

&copy; AttendX HRMS. All Rights Reserved.

</div>
