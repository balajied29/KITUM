/**
 * Socket.IO handshake auth — mirrors the REST `protect` middleware
 * (backend/src/middleware/auth.middleware.js) so tokens work identically.
 *
 * Clients pass the JWT via `io(url, { auth: { token } })`.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { canAuthenticate } = require('../middleware/auth.middleware');

module.exports = async function authenticateSocket(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) return next(new Error('Not authorized, no token'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!canAuthenticate(user)) return next(new Error('User not found or inactive'));

    socket.user = user;
    next();
  } catch {
    next(new Error('Not authorized, token failed'));
  }
};
