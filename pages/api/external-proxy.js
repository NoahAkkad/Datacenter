const { requireRole } = require('../../lib/api/auth');
const { sendSuccess, sendError } = require('../../lib/api/response');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');

  const auth = requireRole(req, res, 'admin');
  if (auth.error) return sendError(res, auth.status, auth.error);

  try {
    const response = await fetch(process.env.EXTERNAL_API_URL);
    const data = await response.json();
    return sendSuccess(res, data);
  } catch (error) {
    console.error('external proxy error', error);
    return sendError(res, 502, 'External API request failed');
  }
}
