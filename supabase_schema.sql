-- Document Tracker Database Schema for Supabase
-- Run this in your Supabase SQL editor to set up the database

-- Enable RLS (Row Level Security)
-- This will be set up for each table

-- Users table with role-based access
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    requires_admin_approval BOOLEAN DEFAULT false,
    admin_approved BOOLEAN DEFAULT false,
    admin_approved_by UUID REFERENCES users(id),
    admin_approved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- External signatories/approvers for documents
CREATE TABLE IF NOT EXISTS document_signatories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    is_signed BOOLEAN DEFAULT false,
    signed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document activity log
CREATE TABLE IF NOT EXISTS document_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document comments
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_document_signatories_document_id ON document_signatories(document_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_document_id ON document_activity(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for documents table
CREATE POLICY "All authenticated users can view documents" ON documents
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can create documents" ON documents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Document creators and admins can update documents" ON documents
    FOR UPDATE USING (
        auth.uid() = created_by OR 
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );

CREATE POLICY "Document creators and admins can delete documents" ON documents
    FOR DELETE USING (
        auth.uid() = created_by OR 
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );

-- RLS Policies for document_signatories table
CREATE POLICY "All authenticated users can view signatories" ON document_signatories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Document creators and admins can manage signatories" ON document_signatories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM documents 
            WHERE documents.id = document_signatories.document_id 
            AND (documents.created_by = auth.uid() OR 
                 EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
        )
    );

-- RLS Policies for document_activity table
CREATE POLICY "All authenticated users can view activity" ON document_activity
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can create activity" ON document_activity
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for document_comments table
CREATE POLICY "All authenticated users can view comments" ON document_comments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can create comments" ON document_comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Comment creators can update their comments" ON document_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Comment creators and admins can delete comments" ON document_comments
    FOR DELETE USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    );

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_signatories_updated_at 
    BEFORE UPDATE ON document_signatories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_comments_updated_at 
    BEFORE UPDATE ON document_comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'member')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for document files
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true);

-- Storage policy for documents bucket
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can view documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents' AND 
        auth.role() = 'authenticated'
    );

CREATE POLICY "Document owners and admins can delete documents" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'documents' AND 
        (auth.uid()::text = (storage.foldername(name))[1] OR
         EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
    );

-- Insert admin secret for validation
INSERT INTO app_config (key, value) VALUES ('admin_secret', '1234');

-- ================================================================
-- NOTIFICATION SYSTEM TABLES AND TRIGGERS
-- ================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('document_created', 'document_deleted', 'status_updated', 'signature_added', 'admin_approval', 'comment_added')),
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create push subscriptions table for web push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_document_id ON notifications(document_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS Policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Users can manage their own push subscriptions
CREATE POLICY "Users can manage their own push subscriptions" ON push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- Add updated_at trigger for notifications
CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for push_subscriptions
CREATE TRIGGER update_push_subscriptions_updated_at 
    BEFORE UPDATE ON push_subscriptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- NOTIFICATION FUNCTIONS
-- ================================================================

-- Function to create notification for all users except the actor
CREATE OR REPLACE FUNCTION create_notification_for_users(
    p_title TEXT,
    p_message TEXT,
    p_type TEXT,
    p_document_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}',
    p_exclude_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, document_id, title, message, type, data)
    SELECT 
        u.id,
        p_document_id,
        p_title,
        p_message,
        p_type,
        p_data
    FROM users u
    WHERE u.id != COALESCE(p_exclude_user_id, '00000000-0000-0000-0000-000000000000'::UUID);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification for specific user
