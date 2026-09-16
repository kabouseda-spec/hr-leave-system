module.exports = function rbac(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(403).json({ error: 'Access denied' });
    if (req.user.is_owner) return next(); // owner bypasses all role checks
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    next();
  };
};
