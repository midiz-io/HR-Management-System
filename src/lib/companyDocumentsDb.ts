import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function ensureCategoryIsText() {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE "CompanyDocument" ALTER COLUMN "category" DROP DEFAULT;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE "CompanyDocument" ALTER COLUMN "category" TYPE text;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        BEGIN
          ALTER TABLE "CompanyDocument" ALTER COLUMN "category" SET DEFAULT 'HR_POLICY';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END $$;
    `);
  } catch (e) {
    // ignore
  }
}

export async function ensureCompanyDocumentTables() {
  // Always ensure category is TEXT to avoid Code 42804 enum type mismatch
  await ensureCategoryIsText();

  // 1. Create CompanyDocument table (using TEXT for category)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CompanyDocument" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "category" TEXT NOT NULL DEFAULT 'HR_POLICY',
          "customCategory" TEXT,
          "companyScope" TEXT NOT NULL DEFAULT 'ALL',
          "fileUrl" TEXT NOT NULL,
          "fileName" TEXT NOT NULL,
          "fileSize" INTEGER,
          "fileType" TEXT DEFAULT 'application/pdf',
          "version" TEXT NOT NULL DEFAULT 'v1.0',
          "versionNotes" TEXT,
          "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "isRequired" BOOLEAN NOT NULL DEFAULT true,
          "createdById" UUID,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
      );
    `);
  } catch (err: any) {
    // Ignore
  }

  // 2. Ensure companyScope column exists
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "CompanyDocument" ADD COLUMN IF NOT EXISTS "companyScope" TEXT NOT NULL DEFAULT 'ALL';
    `);
  } catch (err: any) {
    // Ignore
  }

  // 3. Foreign key to User
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CompanyDocument_createdById_fkey'
        ) THEN
          ALTER TABLE "CompanyDocument" 
          ADD CONSTRAINT "CompanyDocument_createdById_fkey" 
          FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  } catch (err: any) {
    // Ignore
  }

  // 4. Create DocumentAcknowledgement table
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentAcknowledgement" (
          "id" TEXT NOT NULL,
          "documentId" TEXT NOT NULL,
          "userId" UUID NOT NULL,
          "version" TEXT NOT NULL,
          "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "ipAddress" TEXT,
          "notes" TEXT,
          CONSTRAINT "DocumentAcknowledgement_pkey" PRIMARY KEY ("id")
      );
    `);
  } catch (err: any) {
    // Ignore
  }

  // 5. Unique constraint on (documentId, userId, version)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DocumentAcknowledgement_doc_user_version_unique" 
      ON "DocumentAcknowledgement"("documentId", "userId", "version");
    `);
  } catch (err: any) {
    // Ignore
  }

  // 6. Foreign keys for DocumentAcknowledgement
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'DocumentAcknowledgement_documentId_fkey'
        ) THEN
          ALTER TABLE "DocumentAcknowledgement" 
          ADD CONSTRAINT "DocumentAcknowledgement_documentId_fkey" 
          FOREIGN KEY ("documentId") REFERENCES "CompanyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  } catch (err: any) {
    // Ignore
  }

  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'DocumentAcknowledgement_userId_fkey'
        ) THEN
          ALTER TABLE "DocumentAcknowledgement" 
          ADD CONSTRAINT "DocumentAcknowledgement_userId_fkey" 
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  } catch (err: any) {
    // Ignore
  }

  // 7. Indexes
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "CompanyDocument_category_idx" ON "CompanyDocument"("category");
      CREATE INDEX IF NOT EXISTS "CompanyDocument_isActive_idx" ON "CompanyDocument"("isActive");
      CREATE INDEX IF NOT EXISTS "CompanyDocument_companyScope_idx" ON "CompanyDocument"("companyScope");
      CREATE INDEX IF NOT EXISTS "CompanyDocument_createdAt_idx" ON "CompanyDocument"("createdAt" DESC);
      CREATE INDEX IF NOT EXISTS "DocumentAcknowledgement_userId_idx" ON "DocumentAcknowledgement"("userId");
      CREATE INDEX IF NOT EXISTS "DocumentAcknowledgement_documentId_idx" ON "DocumentAcknowledgement"("documentId");
    `);
  } catch (err: any) {
    // Ignore
  }
}

// ==========================================
// RESILIENT DB METHODS
// ==========================================

