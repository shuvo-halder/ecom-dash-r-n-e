import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://mock:mock@localhost:5432/mock' } } })
prisma.$connect().then(() => console.log('connected')).catch(e => console.log(e.message))
