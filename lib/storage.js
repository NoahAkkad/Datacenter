const fs = require('fs');
const path = require('path');

const uploadDir = path.join(process.cwd(), 'public', 'uploads');

function fileTypeAllowed(mimeType = '') {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

async function uploadFile({ buffer, originalName, mimeType }) {
  if (!fileTypeAllowed(mimeType)) throw new Error('Only image and PDF files are allowed');

  const uploadEndpoint = process.env.CLOUD_UPLOAD_ENDPOINT;
  const uploadToken = process.env.CLOUD_UPLOAD_TOKEN;
  if (uploadEndpoint && uploadToken) {
    const form = new FormData();
    form.set('file', new Blob([buffer], { type: mimeType }), originalName);
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${uploadToken}` },
      body: form
    });

    if (!response.ok) throw new Error('Cloud upload failed');
    const payload = await response.json();
    return { key: payload.key, url: payload.url, originalname: originalName, mimetype: mimeType };
  }

  if (process.env.NODE_ENV !== 'production') {
    fs.mkdirSync(uploadDir, { recursive: true });
    const ext = path.extname(originalName || '');
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return { key: filename, url: `/uploads/${filename}`, originalname: originalName, mimetype: mimeType };
  }

  throw new Error('Cloud upload is not configured');
}

async function deleteStoredFile(fileRef = {}) {
  const deleteEndpoint = process.env.CLOUD_DELETE_ENDPOINT;
  const uploadToken = process.env.CLOUD_UPLOAD_TOKEN;
  if (deleteEndpoint && uploadToken && fileRef.key) {
    await fetch(deleteEndpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${uploadToken}` },
      body: JSON.stringify({ key: fileRef.key })
    });
    return;
  }

  if (process.env.NODE_ENV !== 'production' && fileRef.key) {
    const filePath = path.join(uploadDir, path.basename(fileRef.key));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

module.exports = { uploadFile, deleteStoredFile };