export async function dbFindManyDocuments(options: {
  category?: string;
  search?: string;
  includeInactive?: boolean;
  userId: string;
}) {
  await ensureCompanyDocumentTables();

  let query = `
    SELECT 
      d."id", d."title", d."description", d."category"::text as "category",
      d."customCategory", d."companyScope", d."fileUrl", d."fileName",
      d."fileSize", d."fileType", d."version", d."versionNotes",
      d."effectiveDate", d."isActive", d."isRequired", d."createdById",
      d."createdAt", d."updatedAt",
      u."firstName" as "creatorFirstName",
      u."lastName" as "creatorLastName",
      u."email" as "creatorEmail"
    FROM "CompanyDocument" d
    LEFT JOIN "User" u ON d."createdById" = u."id"
    WHERE 1=1
  `;

  const params: any[] = [];
  if (!options.includeInactive) {
    query += ` AND d."isActive" = true`;
  }
  if (options.category && options.category !== 'ALL') {
    params.push(options.category);
    query += ` AND d."category"::text = $${params.length}`;
  }
  if (options.search && options.search.trim() !== '') {
    params.push(`%${options.search.trim()}%`);
    query += ` AND (d."title" ILIKE $${params.length} OR d."description" ILIKE $${params.length} OR d."fileName" ILIKE $${params.length})`;
  }

  query += ` ORDER BY d."effectiveDate" DESC, d."createdAt" DESC`;

  const rawRows: any[] = await prisma.$queryRawUnsafe(query, ...params);

  // Fetch acknowledgements for these docs
  const docIds = rawRows.map((r) => r.id);
  let allAcks: any[] = [];
  if (docIds.length > 0) {
    allAcks = await prisma.$queryRawUnsafe(`
      SELECT "id", "documentId", "userId", "version", "acknowledgedAt", "ipAddress", "notes"
      FROM "DocumentAcknowledgement"
      WHERE "documentId" = ANY($1::text[])
    `, docIds);
  }

  return rawRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    customCategory: r.customCategory,
    companyScope: r.companyScope || 'ALL',
    fileUrl: r.fileUrl,
    fileName: r.fileName,
    fileSize: r.fileSize,
    fileType: r.fileType,
    version: r.version,
    versionNotes: r.versionNotes,
    effectiveDate: r.effectiveDate,
    isActive: Boolean(r.isActive),
    isRequired: Boolean(r.isRequired),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdBy: r.creatorFirstName || r.creatorLastName || r.creatorEmail ? {
      firstName: r.creatorFirstName,
      lastName: r.creatorLastName,
      email: r.creatorEmail,
    } : null,
    acknowledgements: allAcks.filter((a) => a.documentId === r.id),
  }));
}

export async function dbCreateDocument(data: {
  title: string;
  description?: string | null;
  category: string;
  customCategory?: string | null;
  companyScope: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  fileType?: string;
  version: string;
  versionNotes?: string | null;
  effectiveDate: Date;
  isRequired: boolean;
  isActive: boolean;
  userId: string;
}) {
  await ensureCompanyDocumentTables();

  const id = crypto.randomUUID();

  // Try direct text insert
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CompanyDocument" (
        "id", "title", "description", "category", "customCategory", "companyScope",
        "fileUrl", "fileName", "fileSize", "fileType", "version", "versionNotes",
        "effectiveDate", "isActive", "isRequired", "createdById", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::uuid, NOW(), NOW()
      )
    `,
      id,
      data.title,
      data.description || null,
      data.category,
      data.customCategory || null,
      data.companyScope || 'ALL',
      data.fileUrl,
      data.fileName,
      data.fileSize || null,
      data.fileType || 'application/pdf',
      data.version || 'v1.0',
      data.versionNotes || null,
      data.effectiveDate,
      data.isActive,
      data.isRequired,
      data.userId
    );
    return { id, ...data };
  } catch (insertErr: any) {
    console.warn('Initial insert error, attempting category conversion / cast:', insertErr.message);

    if (insertErr.message?.includes('42804') || insertErr.message?.includes('CompanyDocumentCategory')) {
      // 1. Convert column to text and retry
      try {
        await ensureCategoryIsText();
        await prisma.$executeRawUnsafe(`
          INSERT INTO "CompanyDocument" (
            "id", "title", "description", "category", "customCategory", "companyScope",
            "fileUrl", "fileName", "fileSize", "fileType", "version", "versionNotes",
            "effectiveDate", "isActive", "isRequired", "createdById", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::uuid, NOW(), NOW()
          )
        `,
          id,
          data.title,
          data.description || null,
          data.category,
          data.customCategory || null,
          data.companyScope || 'ALL',
          data.fileUrl,
          data.fileName,
          data.fileSize || null,
          data.fileType || 'application/pdf',
          data.version || 'v1.0',
          data.versionNotes || null,
          data.effectiveDate,
          data.isActive,
          data.isRequired,
          data.userId
        );
        return { id, ...data };
      } catch (retryErr: any) {
        // 2. Fallback: Cast to enum type $4::"CompanyDocumentCategory"
        await prisma.$executeRawUnsafe(`
          INSERT INTO "CompanyDocument" (
            "id", "title", "description", "category", "customCategory", "companyScope",
            "fileUrl", "fileName", "fileSize", "fileType", "version", "versionNotes",
            "effectiveDate", "isActive", "isRequired", "createdById", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4::"CompanyDocumentCategory", $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::uuid, NOW(), NOW()
          )
        `,
          id,
          data.title,
          data.description || null,
          data.category,
          data.customCategory || null,
          data.companyScope || 'ALL',
          data.fileUrl,
          data.fileName,
          data.fileSize || null,
          data.fileType || 'application/pdf',
          data.version || 'v1.0',
          data.versionNotes || null,
          data.effectiveDate,
          data.isActive,
          data.isRequired,
          data.userId
        );
        return { id, ...data };
      }
    }
    throw insertErr;
  }
}

export async function dbFindUniqueDocument(id: string) {
  await ensureCompanyDocumentTables();

  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      d."id", d."title", d."description", d."category"::text as "category",
      d."customCategory", d."companyScope", d."fileUrl", d."fileName",
      d."fileSize", d."fileType", d."version", d."versionNotes",
      d."effectiveDate", d."isActive", d."isRequired", d."createdById",
      d."createdAt", d."updatedAt",
      u."firstName" as "creatorFirstName",
      u."lastName" as "creatorLastName",
      u."email" as "creatorEmail"
    FROM "CompanyDocument" d
    LEFT JOIN "User" u ON d."createdById" = u."id"
    WHERE d."id" = $1
    LIMIT 1
  `, id);

  if (rows.length === 0) return null;
  const r = rows[0];

  const acks: any[] = await prisma.$queryRawUnsafe(`
    SELECT * FROM "DocumentAcknowledgement" WHERE "documentId" = $1
  `, id);

  return {
    ...r,
    isActive: Boolean(r.isActive),
    isRequired: Boolean(r.isRequired),
    createdBy: r.creatorFirstName || r.creatorLastName || r.creatorEmail ? {
      firstName: r.creatorFirstName,
      lastName: r.creatorLastName,
      email: r.creatorEmail,
    } : null,
    acknowledgements: acks,
  };
}

