import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const timer = await prisma.solve.count({ where: { cube_type: 'wca', scramble_subset: '333', from_timer: true } });
  const trainer = await prisma.solve.count({ where: { cube_type: 'wca', scramble_subset: '333', trainer_name: { not: null } } });
  const all333 = await prisma.solve.count({ where: { OR: [{ cube_type: 'wca', scramble_subset: '333' }, { cube_type: '333' }] } });
  const threeFamily = await prisma.solve.count({ where: { cube_type: { in: ['333cfop','333roux','333mehta','333zz','333sub'] } } });
  console.log('Timer 3x3 (wca/333):', timer);
  console.log('Trainer 3x3:', trainer);
  console.log('All 3x3 variants (wca/333 + legacy 333 + variants):', all333);
  console.log('3x3 method cubes (CFOP+Roux+Mehta+ZZ+Sub):', threeFamily);
}
main().finally(() => prisma.$disconnect());
