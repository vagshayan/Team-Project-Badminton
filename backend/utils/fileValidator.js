const crypto = require('crypto');
const path = require('path');

/**
 * Magic bytes (file signatures) for allowed image types
 * These are the first few bytes that identify a file type
 */
const MAGIC_BYTES = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF, 0xE0], // JPEG (JFIF)
    [0xFF, 0xD8, 0xFF, 0xE1], // JPEG (Exif)
    [0xFF, 0xD8, 0xFF, 0xE2], // JPEG (APP2)
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47], // PNG
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // WebP (RIFF header - must verify WEBP in bytes 8-11)
  ],
};

/**
 * Safe file extensions for allowed MIME types
 */
const ALLOWED_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Validate file by checking actual magic bytes (file signature)
 * @param {Buffer} buffer - File buffer to validate
 * @returns {string|null} - Validated MIME type or null if invalid
 */
function validateFileMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // Check JPEG
  const jpegSignatures = MAGIC_BYTES['image/jpeg'];
  for (const sig of jpegSignatures) {
    if (buffer.length >= sig.length && sig.every((byte, idx) => buffer[idx] === byte)) {
      return 'image/jpeg';
    }
  }

  // Check PNG
  const pngSignature = MAGIC_BYTES['image/png'][0];
  if (buffer.length >= pngSignature.length && pngSignature.every((byte, idx) => buffer[idx] === byte)) {
    return 'image/png';
  }

  // Check WebP (RIFF....WEBP format)
  const riffSignature = MAGIC_BYTES['image/webp'][0];
  if (buffer.length >= 12 && riffSignature.every((byte, idx) => buffer[idx] === byte)) {
    // Verify it's WebP format by checking "WEBP" at bytes 8-11
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }
  }

  return null;
}

/**
 * Generate a secure random filename with safe extension
 * @param {string} validatedMimeType - MIME type validated by validateFileMagicBytes
 * @returns {string} - Random filename with safe extension
 */
function generateSafeFilename(validatedMimeType) {
  const randomString = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const extension = ALLOWED_EXTENSIONS[validatedMimeType] || '.jpg';
  return `${timestamp}-${randomString}${extension}`;
}

/**
 * Validate upload file
 * @param {Express.Multer.File} file - Multer file object
 * @param {Buffer} buffer - File buffer for magic byte validation
 * @returns {Object} - { valid: boolean, error?: string, mimeType?: string, filename?: string }
 */
function validateUploadFile(file, buffer) {
  // Step 1: Check file exists
  if (!file || !buffer) {
    return { valid: false, error: 'No file provided' };
  }

  // Step 2: Check file size (5MB limit)
  if (buffer.length > 5 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds 5MB limit' };
  }

  // Step 3: Validate actual file content using magic bytes
  const validatedMimeType = validateFileMagicBytes(buffer);
  if (!validatedMimeType) {
    return { 
      valid: false, 
      error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed. File does not match expected image signature.' 
    };
  }

  // Step 4: Generate safe filename (random, no user-supplied extension)
  const filename = generateSafeFilename(validatedMimeType);

  return {
    valid: true,
    mimeType: validatedMimeType,
    filename: filename,
  };
}

/**
 * Multer fileFilter factory - validates files after upload
 * @param {Buffer} fileBuffer - The uploaded file buffer
 * @returns {function} - fileFilter function for multer
 */
function createFileFilterValidation(fileBuffer) {
  return (req, file, cb) => {
    if (!fileBuffer) {
      return cb(new Error('File buffer not available'));
    }

    const validation = validateUploadFile(file, fileBuffer);
    if (!validation.valid) {
      return cb(new Error(validation.error));
    }

    // Store validated MIME type and safe filename on request for later use
    req.validatedMimeType = validation.mimeType;
    req.safeFilename = validation.filename;

    cb(null, true);
  };
}

module.exports = {
  validateFileMagicBytes,
  generateSafeFilename,
  validateUploadFile,
  createFileFilterValidation,
  ALLOWED_EXTENSIONS,
};
