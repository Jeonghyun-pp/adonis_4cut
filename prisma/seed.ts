import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function createSampleOverlay(width: number, height: number, label: string): Promise<Buffer> {
  // Create a transparent frame with decorative border
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#333" stroke-width="20" rx="30"/>
      <rect x="10" y="10" width="${width - 20}" height="${height - 20}" fill="none" stroke="#FFD700" stroke-width="4" rx="25"/>
      <text x="${width / 2}" y="${height - 40}" text-anchor="middle" font-size="36" fill="#333" font-family="sans-serif">${label}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  await prisma.adminUser.upsert({
    where: { username: process.env.ADMIN_USERNAME || 'admin' },
    update: { password: hashedPassword },
    create: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: hashedPassword,
    },
  });
  console.log('Admin user created');

  // Ensure upload dirs exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(path.join(uploadsDir, 'frames'), { recursive: true });
  await fs.mkdir(path.join(uploadsDir, 'masks'), { recursive: true });
  await fs.mkdir(path.join(uploadsDir, 'photos'), { recursive: true });
  await fs.mkdir(path.join(uploadsDir, 'renders'), { recursive: true });

  // Create sample persons
  const person1 = await prisma.person.upsert({
    where: { slug: 'classic' },
    update: {},
    create: { name: 'Classic', slug: 'classic', isActive: true },
  });

  const person2 = await prisma.person.upsert({
    where: { slug: 'retro' },
    update: {},
    create: { name: 'Retro', slug: 'retro', isActive: true },
  });

  console.log('Persons created');

  // Create sample overlays
  const overlay1 = await createSampleOverlay(1200, 1800, 'Classic Frame');
  const overlay1Path = 'frames/sample-classic.png';
  await fs.writeFile(path.join(uploadsDir, overlay1Path), overlay1);

  const overlay2 = await createSampleOverlay(1200, 1800, 'Retro Frame');
  const overlay2Path = 'frames/sample-retro.png';
  await fs.writeFile(path.join(uploadsDir, overlay2Path), overlay2);

  // Create frames
  const frame1 = await prisma.frame.upsert({
    where: { id: 'sample-frame-classic' },
    update: {},
    create: {
      id: 'sample-frame-classic',
      personId: person1.id,
      version: 1,
      width: 1200,
      height: 1800,
      overlayUrl: `/uploads/${overlay1Path}`,
      isActive: true,
    },
  });

  const frame2 = await prisma.frame.upsert({
    where: { id: 'sample-frame-retro' },
    update: {},
    create: {
      id: 'sample-frame-retro',
      personId: person2.id,
      version: 1,
      width: 1200,
      height: 1800,
      overlayUrl: `/uploads/${overlay2Path}`,
      isActive: true,
    },
  });

  console.log('Frames created');

  // Create slots for each frame (2x2 grid layout)
  const slotConfigs = [
    { index: 1, x: 60, y: 60, w: 520, h: 400 },
    { index: 2, x: 620, y: 60, w: 520, h: 400 },
    { index: 3, x: 60, y: 500, w: 520, h: 400 },
    { index: 4, x: 620, y: 500, w: 520, h: 400 },
  ];

  for (const frameObj of [frame1, frame2]) {
    // Delete existing slots first
    await prisma.frameSlot.deleteMany({ where: { frameId: frameObj.id } });

    for (const cfg of slotConfigs) {
      await prisma.frameSlot.create({
        data: {
          frameId: frameObj.id,
          index: cfg.index,
          x: cfg.x,
          y: cfg.y,
          w: cfg.w,
          h: cfg.h,
          fitMode: 'cover',
          rotation: 0,
          borderRadius: frameObj === frame2 ? 20 : 0,
          zIndex: 0,
        },
      });
    }
  }

  console.log('Slots created');
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
