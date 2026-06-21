// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    console.log('🔵 [Middleware] Authenticating token...');
    
    // Check token from multiple sources
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;
    
    console.log('🔵 [Middleware] Token exists:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('❌ [Middleware] No token provided');
      return res.status(401).json({ 
        success: false,
        error: 'Access denied. No token provided.' 
      });
    }

    const verified = jwt.verify(token, 'mypassword');
    console.log('🔵 [Middleware] Token verified for userId:', verified.userId);
    
    req.user = verified;
    next();
    
  } catch (error) {
    console.log('❌ [Middleware] Token verification failed:', error.message);
    res.status(401).json({ 
      success: false,
      error: 'Invalid token' 
    });
  }
};

module.exports = authenticateToken;