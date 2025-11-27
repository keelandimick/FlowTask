# FlowTask TODO

## Known Issues

### 🔒 OpenAI API Keys Exposed (CRITICAL - Before Production)
- Both web (.env) and iOS (SupabaseService.swift:699) expose API keys client-side
- Solution: Move AI categorization to Supabase Edge Function (like Quick Add already does)

---

## Todos

### 1. File Attachments
- Implement file attachment directly to items
- Allow users to attach files to tasks/reminders
- Display attached files in Notes section
- Support common file types (images, PDFs, documents)
- Store files in Supabase Storage

### 2. Silent Push Notifications (iOS Background Sync)
- Enable notifications for reminders created on web without opening iOS app
- Setup APNs (Apple Push Notification Service) in Apple Developer account
- Create Supabase Edge Function to send silent push when reminder is created
- iOS receives silent push, wakes briefly, syncs task, schedules local notification
- Ensures cross-platform reminder notifications work reliably
