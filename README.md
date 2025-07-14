# Document Tracker - Club Management System

A comprehensive web application for tracking document signatures and approvals within club organizations. This system allows clubs to manage their official documents, track signature progress, and maintain transparency throughout the approval process.

## Features

### 🔐 Authentication System
- **Dual Role System**: Admin and Member accounts
- **Secure Admin Access**: Secret code (1234) required for admin account creation
- **Protected Routes**: Role-based access control

### 📄 Document Management
- **Document Upload**: Support for PDF, DOC, DOCX, PNG, JPG files (up to 10MB)
- **Document Information**: Name, description, and file attachment
- **Admin Approval**: Optional admin approval workflow
- **Status Tracking**: Pending, In Progress, Completed, Rejected statuses

### ✍️ Signature Tracking
- **External Signatories**: Add multiple people who need to sign/approve
- **Signatory Details**: Name, position, email, phone number
- **Progress Tracking**: Real-time signature progress with visual indicators
- **Status Updates**: Mark signatures as completed with optional notes
- **Chronological Order**: Maintain signing order with timestamps

### 📊 Dashboard & Analytics
- **Overview Statistics**: Total documents, pending, in progress, completed
- **Filter System**: View documents by status
- **Progress Visualization**: Progress bars and percentage completion
- **Recent Activity**: Real-time activity feed

### 💬 Communication Features
- **Comments System**: Add comments and notes to documents
- **Activity Log**: Track all actions and changes
- **User Identification**: See who performed each action
- **Timestamps**: Complete audit trail with date/time stamps

### 👥 User Management
- **Profile Management**: User profiles with role identification
- **Admin Controls**: Admin-specific functions and approvals
- **Secure Access**: Row-level security with Supabase

## Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Icons**: Lucide React
- **Forms**: React Hook Form
- **Notifications**: React Hot Toast
- **Date Handling**: date-fns
- **Routing**: React Router DOM

## Prerequisites

- Node.js 16+ and npm
- Supabase account and project
- Modern web browser

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd document-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. In the Supabase SQL Editor, run the contents of `supabase_schema.sql` to create all necessary tables, policies, and functions

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

### 5. Configure Supabase Storage

1. In your Supabase dashboard, go to Storage
2. The storage bucket should already be created by the SQL script
3. Ensure storage policies are properly configured for authenticated users

### 6. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage Guide

### Getting Started

1. **Create an Account**:
   - Visit the signup page
   - Choose account type (Member or Admin)
   - For admin accounts, enter the secret code: `1234`
   - Complete the registration form

2. **Sign In**:
   - Use your email and password to sign in
   - You'll be redirected to the dashboard

### Creating Document Trackers

1. Click "New Document Tracker" from the dashboard
2. Fill in document information:
   - Document name (required)
   - Description (optional)
   - Upload document file (required)
   - Enable admin approval if needed
3. Add signatories:
   - At least one signatory is required
   - Include name, position, email, and phone
   - List them in signing order
4. Submit to create the tracker

### Managing Signatures

1. Go to document details page
2. View signatory list with current status
3. Mark signatures as completed when received
4. Add optional notes for each signature
5. Track progress with visual indicators

### Admin Functions

Admins have additional capabilities:
- Approve/reject documents requiring admin approval
- Access to all documents regardless of creator
- Enhanced permissions for document management

### Comments and Communication

- Add comments to documents for team communication
- View activity log for complete audit trail
- See user roles and timestamps for all actions

## Database Schema

The application uses the following main tables:

- `users`: User profiles with roles
- `documents`: Document information and metadata
- `document_signatories`: External people who need to sign
- `document_activity`: Activity log for audit trail
- `document_comments`: Comments and discussions

All tables include Row Level Security (RLS) policies for data protection.

## File Structure

```
src/
├── components/          # Reusable UI components
│   ├── LoadingSpinner.jsx
│   └── Navbar.jsx
├── contexts/           # React contexts
│   └── AuthContext.jsx
├── lib/               # Utilities and configurations
│   └── supabase.js
├── pages/             # Main application pages
│   ├── Dashboard.jsx
│   ├── CreateDocument.jsx
│   ├── DocumentDetails.jsx
│   ├── SignIn.jsx
│   └── SignUp.jsx
├── App.jsx            # Main app component
├── main.jsx           # Application entry point
└── index.css          # Global styles
```

## Security Features

- **Row Level Security**: Database-level access control
- **Role-based Access**: Different permissions for admins and members
- **Secure File Upload**: Validated file types and size limits
- **Authentication Required**: All features require user authentication
- **Admin Secret Code**: Prevents unauthorized admin account creation

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel, Netlify, or similar

1. Build the project
2. Deploy the `dist` folder
3. Set environment variables in your hosting platform
4. Ensure Supabase is configured for production

## Real-World Use Case

This system is perfect for club scenarios like:

- **Event Permission Letters**: Track signatures from dean, principal, HOD
- **Budget Approval Requests**: Get signatures from financial officers
- **Facility Booking Forms**: Collect approvals from facility managers
- **Activity Proposals**: Gather signatures from various authorities
- **Sponsorship Applications**: Track approval workflow

Team members can always see the current status, who has signed, and what's pending, eliminating confusion and improving efficiency.

## Admin Secret Code

The default admin secret code is `1234`. In a production environment, you should:
1. Change this code in `src/pages/SignUp.jsx`
2. Or implement a more secure admin invitation system

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify Supabase configuration
3. Ensure all environment variables are set correctly
4. Check that the database schema was applied successfully

## License

This project is licensed under the MIT License.
