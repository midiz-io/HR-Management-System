import type { PrismaClient as PrismaClientType } from '@prisma/client'

const prismaClientSingleton = () => {
  try {
    if (typeof require !== 'undefined' && require.cache) {
      Object.keys(require.cache).forEach((k) => {
        if ((k.includes('.prisma') || k.includes('@prisma')) && !k.endsWith('.node')) {
          delete require.cache[k];
        }
      });
    }
  } catch {
    // Ignore cache eviction errors in edge/bundled environments
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client') as { PrismaClient: new () => PrismaClientType };
  const basePrisma = new PrismaClient()
  return basePrisma.$extends({
    query: {
      $allModels: {
        async delete({ model, operation, args, query }) {
          if (model !== 'TrashRecord') {
            try {
              const record = await (basePrisma as any)[model].findUnique({ where: args.where });
              if (record) {
                await basePrisma.trashRecord.create({
                  data: {
                    tableName: model,
                    recordId: record.id || 'unknown',
                    recordData: record as any,
                  }
                });
              }
            } catch (e) {
              console.error(`TrashRecord extension error on delete ${model}:`, e);
            }
          }
          return query(args);
        },
        async deleteMany({ model, operation, args, query }) {
          if (model !== 'TrashRecord') {
            try {
              const records = await (basePrisma as any)[model].findMany({ where: args.where });
              if (records && records.length > 0) {
                const trashRecords = records.map((record: any) => ({
                  tableName: model,
                  recordId: record.id || 'unknown',
                  recordData: record,
                }));
                await basePrisma.trashRecord.createMany({ data: trashRecords });
              }
            } catch (e) {
              console.error(`TrashRecord extension error on deleteMany ${model}:`, e);
            }
          }
          return query(args);
        }
      }
    }
  })
}

declare const globalThis: {
  prismaGlobalV3: ReturnType<typeof prismaClientSingleton> | undefined;
} & typeof global;

const prisma = globalThis.prismaGlobalV3 ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobalV3 = prisma
