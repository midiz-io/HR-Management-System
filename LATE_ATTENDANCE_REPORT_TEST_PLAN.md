# Late Attendance Report - Test Plan & Implementation Summary

## Overview
This document outlines the testing plan for the newly implemented Late Attendance Report feature, which allows admins to track and analyze employee late arrivals against their rostered work shift times.

## Implementation Summary

### Files Created/Modified

#### 1. API Endpoint
**File**: `src/pages/api/reports/late-attendance.ts`
- **Purpose**: Backend API to fetch and process late attendance data
- **Method**: GET
- **Authentication**: Required (ADMIN or MANAGER role only)
- **Query Parameters**:
  - `startDate`: Start date filter (ISO format)
  - `endDate`: End date filter (ISO format)
  - `department`: Optional department filter
  - `userId`: Optional specific user filter

**Features**:
- Joins Attendance records with User, Roster, and WorkShift data
- Calculates late minutes by comparing check-in time to roster start time
- Returns Sri Lankan timezone formatted dates/times
- Provides summary statistics:
  - Total late records
  - Unique late employees
  - Average late minutes per record
  - Average late minutes per employee
  - Top 10 late offenders with statistics

#### 2. Frontend Component
**File**: `src/components/LateAttendanceReport.tsx`
- **Purpose**: User interface for viewing and downloading late attendance reports
- **Features**:
  - Date range picker with quick presets
  - Department filter dropdown
  - Employee filter dropdown
  - Search functionality
  - Summary cards showing key metrics
  - Responsive data table
  - CSV download
  - Excel download
  - Top late employees ranking section

#### 3. Dashboard Integration
**File**: `src/pages/admin-dashboard.tsx` (Modified)
- Added "Late Report" tab to admin navigation
- Added FaExclamationTriangle icon import
- Integrated LateAttendanceReport component
- Added to mobile navigation "More" menu

## Features Overview

### 1. Date Range Filtering
- **Quick Presets**:
  - Today
  - Yesterday
  - Last 7 days
  - Last 30 days
  - This week
  - This month
- **Custom Date Range**: Calendar picker for any date range

### 2. Department Filtering
- Dropdown list of all departments
- "All Departments" option to view all data

### 3. Employee Filtering
- Dropdown list of all employees
- "All Employees" option to view all data
- Displays employee name and email

### 4. Search Functionality
- Real-time search across employee names and departments
- Search-as-you-type filtering

### 5. Summary Statistics (4 Cards)
- **Total Late Records**: Count of all late attendance entries
- **Late Employees**: Number of unique employees who were late
- **Avg Late Time/Record**: Average late minutes across all records (HH:MM format)
- **Avg Late Time/Employee**: Average late minutes per employee (HH:MM format)

### 6. Data Table Columns
| Column | Description |
|--------|-------------|
| Employee | Full name of the employee |
| Date | Date of attendance (DD/MM/YYYY) |
| Department | Employee's department |
| Roster Start | Expected start time from work shift (HH:MM AM/PM) |
| Check In | Actual check-in time (HH:MM AM/PM) |
| Late Duration | Minutes late in HH:MM format |

### 7. Download Features
- **CSV Download**: Exports data with all columns to CSV format
- **Excel Download**: Exports styled HTML table with summary statistics
- Both include:
  - Summary section with total records and averages
  - Full data table
  - Timestamp in filename

### 8. Top Late Employees Section
- Displays top 10 employees by late frequency
- Shows:
  - Rank
  - Employee name
  - Number of late occurrences
  - Total late minutes (HH:MM format)
  - Average late minutes per occurrence (HH:MM format)

## Test Plan

### Test Environment Setup
1. Ensure database has:
   - Users with various departments
   - Work shifts with defined start/end times
   - Rosters linking users to work shifts
   - Attendance records with LATE status
2. Login as ADMIN user
3. Navigate to Admin Dashboard → Late Report tab

### Test Cases

#### TC-001: API Authentication
**Objective**: Verify API only allows ADMIN/MANAGER access
- **Steps**:
  1. Test API call without authentication → Should return 401
  2. Test API call as EMPLOYEE role → Should return 403
  3. Test API call as ADMIN role → Should return 200
- **Expected Result**: Only ADMIN/MANAGER can access the endpoint

#### TC-002: Date Range Filtering
**Objective**: Verify date range filtering works correctly
- **Steps**:
  1. Select "Today" preset → Verify data shows only today's late records
  2. Select "Yesterday" preset → Verify data shows only yesterday's late records
  3. Select "Last 7 days" → Verify data shows past week
  4. Select custom date range (e.g., Jan 1 - Jan 15) → Verify data within range
