const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const router = express.Router();

// Memory storage for Vercel Serverless environment
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mimetype, buffer, originalname } = req.file;

    // Handle Image Uploads (Vision)
    if (mimetype.startsWith('image/')) {
      const base64 = buffer.toString('base64');
      return res.json({
        type: 'image',
        filename: originalname,
        mimetype: mimetype,
        base64: base64
      });
    }

    // Handle PDF Uploads (RAG)
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      return res.json({
        type: 'text',
        filename: originalname,
        text: data.text
      });
    }

    // Handle plain text
    if (mimetype.startsWith('text/')) {
      return res.json({
        type: 'text',
        filename: originalname,
        text: buffer.toString('utf-8')
      });
    }

    return res.status(400).json({ error: 'Unsupported file type' });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

module.exports = router;
