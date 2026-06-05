/**
 * Socket handlers for a connected customer (and admin).
 */
const DeliveryRequest = require('../models/DeliveryRequest.model');
const emit = require('./emit');
const dispatch = require('../services/dispatch/DispatchManager');
const { EVENTS, rooms } = require('../shared/constants');

module.exports = function registerCustomerHandlers(io, socket) {
  const uid = String(socket.user._id);
  socket.join(rooms.user(uid));

  // Tracking page asks to join its request room (verified by ownership).
  socket.on('request:join', async ({ requestId } = {}) => {
    if (!requestId) return;
    const owns = await DeliveryRequest.exists({ _id: requestId, customerId: uid }).catch(() => false);
    if (owns) socket.join(rooms.request(String(requestId)));
  });

  socket.on(EVENTS.REQUEST_CANCEL, ({ requestId } = {}) => {
    if (requestId) dispatch.handleCustomerCancel(uid, requestId);
  });
};
