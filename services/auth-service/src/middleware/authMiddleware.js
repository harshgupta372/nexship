const jwt = require('jsonwebtoken');

/**
 * authenticate — verifies the Bearer access token on every protected route.
 * Attaches decoded payload (userId, role) to req.user for downstream handlers.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded; // { userId, role, iat, exp }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
};

/**
 * authorize — role-based guard, used after authenticate.
 * Usage: router.get('/admin-only', authenticate, authorize('ADMIN'), handler)
 */
const authorize = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };

module.exports = { authenticate, authorize };
