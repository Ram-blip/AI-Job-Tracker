const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../env');

module.exports = function authGuard(req, res, next) {
  const token = req.cookies['jid'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
