const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./env');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hashed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hashed}`;
}

function verifyPassword(password, storedHash) {
  const [salt] = storedHash.split(':');
  return hashPassword(password, salt) === storedHash;
}

function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
