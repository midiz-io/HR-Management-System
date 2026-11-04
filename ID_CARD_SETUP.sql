-- Add profileImage column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImage" TEXT;

-- Create a storage bucket for professional photos if it doesn't exist
-- Note: This is typically done via the Supabase Dashboard, but here is the SQL for it
INSERT INTO storage.buckets (id, name, public) 
VALUES ('id-cards', 'id-cards', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the id-cards bucket
-- Allow public access to read files
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'id-cards');

-- Allow authenticated users to upload their own files
CREATE POLICY "User Upload Access" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'id-cards' AND auth.role() = 'authenticated');

-- Allow users to update their own files
CREATE POLICY "User Update Access" ON storage.objects FOR UPDATE
USING (bucket_id = 'id-cards' AND auth.uid()::text = (storage.foldername(name))[1]);
