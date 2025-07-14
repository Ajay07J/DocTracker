# Document Tracker - Notification System

## Overview

The Document Tracker now includes a comprehensive notification system that sends real-time notifications for document status changes, creation, and deletion. The system supports both in-app notifications and browser push notifications that work even when the website is closed.

## Features

### 🔔 Real-time Notifications
- **Document Creation**: Notify all users when a new document is created
- **Document Deletion**: Notify interested users when a document is deleted
- **Status Updates**: Notify when admin approval status changes (approved/rejected)
- **Signature Updates**: Notify when authorities sign or reject documents
- **Comment Updates**: Notify when new comments are added (future enhancement)

### 📱 Push Notifications
- Browser push notifications that work even when the app is closed
- Service Worker integration for background notifications
- Automatic permission request system
- PWA (Progressive Web App) support

### 🎯 Smart Targeting
- Notifications are sent to relevant users only:
  - Document creators
  - Admins (for all document activities)
  - Users who have commented on documents
  - Users involved in signature processes

## Technical Implementation

### Database Schema

#### Notifications Table
```sql
notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    document_id UUID REFERENCES documents(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('document_created', 'document_deleted', 'status_updated', 'signature_added', 'admin_approval', 'comment_added')),
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### Push Subscriptions Table
```sql
push_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Automatic Triggers

The system uses PostgreSQL triggers to automatically create notifications:

1. **Document Creation Trigger**: Fires when a new document is inserted
2. **Document Deletion Trigger**: Fires before a document is deleted
3. **Status Update Trigger**: Fires when admin_approved status changes
4. **Signature Update Trigger**: Fires when signature status changes

### Frontend Components

#### NotificationContext
- Manages notification state and real-time subscriptions
- Handles service worker registration
- Manages push notification permissions
- Provides notification CRUD operations

#### NotificationDropdown
- Beautiful dropdown component in the navbar
- Shows unread count badge
- Allows marking notifications as read/unread
- Provides notification settings and permissions management
- Click notifications to navigate to relevant documents

#### Service Worker (`public/sw.js`)
- Handles push notifications in the background
- Shows browser notifications with proper icons and actions
- Handles notification click events
- Supports offline notification queuing

## Usage Guide

### For Users

1. **Enable Notifications**:
   - Click the bell icon in the navigation bar
   - Click the settings gear icon
   - Click "Enable Push Notifications"
   - Allow browser permission when prompted

2. **View Notifications**:
   - Click the bell icon to see all notifications
   - Unread notifications have a blue accent
   - Click any notification to go to the related document

3. **Manage Notifications**:
   - Mark individual notifications as read
   - Use "Mark all read" to clear unread status
   - Use "Clear all" to delete all notifications
   - Delete individual notifications with the X button

### For Developers

#### Adding New Notification Types

1. **Update Database Schema**:
   ```sql
   ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
   ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
   CHECK (type IN ('document_created', 'document_deleted', 'status_updated', 'signature_added', 'admin_approval', 'comment_added', 'your_new_type'));
   ```

2. **Create Database Function**:
   ```sql
   CREATE OR REPLACE FUNCTION notify_your_event() RETURNS TRIGGER AS $$
   BEGIN
       PERFORM create_notification_for_users(
           'Your Title',
           'Your message with ' || NEW.some_field,
           'your_new_type',
           NEW.document_id,
           jsonb_build_object('key', 'value'),
           NEW.user_id -- exclude the actor
       );
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

3. **Add Trigger**:
   ```sql
   CREATE TRIGGER your_event_notification
       AFTER INSERT ON your_table
       FOR EACH ROW EXECUTE FUNCTION notify_your_event();
   ```

4. **Update Frontend**:
   - Add icon and color mapping in `NotificationDropdown.jsx`
   - Update notification handling logic if needed

#### Manual Notifications

You can create notifications programmatically:

```javascript
// Create notification for specific user
await supabase.rpc('create_notification_for_user', {
  p_user_id: userId,
  p_title: 'Custom Notification',
  p_message: 'Your custom message',
  p_type: 'custom_type',
  p_document_id: documentId, // optional
  p_data: { key: 'value' } // optional
});

// Create notification for all users
await supabase.rpc('create_notification_for_users', {
  p_title: 'System Announcement',
  p_message: 'Important system update',
  p_type: 'system_announcement',
  p_exclude_user_id: currentUserId // optional
});
```

## Notification Types

| Type | Description | Triggered By | Recipients |
|------|-------------|--------------|------------|
| `document_created` | New document created | Document insertion | All users except creator |
| `document_deleted` | Document deleted | Document deletion | Document stakeholders |
| `status_updated` | Admin approval status changed | Document approval/rejection | Document stakeholders |
| `signature_added` | Authority signed/rejected | Signature status change | Document stakeholders |
| `admin_approval` | Admin action required | Pending approval | Admins only |
| `comment_added` | New comment added | Comment insertion | Document stakeholders |

## Browser Compatibility

- **Chrome**: Full support including background push
- **Firefox**: Full support including background push
- **Safari**: Limited push notification support
- **Edge**: Full support including background push
- **Mobile browsers**: Varies by platform and browser

## Security Features

- **Row Level Security**: Users can only see their own notifications
- **CSRF Protection**: All operations require valid authentication
- **Permission Management**: Users control their own notification preferences
- **Data Validation**: All notification data is validated server-side

## Performance Considerations

- **Real-time Subscriptions**: Uses Supabase real-time for instant delivery
- **Efficient Queries**: Indexed columns for fast notification retrieval
- **Pagination**: Notifications are limited to 50 most recent by default
- **Background Processing**: Service worker handles notifications without blocking UI

## Troubleshooting

### Notifications Not Appearing
1. Check browser notification permissions
2. Verify service worker is registered (check browser dev tools)
3. Check if notifications are blocked in browser settings
4. Verify user is logged in and has valid session

### Push Notifications Not Working
1. Ensure HTTPS connection (required for push notifications)
2. Check if service worker is active
3. Verify push subscription is created and stored
4. Check browser console for errors

### Database Issues
1. Verify notification triggers are created
2. Check RLS policies are enabled
3. Ensure user has proper permissions
4. Check for database connection issues

## Future Enhancements

- **Email Notifications**: Send email for critical notifications
- **Slack Integration**: Post notifications to Slack channels
- **Mobile App**: React Native app with push notifications
- **Notification Preferences**: Granular control over notification types
- **Digest Emails**: Weekly/daily summary emails
- **Real-time Dashboard**: Live notification feed for admins

## Testing

### Manual Testing
1. Create a new document → Should notify other users
2. Approve/reject a document → Should notify stakeholders
3. Sign a document → Should notify interested parties
4. Delete a document → Should notify stakeholders

### Automated Testing
```javascript
// Test notification creation
const { data, error } = await supabase
  .from('notifications')
  .insert({
    user_id: testUserId,
    title: 'Test Notification',
    message: 'Test message',
    type: 'document_created'
  });
```

## Support

For issues or questions about the notification system:
1. Check the browser console for errors
2. Verify database schema is up to date
3. Test with different browsers
4. Check notification permissions in browser settings

---

*Last updated: December 2024*
*Version: 1.0.0*