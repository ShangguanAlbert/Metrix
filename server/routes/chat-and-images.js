import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export function registerChatAndImageRoutes(app, deps) {
  const {
    express,
    cors,
    multer,
    dotenv,
    http,
    existsSync,
    mkdtemp,
    mkdir,
    readFileAsync,
    rm,
    writeFileAsync,
    path,
    tmpdir,
    crypto,
    execFile,
    promisify,
    mammoth,
    XLSX,
    PDFParse,
    mongoose,
    OSS,
    WebSocketServer,
    SYSTEM_PROMPT_LEAK_PROTECTION_TOP_PROMPT,
    PROMPT_LEAK_PROBE_KEYWORDS,
    AGENT_E_CONFIG_KEY,
    AGENT_E_FIXED_PROVIDER,
    AGENT_E_ID,
    buildAgentEAdminSettingsResponse,
    createAgentEConfigModel,
    normalizeAgentEConfigDoc,
    sanitizeAgentEConfigPayload,
    sanitizeAgentERuntime,
    selectAgentESkills,
    buildAgentESystemPrompt,
    buildAliyunChatPayload,
    buildAliyunDashScopePayload,
    buildAliyunHeaders,
    buildAliyunProviderConfig,
    buildAliyunResponsesPayload,
    formatAliyunUpstreamError,
    pipeAliyunDashScopeSse,
    resolveAliyunModelPolicy,
    resolveAliyunProtocol,
    resolveAliyunWebSearchRuntime,
    shouldUseAliyunDashScopeMultimodalEndpoint,
    ALIYUN_SEARCH_CITATION_FORMATS,
    ALIYUN_SEARCH_FRESHNESS_OPTIONS,
    ALIYUN_SEARCH_STRATEGIES,
    DEFAULT_TEACHER_SCOPE_KEY,
    SHANGGUAN_FUZE_TEACHER_SCOPE_KEY,
    YANG_JUNFENG_TEACHER_SCOPE_KEY,
    buildTeacherScopedStorageUserId,
    getTeacherScopeLabel,
    isDefaultTeacherScopeKey,
    sanitizeTeacherScopeKey,
    FIXED_STUDENT_ACCOUNTS,
    FIXED_STUDENT_ACCOUNT_TAG,
    FIXED_STUDENT_REQUIRED_TEACHER_SCOPE_KEY,
    groupChatWsRoomSockets,
    groupChatWsMetaBySocket,
    groupChatWsOnlineCountsByRoom,
    userOnlinePresenceByUserId,
    chatPreparedAttachmentCache,
    groupChatExpiredFileCleanupTimer,
    generatedImageExpiredCleanupTimer,
    port,
    mongoUri,
    authSecret,
    MAX_FILE_SIZE_BYTES,
    MAX_FILES,
    CHAT_PREPARED_ATTACHMENT_CACHE_TTL_MS,
    CHAT_PREPARED_ATTACHMENT_CACHE_MAX_ITEMS,
    CHAT_PREPARED_ATTACHMENT_MAX_REFS,
    MAX_IMAGE_GENERATION_INPUT_FILES,
    MAX_PARSED_CHARS_PER_FILE,
    ALIYUN_DASHSCOPE_PARSED_DOC_MAX_CHARS,
    EXCEL_PREVIEW_MAX_ROWS,
    EXCEL_PREVIEW_MAX_COLS,
    EXCEL_PREVIEW_MAX_SHEETS,
    PASSWORD_MIN_LENGTH,
    AUTH_TOKEN_TTL_SECONDS,
    ADMIN_TOKEN_TTL_SECONDS,
    USER_ONLINE_ACTIVITY_WINDOW_MS,
    USER_ONLINE_PRESENCE_RETENTION_MS,
    USER_BROWSER_HEARTBEAT_INTERVAL_MS,
    USER_BROWSER_HEARTBEAT_STALE_MS,
    AGENT_IDS,
    ADMIN_CONFIG_KEY,
    TEACHER_SCOPE_LOCKED_AGENT_MAP,
    CLASS_NAME_JIAOJI_231,
    CLASSROOM_FIRST_LESSON_DATE,
    CLASSROOM_QUESTIONNAIRE_URL,
    ADMIN_CLASSROOM_COURSE_PLAN_MAX_ITEMS,
    ADMIN_CLASSROOM_COURSE_TASK_MAX_ITEMS,
    ADMIN_CLASSROOM_COURSE_FILE_MAX_ITEMS,
    ADMIN_CLASSROOM_COURSE_FILE_UPLOAD_MAX_FILES,
    VOLCENGINE_IMAGE_GENERATION_MODEL_ID_45,
    VOLCENGINE_IMAGE_GENERATION_MODEL_ID_50,
    DEFAULT_VOLCENGINE_IMAGE_GENERATION_MODEL,
    DEFAULT_VOLCENGINE_IMAGE_GENERATION_ENDPOINT,
    SYSTEM_PROMPT_MAX_LENGTH,
    DEFAULT_SYSTEM_PROMPT_FALLBACK,
    RUNTIME_CONTEXT_ROUNDS_MAX,
    RUNTIME_MAX_CONTEXT_WINDOW_TOKENS,
    RUNTIME_MAX_INPUT_TOKENS,
    RUNTIME_MAX_OUTPUT_TOKENS,
    RUNTIME_MAX_REASONING_TOKENS,
    VOLCENGINE_FIXED_SAMPLING_MODEL_ID,
    VOLCENGINE_FIXED_TEMPERATURE,
    VOLCENGINE_FIXED_TOP_P,
    UPLOADED_FILE_CONTEXT_CACHE_TTL_MS,
    GENERATED_IMAGE_HISTORY_TTL_MS,
    GENERATED_IMAGE_HISTORY_MAX_IMAGE_BYTES,
    GENERATED_IMAGE_HISTORY_FETCH_TIMEOUT_MS,
    GROUP_CHAT_MAX_CREATED_ROOMS_PER_USER,
    GROUP_CHAT_MAX_JOINED_ROOMS_PER_USER,
    GROUP_CHAT_MAX_MEMBERS_PER_ROOM,
    GROUP_CHAT_MAX_ROOMS_PER_BOOTSTRAP,
    GROUP_CHAT_DEFAULT_MESSAGES_LIMIT,
    GROUP_CHAT_MAX_MESSAGES_LIMIT,
    GROUP_CHAT_IMAGE_MAX_FILE_SIZE_BYTES,
    GROUP_CHAT_FILE_MAX_FILE_SIZE_BYTES,
    GROUP_CHAT_FILE_TTL_MS,
    GROUP_CHAT_OSS_DEFAULT_REGION,
    GROUP_CHAT_OSS_DEFAULT_PREFIX,
    GROUP_CHAT_OSS_SIGNED_URL_TTL_SECONDS_DEFAULT,
    GROUP_CHAT_OSS_SIGNED_URL_TTL_SECONDS_MAX,
    GROUP_CHAT_OSS_STARTUP_CHECK_TIMEOUT_MS_DEFAULT,
    GROUP_CHAT_OSS_STARTUP_CHECK_TIMEOUT_MS_MAX,
    GROUP_CHAT_OSS_EXPIRED_CLEANUP_INTERVAL_MS,
    GROUP_CHAT_OSS_EXPIRED_CLEANUP_BATCH_SIZE,
    GENERATED_IMAGE_OSS_EXPIRED_CLEANUP_INTERVAL_MS,
    GENERATED_IMAGE_OSS_EXPIRED_CLEANUP_BATCH_SIZE,
    CHAT_ATTACHMENT_OSS_SCOPE,
    TEACHER_LESSON_FILE_OSS_SCOPE,
    TEACHER_LESSON_FILE_OSS_SUB_SCOPE,
    STUDENT_HOMEWORK_OSS_SUB_SCOPE,
    STUDENT_HOMEWORK_UPLOAD_MAX_FILES,
    STUDENT_HOMEWORK_MAX_FILES_PER_LESSON_PER_STUDENT,
    FIXED_ADMIN_ACCOUNTS,
    FIXED_ADMIN_USERNAME_KEYS,
    FIXED_STUDENT_USERNAME_KEYS,
    RESERVED_ADMIN_USERNAME_KEYS,
    CHAT_PREPARED_PDF_IMAGE_OSS_SCOPE,
    IMAGE_GENERATION_INPUT_OSS_SCOPE,
    IMAGE_GENERATION_OUTPUT_OSS_SCOPE,
    ALIYUN_DASHSCOPE_PDF_IMAGE_MAX_PAGES,
    ALIYUN_DASHSCOPE_PDF_RENDER_DPI,
    ALIYUN_DASHSCOPE_PDF_RENDER_TIMEOUT_MS,
    ALIYUN_DASHSCOPE_PDF_RENDER_STDOUT_MAX_BYTES,
    ALIYUN_DASHSCOPE_PDF_RENDER_SCRIPT_PATH,
    GROUP_CHAT_TEXT_MAX_LENGTH,
    GROUP_CHAT_ROOM_NAME_MAX_LENGTH,
    GROUP_CHAT_REPLY_PREVIEW_MAX_LENGTH,
    GROUP_CHAT_LOCAL_PARSE_HINT_TEXT,
    GROUP_CHAT_MEMBER_MUTED_ERROR_MESSAGE,
    GROUP_CHAT_MAX_REACTIONS_PER_MESSAGE,
    GROUP_CHAT_REACTION_EMOJI_MAX_SYMBOLS,
    GROUP_CHAT_MAX_READ_STATES_PER_ROOM,
    GROUP_CHAT_WS_PATH,
    GROUP_CHAT_WS_AUTH_TIMEOUT_MS,
    GROUP_CHAT_WS_MAX_PAYLOAD_BYTES,
    groupChatOssConfig,
    groupChatOssClients,
    groupChatOssClient,
    groupChatOssFallbackClient,
    AGENT_D_FIXED_PROVIDER,
    AGENT_D_FIXED_MODEL,
    AGENT_D_FIXED_MAX_OUTPUT_TOKENS,
    AGENT_C_FIXED_PROVIDER,
    GROUP_CHAT_VOLCENGINE_SUPPORTED_IMAGE_EXTENSIONS,
    GROUP_CHAT_VOLCENGINE_SUPPORTED_IMAGE_MIME_TYPES,
    DEFAULT_AGENT_RUNTIME_CONFIG,
    AGENT_RUNTIME_DEFAULT_OVERRIDES,
    AGENT_RUNTIME_DEFAULTS,
    RESPONSE_MODEL_TOKEN_PROFILES,
    VOLCENGINE_WEB_SEARCH_MODEL_CAPABILITIES,
    VOLCENGINE_WEB_SEARCH_THINKING_PROMPT,
    scryptAsync,
    execFileAsync,
    CRC32_TABLE,
    TEXT_EXTENSIONS,
    WORD_EXTENSIONS,
    EXCEL_EXTENSIONS,
    PDF_EXTENSIONS,
    VIDEO_EXTENSIONS,
    OPENROUTER_VIDEO_EXTENSIONS,
    OPENROUTER_AUDIO_FORMATS,
    OPENROUTER_AUDIO_EXTENSIONS,
    OPENROUTER_AUDIO_MIME_TO_FORMAT,
    upload,
    imageGenerationUpload,
    groupChatImageUpload,
    groupChatFileUpload,
    authUserSchema,
    AuthUser,
    chatStateSchema,
    ChatState,
    uploadedFileContextSchema,
    UploadedFileContext,
    generatedImageHistorySchema,
    GeneratedImageHistory,
    groupChatRoomReadStateSchema,
    groupChatRoomSchema,
    GroupChatRoom,
    groupChatMessageReactionSchema,
    groupChatStoredFileSchema,
    GroupChatStoredFile,
    groupChatMessageSchema,
    GroupChatMessage,
    runtimeConfigSchema,
    adminClassroomCourseFileSchema,
    adminClassroomTaskSchema,
    adminClassroomCoursePlanSchema,
    adminConfigSchema,
    AdminConfig,
    adminClassroomLessonFileSchema,
    AdminClassroomLessonFile,
    classroomHomeworkFileSchema,
    ClassroomHomeworkFile,
    AgentEConfig,
    getDefaultRuntimeConfigByAgent,
    createDefaultAgentRuntimeConfigMap,
    normalizeMessages,
    normalizeMessageContent,
    hasUsableMessageContent,
    hasImageInputInMessages,
    messageContainsImageInput,
    isImageUploadFile,
    cloneNormalizedMessageContent,
    resolveUploadedFileContextIdentity,
    buildUploadedFileContextExpireAt,
    sanitizeUploadedFileContextOssSource,
    normalizeUploadedFileContextOssFiles,
    resolveUploadedContextOssFileForInputFile,
    dedupeUploadedFileContextOssFiles,
    buildUploadedAttachmentLinksForClient,
    saveUploadedFileContext,
    pruneUploadedFileContextsForSession,
    extractTextPartsForAliyunContext,
    buildAliyunDashScopeMediaPartsFromOssFiles,
    buildAliyunDashScopeRehydratedContent,
    rehydrateUploadedFileContexts,
    sanitizeVolcengineFileRefsPayload,
    sanitizePreparedAttachmentRefsPayload,
    sanitizePreparedAttachmentTokens,
    pruneExpiredChatPreparedAttachmentCache,
    trimChatPreparedAttachmentCache,
    createChatPreparedAttachmentToken,
    savePreparedAttachmentToCache,
    resolvePreparedAttachmentRefsFromCache,
    attachVolcengineFileRefsToLatestUserMessage,
    attachPreparedAttachmentPartsToLatestUserMessage,
    attachFilesToLatestUserMessage,
    stripAliyunDocumentUrlPartsFromMessages,
    isAliyunDashScopeUnsupportedNativeFileErrorText,
    resolveLatestUserMessage,
    buildInitialAttachmentParts,
    buildDataUrlForBuffer,
    resolveOpenRouterAudioFormat,
    resolveOpenRouterVideoMime,
    buildOpenRouterFileInputPart,
    resolveAliyunVideoMime,
    resolveAliyunDashScopeAttachmentUrl,
    buildAliyunDashScopeDocumentUrlPart,
    shouldForceAliyunDashScopeLocalParseForFile,
    renderPdfToAliyunDashScopeImagesWithPython,
    buildAliyunDashScopePdfImageParts,
    buildAliyunDashScopeFileInputParts,
    buildParsedFilePreviewTextPart,
    attachFilesToLatestUserMessageForOpenRouter,
    attachFilesToLatestUserMessageForAliyunDashScope,
    attachFilesToLatestUserMessageByLocalParsing,
    streamAgentEResponse,
    streamAgentResponse,
    streamSeedreamImageGeneration,
    buildSeedreamImageGenerationRequest,
    normalizeSeedreamGenerationModel,
    normalizeSeedreamSize,
    normalizeSeedreamSequentialMode,
    normalizeSeedreamResponseFormat,
    parseSeedreamImageInputs,
    isSeedreamImageInputUrl,
    buildSeedreamFileImageInputs,
    normalizeSeedreamImageMimeType,
    extractSeedreamImageResultEntries,
    pipeVolcengineImageGenerationSse,
    emitSeedreamImageGenerationNonStreamEvents,
    buildGeneratedImageHistoryExpireAt,
    normalizeGeneratedImageHistoryResponseFormat,
    normalizeGeneratedImageStoreUrl,
    normalizeGeneratedImageStorageType,
    normalizeGeneratedImageMimeType,
    extractGeneratedImageDataBuffer,
    parseGeneratedImageDataUrl,
    buildGeneratedImageHistoryContentPath,
    buildAdminGeneratedImageHistoryContentPath,
    parseTeacherScopedStorageUserId,
    resolveGeneratedImageOutputUrl,
    fetchGeneratedImageBinaryFromUrl,
    buildGeneratedImageBinaryPayload,
    saveGeneratedImageHistory,
    toGeneratedImageHistoryItem,
    toAdminGeneratedImageHistoryItem,
    sanitizeImageGenerationUsage,
    mapVolcengineImageGenerationEventError,
    buildImageGenerationHeaders,
    getVolcengineImageGenerationConfig,
    buildChatRequestPayload,
    buildOpenRouterPlugins,
    buildResponsesRequestPayload,
    resolveProviderWebSearchRuntime,
    resolveVolcengineWebSearchRuntime,
    buildWebSearchToolFromRuntimeConfig,
    resolveVolcengineWebSearchCapability,
    findVolcengineWebSearchCapabilityByModel,
    getNormalizedModelCandidates,
    readModelAllowlistFromEnv,
    matchModelCandidates,
    resolveRuntimeTokenProfileByModel,
    isVolcengineFixedSamplingModel,
    buildResponsesInputItems,
    normalizeResponsesMessageContent,
    keepVolcengineResponsesFileRefsOnly,
    extractInputImageUrl,
    extractInputVideoUrl,
    extractAliyunFileUrl,
    normalizeOpenRouterFilePart,
    normalizeOpenRouterAudioPart,
    mapReasoningEffortToResponses,
    supportsVolcengineResponsesReasoningEffort,
    resolveRequestProtocol,
    extractSmartContextIncrementalMessages,
    isPromptLeakProbeRequest,
    extractMessagePlainText,
    resolveSmartContextRuntime,
    readSessionContextRef,
    saveSessionContextRef,
    clearSessionContextRef,
    shouldResetSmartContextReference,
    pickRecentUserRounds,
    parseFileContent,
    classifyVolcengineFileInputType,
    normalizeMultipartUploadFile,
    uploadVolcengineMultipartFilesAsRefs,
    uploadVolcengineFileAndWaitActive,
    waitForVolcengineFileActive,
    retrieveVolcengineFileMeta,
    sleepMs,
    getFileExtension,
    normalizeMultipartFileName,
    isWordFile,
    isExcelFile,
    isPdfFile,
    isTextLikeFile,
    isProbablyBinary,
    decodeTextFile,
    parseDocx,
    parseExcel,
    normalizeRow,
    parsePdf,
    clipText,
    pipeOpenRouterSse,
    pipeResponsesSse,
    extractResponsesOutputTextFromCompleted,
    extractResponsesReasoningTextFromCompleted,
    extractResponsesTokenUsage,
    extractResponsesWebSearchUsage,
    extractNamedToolUsageCount,
    extractNamedToolUsageDetails,
    normalizeUsageCount,
    sumNumericUsage,
    sanitizeUsageCountNumber,
    formatWebSearchUsageText,
    extractResponsesErrorMessage,
    extractOpenRouterStreamErrorMessage,
    extractDeltaText,
    extractSseDataPayload,
    findSseEventBoundary,
    writeEvent,
    safeReadText,
    safeReadJson,
    getModelByAgent,
    getSystemPromptByAgent,
    getResolvedAgentRuntimeConfig,
    getDefaultSystemPrompt,
    readAdminAgentConfig,
    readAgentEConfig,
    writeAgentEConfig,
    sanitizeAdminClassroomTaskType,
    sanitizeAdminClassroomTaskPayload,
    sanitizeAdminClassroomCourseFilePayload,
    sanitizeAdminClassroomCourseFilesPayload,
    normalizeAdminClassroomLessonDateTimeInput,
    parseAdminClassroomLegacyCourseTimeRange,
    buildAdminClassroomCourseTimeText,
    sortAdminClassroomCoursePlans,
    sanitizeAdminClassroomCoursePlanPayload,
    sanitizeAdminClassroomCoursePlansPayload,
    createAdminClassroomLessonFileId,
    createClassroomHomeworkFileId,
    normalizeAdminClassroomLessonFileDoc,
    normalizeClassroomHomeworkFileDoc,
    compareClassroomRosterStudent,
    iterateAdminClassroomTaskFiles,
    collectAdminClassroomFileIdsFromLesson,
    findAdminClassroomLessonTaskById,
    findAdminClassroomLessonByFileId,
    normalizeAdminConfigDoc,
    sanitizeAgentPromptPayload,
    resolveAgentSystemPrompts,
    sanitizeAgentRuntimeConfigsPayload,
    sanitizeSingleAgentRuntimeConfig,
    resolveAgentRuntimeConfigs,
    normalizeRuntimeConfigFromPreset,
    getRuntimePresetDefaults,
    sanitizeRuntimeProtocol,
    sanitizeRuntimeProvider,
    sanitizeRuntimeModel,
    sanitizeOpenRouterPreset,
    sanitizeOpenRouterWebPluginEngine,
    sanitizeOpenRouterPdfEngine,
    sanitizeAliyunSearchStrategy,
    sanitizeAliyunSearchCitationFormat,
    sanitizeAliyunSearchFreshness,
    sanitizeAliyunAssignedSiteList,
    normalizeAliyunAssignedSite,
    sanitizeAliyunPromptIntervene,
    sanitizeAliyunFileProcessMode,
    sanitizeEnableThinking,
    sanitizeCreativityMode,
    sanitizeRuntimeNumber,
    sanitizeRuntimeInteger,
    sanitizeRuntimeBoolean,
    sanitizeReasoningEffort,
    sanitizeSmartContextMode,
    buildAdminAgentSettingsResponse,
    buildAgentProviderDefaults,
    buildAgentModelDefaults,
    sanitizeSystemPrompt,
    getProviderByAgent,
    resolveReasoningPolicy,
    modelSupportsReasoning,
    modelRequiresReasoning,
    providerSupportsReasoning,
    normalizeProvider,
    getProviderConfig,
    readEnvApiKey,
    isPlaceholderApiKey,
    buildProviderHeaders,
    extractRequestFailureCode,
    isRetryableRequestFailure,
    formatProviderRequestFailure,
    sendProviderRequestWithRetry,
    formatProviderUpstreamError,
    parseUpstreamErrorDetail,
    mapVolcengineUpstreamError,
    pruneExpiredUserOnlinePresence,
    markUserOnlinePresence,
    markUserOnlineBrowserHeartbeat,
    setUserOnlineSocketPresence,
    collectOnlinePresenceEntries,
    requireChatAuth,
    resolveImageHistoryAuthUserId,
    requireAdminAuth,
    readJsonLikeField,
    readRequestMessages,
    readRequestVolcengineFileRefs,
    readRequestPreparedAttachmentRefs,
    defaultChatState,
    readChatStateShape,
    readTeacherScopedChatStateRaw,
    normalizeChatStateDoc,
    getTeacherScopedChatStatePath,
    readTeacherScopedSessionContextRefs,
    sanitizeChatStatePayload,
    sanitizeChatStateMetaPayload,
    sanitizeSessionMessageUpsertsPayload,
    sanitizeSmartContextMapAgentId,
    buildSmartContextEnabledMapKey,
    sanitizeSmartContextEnabledBySessionAgent,
    sanitizeAgentBySession,
    sanitizeStateSettings,
    sanitizeGroups,
    sanitizeSessions,
    sanitizeSessionMessages,
    sanitizeMessage,
    resolveActiveId,
    sanitizeUserProfile,
    validateUserProfile,
    isUserProfileComplete,
    sanitizeId,
    sanitizePreparedAttachmentToken,
    sanitizeText,
    sanitizeIsoDate,
    sanitizeAgent,
    resolveTeacherScopedLockedAgentId,
    sanitizeReasoning,
    sanitizeNumber,
    sanitizeGroupChatRoomName,
    sanitizeGroupChatText,
    sanitizeGroupChatCode,
    sanitizeGroupChatAfterDate,
    buildGroupChatDisplayName,
    createGroupChatRoomCodeCandidate,
    generateUniqueGroupChatRoomCode,
    sanitizeGroupChatMemberUserIds,
    sanitizeGroupChatMutedMemberUserIds,
    normalizeGroupChatReadStates,
    getGroupChatOnlineUserIdsByRoom,
    normalizeGroupChatRoomDoc,
    isGroupChatMemberMuted,
    normalizeGroupChatFilesApiInputType,
    normalizeGroupChatFilesApiStatus,
    normalizeGroupChatFilesApiMeta,
    normalizeGroupChatFileOssMeta,
    isGroupChatFilesApiExpired,
    resolveGroupChatFileExtension,
    classifyGroupChatVolcengineSupportedInputType,
    normalizeGroupChatRoomFileItemFromMessageDoc,
    normalizeGroupChatMessageDoc,
    sanitizeGroupChatImageFileName,
    sanitizeGroupChatFileName,
    buildAttachmentContentDisposition,
    toAsciiHeaderFileName,
    encodeRfc5987ValueChars,
    sanitizeGroupChatFileMimeType,
    normalizeGroupChatUploadedFileName,
    decodeGroupChatMaybeUriComponent,
    decodeGroupChatMaybeRfc2047,
    decodeGroupChatLatin1ToUtf8,
    looksLikeGroupChatMojibake,
    scoreGroupChatFileNameCandidate,
    buildGroupChatFileExpireAt,
    sanitizeAliyunOssNetworkMode,
    resolveAliyunOssNetworkMode,
    buildGroupChatOssConfig,
    createGroupChatOssClient,
    createGroupChatOssClients,
    isGroupChatOssConnectionTimeoutError,
    isGroupChatOssAccessDeniedError,
    callGroupChatOssWithTimeoutFallback,
    sanitizeAliyunOssBucket,
    sanitizeAliyunOssRegion,
    sanitizeAliyunOssEndpoint,
    sanitizeAliyunOssObjectPrefix,
    sanitizeGroupChatFileStorageType,
    sanitizeGroupChatOssObjectKey,
    sanitizeGroupChatHttpUrl,
    resolveGroupChatOssBucketHost,
    normalizeGroupChatOssPublicEndpoint,
    encodeGroupChatOssObjectKeyPath,
    buildGroupChatOssObjectKey,
    sanitizeGroupChatOssScopeSegment,
    resolveFileExtensionByMimeType,
    buildRuntimeOssObjectKey,
    formatTeacherLessonOssTimeSegment,
    buildTeacherLessonOssLessonSegment,
    sanitizeStudentHomeworkOssFolderSegment,
    buildStudentHomeworkLessonFolderName,
    buildStudentHomeworkStudentFolderName,
    buildStudentHomeworkOssObjectKey,
    uploadTeacherLessonFileToOss,
    uploadStudentHomeworkFileToOss,
    uploadBufferToGroupChatOss,
    sanitizeChatAttachmentOssSource,
    uploadChatAttachmentsToOss,
    backupChatAttachmentsToOssInBackground,
    buildGroupChatOssObjectUrl,
    buildGroupChatFileSignedDownloadUrl,
    buildTeacherLessonFileDownloadUrl,
    buildGroupChatStoredFileStoragePayload,
    deleteGroupChatOssObject,
    readGroupChatOssStartupCheckConfig,
    buildGroupChatOssStartupProbeObjectKey,
    formatGroupChatOssError,
    runGroupChatOssStartupHealthCheck,
    deleteGroupChatStoredFileObjects,
    deleteGeneratedImageHistoryOssObjects,
    isGroupChatOssNotFoundError,
    findGroupChatStoredFileByRoomAndId,
    cleanupExpiredGroupChatStoredFiles,
    startGroupChatExpiredFileCleanupTask,
    cleanupExpiredGeneratedImageHistories,
    startGeneratedImageExpiredCleanupTask,
    migrateOssFilesToPermanentRetention,
    sanitizeGroupChatReactionEmoji,
    normalizeGroupChatReactions,
    toGroupChatDateTimestamp,
    collectGroupChatMemberUserIds,
    readGroupChatUsersByIds,
    createGroupChatSystemMessage,
    collectMentionNames,
    resolveGroupChatReplyMeta,
    buildGroupChatReadStateMap,
    buildGroupChatRoomReadStatesFromMap,
    updateGroupChatRoomReadState,
    markGroupChatRoomReadByMessageId,
    isMongoObjectIdLike,
    initGroupChatWebSocketServer,
    handleGroupChatWsMessage,
    handleGroupChatWsAuth,
    handleGroupChatWsJoinRoom,
    handleGroupChatWsLeaveRoom,
    readGroupChatWsPayload,
    sendGroupChatWsPayload,
    sendGroupChatWsError,
    closeGroupChatSocket,
    attachSocketToGroupChatRoom,
    detachSocketFromGroupChatRoom,
    detachSocketFromAllGroupChatRooms,
    clearGroupChatRoomSockets,
    broadcastGroupChatWsPayload,
    sendGroupChatWsPayloadToUserInRoom,
    broadcastGroupChatMemberPresenceUpdated,
    broadcastGroupChatRoomReadStateUpdated,
    broadcastGroupChatMessageCreated,
    broadcastGroupChatMessageReactionsUpdated,
    broadcastGroupChatMessageDeleted,
    broadcastGroupChatRoomUpdated,
    assertPartyAgentPanelRoomAccess,
    broadcastGroupChatRoomDissolved,
    broadcastGroupChatMemberJoined,
    startServer,
    runStartupMaintenanceTasks,
    ensureUploadedFileContextIndexes,
    ensureGeneratedImageHistoryIndexes,
    ensureGroupChatStoredFileIndexes,
    hasEquivalentMongoIndex,
    hasSameMongoIndexKey,
    readCollectionIndexesSafe,
    isMongoNamespaceMissingError,
    ensureUploadedFileContextTtlIndex,
    ensureGeneratedImageHistoryTtlIndex,
    ensureGroupChatStoredFileTtlIndex,
    findMongoIndexByKey,
    normalizeUsername,
    toUsernameKey,
    isReservedAdminUsernameKey,
    isFixedAdminUsernameKey,
    isFixedAdminUser,
    isFixedStudentUsernameKey,
    isFixedStudentUser,
    readLockedTeacherScopeKey,
    isJiaoji231ClassName,
    resolveLoginLockedTeacherScopeKey,
    validatePassword,
    hashPassword,
    verifyPassword,
    ensureFixedAdminAccounts,
    ensureFixedStudentAccounts,
    signToken,
    verifyToken,
    readBearerToken,
    authenticateAdminRequest,
    authenticateAdminRequestFromHeaderOrQuery,
    buildAdminUsersExportTxt,
    buildAdminChatsExportTxt,
    buildSingleUserChatExportTxt,
    appendUserChatSection,
    appendIndentedBlock,
    formatDisplayTime,
    formatSystemDateYmd,
    formatFileStamp,
    normalizeExportRole,
    normalizeFeedbackLabel,
    formatMaybeNumber,
    buildZipReadme,
    sanitizeZipFileNamePart,
    buildZipBuffer,
    sanitizeZipEntryName,
    toDosDateTime,
    crc32Buffer,
    createCrc32Table,
    toPublicUser,
  } = deps;

  const SESSION_TITLE_MODEL_AGENT_ID = "C";
  const DOCUMENT_PREVIEW_PDF_PAGE = Object.freeze({
    width: 595.28,
    height: 841.89,
    margin: 48,
    titleSize: 18,
    bodySize: 12,
    metaSize: 10,
    lineGap: 6,
  });

  function listDocumentPreviewFontCandidates() {
    const candidates = [
      process.env.EDUCHAT_PREVIEW_FONT_PATH,
      process.env.CHAT_PREVIEW_FONT_PATH,
      process.env.PDF_PREVIEW_FONT_PATH,
      process.env.HOME
        ? path.join(process.env.HOME, "Library/Fonts/SimSun.ttf")
        : "",
      process.env.HOME
        ? path.join(process.env.HOME, ".fonts/NotoSansCJK-Regular.ttc")
        : "",
      "/System/Library/Fonts/Hiragino Sans GB.ttc",
      "/System/Library/Fonts/STHeiti Medium.ttc",
      "/System/Library/Fonts/Supplemental/Songti.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
      "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
      "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
      "C:\\Windows\\Fonts\\simsun.ttc",
      "C:\\Windows\\Fonts\\msyh.ttc",
      "C:\\Windows\\Fonts\\simhei.ttf",
    ];
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  async function embedPreviewPdfFont(pdfDoc) {
    pdfDoc.registerFontkit(fontkit);
    const candidates = listDocumentPreviewFontCandidates();
    for (let index = 0; index < candidates.length; index += 1) {
      const candidatePath = candidates[index];
      if (!candidatePath || !existsSync(candidatePath)) continue;
      try {
        const fontBytes = await readFileAsync(candidatePath);
        const font = await pdfDoc.embedFont(fontBytes, { subset: true });
        return font;
      } catch {
        // Ignore invalid or unsupported font candidates.
      }
    }
    return pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  function normalizeDocumentPreviewText(value) {
    const text = String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\t/g, "  ");
    return text.trim();
  }

  function wrapPreviewPdfLine(text, font, fontSize, maxWidth) {
    const chars = Array.from(String(text || ""));
    if (chars.length === 0) return [""];
    const lines = [];
    let current = "";

    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index];
      const next = current + char;
      if (
        current &&
        font.widthOfTextAtSize(next, fontSize) > maxWidth
      ) {
        lines.push(current.replace(/\s+$/g, ""));
        current = char.trim() ? char : "";
        continue;
      }
      current = next;
    }

    if (current || lines.length === 0) {
      lines.push(current.replace(/\s+$/g, ""));
    }
    return lines;
  }

  async function buildDocumentPreviewPdfBuffer({
    fileName = "",
    sourceLabel = "文档预览",
    text = "",
  } = {}) {
    const pdfDoc = await PDFDocument.create();
    const font = await embedPreviewPdfFont(pdfDoc);
    const safeText =
      normalizeDocumentPreviewText(text) || "文档中没有可供预览的文本内容。";
    const safeFileName = sanitizeText(fileName, "document.docx", 180);
    const pageConfig = DOCUMENT_PREVIEW_PDF_PAGE;
    const maxWidth = pageConfig.width - pageConfig.margin * 2;
    const titleLines = wrapPreviewPdfLine(
      safeFileName,
      font,
      pageConfig.titleSize,
      maxWidth,
    );
    const bodyParagraphs = safeText.split(/\n{2,}/).map((item) => item.trim());
    const metaLine = `${sourceLabel} · 文本转 PDF 预览`;

    let page = pdfDoc.addPage([pageConfig.width, pageConfig.height]);
    let cursorY = pageConfig.height - pageConfig.margin;

    const ensureSpace = (requiredHeight) => {
      if (cursorY - requiredHeight >= pageConfig.margin) return;
      page = pdfDoc.addPage([pageConfig.width, pageConfig.height]);
      cursorY = pageConfig.height - pageConfig.margin;
    };

    const drawLine = (line, size, options = {}) => {
      ensureSpace(size + pageConfig.lineGap);
      page.drawText(line, {
        x: pageConfig.margin,
        y: cursorY - size,
        size,
        font,
        color: options.color || rgb(0.24, 0.22, 0.16),
      });
      cursorY -= size + pageConfig.lineGap;
    };

    titleLines.forEach((line) => {
      drawLine(line, pageConfig.titleSize, { color: rgb(0.18, 0.16, 0.12) });
    });
    cursorY -= 2;
    drawLine(metaLine, pageConfig.metaSize, { color: rgb(0.45, 0.42, 0.35) });
    cursorY -= 8;

    bodyParagraphs.forEach((paragraph, paragraphIndex) => {
      const lines = wrapPreviewPdfLine(
        paragraph || "",
        font,
        pageConfig.bodySize,
        maxWidth,
      );
      lines.forEach((line) => {
        drawLine(line || " ", pageConfig.bodySize);
      });
      if (paragraphIndex < bodyParagraphs.length - 1) {
        cursorY -= pageConfig.bodySize * 0.65;
      }
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  function resolveChatAttachmentLinkFromOssFiles(
    attachment,
    attachmentIndex,
    ossFiles = [],
  ) {
    const safeOssFiles = normalizeUploadedFileContextOssFiles(ossFiles);
    if (safeOssFiles.length === 0) return null;

    const attachmentName = sanitizeGroupChatFileName(attachment?.name);
    const attachmentMimeType = sanitizeGroupChatFileMimeType(attachment?.type);
    const attachmentSize = sanitizeRuntimeInteger(
      attachment?.size,
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const matchedByMeta =
      safeOssFiles.find((item) => {
        const sameName =
          sanitizeGroupChatFileName(item?.fileName) === attachmentName &&
          !!attachmentName;
        const sameMime =
          sanitizeGroupChatFileMimeType(item?.mimeType) === attachmentMimeType &&
          !!attachmentMimeType;
        const sameSize =
          sanitizeRuntimeInteger(item?.size, 0, 0, Number.MAX_SAFE_INTEGER) ===
            attachmentSize && attachmentSize > 0;
        return sameName || (sameMime && sameSize);
      }) || null;
    const matchedByIndex =
      !matchedByMeta &&
      attachmentIndex >= 0 &&
      attachmentIndex < safeOssFiles.length
        ? safeOssFiles[attachmentIndex]
        : null;
    const matched = matchedByMeta || matchedByIndex;
    if (!matched) return null;

    const ossKey = sanitizeGroupChatOssObjectKey(matched?.ossKey);
    const url = sanitizeGroupChatHttpUrl(matched?.fileUrl);
    if (!ossKey && !url) return null;
    return { ossKey, url };
  }

  function sanitizeSelectedContextFiles(raw) {
    let source = raw;
    if (typeof source === "string") {
      try {
        source = JSON.parse(source);
      } catch {
        source = [];
      }
    }
    const list = Array.isArray(source) ? source : [];
    return list
      .map((item) => {
        const messageId = sanitizeId(item?.messageId, "");
        const attachmentIndex = sanitizeRuntimeInteger(
          item?.attachmentIndex,
          -1,
          -1,
          7,
        );
        if (!messageId || attachmentIndex < 0) return null;
        const fileId = sanitizeText(item?.fileId, "", 160);
        const inputType = String(item?.inputType || "")
          .trim()
          .toLowerCase();
        const safeInputType =
          inputType === "input_file" ||
          inputType === "input_image" ||
          inputType === "input_video"
            ? inputType
            : "";
        return {
          key: sanitizeText(item?.key, "", 240),
          messageId,
          attachmentIndex,
          name: sanitizeGroupChatFileName(item?.name || "文件"),
          type: sanitizeGroupChatFileMimeType(item?.type),
          kind: sanitizeText(item?.kind, "", 24).toLowerCase(),
          fileId,
          inputType: safeInputType,
        };
      })
      .filter(Boolean);
  }

  function filterUploadedContextContentByFileName(content, fileName) {
    const normalized = normalizeMessageContent(content);
    const safeName = sanitizeGroupChatFileName(fileName);
    if (!Array.isArray(normalized) || !safeName) return [];

    return normalized
      .map((part) => {
        const type = String(part?.type || "")
          .trim()
          .toLowerCase();
        if (type !== "text") return null;
        const text = String(part?.text || "");
        if (!text.includes(`[附件: ${safeName}]`)) return null;
        return { type: "text", text };
      })
      .filter(Boolean);
  }

  async function injectSelectedContextFilesIntoMessages(
    messages,
    selectedContextFiles,
    {
      userId,
      sessionId,
      provider = "",
      protocol = "",
      agentId = "",
    } = {},
  ) {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const existingMessageIds = new Set(
      safeMessages.map((item) => sanitizeId(item?.id, "")).filter(Boolean),
    );
    const safeSelections = sanitizeSelectedContextFiles(selectedContextFiles).filter(
      (item) => !existingMessageIds.has(item.messageId),
    );
    if (safeMessages.length === 0 || safeSelections.length === 0) return;

    const latestUserMessage = resolveLatestUserMessage(safeMessages);
    if (!latestUserMessage) return;

    const directRefs = sanitizeVolcengineFileRefsPayload(
      safeSelections
        .map((item) => {
          if (!item.fileId || !item.inputType) return null;
          return {
            fileId: item.fileId,
            inputType: item.inputType,
          };
        })
        .filter(Boolean),
    );
    if (directRefs.length > 0) {
      attachVolcengineFileRefsToLatestUserMessage(safeMessages, directRefs);
    }

    const selectedMessageIds = Array.from(
      new Set(safeSelections.map((item) => item.messageId).filter(Boolean)),
    );
    if (selectedMessageIds.length === 0) return;

    let docs = [];
    try {
      docs = await UploadedFileContext.find(
        {
          userId: sanitizeId(userId, ""),
          sessionId: sanitizeId(sessionId, ""),
          messageId: { $in: selectedMessageIds },
          expiresAt: { $gt: new Date() },
        },
        { messageId: 1, content: 1, preparedAttachmentTokens: 1 },
      ).lean();
    } catch (error) {
      console.warn(
        `[chat-file-context] 读取已选文件上下文失败（${sessionId}）：`,
        error?.message || error,
      );
      return;
    }
    if (!Array.isArray(docs) || docs.length === 0) return;

    const docsByMessageId = new Map();
    docs.forEach((doc) => {
      const messageId = sanitizeId(doc?.messageId, "");
      if (!messageId) return;
      docsByMessageId.set(messageId, doc);
    });

    const appendEntries = [];
    const preparedTokenRefs = [];
    safeSelections.forEach((item) => {
      const doc = docsByMessageId.get(item.messageId);
      if (!doc) return;

      const matchingTextParts = filterUploadedContextContentByFileName(
        doc?.content,
        item.name,
      );
      if (matchingTextParts.length > 0) {
        appendEntries.push({ parts: matchingTextParts });
      }

      if (
        (item.kind === "pdf" || item.kind === "word") &&
        Array.isArray(doc?.preparedAttachmentTokens) &&
        doc.preparedAttachmentTokens.length > 0
      ) {
        doc.preparedAttachmentTokens.forEach((token) => {
          preparedTokenRefs.push({ token });
        });
      }
    });

    if (appendEntries.length > 0) {
      attachPreparedAttachmentPartsToLatestUserMessage(
        safeMessages,
        appendEntries,
      );
    }

    if (preparedTokenRefs.length > 0) {
      const preparedResolution = resolvePreparedAttachmentRefsFromCache({
        refs: preparedTokenRefs,
        userId,
        sessionId,
        provider,
        protocol,
        agentId,
      });
      if (Array.isArray(preparedResolution?.entries) && preparedResolution.entries.length > 0) {
        attachPreparedAttachmentPartsToLatestUserMessage(
          safeMessages,
          preparedResolution.entries,
        );
      }
    }
  }

  function buildSessionTitleQuestionText(question, answer) {
    const safeQuestion = sanitizeText(question, "", 600);
    const safeAnswer = sanitizeText(answer, "", 1200);
    return [
      "请根据下面这轮对话，生成一个简短、具体的中文会话标题。",
      "",
      "要求：",
      "1. 只输出标题本身，不要解释，不要引号，不要序号。",
      "2. 长度尽量控制在 6-18 个汉字。",
      "3. 重点体现用户真实意图，避免“新对话”“聊天记录”“问题咨询”这类泛化标题。",
      "",
      `用户问题：${safeQuestion || "（无）"}`,
      `助手回答：${safeAnswer || "（无）"}`,
    ].join("\n");
  }

  function normalizeGeneratedSessionTitle(title, fallback = "新对话") {
    const cleaned = sanitizeText(title, "", 80)
      .replace(/^["'“”‘’【\[]+|["'“”‘’】\]]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return fallback;
    const clipped = cleaned.length > 24 ? cleaned.slice(0, 24).trim() : cleaned;
    return clipped || fallback;
  }

  async function generateSessionTitleByModel({ question = "", answer = "" } = {}) {
    const runtimeConfig = await getResolvedAgentRuntimeConfig(SESSION_TITLE_MODEL_AGENT_ID);
    const provider = getProviderByAgent(SESSION_TITLE_MODEL_AGENT_ID, runtimeConfig);
    const model = getModelByAgent(SESSION_TITLE_MODEL_AGENT_ID, runtimeConfig);
    const protocol = resolveRequestProtocol(runtimeConfig.protocol, provider, model).value;
    const providerConfig = getProviderConfig(provider);
    const endpoint =
      protocol === "responses" ? providerConfig.responsesEndpoint : providerConfig.chatEndpoint;
    if (!endpoint || !providerConfig.apiKey) {
      throw new Error("标题生成模型未配置完成。");
    }

    const prompt = buildSessionTitleQuestionText(question, answer);
    const headers = buildProviderHeaders(provider, providerConfig.apiKey, protocol);
    let payload = null;

    if (protocol === "responses") {
      payload = {
        model,
        stream: false,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }],
          },
        ],
        instructions:
          "你是会话标题生成器。你只能输出一个简短中文标题，不要输出任何解释、标点装饰或多余内容。",
        max_output_tokens: 48,
        thinking: { type: "disabled" },
      };
    } else {
      payload = {
        model,
        stream: false,
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 48,
        messages: [
          {
            role: "system",
            content:
              "你是会话标题生成器。你只能输出一个简短中文标题，不要输出任何解释、标点装饰或多余内容。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      };
    }

    const upstream = await sendProviderRequestWithRetry({
      endpoint,
      headers,
      body: JSON.stringify(payload),
      provider,
      protocol,
    });

    if (!upstream.ok) {
      const detail = await safeReadText(upstream);
      throw new Error(
        formatProviderUpstreamError(provider, protocol, upstream.status, detail),
      );
    }

    const data = await safeReadJson(upstream);
    let rawTitle = "";
    if (protocol === "responses") {
      rawTitle = extractResponsesOutputTextFromCompleted(data);
    } else {
      const firstChoice = data?.choices?.[0] || {};
      rawTitle =
        extractDeltaText(firstChoice?.message?.content) ||
        extractDeltaText(firstChoice?.text) ||
        extractDeltaText(data?.output_text);
    }

    return normalizeGeneratedSessionTitle(rawTitle, "新对话");
  }

  app.post(
    "/api/auth/admin/agent-debug-stream",
    requireAdminAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      const agentId = sanitizeAgent(req.body?.agentId || "A");
      const sessionId = sanitizeId(req.body?.sessionId, `admin-debug-${agentId}`);
      const adminUserId = sanitizeId(req.authAdmin?._id, "admin");
      const messages = readRequestMessages(req.body?.messages);
      const runtimeConfig = sanitizeSingleAgentRuntimeConfig(
        readJsonLikeField(req.body?.runtimeConfig, {}),
        agentId,
      );
      const files = Array.isArray(req.files) ? req.files : [];
      const volcengineFileRefs = readRequestVolcengineFileRefs(
        req.body?.volcengineFileRefs,
      );
      const preparedAttachmentRefs = readRequestPreparedAttachmentRefs(
        req.body?.preparedAttachmentRefs,
      );

      await streamAgentResponse({
        res,
        agentId,
        messages,
        files,
        volcengineFileRefs,
        preparedAttachmentRefs,
        runtimeConfig,
        chatUserId: adminUserId,
        sessionId,
        attachUploadedFiles: files.length > 0 || preparedAttachmentRefs.length > 0,
      });
    },
  );

  app.post(
    "/api/auth/admin/agent-e/debug-stream",
    requireAdminAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      const sessionId = sanitizeId(req.body?.sessionId, "admin-debug-E");
      const adminUserId = sanitizeId(req.authAdmin?._id, "admin");
      const messages = readRequestMessages(req.body?.messages);
      const files = Array.isArray(req.files) ? req.files : [];
      const runtimeOverride = readJsonLikeField(req.body?.runtimeOverride, null);
      const volcengineFileRefs = readRequestVolcengineFileRefs(
        req.body?.volcengineFileRefs,
      );
      const preparedAttachmentRefs = readRequestPreparedAttachmentRefs(
        req.body?.preparedAttachmentRefs,
      );
      await streamAgentEResponse({
        res,
        messages,
        files,
        volcengineFileRefs,
        preparedAttachmentRefs,
        runtimeOverride,
        chatUserId: adminUserId,
        sessionId,
        attachUploadedFiles: files.length > 0 || preparedAttachmentRefs.length > 0,
      });
    },
  );

  app.post(
    "/api/auth/admin/volcengine-files/upload",
    requireAdminAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      const agentId = sanitizeAgent(req.body?.agentId || "A");
      const files = Array.isArray(req.files) ? req.files.filter(Boolean) : [];
      if (files.length === 0) {
        res.json({ ok: true, files: [] });
        return;
      }

      const runtimeConfig = await getResolvedAgentRuntimeConfig(agentId);
      const provider = getProviderByAgent(agentId, runtimeConfig);
      const protocol = resolveRequestProtocol(runtimeConfig.protocol, provider).value;
      if (provider !== "volcengine" || protocol !== "responses") {
        res.status(400).json({ error: "当前智能体不是火山引擎 Responses 协议，不能使用 Files API 上传。" });
        return;
      }

      const providerConfig = getProviderConfig("volcengine");
      if (!providerConfig.apiKey) {
        res.status(500).json({ error: providerConfig.missingKeyMessage });
        return;
      }
      if (!providerConfig.filesEndpoint) {
        res.status(500).json({ error: "未配置火山引擎 Files API 端点。" });
        return;
      }

      try {
        const model = getModelByAgent(agentId, runtimeConfig);
        const uploadedBundle = await uploadVolcengineMultipartFilesAsRefs({
          files,
          model,
          filesEndpoint: providerConfig.filesEndpoint,
          apiKey: providerConfig.apiKey,
          strictSupportedTypes: true,
        });
        const uploadedToOss = await uploadChatAttachmentsToOss({
          files: uploadedBundle.uploadedFiles,
          userId: "admin",
          sessionId: "",
          source: "admin-volcengine-files-api",
          stopOnError: false,
        });
        const refsWithOss = await Promise.all(
          uploadedBundle.uploadedRefs.map(async (item, idx) => {
            const oss = uploadedToOss[idx] || null;
            const ossKey = sanitizeGroupChatOssObjectKey(oss?.ossKey);
            const directUrl = sanitizeGroupChatHttpUrl(oss?.fileUrl);
            const signedUrl = ossKey
              ? await buildGroupChatFileSignedDownloadUrl({
                  ossKey,
                  fileName: String(item?.name || oss?.fileName || ""),
                })
              : "";
            return {
              ...item,
              url: sanitizeGroupChatHttpUrl(signedUrl || directUrl),
              ossKey,
            };
          }),
        );

        res.json({
          ok: true,
          files: refsWithOss,
        });
      } catch (error) {
        const message = error?.message || "火山文件上传失败，请稍后重试。";
        const status = String(message).includes("文件类型不支持 Files API 上传")
          ? 400
          : 500;
        res.status(status).json({
          error: message,
        });
      }
    },
  );

  app.post(
    "/api/auth/admin/attachments/prepare",
    requireAdminAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      const agentId = sanitizeAgent(req.body?.agentId || "A");
      const sessionId = sanitizeId(req.body?.sessionId, `admin-debug-${agentId}`);
      const userId = sanitizeId(req.authAdmin?._id, "admin");
      const files = Array.isArray(req.files) ? req.files.filter(Boolean) : [];
      if (files.length === 0) {
        res.json({ ok: true, files: [] });
        return;
      }

      const runtimeConfig = await getResolvedAgentRuntimeConfig(agentId);
      const provider = getProviderByAgent(agentId, runtimeConfig);
      const model = getModelByAgent(agentId, runtimeConfig);
      const protocol = resolveRequestProtocol(runtimeConfig.protocol, provider, model).value;
      const aliyunFileProcessMode = sanitizeAliyunFileProcessMode(
        runtimeConfig?.aliyunFileProcessMode,
      );
      if (provider !== "aliyun") {
        res.status(400).json({ error: "当前智能体不需要 PDF 预处理。" });
        return;
      }

      try {
        const preparedFiles = [];
        for (let idx = 0; idx < files.length; idx += 1) {
          const file = files[idx];
          const ext = getFileExtension(file?.originalname);
          const mime = sanitizeGroupChatFileMimeType(file?.mimetype);
          if (!isPdfFile(ext, mime)) {
            throw new Error("仅支持 PDF 预处理，请重新选择文件。");
          }
          if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0) {
            throw new Error("PDF 文件内容为空，无法预处理。");
          }

          const converted = await buildAliyunDashScopePdfImageParts(file, {
            userId,
            sessionId,
            ossScope: CHAT_PREPARED_PDF_IMAGE_OSS_SCOPE,
          });
          let parts = Array.isArray(converted?.parts) ? converted.parts : [];
          let fallbackApplied = false;
          if (parts.length === 0) {
            const fallback = await buildParsedFilePreviewTextPart(file, {
              maxChars: ALIYUN_DASHSCOPE_PARSED_DOC_MAX_CHARS,
            });
            if (fallback) {
              parts = [fallback];
              fallbackApplied = true;
            }
          }
          if (parts.length === 0) {
            throw new Error(converted?.error || "PDF 转图片失败，请稍后重试。");
          }

          const fileName = sanitizeGroupChatFileName(file?.originalname);
          const fileSize = sanitizeRuntimeInteger(
            file?.size,
            file?.buffer?.length,
            0,
            GROUP_CHAT_FILE_MAX_FILE_SIZE_BYTES,
          );
          const originalUploadedList = await uploadChatAttachmentsToOss({
            files: [file],
            userId,
            sessionId,
            source: "chat-attachments-prepare",
            stopOnError: false,
          });
          const originalUploaded = originalUploadedList[0] || null;
          const originalOssKey = sanitizeGroupChatOssObjectKey(originalUploaded?.ossKey);
          const originalDirectUrl = sanitizeGroupChatHttpUrl(originalUploaded?.fileUrl);
          const originalSignedUrl = originalOssKey
            ? await buildGroupChatFileSignedDownloadUrl({
                ossKey: originalOssKey,
                fileName,
              })
            : "";
          const token = savePreparedAttachmentToCache({
            userId,
            sessionId,
            provider,
            protocol,
            agentId,
            fileName,
            mimeType: mime,
            size: fileSize,
            parts,
            extra: {
              pageCount: Math.max(0, Number(converted?.pageCount) || 0),
              imageCount: parts.filter((item) => String(item?.type || "") === "image_url").length,
              fallbackApplied,
              aliyunFileProcessMode,
              ossFiles: normalizeUploadedFileContextOssFiles(converted?.ossFiles),
            },
          });
          if (!token) {
            throw new Error("PDF 预处理缓存失败，请稍后重试。");
          }
          const imageCount = parts.filter((item) => String(item?.type || "") === "image_url").length;
          preparedFiles.push({
            token,
            fileName,
            mimeType: mime,
            size: fileSize,
            ossKey: originalOssKey,
            url: sanitizeGroupChatHttpUrl(originalSignedUrl || originalDirectUrl),
            pageCount: Math.max(0, Number(converted?.pageCount) || 0),
            imageCount,
            fallbackApplied,
            expiresInMs: CHAT_PREPARED_ATTACHMENT_CACHE_TTL_MS,
          });
        }

        res.json({
          ok: true,
          files: preparedFiles,
        });
      } catch (error) {
        res.status(500).json({
          error: error?.message || "PDF 预处理失败，请稍后重试。",
        });
      }
    },
  );

  app.post(
    "/api/chat/sessions/suggest-title",
    requireChatAuth,
    async (req, res) => {
      const question = sanitizeText(req.body?.question, "", 600);
      const answer = sanitizeText(req.body?.answer, "", 1200);
      if (!question || !answer) {
        res.status(400).json({ error: "缺少用于生成标题的首轮问答内容。" });
        return;
      }

      try {
        const title = await generateSessionTitleByModel({
          question,
          answer,
        });
        res.json({
          ok: true,
          title,
        });
      } catch (error) {
        res.status(500).json({
          error: error?.message || "会话标题生成失败，请稍后重试。",
        });
      }
    },
  );

  app.post(
    "/api/chat/document-preview",
    requireChatAuth,
    upload.single("file"),
    async (req, res) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "缺少待预览文件。" });
        return;
      }

      const ext = getFileExtension(file?.originalname);
      const mime = sanitizeGroupChatFileMimeType(file?.mimetype);
      const safeFileName = sanitizeGroupChatFileName(file?.originalname || "document.pdf");
      const previewFileName = safeFileName.replace(/\.[a-z0-9]+$/i, "") || "document";
      const lowerExt = String(ext || "").toLowerCase();
      const isHtmlPreview =
        mime.includes("html") || lowerExt === "html" || lowerExt === "htm";
      const isMarkdownPreview =
        mime.includes("markdown") ||
        mime.includes("mdx") ||
        lowerExt === "md" ||
        lowerExt === "markdown" ||
        lowerExt === "mdown" ||
        lowerExt === "mkd";

      if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0) {
        res.status(400).json({ error: "文件内容为空，无法生成预览。" });
        return;
      }

      try {
        let pdfBuffer = Buffer.from([]);

        if (isPdfFile(ext, mime)) {
          pdfBuffer = file.buffer;
        } else if (isWordFile(ext, mime)) {
          if (String(ext || "").toLowerCase() === "doc") {
            res.status(400).json({
              error: "暂不支持旧版 .doc 生成预览，请先另存为 .docx 后重试。",
            });
            return;
          }

          const extracted = await mammoth.extractRawText({ buffer: file.buffer });
          pdfBuffer = await buildDocumentPreviewPdfBuffer({
            fileName: safeFileName,
            sourceLabel: "Word 文档",
            text: extracted?.value || "",
          });
        } else if (isHtmlPreview || isMarkdownPreview) {
          res.setHeader(
            "Content-Type",
            isHtmlPreview ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8",
          );
          res.setHeader(
            "Content-Disposition",
            buildAttachmentContentDisposition(safeFileName),
          );
          res.setHeader("Cache-Control", "private, no-store");
          res.send(file.buffer);
          return;
        } else {
          res.status(400).json({ error: "仅支持 PDF、Word、HTML 或 Markdown 文档预览。" });
          return;
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          buildAttachmentContentDisposition(`${previewFileName}.pdf`),
        );
        res.setHeader("Cache-Control", "private, no-store");
        res.send(pdfBuffer);
      } catch (error) {
        res.status(500).json({
          error: error?.message || "文档预览生成失败，请稍后重试。",
        });
      }
    },
  );

  app.get(
    "/api/chat/document-preview/attachment",
    requireChatAuth,
    async (req, res) => {
      const chatUserId = sanitizeId(req.authUser?._id, "");
      const storageUserId = sanitizeId(req.authStorageUserId || req.authUser?._id, "");
      const teacherScopeKey = sanitizeTeacherScopeKey(req.authTeacherScopeKey);
      const sessionId = sanitizeId(req.query?.sessionId, "");
      const messageId = sanitizeId(req.query?.messageId, "");
      const attachmentIndex = sanitizeRuntimeInteger(
        req.query?.attachmentIndex,
        -1,
        -1,
        7,
      );
      const fallbackFileName = sanitizeGroupChatFileName(req.query?.fileName || "聊天附件.bin");
      const fallbackMimeType = sanitizeGroupChatFileMimeType(req.query?.mimeType);
      const fallbackOssKey = sanitizeGroupChatOssObjectKey(req.query?.ossKey);
      const fallbackDirectUrl = sanitizeGroupChatHttpUrl(req.query?.url);

      if ((!chatUserId || !sessionId || !messageId || attachmentIndex < 0) && !fallbackOssKey && !fallbackDirectUrl) {
        res.status(400).json({ error: "无效参数。" });
        return;
      }

      let fileName = fallbackFileName;
      let mimeType = fallbackMimeType;
      let ossKey = fallbackOssKey;
      let directUrl = fallbackDirectUrl;

      if (chatUserId && sessionId && messageId && attachmentIndex >= 0) {
        const stateDoc = await ChatState.findOne(
          { userId: chatUserId },
          { sessionMessages: 1, teacherStates: 1 },
        ).lean();
        const currentState = normalizeChatStateDoc(stateDoc, teacherScopeKey);
        const currentMessages = Array.isArray(currentState.sessionMessages?.[sessionId])
          ? currentState.sessionMessages[sessionId]
          : [];
        const message =
          currentMessages.find((item) => sanitizeId(item?.id, "") === messageId) || null;

        if (message) {
          const attachments = Array.isArray(message.attachments) ? message.attachments : [];
          const attachment = attachments[attachmentIndex] || null;
          if (attachment) {
            fileName = sanitizeGroupChatFileName(
              attachment?.name || fileName || `聊天附件-${attachmentIndex + 1}.bin`,
            );
            mimeType = sanitizeGroupChatFileMimeType(attachment?.type || mimeType);
            ossKey = ossKey || sanitizeGroupChatOssObjectKey(attachment?.ossKey);
            directUrl = directUrl || sanitizeGroupChatHttpUrl(attachment?.url || attachment?.fileUrl);

            if (!ossKey || !directUrl) {
              const uploadedContextDoc = await UploadedFileContext.findOne({
                userId: storageUserId,
                sessionId,
                messageId,
              })
                .select({ ossFiles: 1 })
                .lean();
              const resolved = resolveChatAttachmentLinkFromOssFiles(
                attachment,
                attachmentIndex,
                uploadedContextDoc?.ossFiles,
              );
              if (resolved) {
                ossKey = ossKey || sanitizeGroupChatOssObjectKey(resolved.ossKey);
                directUrl = directUrl || sanitizeGroupChatHttpUrl(resolved.url);
              }
            }
          }
        }
      }

      const ext = getFileExtension(fileName);
      const lowerExt = String(ext || "").toLowerCase();
      const isHtmlPreview =
        mimeType.includes("html") || lowerExt === "html" || lowerExt === "htm";
      const isMarkdownPreview =
        mimeType.includes("markdown") ||
        mimeType.includes("mdx") ||
        lowerExt === "md" ||
        lowerExt === "markdown" ||
        lowerExt === "mdown" ||
        lowerExt === "mkd";

      const downloadUrl =
        (ossKey
          ? await buildTeacherLessonFileDownloadUrl({
              ossKey,
              fileName,
            })
          : "") ||
        directUrl ||
        (ossKey ? buildGroupChatOssObjectUrl(ossKey) : "");

      if (!downloadUrl) {
        res.status(404).json({ error: "附件缺少可预览地址。" });
        return;
      }

      try {
        const upstream = await fetch(downloadUrl);
        if (!upstream.ok) {
          throw new Error(`预览文件下载失败（${upstream.status}）`);
        }
        const fileBuffer = Buffer.from(await upstream.arrayBuffer());
        if (!fileBuffer.length) {
          throw new Error("附件内容为空，无法预览。");
        }

        if (isPdfFile(ext, mimeType)) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            buildAttachmentContentDisposition(fileName),
          );
          res.setHeader("Cache-Control", "private, no-store");
          res.send(fileBuffer);
          return;
        }

        if (isWordFile(ext, mimeType)) {
          if (String(ext || "").toLowerCase() === "doc") {
            res.status(400).json({
              error: "暂不支持旧版 .doc 生成预览，请先另存为 .docx 后重试。",
            });
            return;
          }
          const extracted = await mammoth.extractRawText({ buffer: fileBuffer });
          const previewPdf = await buildDocumentPreviewPdfBuffer({
            fileName,
            sourceLabel: "Word 文档",
            text: extracted?.value || "",
          });
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            buildAttachmentContentDisposition(`${fileName.replace(/\.[a-z0-9]+$/i, "") || "document"}.pdf`),
          );
          res.setHeader("Cache-Control", "private, no-store");
          res.send(previewPdf);
          return;
        }

        if (isHtmlPreview || isMarkdownPreview) {
          res.setHeader(
            "Content-Type",
            isHtmlPreview ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8",
          );
          res.setHeader("Cache-Control", "private, no-store");
          res.send(fileBuffer);
          return;
        }

        res.status(400).json({ error: "当前附件类型暂不支持预览。" });
      } catch (error) {
        res.status(500).json({
          error: error?.message || "附件预览生成失败，请稍后重试。",
        });
      }
    },
  );

  app.post(
    "/api/chat/volcengine-files/upload",
    requireChatAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      const agentId = sanitizeAgent(req.body?.agentId || "A");
      const userId = sanitizeId(req.authStorageUserId || req.authUser?._id, "");
      const files = Array.isArray(req.files) ? req.files.filter(Boolean) : [];
      if (files.length === 0) {
        res.json({ ok: true, files: [] });
        return;
      }

      const runtimeConfig = await getResolvedAgentRuntimeConfig(agentId);
      const provider = getProviderByAgent(agentId, runtimeConfig);
      const protocol = resolveRequestProtocol(runtimeConfig.protocol, provider).value;
      if (provider !== "volcengine" || protocol !== "responses") {
        res.status(400).json({ error: "当前智能体不是火山引擎 Responses 协议，不能使用 Files API 上传。" });
        return;
      }

      const providerConfig = getProviderConfig("volcengine");
      if (!providerConfig.apiKey) {
        res.status(500).json({ error: providerConfig.missingKeyMessage });
        return;
      }
      if (!providerConfig.filesEndpoint) {
        res.status(500).json({ error: "未配置火山引擎 Files API 端点。" });
        return;
      }

      try {
        const model = getModelByAgent(agentId, runtimeConfig);
        const uploadedBundle = await uploadVolcengineMultipartFilesAsRefs({
          files,
          model,
          filesEndpoint: providerConfig.filesEndpoint,
          apiKey: providerConfig.apiKey,
          strictSupportedTypes: true,
        });
        const uploadedToOss = await uploadChatAttachmentsToOss({
          files: uploadedBundle.uploadedFiles,
          userId,
          sessionId: "",
          source: "chat-volcengine-files-api",
          stopOnError: false,
        });
        const refsWithOss = await Promise.all(
          uploadedBundle.uploadedRefs.map(async (item, idx) => {
            const oss = uploadedToOss[idx] || null;
            const ossKey = sanitizeGroupChatOssObjectKey(oss?.ossKey);
            const directUrl = sanitizeGroupChatHttpUrl(oss?.fileUrl);
            const signedUrl = ossKey
              ? await buildGroupChatFileSignedDownloadUrl({
                  ossKey,
                  fileName: String(item?.name || oss?.fileName || ""),
                })
              : "";
            return {
              ...item,
              url: sanitizeGroupChatHttpUrl(signedUrl || directUrl),
              ossKey,
            };
          }),
        );

        res.json({
          ok: true,
          files: refsWithOss,
        });
      } catch (error) {
        const message = error?.message || "火山文件上传失败，请稍后重试。";
        const status = String(message).includes("文件类型不支持 Files API 上传")
          ? 400
          : 500;
        res.status(status).json({
          error: message,
        });
      }
    },
  );

  app.post(
    "/api/chat/attachments/prepare",
    requireChatAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      const agentId = sanitizeAgent(req.body?.agentId || "A");
      const sessionId = sanitizeId(req.body?.sessionId, "");
      const userId = sanitizeId(req.authStorageUserId || req.authUser?._id, "");
      if (!userId) {
        res.status(400).json({ error: "无效用户身份。" });
        return;
      }

      const files = Array.isArray(req.files) ? req.files.filter(Boolean) : [];
      if (files.length === 0) {
        res.json({ ok: true, files: [] });
        return;
      }

      const runtimeConfig = await getResolvedAgentRuntimeConfig(agentId);
      const provider = getProviderByAgent(agentId, runtimeConfig);
      const model = getModelByAgent(agentId, runtimeConfig);
      const protocol = resolveRequestProtocol(runtimeConfig.protocol, provider, model).value;
      const aliyunFileProcessMode = sanitizeAliyunFileProcessMode(
        runtimeConfig?.aliyunFileProcessMode,
      );
      if (provider !== "aliyun") {
        res.status(400).json({ error: "当前智能体不需要 PDF 预处理。" });
        return;
      }

      try {
        const preparedFiles = [];
        for (let idx = 0; idx < files.length; idx += 1) {
          const file = files[idx];
          const ext = getFileExtension(file?.originalname);
          const mime = sanitizeGroupChatFileMimeType(file?.mimetype);
          if (!isPdfFile(ext, mime)) {
            throw new Error("仅支持 PDF 预处理，请重新选择文件。");
          }
          if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0) {
            throw new Error("PDF 文件内容为空，无法预处理。");
          }

          const converted = await buildAliyunDashScopePdfImageParts(file, {
            userId,
            sessionId,
            ossScope: CHAT_PREPARED_PDF_IMAGE_OSS_SCOPE,
          });
          let parts = Array.isArray(converted?.parts) ? converted.parts : [];
          let fallbackApplied = false;
          if (parts.length === 0) {
            const fallback = await buildParsedFilePreviewTextPart(file, {
              maxChars: ALIYUN_DASHSCOPE_PARSED_DOC_MAX_CHARS,
            });
            if (fallback) {
              parts = [fallback];
              fallbackApplied = true;
            }
          }
          if (parts.length === 0) {
            throw new Error(converted?.error || "PDF 转图片失败，请稍后重试。");
          }

          const fileName = sanitizeGroupChatFileName(file?.originalname);
          const fileSize = sanitizeRuntimeInteger(
            file?.size,
            file?.buffer?.length,
            0,
            GROUP_CHAT_FILE_MAX_FILE_SIZE_BYTES,
          );
          const originalUploadedList = await uploadChatAttachmentsToOss({
            files: [file],
            userId,
            sessionId,
            source: "chat-attachments-prepare",
            stopOnError: false,
          });
          const originalUploaded = originalUploadedList[0] || null;
          const originalOssKey = sanitizeGroupChatOssObjectKey(originalUploaded?.ossKey);
          const originalDirectUrl = sanitizeGroupChatHttpUrl(originalUploaded?.fileUrl);
          const originalSignedUrl = originalOssKey
            ? await buildGroupChatFileSignedDownloadUrl({
                ossKey: originalOssKey,
                fileName,
              })
            : "";
          const token = savePreparedAttachmentToCache({
            userId,
            sessionId,
            provider,
            protocol,
            agentId,
            fileName,
            mimeType: mime,
            size: fileSize,
            parts,
            extra: {
              pageCount: Math.max(0, Number(converted?.pageCount) || 0),
              imageCount: parts.filter((item) => String(item?.type || "") === "image_url").length,
              fallbackApplied,
              aliyunFileProcessMode,
              ossFiles: normalizeUploadedFileContextOssFiles(converted?.ossFiles),
            },
          });
          if (!token) {
            throw new Error("PDF 预处理缓存失败，请稍后重试。");
          }
          const imageCount = parts.filter((item) => String(item?.type || "") === "image_url").length;
          preparedFiles.push({
            token,
            fileName,
            mimeType: mime,
            size: fileSize,
            ossKey: originalOssKey,
            url: sanitizeGroupChatHttpUrl(originalSignedUrl || originalDirectUrl),
            pageCount: Math.max(0, Number(converted?.pageCount) || 0),
            imageCount,
            fallbackApplied,
            expiresInMs: CHAT_PREPARED_ATTACHMENT_CACHE_TTL_MS,
          });
        }

        res.json({
          ok: true,
          files: preparedFiles,
        });
      } catch (error) {
        res.status(500).json({
          error: error?.message || "PDF 预处理失败，请稍后重试。",
        });
      }
    },
  );

  app.post(
    "/api/chat/stream",
    requireChatAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      if ((await assertPartyAgentPanelRoomAccess(req, res)) === false) return;
      const requestedAgentId = sanitizeAgent(req.body?.agentId || "A");
      const teacherScopedLockedAgentId = resolveTeacherScopedLockedAgentId(
        req.authTeacherScopeKey,
      );
      const agentId = teacherScopedLockedAgentId || requestedAgentId;
      const sessionId = sanitizeId(req.body?.sessionId, "");
      const requestedSmartContextEnabled = sanitizeRuntimeBoolean(
        req.body?.smartContextEnabled,
        false,
      );
      const smartContextEnabled = teacherScopedLockedAgentId
        ? true
        : requestedSmartContextEnabled;
      const contextMode = sanitizeSmartContextMode(req.body?.contextMode);
      const volcengineFileRefs = readRequestVolcengineFileRefs(
        req.body?.volcengineFileRefs,
      );
      const preparedAttachmentRefs = readRequestPreparedAttachmentRefs(
        req.body?.preparedAttachmentRefs,
      );
      const selectedContextFiles = sanitizeSelectedContextFiles(
        req.body?.selectedContextFiles,
      );
      let messages = [];
      try {
        messages = JSON.parse(req.body.messages || "[]");
      } catch {
        res.status(400).json({ error: "Invalid messages JSON" });
        return;
      }

      if (selectedContextFiles.length > 0) {
        const runtimeConfig = await getResolvedAgentRuntimeConfig(agentId);
        const provider = getProviderByAgent(agentId, runtimeConfig);
        const model = getModelByAgent(agentId, runtimeConfig);
        const protocol = resolveRequestProtocol(
          runtimeConfig.protocol,
          provider,
          model,
        ).value;
        await injectSelectedContextFilesIntoMessages(messages, selectedContextFiles, {
          userId: String(req.authStorageUserId || req.authUser?._id || ""),
          sessionId,
          provider,
          protocol,
          agentId,
        });
      }

      await streamAgentResponse({
        res,
        agentId,
        messages,
        files: req.files || [],
        chatUserId: String(req.authUser?._id || ""),
        chatStorageUserId: String(req.authStorageUserId || ""),
        teacherScopeKey: req.authTeacherScopeKey,
        sessionId,
        smartContextEnabled,
        contextMode,
        attachUploadedFiles: true,
        volcengineFileRefs,
        preparedAttachmentRefs,
      });
    },
  );

  app.post(
    "/api/chat/stream-e",
    requireChatAuth,
    upload.array("files", MAX_FILES),
    async (req, res) => {
      if ((await assertPartyAgentPanelRoomAccess(req, res)) === false) return;
      const teacherScopedLockedAgentId = resolveTeacherScopedLockedAgentId(
        req.authTeacherScopeKey,
      );
      if (teacherScopedLockedAgentId && teacherScopedLockedAgentId !== AGENT_E_ID) {
        res.status(403).json({ error: "当前授课教师已锁定“远程教育”智能体。" });
        return;
      }
      const sessionId = sanitizeId(req.body?.sessionId, "");
      const smartContextEnabled = sanitizeRuntimeBoolean(req.body?.smartContextEnabled, false);
      const contextMode = sanitizeSmartContextMode(req.body?.contextMode);
      const volcengineFileRefs = readRequestVolcengineFileRefs(
        req.body?.volcengineFileRefs,
      );
      const preparedAttachmentRefs = readRequestPreparedAttachmentRefs(
        req.body?.preparedAttachmentRefs,
      );
      const selectedContextFiles = sanitizeSelectedContextFiles(
        req.body?.selectedContextFiles,
      );
      let messages = [];
      try {
        messages = JSON.parse(req.body.messages || "[]");
      } catch {
        res.status(400).json({ error: "Invalid messages JSON" });
        return;
      }

      if (selectedContextFiles.length > 0) {
        const runtimeConfig = await getResolvedAgentRuntimeConfig(AGENT_E_ID);
        const provider = getProviderByAgent(AGENT_E_ID, runtimeConfig);
        const model = getModelByAgent(AGENT_E_ID, runtimeConfig);
        const protocol = resolveRequestProtocol(
          runtimeConfig.protocol,
          provider,
          model,
        ).value;
        await injectSelectedContextFilesIntoMessages(messages, selectedContextFiles, {
          userId: String(req.authStorageUserId || req.authUser?._id || ""),
          sessionId,
          provider,
          protocol,
          agentId: AGENT_E_ID,
        });
      }

      await streamAgentEResponse({
        res,
        messages,
        files: req.files || [],
        chatUserId: String(req.authUser?._id || ""),
        chatStorageUserId: String(req.authStorageUserId || ""),
        teacherScopeKey: req.authTeacherScopeKey,
        sessionId,
        smartContextEnabled,
        contextMode,
        attachUploadedFiles: true,
        volcengineFileRefs,
        preparedAttachmentRefs,
      });
    },
  );

  app.post(
    "/api/images/seedream/stream",
    requireChatAuth,
    imageGenerationUpload.array("images", MAX_IMAGE_GENERATION_INPUT_FILES),
    async (req, res) => {
      await streamSeedreamImageGeneration({
        res,
        body: req.body || {},
        files: req.files || [],
        chatUserId: String(req.authUser?._id || ""),
        chatStorageUserId: String(req.authStorageUserId || ""),
        teacherScopeKey: req.authTeacherScopeKey,
      });
    },
  );

  app.get("/api/images/history", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authStorageUserId || req.authUser?._id, "");
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }

    const limit = sanitizeRuntimeInteger(req.query?.limit, 80, 1, 200);
    let docs = [];
    try {
      docs = await GeneratedImageHistory.find(
        {
          userId,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        },
        {
          prompt: 1,
          imageUrl: 1,
          imageStorageType: 1,
          responseFormat: 1,
          size: 1,
          model: 1,
          createdAt: 1,
        },
      )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取图片历史失败，请稍后重试。",
      });
      return;
    }

    res.json({
      ok: true,
      items: Array.isArray(docs) ? docs.map(toGeneratedImageHistoryItem) : [],
    });
  });

  app.get("/api/images/history/:imageId/content", async (req, res) => {
    const userId = resolveImageHistoryAuthUserId(req);
    const imageId = sanitizeId(req.params?.imageId, "");
    if (!userId || !imageId) {
      res.status(401).json({ error: "登录状态无效或已过期，请重新登录。" });
      return;
    }

    try {
      const doc = await GeneratedImageHistory.findOne(
        {
          _id: imageId,
          userId,
        },
        {
          imageUrl: 1,
          ossKey: 1,
          imageData: 1,
          imageMimeType: 1,
          imageStorageType: 1,
          expiresAt: 1,
        },
      ).lean();
      if (!doc) {
        res.status(404).json({ error: "图片不存在或已过期。" });
        return;
      }

      const expiresAt = sanitizeIsoDate(doc?.expiresAt);
      const imageStorageType = normalizeGeneratedImageStorageType(doc?.imageStorageType);
      if (imageStorageType !== "oss" && expiresAt && Date.parse(expiresAt) <= Date.now()) {
        res.status(410).json({ error: "图片已过期。" });
        return;
      }

      const ossKey = sanitizeGroupChatOssObjectKey(doc?.ossKey);
      if (ossKey) {
        const ossUrl =
          sanitizeGroupChatHttpUrl(doc?.imageUrl) || buildGroupChatOssObjectUrl(ossKey);
        if (/^https?:\/\//i.test(ossUrl)) {
          res.redirect(ossUrl);
          return;
        }
      }

      const imageBuffer = extractGeneratedImageDataBuffer(doc?.imageData);
      const imageMimeType = normalizeGeneratedImageMimeType(doc?.imageMimeType);
      if (imageBuffer.length > 0) {
        res.setHeader("Content-Type", imageMimeType || "image/png");
        res.setHeader("Content-Length", String(imageBuffer.length));
        res.setHeader("Cache-Control", "private, no-store");
        res.send(imageBuffer);
        return;
      }

      const fallbackUrl = normalizeGeneratedImageStoreUrl(doc?.imageUrl || "");
      if (/^https?:\/\//i.test(fallbackUrl)) {
        res.redirect(fallbackUrl);
        return;
      }
      const fallbackParsedDataUrl = parseGeneratedImageDataUrl(fallbackUrl);
      if (fallbackParsedDataUrl) {
        res.setHeader("Content-Type", fallbackParsedDataUrl.mimeType || "image/png");
        res.setHeader("Content-Length", String(fallbackParsedDataUrl.data.length));
        res.setHeader("Cache-Control", "private, no-store");
        res.send(fallbackParsedDataUrl.data);
        return;
      }

      res.status(404).json({ error: "图片不存在或已过期。" });
    } catch (error) {
      if (String(error?.name || "") === "CastError") {
        res.status(400).json({ error: "无效图片 ID。" });
        return;
      }
      res.status(500).json({
        error: error?.message || "读取图片内容失败，请稍后重试。",
      });
    }
  });

  app.delete("/api/images/history", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authStorageUserId || req.authUser?._id, "");
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }

    try {
      const historyDocs = await GeneratedImageHistory.find(
        { userId },
        { _id: 1, ossKey: 1 },
      ).lean();
      const deleteOssSummary = await deleteGeneratedImageHistoryOssObjects(historyDocs);
      const result = await GeneratedImageHistory.deleteMany({ userId });
      res.json({
        ok: true,
        deletedCount: Number(result?.deletedCount || 0),
        deletedOssObjectCount: Number(deleteOssSummary?.deletedCount || 0),
        failedOssKeys: Array.isArray(deleteOssSummary?.failedKeys)
          ? deleteOssSummary.failedKeys
          : [],
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "批量清空图片历史失败，请稍后重试。",
      });
    }
  });

  app.delete("/api/images/history/:imageId", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authStorageUserId || req.authUser?._id, "");
    const imageId = sanitizeId(req.params?.imageId, "");
    if (!userId || !imageId) {
      res.status(400).json({ error: "无效参数。" });
      return;
    }

    try {
      const deleted = await GeneratedImageHistory.findOneAndDelete({
        _id: imageId,
        userId,
      }, {
        projection: {
          _id: 1,
          ossKey: 1,
        },
      });
      const deleteOssSummary = await deleteGeneratedImageHistoryOssObjects(
        deleted ? [deleted] : [],
      );
      res.json({
        ok: true,
        deleted: !!deleted,
        deletedOssObjectCount: Number(deleteOssSummary?.deletedCount || 0),
        failedOssKeys: Array.isArray(deleteOssSummary?.failedKeys)
          ? deleteOssSummary.failedKeys
          : [],
      });
    } catch (error) {
      if (String(error?.name || "") === "CastError") {
        res.status(400).json({ error: "无效图片 ID。" });
        return;
      }
      res.status(500).json({
        error: error?.message || "删除图片历史失败，请稍后重试。",
      });
    }
  });
}
