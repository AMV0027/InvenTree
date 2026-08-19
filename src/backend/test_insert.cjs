const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const mixin = await prisma.pathstringmixin.create({
      data: {
        name: 'TestCat3',
        description: 'Test3',
        pathstring: 'TestCat3'
      }
    });
    console.log('Mixin ID:', mixin.id);

    const tree = await prisma.inventreetree.create({
      data: {
        id: mixin.id
      }
    });
    console.log('Tree created:', tree.id);

    const cat = await prisma.partcategory.create({
      data: {
        id: mixin.id,
        structural: false,
        defaultKeywords: '',
        icon: '',
        defaultLocationId: null
      }
    });
    console.log('Cat created:', cat.id);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
