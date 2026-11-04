import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Create Supabase client with admin privileges
  const supabase = createClient(req, res);
  
  // Get user from session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    const { fileName, fileType, fileData, fileSize } = req.body;
    
    if (!fileName || !fileType || !fileData || !fileSize) {
      return res.status(400).json({ 
        error: 'File name, type, data, and size are required' 
      });
    }
    
    // Validate file type (PDF or JPG/JPEG)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ 
        error: 'Only PDF and JPG/JPEG files are allowed' 
      });
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (fileSize > maxSize) {
      return res.status(400).json({ 
        error: 'File size exceeds the maximum limit of 5MB' 
      });
    }
    
    // Convert base64 data to buffer
    const base64Data = fileData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate a unique file path
    const timestamp = Date.now();
    const fileExt = fileName.split('.').pop();
    const filePath = `leave-documents/${userId}/${timestamp}-${fileName}`;
    
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: fileType,
        upsert: false
      });
    
    if (error) {
      console.error('Error uploading file to storage:', error);
      return res.status(500).json({ 
        error: 'Failed to upload file to storage' 
      });
    }
    
    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);
    
    // Return file information
    return res.status(200).json({
      fileName,
      fileUrl: publicUrl,
      fileType,
      fileSize
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return res.status(500).json({ error: 'Failed to upload document' });
  }
}