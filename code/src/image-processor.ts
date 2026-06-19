import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { ImageInfo, ProcessedImage } from "./types.js";
import { config } from "./config.js";

// ─── Image Processing ───────────────────────────────────────────

/**
 * Process a batch of images: load from disk, validate, resize, convert to base64.
 * Gracefully handles missing/corrupt images by returning valid=false.
 */
export async function processImages(
  imageInfos: ImageInfo[]
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  for (const info of imageInfos) {
    try {
      const processed = await processSingleImage(info);
      results.push(processed);
    } catch (err) {
      // Graceful degradation: don't crash the pipeline
      results.push({
        id: info.id,
        path: info.path,
        base64: "",
        mimeType: "image/jpeg",
        originalSizeBytes: 0,
        processedSizeBytes: 0,
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * Process a single image: load, validate, resize if needed, convert to base64.
 */
async function processSingleImage(info: ImageInfo): Promise<ProcessedImage> {
  // Resolve the path relative to dataset root
  const absolutePath = resolve(config.paths.datasetRoot, info.path);

  // Check file exists
  if (!existsSync(absolutePath)) {
    return {
      id: info.id,
      path: info.path,
      base64: "",
      mimeType: "image/jpeg",
      originalSizeBytes: 0,
      processedSizeBytes: 0,
      valid: false,
      error: `File not found: ${absolutePath}`,
    };
  }

  // Read raw file
  const rawBuffer = readFileSync(absolutePath);
  const originalSizeBytes = rawBuffer.length;

  // Get image metadata to check dimensions
  const metadata = await sharp(rawBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    return {
      id: info.id,
      path: info.path,
      base64: "",
      mimeType: "image/jpeg",
      originalSizeBytes,
      processedSizeBytes: 0,
      valid: false,
      error: "Could not read image dimensions",
    };
  }

  // Determine MIME type from format
  const mimeType = getMimeType(metadata.format);

  // Resize if needed (max dimension 1024px, maintain aspect ratio)
  let processedBuffer: Buffer;
  const maxDim = config.image.maxDimensionPx;

  if (metadata.width > maxDim || metadata.height > maxDim) {
    processedBuffer = await sharp(rawBuffer)
      .resize(maxDim, maxDim, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: config.image.quality })
      .toBuffer();
  } else if (originalSizeBytes > config.image.maxSizeBytes) {
    // File is within dimension limits but too large — compress
    processedBuffer = await sharp(rawBuffer)
      .jpeg({ quality: config.image.quality })
      .toBuffer();
  } else {
    // No processing needed — use as-is but ensure JPEG for consistency
    processedBuffer = await sharp(rawBuffer)
      .jpeg({ quality: 95 })
      .toBuffer();
  }

  // Convert to base64
  const base64 = processedBuffer.toString("base64");

  return {
    id: info.id,
    path: info.path,
    base64,
    mimeType: "image/jpeg", // We always convert to JPEG for consistency
    originalSizeBytes,
    processedSizeBytes: processedBuffer.length,
    valid: true,
  };
}

/**
 * Map sharp format string to MIME type
 */
function getMimeType(
  format: string | undefined
): "image/jpeg" | "image/png" | "image/webp" {
  switch (format) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

// ─── Self-Test ──────────────────────────────────────────────────

if (import.meta.main) {
  const { parseImagePaths } = await import("./types.js");

  console.log("\n🖼️  Image Processor — Self Test\n");

  // Test with a sample image
  const samplePath = "images/sample/case_001/img_1.jpg";
  const imageInfos = parseImagePaths(samplePath, config.paths.datasetRoot);

  console.log(`Processing: ${samplePath}`);
  const results = await processImages(imageInfos);

  for (const img of results) {
    if (img.valid) {
      console.log(`  ✓ ${img.id}: ${img.originalSizeBytes}B → ${img.processedSizeBytes}B (base64 length: ${img.base64.length})`);
    } else {
      console.log(`  ✗ ${img.id}: ${img.error}`);
    }
  }

  // Test with multi-image case
  const multiPath =
    "images/sample/case_005/img_1.jpg;images/sample/case_005/img_2.jpg";
  const multiInfos = parseImagePaths(multiPath, config.paths.datasetRoot);

  console.log(`\nProcessing multi-image: ${multiPath}`);
  const multiResults = await processImages(multiInfos);

  for (const img of multiResults) {
    if (img.valid) {
      console.log(`  ✓ ${img.id}: ${img.originalSizeBytes}B → ${img.processedSizeBytes}B`);
    } else {
      console.log(`  ✗ ${img.id}: ${img.error}`);
    }
  }

  // Test with non-existent image
  const badPath = "images/test/case_999/img_1.jpg";
  const badInfos = parseImagePaths(badPath, config.paths.datasetRoot);

  console.log(`\nProcessing missing image: ${badPath}`);
  const badResults = await processImages(badInfos);

  for (const img of badResults) {
    if (img.valid) {
      console.log(`  ✓ ${img.id}: OK`);
    } else {
      console.log(`  ✗ ${img.id}: ${img.error} (graceful failure)`);
    }
  }

  console.log("\n✅ Image processor self-test complete!\n");
}
