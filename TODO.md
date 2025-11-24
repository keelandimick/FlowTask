# FlowTask TODO

## Near-Term Priorities

### 1. Implement Refresh Categories Logic
- ✅ UI added to iOS Settings (disabled)
- Implement AI categorization functionality
- Call AI to categorize uncategorized tasks
- Show progress indicator during categorization
- Only enable when uncategorized items exist

### 2. Confirm Syncing Works
- Test iOS → Web syncing (including clearing date/times)
- Test Web → iOS syncing
- Verify all task operations sync correctly

### 3. Test Push Notifications & Siri
- Thoroughly test push notifications for reminders AND recurring items
- Test Siri integration ("In FlowTask, remind me to...")
- Verify notification timing and content
- Ensure recurring notifications fire at correct intervals

### 4. Implement Simple Popup Yellow Note
- When tapping once on an item, show a yellow popup note
- Simple overlay/modal showing task notes

### 5. Fix Shared List Logic
- Work out shared list logic so it actually works
- Currently unfinished in both web and iOS
- Ensure proper multi-user collaboration

### 6. File Attachments
- Implement file attachment directly to items
- Allow users to attach files to tasks/reminders
- Display attached files in Notes section
- Support common file types (images, PDFs, documents)
- Store files in Supabase Storage

### 7. Create Dashboard Screen in iOS
Includes (in this order):
- Reminders (today and within7 status)
- Tasks (with "NOW" priority badge only)
- Recurring items (daily frequency only)