- **Expected Result**: Data accurately reflects selected date range

#### TC-003: Department Filtering
**Objective**: Verify department filter works correctly
- **Steps**:
  1. Select "All Departments" → Verify all records shown
  2. Select specific department (e.g., "IT") → Verify only IT department records shown
  3. Switch to another department → Verify data updates
- **Expected Result**: Data filtered by selected department

#### TC-004: Employee Filtering
**Objective**: Verify employee filter works correctly
- **Steps**:
  1. Select "All Employees" → Verify all records shown
  2. Select specific employee → Verify only that employee's records shown
  3. Combine with department filter → Verify both filters work together
- **Expected Result**: Data filtered by selected employee

#### TC-005: Search Functionality
**Objective**: Verify search works across employee names and departments
- **Steps**:
  1. Type employee name in search box → Verify matching records shown
  2. Type department name → Verify matching records shown
  3. Type partial text → Verify fuzzy matching works
  4. Clear search → Verify all records return
- **Expected Result**: Real-time search filtering works correctly

#### TC-006: Summary Statistics Calculation
**Objective**: Verify summary cards show accurate calculations
- **Steps**:
  1. Note total records in table
  2. Count unique employees
  3. Manually calculate average late time
  4. Compare with summary cards
- **Expected Result**: Summary statistics match actual data

#### TC-007: Late Minutes Calculation
**Objective**: Verify late duration calculated correctly
- **Steps**:
  1. Find record with known roster start time (e.g., 09:00 AM)
  2. Find record with known check-in time (e.g., 09:15 AM)
  3. Verify late duration shows "00:15"
  4. Test with various time differences
- **Expected Result**: Late duration = Check In Time - Roster Start Time

#### TC-008: Data Table Display
**Objective**: Verify all columns display correctly
- **Steps**:
  1. Verify all 6 columns are visible
  2. Check date format (DD/MM/YYYY)
  3. Check time format (HH:MM AM/PM)
  4. Check late duration format (HH:MM)
  5. Verify data accuracy
- **Expected Result**: All columns display correct formatted data

#### TC-009: CSV Download
**Objective**: Verify CSV download works correctly
- **Steps**:
  1. Click "Download CSV" button
  2. Open downloaded file
  3. Verify filename includes date
  4. Verify summary section included
  5. Verify all data rows present
  6. Verify columns separated by commas
  7. Verify special characters escaped
- **Expected Result**: CSV file downloads with complete accurate data

#### TC-010: Excel Download
**Objective**: Verify Excel download works correctly
- **Steps**:
  1. Click "Download Excel" button
  2. Open downloaded file in Excel
  3. Verify filename includes date
  4. Verify styling (headers, borders)
  5. Verify summary section formatted correctly
  6. Verify all data rows present
- **Expected Result**: Excel file downloads with styled table

#### TC-011: Top Late Employees Section
**Objective**: Verify top late employees ranking is accurate
- **Steps**:
  1. Verify top 10 employees listed
  2. Verify sorted by late count (descending)
  3. Verify calculations:
     - Late count matches data table
     - Total late minutes sum correct
     - Average late minutes calculated correctly
  4. Check HH:MM formatting
- **Expected Result**: Ranking accurate and calculations correct

#### TC-012: Responsive Design
**Objective**: Verify mobile responsiveness
- **Steps**:
  1. Test on mobile device (or resize browser to mobile width)
  2. Verify filters stack vertically
  3. Verify table scrolls horizontally
  4. Verify buttons are touch-friendly
  5. Verify summary cards stack appropriately
  6. Test tab navigation on mobile
- **Expected Result**: UI adapts well to mobile screens

#### TC-013: Empty States
**Objective**: Verify empty state handling
- **Steps**:
  1. Select date range with no late records
  2. Verify "No late attendance records found" message
  3. Select employee with no late records
  4. Verify empty state shown
- **Expected Result**: Friendly empty state messages displayed

#### TC-014: Loading States
**Objective**: Verify loading indicators work
- **Steps**:
  1. Click "Generate Report" with slow network
  2. Verify loading spinner shows
  3. Verify buttons disabled during load
  4. Wait for data to load
- **Expected Result**: Loading state provides feedback to user

#### TC-015: Error Handling
**Objective**: Verify error handling works correctly
- **Steps**:
  1. Simulate API error (disconnect network)
  2. Try to generate report
  3. Verify error toast notification
  4. Verify user-friendly error message
