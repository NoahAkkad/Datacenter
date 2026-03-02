const formidable = require('formidable');

function parseMultipart(req) {
  const form = formidable({ multiples: true, maxFileSize: 10 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

module.exports = { parseMultipart };
