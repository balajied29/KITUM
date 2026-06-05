/**
 * Thin wrapper around the Socket.IO server instance.
 * Other modules (dispatch engine, controllers) emit through here so they never
 * need a direct reference to `io` — keeps the dependency graph acyclic.
 */
const { rooms } = require('../shared/constants');

let io = null;

const setIO = (instance) => {
  io = instance;
};

const toFulfiller = (id, event, payload) =>
  io && io.to(rooms.fulfiller(String(id))).emit(event, payload);

const toUser = (id, event, payload) =>
  io && io.to(rooms.user(String(id))).emit(event, payload);

const toRequest = (id, event, payload) =>
  io && io.to(rooms.request(String(id))).emit(event, payload);

/** Force every socket in `sourceRoom` to also join `targetRoom`. */
const joinRoom = (sourceRoom, targetRoom) => io && io.in(sourceRoom).socketsJoin(targetRoom);

/** Force every socket in `sourceRoom` to leave `targetRoom`. */
const leaveRoom = (sourceRoom, targetRoom) => io && io.in(sourceRoom).socketsLeave(targetRoom);

/** Is at least one socket for this fulfiller currently connected? */
const isFulfillerConnected = (id) => {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(rooms.fulfiller(String(id)));
  return !!(room && room.size > 0);
};

module.exports = { setIO, toFulfiller, toUser, toRequest, joinRoom, leaveRoom, isFulfillerConnected };
