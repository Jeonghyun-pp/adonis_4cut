import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { log } from '@/lib/logger';

export interface SlotTransform {
  scale: number;
  tx: number;
  ty: number;
}

export async function renderFrame(jobId: string): Promise<string> {
  const job = await prisma.renderJob.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      frame: { include: { slots: { orderBy: { zIndex: 'asc' } } } },
      assets: true,
    },
  });

  const { frame } = job;
  const slots = frame.slots;
  const format = (job.format as 'png' | 'jpg') || 'png';

  log('render', 'start', { jobId, frameId: frame.id, width: frame.width, height: frame.height });

  // Parse transforms from asset metadata
  const transforms: SlotTransform[] = [];
  for (let i = 0; i < 4; i++) {
    const asset = job.assets.find((a) => a.kind === `transform_${i}`);
    if (asset) {
      transforms.push(JSON.parse(asset.url));
    } else {
      transforms.push({ scale: 1, tx: 0, ty: 0 });
    }
  }

  // Create base canvas
  let composite = sharp({
    create: {
      width: frame.width,
      height: frame.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).png();

  const compositeInputs: sharp.OverlayOptions[] = [];

  // Process each slot
  for (const slot of slots) {
    const photoAsset = job.assets.find((a) => a.kind === `photo_${slot.index}`);
    if (!photoAsset) continue;

    const transform = transforms[slot.index - 1] || { scale: 1, tx: 0, ty: 0 };

    await prisma.renderJob.update({
      where: { id: jobId },
      data: { progress: Math.round((slot.index / slots.length) * 80) },
    });

    const photoBuffer = await loadBuffer(photoAsset.url);
    if (!photoBuffer) {
      log('render', 'warn', { jobId, msg: `Missing photo for slot ${slot.index}` });
      continue;
    }

    // Apply user transform: scale the photo, then extract the slot-sized region
    const photoMeta = await sharp(photoBuffer).metadata();
    const photoW = photoMeta.width || slot.w;
    const photoH = photoMeta.height || slot.h;

    // Calculate cover/contain dimensions
    const slotAspect = slot.w / slot.h;
    const photoAspect = photoW / photoH;

    let resizeW: number, resizeH: number;
    if (slot.fitMode === 'contain') {
      if (photoAspect > slotAspect) {
        resizeW = slot.w;
        resizeH = Math.round(slot.w / photoAspect);
      } else {
        resizeH = slot.h;
        resizeW = Math.round(slot.h * photoAspect);
      }
    } else {
      // cover
      if (photoAspect > slotAspect) {
        resizeH = slot.h;
        resizeW = Math.round(slot.h * photoAspect);
      } else {
        resizeW = slot.w;
        resizeH = Math.round(slot.w / photoAspect);
      }
    }

    // Apply user scale
    const scaledW = Math.round(resizeW * transform.scale);
    const scaledH = Math.round(resizeH * transform.scale);

    let scaledPhoto = sharp(photoBuffer)
      .resize(scaledW, scaledH, { fit: 'fill' })
      .removeAlpha();

    if (slot.rotation !== 0) {
      scaledPhoto = scaledPhoto.rotate(slot.rotation, { background: { r: 255, g: 255, b: 255, alpha: 0 } });
    }

    let scaledBuf = await scaledPhoto.png().toBuffer();

    // Extract the slot-sized region with user pan offsets
    const offsetX = Math.max(0, Math.min(
      Math.round((scaledW - slot.w) / 2 - transform.tx),
      scaledW - slot.w
    ));
    const offsetY = Math.max(0, Math.min(
      Math.round((scaledH - slot.h) / 2 - transform.ty),
      scaledH - slot.h
    ));

    // Ensure we can extract
    const extractW = Math.min(slot.w, scaledW);
    const extractH = Math.min(slot.h, scaledH);

    let slotImage = await sharp(scaledBuf)
      .extract({
        left: Math.min(offsetX, Math.max(0, scaledW - extractW)),
        top: Math.min(offsetY, Math.max(0, scaledH - extractH)),
        width: extractW,
        height: extractH,
      })
      .resize(slot.w, slot.h, { fit: 'fill' })
      .png()
      .toBuffer();

    // Apply border radius by compositing with a rounded rect mask
    if (slot.borderRadius > 0) {
      const roundedMask = Buffer.from(
        `<svg width="${slot.w}" height="${slot.h}">
          <rect x="0" y="0" width="${slot.w}" height="${slot.h}" rx="${slot.borderRadius}" ry="${slot.borderRadius}" fill="white"/>
        </svg>`
      );
      slotImage = await sharp(slotImage)
        .composite([{ input: roundedMask, blend: 'dest-in' }])
        .png()
        .toBuffer();
    }

    // Apply mask if exists
    if (slot.maskUrl) {
      const maskBuffer = await loadBuffer(slot.maskUrl);
      if (maskBuffer) {
        const resizedMask = await sharp(maskBuffer)
          .resize(slot.w, slot.h, { fit: 'fill' })
          .grayscale()
          .png()
          .toBuffer();

        slotImage = await sharp(slotImage)
          .ensureAlpha()
          .composite([{ input: resizedMask, blend: 'dest-in' }])
          .png()
          .toBuffer();
      }
    }

    compositeInputs.push({
      input: await sharp(slotImage).ensureAlpha().png().toBuffer(),
      left: slot.x,
      top: slot.y,
    });

    // 슬롯별 오버레이 합성
    if (slot.overlayUrl) {
      const slotOverlayBuffer = await loadBuffer(slot.overlayUrl);
      if (slotOverlayBuffer) {
        const resizedSlotOverlay = await sharp(slotOverlayBuffer)
          .resize(slot.w, slot.h, { fit: 'fill' })
          .ensureAlpha()
          .png()
          .toBuffer();
        compositeInputs.push({
          input: resizedSlotOverlay,
          left: slot.x,
          top: slot.y,
        });
      }
    }
  }

  // 전체 프레임 오버레이 (있으면)
  if (frame.overlayUrl) {
    const overlayBuffer = await loadBuffer(frame.overlayUrl);
    if (overlayBuffer) {
      const resizedOverlay = await sharp(overlayBuffer)
        .resize(frame.width, frame.height, { fit: 'fill' })
        .png()
        .toBuffer();
      compositeInputs.push({ input: resizedOverlay });
    }
  }

  // Compose everything
  let resultBuffer = await composite.composite(compositeInputs).toBuffer();

  if (format === 'jpg') {
    resultBuffer = await sharp(resultBuffer).jpeg({ quality: 90 }).toBuffer();
  }

  // Store result
  const storage = getStorage();
  const ext = format === 'jpg' ? 'jpg' : 'png';
  const contentType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const resultKey = `renders/${jobId}.${ext}`;
  const resultUrl = await storage.putBuffer(resultKey, resultBuffer, contentType);

  log('render', 'done', { jobId, resultUrl });

  return resultUrl;
}

async function loadBuffer(url: string): Promise<Buffer | null> {
  // DB/storage uploads
  if (url.startsWith('/uploads/')) {
    const key = url.replace('/uploads/', '');
    const storage = getStorage();
    return storage.getBuffer(key);
  }
  // Static assets in public/
  if (url.startsWith('/sample/') || url.startsWith('/public/')) {
    const filePath = path.join(process.cwd(), 'public', url.startsWith('/public/') ? url.replace('/public/', '') : url.replace('/sample/', 'sample/'));
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }
  return null;
}