export async function dbUpdateDocument(id: string, data: any) {
  await ensureCompanyDocumentTables();

  const sets: string[] = ['"updatedAt" = NOW()'];
  const params: any[] = [id];

  const allowedFields = [
    'title', 'description', 'category', 'customCategory', 'companyScope',
    'fileUrl', 'fileName', 'fileSize', 'fileType', 'version', 'versionNotes',
    'effectiveDate', 'isActive', 'isRequired'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      params.push(data[field]);
      sets.push(`"${field}" = $${params.length}`);
    }
  }

  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "CompanyDocument"
      SET ${sets.join(', ')}
      WHERE "id" = $1
    `, ...params);
  } catch (updateErr: any) {
    if (updateErr.message?.includes('42804') || updateErr.message?.includes('CompanyDocumentCategory')) {
      await ensureCategoryIsText();
      await prisma.$executeRawUnsafe(`
        UPDATE "CompanyDocument"
        SET ${sets.join(', ')}
        WHERE "id" = $1
      `, ...params);
    } else {
      throw updateErr;
    }
  }

  return { id, ...data };
}

export async function dbDeleteDocument(id: string) {
  await ensureCompanyDocumentTables();

  await prisma.$executeRawUnsafe(`
    DELETE FROM "CompanyDocument" WHERE "id" = $1
  `, id);

  return { success: true };
}

export async function dbUpsertAcknowledgement(data: {
  documentId: string;
  userId: string;
  version: string;
  ipAddress?: string | null;
  notes?: string | null;
}) {
  await ensureCompanyDocumentTables();

  const id = crypto.randomUUID();

  await prisma.$executeRawUnsafe(`
    INSERT INTO "DocumentAcknowledgement" (
      "id", "documentId", "userId", "version", "acknowledgedAt", "ipAddress", "notes"
    ) VALUES (
      $1, $2, $3::uuid, $4, NOW(), $5, $6
    )
    ON CONFLICT ("documentId", "userId", "version")
    DO UPDATE SET
      "acknowledgedAt" = NOW(),
      "ipAddress" = EXCLUDED."ipAddress",
      "notes" = EXCLUDED."notes"
  `, id, data.documentId, data.userId, data.version, data.ipAddress || null, data.notes || null);

  return {
    id,
    ...data,
    acknowledgedAt: new Date(),
  };
}

export async function dbGetAcknowledgementsForDoc(documentId: string) {
  await ensureCompanyDocumentTables();

  const acks: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      a."id", a."documentId", a."userId", a."version", a."acknowledgedAt", a."ipAddress", a."notes",
      u."firstName", u."lastName", u."email", u."department", u."position", u."role", u."isResigned"
    FROM "DocumentAcknowledgement" a
    JOIN "User" u ON a."userId" = u."id"
    WHERE a."documentId" = $1
    ORDER BY a."acknowledgedAt" DESC
  `, documentId);

  return acks;
}
