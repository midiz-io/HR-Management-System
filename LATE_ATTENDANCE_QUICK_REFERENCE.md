# 📋 Late Attendance Report - Quick Reference

## 🚀 Quick Start

### Access the Feature:
1. Login as **ADMIN** or **MANAGER**
2. Go to **Admin Dashboard**
3. Click **"Late Report"** tab
4. Select filters and click **"Generate Report"**

## 📊 Main Components

### API Endpoint
```
GET /api/reports/late-attendance
Query Params: startDate, endDate, department?, userId?
Auth: Required (ADMIN/MANAGER only)
Response: JSON with late attendance data + summary
```

### UI Component
```
Location: src/components/LateAttendanceReport.tsx
Features: Filters, Data Table, Downloads, Statistics
Mobile: Fully responsive with horizontal scroll
```

## 🎯 Key Features at a Glance

| Feature | Description |
|---------|-------------|
| **Date Range** | Quick presets + custom picker |
| **Filters** | Department, Employee, Search |
| **Summary** | 4 metric cards with statistics |
| **Data Table** | 6 columns: Name, Date, Dept, Start, In, Late |
| **Downloads** | CSV & Excel/HTML formats |
| **Rankings** | Top 10 late employees list |
| **Mobile** | Responsive design, touch-friendly |

## 📥 Quick Actions

```
Today's Report:
1. Click "Today" preset
2. Click "Generate Report"
3. Done! ✅

Department Report:
1. Select department from dropdown
2. Select date range
3. Click "Generate Report"
4. Done! ✅

Download Report:
1. Generate report first
2. Click "Download CSV" or "Download Excel"
3. File saved with timestamp
4. Done! ✅
```

## 📁 File Locations

```
Backend:  src/pages/api/reports/late-attendance.ts
Frontend: src/components/LateAttendanceReport.tsx
Integrated: src/pages/admin-dashboard.tsx (Late Report tab)
```

## 🧪 Quick Test

```bash
# Build the project
pnpm run vercel-build

# Expected: ✅ Build successful with no errors
# API route: /api/reports/late-attendance
# Component: Accessible from admin dashboard
```

## 📋 Columns Displayed

| # | Column | Format | Example |
|---|--------|--------|---------|
| 1 | Employee Name | Text | John Doe |
| 2 | Date | DD/MM/YYYY | 15/01/2025 |
| 3 | Department | Text | IT |
| 4 | Roster Start | HH:MM AM/PM | 09:00 AM |
| 5 | Check In | HH:MM AM/PM | 09:15 AM |
| 6 | Late Duration | HH:MM | 00:15 |

## 💡 Pro Tips

- Use **"Last 7 Days"** preset for weekly reviews
- **Search** for instant filtering by name/department
- **Combine filters** for detailed insights
- Check **Top Late Employees** for patterns
- **Download CSV** for Excel analysis
- **Download Excel** for formatted reports

## ⚠️ Requirements

### User Requirements:
- Must have ADMIN or MANAGER role
- Must be authenticated

### Data Requirements:
- Employees with departments
- Active rosters assigned
- Work shifts defined
- Attendance records with "LATE" status

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| No data showing | Check date range and ensure "LATE" status exists |
| Access denied | Verify ADMIN/MANAGER role |
| Wrong times | Check roster/work shift configuration |
| Download fails | Ensure data loaded, check popup blocker |

## 📚 Full Documentation

- **Test Plan**: `LATE_ATTENDANCE_REPORT_TEST_PLAN.md`
- **Implementation**: `LATE_ATTENDANCE_IMPLEMENTATION_SUMMARY.md`
- **Visual Guide**: `LATE_ATTENDANCE_VISUAL_GUIDE.md`
- **Completion**: `LATE_ATTENDANCE_COMPLETE.md`

## ✅ Status

```
Implementation:  ✅ COMPLETE
Integration:     ✅ COMPLETE
Build:           ✅ PASSING
Documentation:   ✅ COMPLETE
Status:          🟢 READY FOR PRODUCTION
```

## 📞 Quick Help

**Can't access?** → Check user role (must be ADMIN/MANAGER)
**No results?** → Adjust date range, check data exists
**Wrong times?** → Verify roster assignments and work shifts
**Need help?** → See full documentation files

---

**Everything works! Start using the Late Attendance Report now!** 🎉
