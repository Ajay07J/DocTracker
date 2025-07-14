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
VALUES ('documents', 'documents', false);

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