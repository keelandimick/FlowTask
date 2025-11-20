# FlowTask

A modern task management app with lists, reminders, and recurring tasks built with React, TypeScript, and Supabase.

## Features

### Core Functionality
- **Three Views**: Tasks, Reminders, Recurring
- **Smart Lists**: Create and manage multiple lists with custom colors
- **Drag & Drop**: Move items between columns with smooth interactions
- **Notes System**: Add notes to tasks with special "on hold" status
- **Global Search**: Find tasks across all lists with ⌘K/Ctrl+K

### Collaboration
- **List Sharing**: Share lists with other users via email
- **Real-Time Sync**: See collaborator changes instantly in shared lists
- **Isolated Updates**: Personal lists remain fast with optimistic updates

### AI-Powered
- **Smart List Assignment**: AI automatically assigns new tasks to the most appropriate list based on content
- **AI Categorization**: Organize tasks by AI-generated categories within lists
- **Context-Aware**: Analyzes keywords and context (e.g., "business meeting" → Work list)
- **User-Triggered**: Manual control over when to categorize existing tasks
- **Smart Import**: Import tasks from images and PDFs with automatic list matching
- **Spell Check**: Automatic spelling correction when creating tasks

### User Experience
- **Keyboard Navigation**: Navigate tasks with arrow keys
- **Keyboard Shortcuts**: Quick actions with ⌘I, ⌘K
- **Dark Mode Support**: System preference detection (manual toggle coming)
- **Mobile Responsive**: Works on desktop and mobile browsers
- **PWA Ready**: Add to home screen on Safari/Chrome

## Tech Stack

### Frontend
- **React** with TypeScript
- **Zustand** for state management
- **Tailwind CSS** for styling
- **@dnd-kit** for drag and drop
- **date-fns** & **Chrono** for date parsing

### Backend & Services
- **Supabase** (PostgreSQL + Realtime + Auth)
- **OpenAI** for AI categorization and spell checking

## Getting Started

### Prerequisites
- Node.js 16+
- Supabase account
- OpenAI API key (for AI features)

### Installation
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase and OpenAI credentials

# Run development server
npm start

# Build for production
npm run build
```

### Environment Variables
```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
REACT_APP_OPENAI_API_KEY=your-openai-api-key
```

## Key Concepts

### Real-Time Collaboration
- **Shared Lists**: Automatic real-time sync via Supabase Realtime
- **Personal Lists**: Fast optimistic updates with polling backup
- **Conflict Prevention**: Your changes take priority during updates

### AI Categorization
- Toggle between **Column View** (status-based) and **Category View** (AI-organized)
- Categories are context-aware (e.g., "Work" list won't have "Personal" categories)
- Manual re-categorization on demand

### Data Management
- **Soft Deletes**: Items move to trash before permanent deletion
- **Duplicate Prevention**: Excludes completed/trashed items
- **User Preferences**: Persistent settings per user

## Project Structure
```
src/
├── components/     # React components
├── contexts/       # Auth and other contexts
├── lib/           # AI, database, and utility functions
├── store/         # Zustand state management
├── types/         # TypeScript type definitions
└── utils/         # Helper functions
```

## Known Limitations
- Browser prevents Cmd+N override (opens new tab instead)
- Supabase eventual consistency can cause brief delays
- No offline support yet
- Limited to Supabase's rate limits

## License
Private project - all rights reserved