- **Expected Result**: Errors handled gracefully with user feedback

#### TC-016: Timezone Consistency
**Objective**: Verify all times use Sri Lankan timezone
- **Steps**:
  1. Check roster start times in report
  2. Check check-in times in report
  3. Verify times match Asia/Colombo (UTC+5:30)
  4. Compare with server time to ensure conversion
- **Expected Result**: All times consistently in Sri Lankan timezone

#### TC-017: Multiple Filters Combined
**Objective**: Verify multiple filters work together
- **Steps**:
  1. Select date range + department + employee
  2. Verify data filtered by all criteria
  3. Add search term
  4. Verify all filters applied simultaneously
  5. Remove filters one by one
  6. Verify data updates accordingly
- **Expected Result**: All filters work in combination

#### TC-018: Data Refresh
**Objective**: Verify data refreshes when changing filters
- **Steps**:
  1. Generate initial report
  2. Change date range
  3. Verify data refreshes automatically
  4. Change department
  5. Verify data updates
- **Expected Result**: Data refreshes when filters change

#### TC-019: Performance with Large Data
**Objective**: Verify performance with many records
- **Steps**:
  1. Select date range with 500+ records
  2. Measure load time
  3. Test scrolling performance
  4. Test download performance
- **Expected Result**: Acceptable performance (< 3 seconds load time)

#### TC-020: Download with Filtered Data
**Objective**: Verify downloads respect active filters
- **Steps**:
  1. Apply department filter
  2. Download CSV
  3. Verify CSV contains only filtered data
  4. Apply additional filters
  5. Download Excel
  6. Verify Excel contains only filtered data
- **Expected Result**: Downloads contain only filtered records

## Integration Tests

### INT-001: Admin Dashboard Integration
- Verify "Late Report" tab appears in admin dashboard
- Verify tab icon shows correctly
- Verify component loads when tab clicked
- Verify tab accessible from mobile "More" menu

### INT-002: Build Integration
- Run `pnpm run vercel-build`
- Verify no compilation errors
- Verify no TypeScript errors (related to new code)
- Verify bundle size remains reasonable

### INT-003: Database Integration
- Verify Prisma queries execute correctly
- Verify joins between Attendance, User, Roster, WorkShift work
- Verify no N+1 query issues
- Verify proper indexing for performance

## Manual Testing Checklist

- [ ] Component renders without errors
- [ ] All filters work independently
- [ ] All filters work in combination
- [ ] Date range picker functions correctly
- [ ] Quick date presets work
- [ ] Department dropdown populates
- [ ] Employee dropdown populates
- [ ] Search filters results real-time
- [ ] Summary cards show correct calculations
- [ ] Data table displays all columns
- [ ] Data table shows correct data
- [ ] Late duration calculated correctly
- [ ] CSV download works
- [ ] Excel download works
- [ ] Top late employees section accurate
- [ ] Empty states display properly
- [ ] Loading states show during data fetch
- [ ] Error states handled gracefully
- [ ] Mobile responsive layout works
- [ ] Tab navigation works on mobile
- [ ] All times in Sri Lankan timezone
- [ ] Toast notifications appear
- [ ] Build completes successfully

## Known Issues & Notes

1. **TypeScript Errors**: Pre-existing TypeScript errors in mobile navigation click handlers (not related to late attendance feature)
2. **Type Checking Skipped**: Build process skips type validation, so TypeScript errors don't block build
3. **Date Format**: API returns ISO dates but UI formats to DD/MM/YYYY for better readability
4. **Time Format**: Uses 12-hour format (AM/PM) for user-friendliness

## Success Criteria

The feature is considered successfully implemented and tested when:
- ✅ All test cases pass
- ✅ Build completes without errors
- ✅ No console errors in browser
- ✅ Component integrates smoothly into admin dashboard
- ✅ All filters and downloads work correctly
- ✅ Calculations are accurate
- ✅ UI is responsive and user-friendly
- ✅ Sri Lankan timezone used consistently
- ✅ Performance is acceptable with large datasets

## Next Steps

1. Deploy to staging/production environment
2. Gather user feedback
3. Monitor API performance
4. Add additional features based on user requests:
   - Export to PDF
   - Email report scheduling
   - Late attendance trends/analytics
   - Department comparison charts
   - Configurable late threshold (e.g., > 15 minutes)

## Contact

For issues or questions regarding this feature, please contact the development team.
