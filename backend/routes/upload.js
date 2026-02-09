import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Protect all upload routes with authentication
router.use(authenticateToken);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
    }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
    // Allow all common file types
    const allowedTypes = [
        // Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text files
        'text/plain',
        'text/csv',
        'text/html',
        'text/css',
        'text/javascript',
        'application/javascript',
        // Archives
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        // Others
        'application/json',
        'application/xml',
        'application/octet-stream' // For general binary files
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        // Allow all files in development mode
        if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️  Allowing non-standard file type: ${file.mimetype}`);
            cb(null, true);
        } else {
            cb(new Error(`Nepodporovaný typ souboru: ${file.mimetype}`), false);
        }
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max file size
    }
});

// =================================================================================
// UPLOAD FILE
// =================================================================================
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No file uploaded',
                message: 'Žádný soubor nebyl nahrán' 
            });
        }

        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: `/uploads/${req.file.filename}`,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user ? req.user.id : null
        };

        console.log('✅ File uploaded:', fileInfo.originalName);

        res.status(200).json({
            success: true,
            message: 'Soubor byl úspěšně nahrán',
            file: fileInfo
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Upload failed',
            message: 'Chyba při nahrávání souboru' 
        });
    }
});

// =================================================================================
// UPLOAD MULTIPLE FILES
// =================================================================================
router.post('/multiple', upload.array('files', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                error: 'No files uploaded',
                message: 'Žádné soubory nebyly nahrány' 
            });
        }

        const filesInfo = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: `/uploads/${file.filename}`,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user ? req.user.id : null
        }));

        console.log(`✅ ${filesInfo.length} files uploaded`);

        res.status(200).json({
            success: true,
            message: `${filesInfo.length} souborů bylo úspěšně nahráno`,
            files: filesInfo
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Upload failed',
            message: 'Chyba při nahrávání souborů' 
        });
    }
});

// =================================================================================
// GET UPLOADED FILES LIST
// =================================================================================
router.get('/list', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        
        const fileList = files.map(filename => {
            const filePath = path.join(uploadsDir, filename);
            const stats = fs.statSync(filePath);
            
            return {
                filename: filename,
                size: stats.size,
                uploadedAt: stats.birthtime,
                path: `/uploads/${filename}`
            };
        });

        res.json({
            success: true,
            count: fileList.length,
            files: fileList
        });

    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ 
            error: 'Failed to list files',
            message: 'Chyba při načítání seznamu souborů' 
        });
    }
});

// =================================================================================
// DELETE FILE
// =================================================================================
router.delete('/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                error: 'File not found',
                message: 'Soubor nebyl nalezen' 
            });
        }

        fs.unlinkSync(filePath);
        
        console.log('🗑️  File deleted:', filename);

        res.json({
            success: true,
            message: 'Soubor byl smazán'
        });

    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ 
            error: 'Failed to delete file',
            message: 'Chyba při mazání souboru' 
        });
    }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'Soubor je příliš velký (maximum 50MB)'
            });
        }
        return res.status(400).json({
            error: 'Upload error',
            message: error.message
        });
    }
    next(error);
});

export default router;

