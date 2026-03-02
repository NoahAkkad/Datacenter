function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function sendError(res, status, message, details) {
  return res.status(status).json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  });
}

module.exports = { sendSuccess, sendError };
