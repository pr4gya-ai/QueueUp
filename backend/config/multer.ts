import multer from "multer";

export const MAX_UPLOAD_MB = 50;

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (/^(image|video)\//.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(Object.assign(new Error("Only image and video files are allowed"), { status: 400 }));
        }
    },
});