CREATE OR REPLACE FUNCTION create_notification_for_user(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT,
    p_document_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO notifications (user_id, document_id, title, message, type, data)
    VALUES (p_user_id, p_document_id, p_title, p_message, p_type, p_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify users interested in a document
CREATE OR REPLACE FUNCTION create_notification_for_document_users(
    p_title TEXT,
    p_message TEXT,
    p_type TEXT,
    p_document_id UUID,
    p_data JSONB DEFAULT '{}',
    p_exclude_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    doc_creator UUID;
    signatory_users UUID[];
    commenter_users UUID[];
    all_users UUID[];
BEGIN
    -- Get document creator
    SELECT created_by INTO doc_creator FROM documents WHERE id = p_document_id;
    
    -- Get all signatory users (admins who might be interested)
    SELECT ARRAY_AGG(DISTINCT u.id) INTO signatory_users
    FROM users u 
    WHERE u.role = 'admin';
    
    -- Get users who have commented on this document
    SELECT ARRAY_AGG(DISTINCT user_id) INTO commenter_users
    FROM document_comments 
    WHERE document_id = p_document_id;
    
    -- Combine all interested users
    all_users := ARRAY[doc_creator] || COALESCE(signatory_users, ARRAY[]::UUID[]) || COALESCE(commenter_users, ARRAY[]::UUID[]);
    
    -- Create notifications for all interested users
    INSERT INTO notifications (user_id, document_id, title, message, type, data)
    SELECT 
        DISTINCT unnest(all_users),
        p_document_id,
        p_title,
        p_message,
        p_type,
        p_data
    WHERE unnest(all_users) != COALESCE(p_exclude_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND unnest(all_users) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- NOTIFICATION TRIGGERS
-- ================================================================

-- Trigger for document creation
CREATE OR REPLACE FUNCTION notify_document_created() RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
BEGIN
    -- Get creator name
    SELECT full_name INTO creator_name FROM users WHERE id = NEW.created_by;
    
    -- Notify all users except the creator
    PERFORM create_notification_for_users(
        'New Document Created',
        creator_name || ' created a new document: ' || NEW.name,
        'document_created',
        NEW.id,
        jsonb_build_object('document_name', NEW.name, 'creator', creator_name),
        NEW.created_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for document deletion
CREATE OR REPLACE FUNCTION notify_document_deleted() RETURNS TRIGGER AS $$
DECLARE
    deleter_name TEXT;
    doc_name TEXT;
BEGIN
    -- Get deleter name and document name
    SELECT full_name INTO deleter_name FROM users WHERE id = auth.uid();
    doc_name := OLD.name;
    
    -- Notify interested users
    PERFORM create_notification_for_document_users(
        'Document Deleted',
        deleter_name || ' deleted the document: ' || doc_name,
        'document_deleted',
        OLD.id,
        jsonb_build_object('document_name', doc_name, 'deleter', deleter_name),
        auth.uid()
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for document status updates (admin approval)
CREATE OR REPLACE FUNCTION notify_status_updated() RETURNS TRIGGER AS $$
DECLARE
    updater_name TEXT;
    status_text TEXT;
BEGIN
    -- Only notify on admin approval status changes
    IF OLD.admin_approved != NEW.admin_approved THEN
        -- Get updater name
        SELECT full_name INTO updater_name FROM users WHERE id = auth.uid();
        
        -- Convert status to readable text
        status_text := CASE 
            WHEN NEW.admin_approved = true THEN 'approved'
            WHEN NEW.admin_approved = false THEN 'rejected'
            ELSE 'pending review'
        END;
        
        -- Notify interested users
        PERFORM create_notification_for_document_users(
            'Document Status Updated',
            'Document "' || NEW.name || '" has been ' || status_text || ' by ' || updater_name,
            'status_updated',
            NEW.id,
            jsonb_build_object(
                'document_name', NEW.name, 
                'status', status_text, 
                'updater', updater_name,
                'admin_approved', NEW.admin_approved
            ),
            auth.uid()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for signature updates
CREATE OR REPLACE FUNCTION notify_signature_updated() RETURNS TRIGGER AS $$
DECLARE
    doc_name TEXT;
    signatory_name TEXT;
    status_text TEXT;
BEGIN
    -- Only notify on signature status changes
    IF OLD.signed_at IS DISTINCT FROM NEW.signed_at OR OLD.status != NEW.status THEN
        -- Get document name
        SELECT name INTO doc_name FROM documents WHERE id = NEW.document_id;
        
        -- Get signatory name
        signatory_name := NEW.name;
        
        -- Convert status to readable text
        status_text := CASE NEW.status
            WHEN 'signed' THEN 'signed'
            WHEN 'rejected' THEN 'rejected'
            ELSE 'pending'
        END;
        
        -- Notify interested users
        PERFORM create_notification_for_document_users(
            'Signature Update',
            signatory_name || ' has ' || status_text || ' the document "' || doc_name || '"',
            'signature_added',
            NEW.document_id,
            jsonb_build_object(
                'document_name', doc_name,
                'signatory_name', signatory_name,
                'status', status_text,
                'position', NEW.position
            ),
            NULL -- Don't exclude anyone for signature updates
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the triggers
CREATE TRIGGER document_created_notification
    AFTER INSERT ON documents
    FOR EACH ROW EXECUTE FUNCTION notify_document_created();

CREATE TRIGGER document_deleted_notification
    BEFORE DELETE ON documents
    FOR EACH ROW EXECUTE FUNCTION notify_document_deleted();

CREATE TRIGGER document_status_updated_notification
    AFTER UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION notify_status_updated();

CREATE TRIGGER signature_updated_notification
    AFTER UPDATE ON document_signatories
    FOR EACH ROW EXECUTE FUNCTION notify_signature_updated();