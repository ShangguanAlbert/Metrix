import * as chatApi from "../api/chatApi.js";
import {
  clearManyStreamDrafts,
  clearStreamDraft,
  getStreamDraft,
  primeAllStreamDrafts,
  replaceAllStreamDrafts,
  startStreamDraft,
  updateStreamDraft,
} from "../../../pages/chat/streamDraftStore.js";
import {
  createNewSessionRecord,
  createWelcomeMessage,
  hasUserTurn,
} from "../../../pages/chat/sessionFactory.js";

export function createChatDataService(overrides = {}) {
  const deps = {
    fetchChatBootstrap: chatApi.fetchChatBootstrap,
    saveChatState: chatApi.saveChatState,
    saveChatStateMeta: chatApi.saveChatStateMeta,
    saveChatSessionMessages: chatApi.saveChatSessionMessages,
    saveUserProfile: chatApi.saveUserProfile,
    clearChatSmartContext: chatApi.clearChatSmartContext,
    startStreamDraft,
    updateStreamDraft,
    getStreamDraft,
    clearStreamDraft,
    clearManyStreamDrafts,
    replaceAllStreamDrafts,
    primeAllStreamDrafts,
    createNewSessionRecord,
    createWelcomeMessage,
    hasUserTurn,
    ...overrides,
  };

  return {
    fetchBootstrap() {
      return deps.fetchChatBootstrap();
    },
    saveState(payload) {
      return deps.saveChatState(payload);
    },
    saveStateMeta(payload) {
      return deps.saveChatStateMeta(payload);
    },
    saveSessionMessages(payload) {
      return deps.saveChatSessionMessages(payload);
    },
    saveUserProfile(payload) {
      return deps.saveUserProfile(payload);
    },
    clearSmartContext(sessionId) {
      return deps.clearChatSmartContext(sessionId);
    },
    startDraft(sessionId, draft) {
      return deps.startStreamDraft(sessionId, draft);
    },
    updateDraft(sessionId, updater) {
      return deps.updateStreamDraft(sessionId, updater);
    },
    getDraft(sessionId) {
      return deps.getStreamDraft(sessionId);
    },
    clearDraft(sessionId) {
      return deps.clearStreamDraft(sessionId);
    },
    clearDrafts(sessionIds) {
      return deps.clearManyStreamDrafts(sessionIds);
    },
    replaceDrafts(nextBySession) {
      return deps.replaceAllStreamDrafts(nextBySession);
    },
    primeDrafts(nextBySession) {
      return deps.primeAllStreamDrafts(nextBySession);
    },
    createSessionRecord() {
      return deps.createNewSessionRecord();
    },
    createWelcomeMessage() {
      return deps.createWelcomeMessage();
    },
    hasUserTurn(messages) {
      return deps.hasUserTurn(messages);
    },
  };
}

export const chatDataService = createChatDataService();
