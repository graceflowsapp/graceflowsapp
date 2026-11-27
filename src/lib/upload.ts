"use client";

import { tr } from "@/lib/i18n";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(CLOUD && PRESET);

/** Resize an image in the browser so uploads stay small (and demo data URLs fit in localStorage). */
async function resize(file: File, max = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(tr("Gagal memproses gambar")))), "image/jpeg", 0.85),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * Uploads a profile photo. Uses a Cloudinary *unsigned* upload preset when configured,
 * otherwise returns a small data URL (Demo Mode).
 */
export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  if (!isCloudinaryConfigured) return blobToDataUrl(await resize(file, 256));
  const blob = await resize(file);

  const form = new FormData();
  form.append("file", blob, `${userId}.jpg`);
  form.append("upload_preset", PRESET!);
  form.append("folder", "graceflow/avatars");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(tr("Upload gagal ({status})", { status: res.status }));
  const json = (await res.json()) as { secure_url: string };
  // Deliver a face-cropped square thumbnail
  return json.secure_url.replace("/upload/", "/upload/c_thumb,g_face,w_400,h_400,f_auto,q_auto/");
}
