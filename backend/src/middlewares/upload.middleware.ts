import multer from 'multer';

// Use memoryStorage so storageService can validate, inspect, and write through IStorageService
const storage = multer.memoryStorage();

export const uploadImageMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB (FR-3.2)
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG and PNG are allowed.'));
    }
  },
});

