/**
 * Media Service
 * 
 * Handles file uploads, media optimization, and CDN delivery.
 * 
 * Migration note: Becomes a MediaModule backed by:
 * - AWS S3 / Cloudflare R2 for object storage
 * - Cloudflare Stream for video processing
 * - Sharp/FFmpeg pipeline for image/video transcoding
 * - CloudFront or Cloudflare CDN for delivery
 * 
 * Current MVP: Base44 UploadFile integration
 */

import { base44 } from '@/api/base44Client';

// ─── Upload Limits ────────────────────────────────────────────────────────────
const LIMITS = {
  image: 10 * 1024 * 1024,       // 10MB
  video: 200 * 1024 * 1024,      // 200MB
  document: 50 * 1024 * 1024,    // 50MB
  audio: 50 * 1024 * 1024,       // 50MB
};

const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'],
  document: ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'],
};

/**
 * Validate file before upload
 */
function validateFile(file, type = 'image') {
  const limit = LIMITS[type] || LIMITS.image;
  const allowed = ALLOWED_TYPES[type] || ALLOWED_TYPES.image;

  if (file.size > limit) {
    throw new Error(`File size exceeds ${limit / (1024 * 1024)}MB limit for ${type} uploads`);
  }
  if (!allowed.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed for ${type} uploads`);
  }
  return true;
}

/**
 * Upload an image file
 */
async function uploadImage(file, { context = 'post' } = {}) {
  validateFile(file, 'image');
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, type: 'image', context };
}

/**
 * Upload a video file
 */
async function uploadVideo(file, { context = 'post', onProgress } = {}) {
  validateFile(file, 'video');
  // Future: Upload to Cloudflare Stream, return stream ID
  // Current: Direct upload via Base44
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return {
    url: file_url,
    type: 'video',
    context,
    // Future fields: stream_id, thumbnail_url, duration, resolutions
  };
}

/**
 * Upload a document
 */
async function uploadDocument(file) {
  validateFile(file, 'document');
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, type: 'document' };
}

/**
 * Upload avatar image
 * Future: Auto-crop to square, generate multiple resolutions
 */
async function uploadAvatar(file) {
  validateFile(file, 'image');
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, type: 'avatar' };
}

/**
 * Upload cover image
 */
async function uploadCover(file) {
  validateFile(file, 'image');
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { url: file_url, type: 'cover' };
}

/**
 * Generate a thumbnail for a video or article
 * Future: Extract frame from video via FFmpeg pipeline
 */
async function generateThumbnail(sourceUrl, type = 'video') {
  // MVP: Use LLM image generation as placeholder
  // Future: Extract from video stream at 10% timestamp
  if (type === 'video') {
    return sourceUrl; // Return source as fallback
  }
  return null;
}

/**
 * Get optimized image URL with dimensions
 * Future: Cloudflare Image Resizing or imgix integration
 */
function getOptimizedUrl(url, { width, height, quality = 80 } = {}) {
  if (!url) return null;
  // Future: Append transformation params for CDN
  // e.g., https://cdn.studentos.com/img/[hash]?w=800&q=80
  return url;
}

export default {
  uploadImage,
  uploadVideo,
  uploadDocument,
  uploadAvatar,
  uploadCover,
  generateThumbnail,
  getOptimizedUrl,
  validateFile,
  LIMITS,
};