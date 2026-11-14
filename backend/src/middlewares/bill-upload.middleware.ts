import multer from 'multer';

// Memory storage so the storage service can inspect and write through IStorageService
const storage = multer.memoryStorage();

export const uploadBillMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB (FR-6.3)
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG images and PDF documents are allowed.'));
    }
  },
});

