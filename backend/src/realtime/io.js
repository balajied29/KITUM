/**
 * Socket.IO server bootstrap. Attaches to the existing HTTP server, applies the
 * JWT handshake, and routes each connection to role-specific handlers.
 */
const { Server } = require('socket.io');
const authenticateSocket = require('./socketAuth');
const emit = require('./emit');
const registerFulfillerHandlers = require('./fulfiller.socket');
const registerCustomerHandlers = require('./customer.socket');
const { ROLES } = require('../shared/constants');

function initSocket(httpServer) {
  const origins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : '*';
  const io = new Server(httpServer, {
    cors: { origin: origins, methods: ['GET', 'POST'], credentials: true },
    // Mobile networks: keep connections alive through flaky links.
    pingInterval: 20000,
    pingTimeout: 25000,
  });

  emit.setIO(io);
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    if (socket.user.role === ROLES.FULFILLER) {
      registerFulfillerHandlers(io, socket);
    } else {
      registerCustomerHandlers(io, socket); // customers + admins
    }
  });

  return io;
}

module.exports = { initSocket };
