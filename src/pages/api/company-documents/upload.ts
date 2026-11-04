import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { createAdminClient } from '@/util/supabase/admin';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

interface ParsedUpload {
  buffer: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
}

function parseMultipart(req: NextApiRequest): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    try {
      const busboy = Busboy({
        headers: req.headers,
        limits: { fileSize: 35 * 1024 * 1024 },
      });

      const fileChunks: Buffer[] = [];
      let fileName = '';
      let fileType = 'application/pdf';

      busboy.on('file', (_name: string, file: NodeJS.ReadableStream, info: any) => {
        fileName = info.filename || 'document.pdf';
        fileType = info.mimeType || 'application/pdf';

        file.on('data', (data: Buffer) => {
          fileChunks.push(data);
        });
      });

      busboy.on('error', (err: any) => reject(err));

      busboy.on('finish', () => {
        const buffer = Buffer.concat(fileChunks);
        if (buffer.length === 0) {
          return reject(new Error('No file uploaded or file is empty'));
        }
        resolve({
          buffer,
          fileName,
          fileType,
          fileSize: buffer.length,
        });
      });

      req.pipe(busboy);
    } catch (err) {
      reject(err);
    }
  });
}

async function parseJson(req: NextApiRequest): Promise<ParsedUpload> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) {
    throw new Error('Empty request body');
  }
  const body = JSON.parse(raw);
  const { fileName, fileType, fileData, fileSize } = body;
  if (!fileName || !fileData) {
    throw new Error('File name and file data are required');
  }
  const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const buffer = Buffer.from(base64Data, 'base64');
  return {
    buffer,
    fileName,
    fileType: fileType || 'application/pdf',
    fileSize: fileSize || buffer.length,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Auth check
  const supabase = createClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check role - only ADMIN, SUPER_ADMIN or MANAGER can upload company policies
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || (dbUser.role !== 'ADMIN' && (dbUser.role as any) !== 'SUPER_ADMIN' && dbUser.role !== 'MANAGER')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    const contentType = req.headers['content-type'] || '';
    const parsed: ParsedUpload = contentType.includes('multipart/form-data')
      ? await parseMultipart(req)
      : await parseJson(req);

    const { buffer, fileName, fileType, fileSize } = parsed;

    // STRICT CHECK: Only PDF documents are allowed
    const isPdf = fileName.toLowerCase().endsWith('.pdf') || fileType === 'application/pdf';
    if (!isPdf) {
      return res.status(400).json({ error: 'Only PDF documents (.pdf) are allowed for company policies and documents' });
    }

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `company-policies/${timestamp}-${sanitizedFileName}`;

    let uploadedUrl = '';

    // Attempt 1: Upload to Supabase Storage using Admin Client (bypasses RLS)
    try {
      let supabaseAdmin: any = null;
      try {
        supabaseAdmin = createAdminClient();
      } catch (_) {
        // Service role key not available
      }

      const client = supabaseAdmin || supabase;

      const uploadPromise = (async () => {
        try {
          if (supabaseAdmin) {
            await supabaseAdmin.storage.createBucket('documents', { public: true }).catch(() => {});
          }
          const { data, error } = await client.storage
            .from('documents')
            .upload(storagePath, buffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (!error && data) {
            const { data: { publicUrl } } = client.storage
              .from('documents')
              .getPublicUrl(storagePath);
            return publicUrl;
          } else if (error) {
            console.warn('Supabase storage upload error, fallback to local storage:', error.message);
          }
        } catch (e: any) {
          console.warn('Supabase storage exception, fallback to local storage:', e?.message || e);
        }
        return null;
      })();

      // 3-second timeout protection to avoid hanging uploads
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      uploadedUrl = (await Promise.race([uploadPromise, timeoutPromise])) || '';
    } catch (storageErr) {
      console.warn('Supabase storage error:', storageErr);
    }

    // Attempt 2: Instant local storage fallback (<10ms)
    if (!uploadedUrl) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFileName = `${timestamp}-${sanitizedFileName}`;
      const filePath = path.join(uploadDir, localFileName);
      fs.writeFileSync(filePath, buffer);
      uploadedUrl = `/uploads/documents/${localFileName}`;
    }

    return res.status(200).json({
      success: true,
      fileUrl: uploadedUrl,
      fileName,
      fileSize: fileSize || buffer.length,
      fileType: 'application/pdf',
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: err.message || 'File upload failed' });
  }
}
