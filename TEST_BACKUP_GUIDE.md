# Database Backup System - Testing Guide

## Implementation Summary

I've successfully implemented a comprehensive database backup system with two export formats:

### 1. **JSON Backup** (`/api/admin/database-backup`)
- Returns structured JSON with metadata
- Includes all relations and nested data
- Best for data migration and inspection
- Contains record counts and export timestamp

### 2. **SQL Backup** (`/api/admin/database-backup-sql`)
- Returns ready-to-execute PostgreSQL SQL statements
- Direct database restore capability
- Uses INSERT statements with conflict handling
- Best for database recovery

## Features Implemented

### API Endpoints
- ✅ `/api/admin/database-backup.ts` - JSON export
- ✅ `/api/admin/database-backup-sql.ts` - SQL export
- ✅ Admin authentication required
- ✅ Complete data export from all tables

### Component Updates
- ✅ `DatabaseBackup.tsx` updated with dual download options
- ✅ JSON and SQL backup buttons
- ✅ Format comparison information
- ✅ Download progress indicators
- ✅ Success/error toast notifications

### Admin Dashboard Integration
- ✅ Added "Backup" tab to admin dashboard
- ✅ FaDatabase icon for backup tab
- ✅ DatabaseBackup component integrated

## Tables Included in Backup

1. **User** - Users with roles and profiles
2. **Location** - Geofencing locations
3. **Attendance** - Check-in/out records
4. **LeaveType** - Leave type definitions
5. **LeaveRequest** - Leave applications
6. **LeaveBalance** - User leave balances
7. **LeaveDocument** - Supporting documents
8. **WorkShift** - Shift definitions
9. **Roster** - Employee rosters
10. **NotificationSubscription** - Push subscriptions
11. **Notification** - System notifications
12. **DailyReport** - Generated reports
13. **Task** - Task assignments
14. **TaskMessage** - Task communications

## How to Test

### 1. Access the Backup Feature
1. Open browser to `http://localhost:3000`
2. Login as an admin user
3. Navigate to the admin dashboard
4. Click on the "Backup" tab

### 2. Test JSON Backup
1. Click "Download JSON Backup" button
2. Button should show "Creating JSON Backup..." during download
3. A file named `database_backup_YYYY-MM-DD-HHMMSS.json` should download
4. Open the JSON file to verify structure
5. Check for metadata section with record counts

### 3. Test SQL Backup
1. Click "Download SQL Backup" button
2. Button should show "Creating SQL Backup..." during download
3. A file named `database_backup_YYYY-MM-DD-HHMMSS.sql` should download
4. Open the SQL file to verify INSERT statements
5. Check for proper PostgreSQL syntax

### 4. Verify Success Messages
- Toast notification should appear after successful download
- "Last backup created" alert should update with timestamp and format type
- Record counts should be displayed in the toast

## Testing Checklist

### Functional Tests
- [ ] Admin can access the Backup tab
- [ ] Non-admin users are blocked (403 error)
- [ ] JSON backup downloads successfully
- [ ] SQL backup downloads successfully
- [ ] Filenames include timestamp
- [ ] Files contain actual data
- [ ] Both formats can be downloaded in sequence
- [ ] Loading states work correctly
- [ ] Error handling works for failed downloads
- [ ] Toast notifications appear correctly

### Data Integrity Tests
- [ ] JSON backup includes all tables
- [ ] JSON backup has metadata section
- [ ] JSON backup includes nested relations
- [ ] SQL backup has valid INSERT statements
- [ ] SQL backup includes all tables
- [ ] SQL backup has proper escaping
- [ ] Record counts match database

### UI/UX Tests
- [ ] Buttons are clearly labeled
- [ ] Format descriptions are helpful
- [ ] Icons are appropriate (FaFileCode, FaFileAlt)
- [ ] Loading states prevent double-clicks
- [ ] Success/error messages are clear
- [ ] Mobile responsive layout works

## Expected Output

### JSON Backup Structure
```json
{
  "metadata": {
    "exportDate": "2025-12-04T...",
    "version": "1.0",
    "databaseType": "PostgreSQL",
    "recordCounts": {
      "users": 10,
      "locations": 5,
      // ... other counts
    }
  },
  "data": {
    "users": [...],
    "locations": [...],
    // ... other tables
  }
}
```

### SQL Backup Structure
```sql
-- Database Backup
-- Generated: 2025-12-04T...
BEGIN;
SET session_replication_role = replica;

INSERT INTO "User" (...) VALUES (...);
INSERT INTO "Location" (...) VALUES (...);
-- ... more inserts

SET session_replication_role = DEFAULT;
COMMIT;
```

## Troubleshooting

### Issue: 401 Unauthorized
**Solution:** Make sure you're logged in as an admin user

### Issue: 403 Forbidden
**Solution:** Current user doesn't have ADMIN role

### Issue: Download doesn't start
**Solution:** Check browser console for errors, verify API endpoint is accessible

### Issue: Empty backup file
**Solution:** Database might be empty, add test data and retry

### Issue: SQL syntax errors
**Solution:** Check if data has special characters that need escaping

## Security Considerations

✅ **Implemented:**
- Admin-only access (role-based authentication)
- Supabase session verification
- Secure file download (client-side blob creation)

⚠️ **Recommendations:**
- Store backups in encrypted storage
- Implement backup retention policy
- Schedule automatic backups
- Test restore procedures regularly
- Audit backup downloads (add logging)

## Next Steps (Optional Enhancements)

1. **Automated Backups:** Schedule daily/weekly backups
2. **Backup History:** Track previous backups
3. **Restore Functionality:** Upload and restore from backup
4. **Compression:** Add .zip compression for large backups
5. **Cloud Storage:** Upload to AWS S3 or similar
6. **Differential Backups:** Only backup changed data
7. **Email Notifications:** Send backup completion emails

## Files Modified/Created

### Created:
- `src/pages/api/admin/database-backup.ts`
- `src/pages/api/admin/database-backup-sql.ts`
- `TEST_BACKUP_GUIDE.md` (this file)

### Modified:
- `src/components/DatabaseBackup.tsx`
- `src/pages/admin-dashboard.tsx`

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the terminal for API errors
3. Verify your admin credentials
4. Ensure database connection is working
5. Check Prisma schema matches implementation
