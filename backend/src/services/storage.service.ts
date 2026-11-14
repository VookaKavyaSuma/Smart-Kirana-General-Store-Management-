import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UploadResult {
  url: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface SignedUrlResult {
  token: string;
  signedUrl: string;
  expiresAt: Date;
}

export interface IStorageService {
  uploadFile(file: Express.Multer.File, subFolder?: string): Promise<UploadResult>;
  uploadPrivateFile(file: Express.Multer.File, subFolder?: string): Promise<UploadResult>;
  deleteFile(filePath: string): Promise<boolean>;
  generateSignedToken(fileId: string, storeId: string, expiresInMinutes?: number): SignedUrlResult;
  verifySignedToken(fileId: string, storeId: string, token: string): boolean;
}

export class LocalStorageService implements IStorageService {
  private uploadRoot: string;
  private privateRoot: string;
  private secretKey: string;

  constructor(uploadDir?: string) {
    this.uploadRoot = uploadDir || path.join(process.cwd(), 'uploads');
    this.privateRoot = path.join(this.uploadRoot, 'private_bills');
    this.secretKey = process.env.SESSION_SECRET || 'kirana-private-storage-secret-key-2026';

    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true });
    }
    if (!fs.existsSync(this.privateRoot)) {
      fs.mkdirSync(this.privateRoot, { recursive: true });
    }
  }

  /**
   * Upload public files (e.g. item photos)
   */
  async uploadFile(file: Express.Multer.File, subFolder: string = 'items'): Promise<UploadResult> {
    if (!file) {
      throw new Error('No file provided for upload.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Invalid file format. Only JPG and PNG images are accepted.');
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      throw new Error('File exceeds the 5 MB size limit.');
    }

    const folderPath = path.join(this.uploadRoot, subFolder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype === 'image/png' ? '.png' : '.jpg');
    const safeFileName = `${crypto.randomUUID()}${ext}`;
    const destinationPath = path.join(folderPath, safeFileName);

    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, destinationPath);
    } else {
      throw new Error('File content could not be read.');
    }

    return {
      url: `/uploads/${subFolder}/${safeFileName}`,
      filePath: destinationPath,
      fileName: safeFileName,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Upload private files (e.g. bills, invoices) - stored securely outside public web paths (FR-6.1, FR-6.2, FR-6.3)
   */
  async uploadPrivateFile(file: Express.Multer.File, subFolder: string = 'bills'): Promise<UploadResult> {
    if (!file) {
      throw new Error('No bill file provided for upload.');
    }

    // FR-6.3: Accepted formats: JPG, PNG, PDF, up to 10 MB each
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Invalid file format. Only JPG, PNG images and PDF documents are accepted.');
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (FR-6.3)
    if (file.size > MAX_SIZE) {
      throw new Error('File exceeds the 10 MB size limit.');
    }

    const targetDir = path.join(this.privateRoot, subFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext) {
      if (file.mimetype === 'application/pdf') ext = '.pdf';
      else if (file.mimetype === 'image/png') ext = '.png';
      else ext = '.jpg';
    }

    const safeFileName = `${crypto.randomUUID()}${ext}`;
    const destinationPath = path.join(targetDir, safeFileName);

    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, destinationPath);
    } else {
      throw new Error('File content could not be read.');
    }

    return {
      url: '', // Private files have NO public URL!
      filePath: destinationPath,
      fileName: safeFileName,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Generate short-lived HMAC signed token for private file access (FR-6.3)
   */
  generateSignedToken(fileId: string, storeId: string, expiresInMinutes = 15): SignedUrlResult {
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const exp = Math.floor(expiresAt.getTime() / 1000);

    const payload = `${fileId}:${storeId}:${exp}`;
    const hmac = crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
    const token = `${exp}.${hmac}`;

    return {
      token,
      signedUrl: `/api/v1/bills/${fileId}/access?token=${token}`,
      expiresAt,
    };
  }

  /**
   * Verify an incoming signed token for private file access
   */
  verifySignedToken(fileId: string, storeId: string, token: string): boolean {
    if (!token || !token.includes('.')) {
      return false;
    }

    const [expStr, signature] = token.split('.');
    const exp = parseInt(expStr, 10);

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(exp) || now > exp) {
      return false;
    }

    const payload = `${fileId}:${storeId}:${exp}`;
    const expectedSignature = crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    // Timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting file:', err);
      return false;
    }
  }
}

export const storageService: IStorageService = new LocalStorageService();
