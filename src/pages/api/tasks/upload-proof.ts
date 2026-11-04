import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create Supabase client
  const supabase = createClient(req, res);
  
  // Get the user from the session
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { taskId, image } = req.body;

    if (!taskId || !image) {
      return res.status(400).json({ error: 'Task ID and image are required' });
    }

    // Check if user is assigned to this task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.assignedToId !== user.id) {
      return res.status(403).json({ error: 'Only the assigned employee can upload proof for this task' });
    }

    // Extract the base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate a unique filename
    const filename = `task-proof-${taskId}-${uuidv4()}.jpg`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('task-proofs')
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading to Supabase:', error);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('task-proofs')
      .getPublicUrl(filename);

    // Update the task with the proof image URL
    await prisma.task.update({
      where: { id: taskId },
      data: {
        proofImageUrl: urlData.publicUrl,
        status: 'COMPLETED', // Automatically mark as completed when proof is uploaded
      },
    });

    broadcastRealtimeEvent('TASK_UPDATED', { action: 'PROOF_UPLOAD', taskId });
    return res.status(200).json({ 
      message: 'Proof uploaded successfully',
      imageUrl: urlData.publicUrl
    });
  } catch (error) {
    console.error('Error uploading proof:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}