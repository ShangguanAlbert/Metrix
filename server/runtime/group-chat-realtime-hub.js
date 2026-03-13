export function createGroupChatRealtimeHub(deps) {
  return {
    initWebSocketServer(server) {
      return deps.initGroupChatWebSocketServer(server);
    },
    broadcastMessageCreated(roomId, message) {
      deps.broadcastGroupChatMessageCreated(roomId, message);
    },
    broadcastMessageDeleted(roomId, messageId) {
      deps.broadcastGroupChatMessageDeleted(roomId, messageId);
    },
    broadcastMessageReactionsUpdated(roomId, message) {
      deps.broadcastGroupChatMessageReactionsUpdated(roomId, message);
    },
    broadcastRoomUpdated(roomId, room) {
      deps.broadcastGroupChatRoomUpdated(roomId, room);
    },
    broadcastRoomDissolved(roomId, byUser) {
      deps.broadcastGroupChatRoomDissolved(roomId, byUser);
    },
    broadcastMemberJoined(roomId, user) {
      deps.broadcastGroupChatMemberJoined(roomId, user);
    },
    getOnlineUserIdsByRoom(roomId) {
      return deps.getGroupChatOnlineUserIdsByRoom(roomId);
    },
  };
}
