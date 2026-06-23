const jwt = require('jsonwebtoken');

// Routes that bypass JWT verification
const PUBLIC_PATHS = new Set([
  'POST:/auth/register',
  'POST:/auth/login',
  'POST:/auth/refresh',
  'GET:/health',
  'GET:/metrics',
]);

/**
 * Gateway-level JWT middleware.
 *
 * On success it injects x-user-id and x-user-role headers into the
 * proxied request so downstream services can trust the identity without
 * re-verifying the token themselves.
 */
const authenticate = (req, res, next) => {
  const key = `${req.method}:${req.path}`;
  if (PUBLIC_PATHS.has(key)) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // Pass identity to downstream services via trusted internal headers
    req.headers['x-user-id'] = String(decoded.userId);
    req.headers['x-user-role'] = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
};

module.exports = authenticate;
