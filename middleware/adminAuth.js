/**
 * Middleware to restrict route access to admin users only.
 * Assumes the 'protect' middleware has run beforehand and populated req.user.
 */
export const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({ message: 'Admin access required' });
};
