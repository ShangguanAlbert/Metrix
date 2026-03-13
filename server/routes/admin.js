export function registerAdminRoutes(app, deps) {
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

  app.get("/api/auth/admin/agent-e/settings", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const config = await readAgentEConfig();
    res.json(buildAgentEAdminSettingsResponse(config));
  });

  app.put("/api/auth/admin/agent-e/settings", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const next = await writeAgentEConfig(req.body || {});
    res.json(buildAgentEAdminSettingsResponse(next));
  });

  app.get("/api/auth/admin/agent-e/skills", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const config = await readAgentEConfig();
    const payload = buildAgentEAdminSettingsResponse(config);
    res.json({
      ok: true,
      skills: payload.config.skills,
      availableSkills: payload.availableSkills,
      updatedAt: payload.config.updatedAt,
    });
  });

  app.put("/api/auth/admin/agent-e/skills", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const config = await readAgentEConfig();
    const next = await writeAgentEConfig({
      ...config,
      skills: Array.isArray(req.body?.skills) ? req.body.skills : [],
    });
    const payload = buildAgentEAdminSettingsResponse(next);
    res.json({
      ok: true,
      skills: payload.config.skills,
      availableSkills: payload.availableSkills,
      updatedAt: payload.config.updatedAt,
    });
  });

  app.get("/api/auth/admin/me", async (req, res) => {
    const admin = await authenticateAdminRequest(req, res);
    if (!admin) return;

    res.json({
      ok: true,
      admin: {
        id: String(admin?._id || ""),
        username: admin?.username || "",
        role: admin?.role || "admin",
        createdAt: sanitizeIsoDate(admin?.createdAt),
        updatedAt: sanitizeIsoDate(admin?.updatedAt),
      },
      adminUsernames: FIXED_ADMIN_ACCOUNTS.map((item) => item.username),
    });
  });

  app.get("/api/auth/admin/users", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;

    const users = await AuthUser.find({ role: "user" })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    res.json({
      ok: true,
      users: users.map((item) => ({
        username: item.username,
        role: item.role,
        password: item.passwordPlain || "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  });

  app.get("/api/auth/admin/group-chat/rooms", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;

    const adminOrderMap = new Map(
      FIXED_ADMIN_ACCOUNTS.map((item, idx) => [toUsernameKey(item?.username), idx]),
    );
    const adminDefaultOrder = FIXED_ADMIN_ACCOUNTS.length + 200;
    const adminFallbackOrder = FIXED_ADMIN_ACCOUNTS.length + 80;

    const resolveAdminOrder = (user = null) => {
      if (!user || user.role !== "admin") return adminDefaultOrder;
      const usernameKey =
        toUsernameKey(user.username) ||
        toUsernameKey(user.usernameKey) ||
        toUsernameKey(user.displayName);
      if (adminOrderMap.has(usernameKey)) {
        return adminOrderMap.get(usernameKey);
      }
      return adminFallbackOrder;
    };

    const buildMemberItem = (userId, usersById) => {
      const safeUserId = sanitizeId(userId, "");
      const user = usersById.get(safeUserId);
      if (!safeUserId) return null;
      if (!user) {
        return {
          id: safeUserId,
          username: "",
          displayName: "未知用户",
          role: "",
          className: "",
          studentId: "",
          adminOrder: adminDefaultOrder,
        };
      }

      const profile = sanitizeUserProfile(user?.profile);
      const username = sanitizeText(user?.username, "", 64);
      const displayName = sanitizeText(
        profile.name || username,
        username || "未知用户",
        64,
      );
      return {
        id: safeUserId,
        username,
        displayName,
        role: sanitizeText(user?.role, "", 20),
        className: sanitizeText(profile.className, "", 40),
        studentId: sanitizeText(profile.studentId, "", 20),
        adminOrder: resolveAdminOrder({
          role: user?.role,
          username,
          usernameKey: user?.usernameKey,
          displayName,
        }),
      };
    };

    try {
      const rawRooms = await GroupChatRoom.find(
        {},
        {
          roomCode: 1,
          name: 1,
          ownerUserId: 1,
          memberUserIds: 1,
          partyAgentMemberEnabled: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      )
        .sort({ updatedAt: -1, _id: 1 })
        .lean();
      const rooms = (Array.isArray(rawRooms) ? rawRooms : [])
        .map((room) => normalizeGroupChatRoomDoc(room))
        .filter(Boolean);

      const userIdSet = new Set();
      rooms.forEach((room) => {
        const ownerUserId = sanitizeId(room?.ownerUserId, "");
        if (ownerUserId) userIdSet.add(ownerUserId);
        sanitizeGroupChatMemberUserIds(room?.memberUserIds).forEach((userId) => {
          userIdSet.add(userId);
        });
      });

      const users = userIdSet.size
        ? await AuthUser.find(
            { _id: { $in: Array.from(userIdSet) } },
            { username: 1, usernameKey: 1, profile: 1, role: 1 },
          ).lean()
        : [];
      const usersById = new Map(
        users.map((user) => [sanitizeId(user?._id, ""), user]),
      );

      const payloadRooms = rooms
        .map((room) => {
          const roomId = sanitizeId(room?.id, "");
          if (!roomId) return null;
          const ownerUserId = sanitizeId(room?.ownerUserId, "");
          const owner = buildMemberItem(ownerUserId, usersById);
          const ownerSortOrder = owner?.adminOrder ?? adminDefaultOrder;
          const members = sanitizeGroupChatMemberUserIds(room?.memberUserIds)
            .map((memberId) => buildMemberItem(memberId, usersById))
            .filter(Boolean)
            .sort((a, b) => {
              if (a.id === ownerUserId) return -1;
              if (b.id === ownerUserId) return 1;
              if (a.adminOrder !== b.adminOrder) return a.adminOrder - b.adminOrder;
              return String(a.displayName || "").localeCompare(
                String(b.displayName || ""),
                "zh-CN",
                { sensitivity: "base" },
              );
            });

          if (owner && !members.some((member) => member.id === owner.id)) {
            members.unshift(owner);
          }

          return {
            id: roomId,
            roomCode: sanitizeText(room?.roomCode, "", 32),
            name: sanitizeText(room?.name, "未命名派", 80),
            partyAgentMemberEnabled: sanitizeRuntimeBoolean(room?.partyAgentMemberEnabled, true),
            memberCount: members.length,
            owner,
            members,
            createdAt: sanitizeIsoDate(room?.createdAt),
            updatedAt: sanitizeIsoDate(room?.updatedAt),
            ownerAdminSortOrder: ownerSortOrder,
          };
        })
        .filter(Boolean);

      payloadRooms.sort((a, b) => {
        if (a.ownerAdminSortOrder !== b.ownerAdminSortOrder) {
          return a.ownerAdminSortOrder - b.ownerAdminSortOrder;
        }
        const ownerCompare = String(a.owner?.displayName || "").localeCompare(
          String(b.owner?.displayName || ""),
          "zh-CN",
          { sensitivity: "base" },
        );
        if (ownerCompare !== 0) return ownerCompare;
        const updatedDiff =
          (Date.parse(String(b.updatedAt || "")) || 0) -
          (Date.parse(String(a.updatedAt || "")) || 0);
        if (updatedDiff !== 0) return updatedDiff;
        return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN", {
          sensitivity: "base",
        });
      });

      res.json({
        ok: true,
        updatedAt: new Date().toISOString(),
        totalRoomCount: payloadRooms.length,
        rooms: payloadRooms,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取群聊派列表失败，请稍后重试。",
      });
    }
  });

  app.delete("/api/auth/admin/group-chat/rooms/:roomId", async (req, res) => {
    const admin = await authenticateAdminRequest(req, res);
    if (!admin) return;

    const roomId = sanitizeId(req.params?.roomId, "");
    if (!roomId) {
      res.status(400).json({ error: "无效参数。" });
      return;
    }
    if (!isMongoObjectIdLike(roomId)) {
      res.status(400).json({ error: "无效群聊 ID。" });
      return;
    }

    try {
      const room = await GroupChatRoom.findById(roomId).lean();
      const normalizedRoom = normalizeGroupChatRoomDoc(room);
      if (!normalizedRoom) {
        res.status(404).json({ error: "群聊不存在或已失效。" });
        return;
      }

      const storedFileDocs = await GroupChatStoredFile.find(
        { roomId },
        { _id: 1, ossKey: 1 },
      ).lean();
      await Promise.all([
        deleteGroupChatStoredFileObjects(storedFileDocs),
        GroupChatRoom.deleteOne({ _id: roomId }),
        GroupChatMessage.deleteMany({ roomId }),
        GroupChatStoredFile.deleteMany({ roomId }),
      ]);

      const adminId = sanitizeId(admin?._id, "");
      const adminName = sanitizeText(admin?.username, "管理员", 64) || "管理员";
      broadcastGroupChatRoomDissolved(roomId, {
        id: adminId || "admin",
        name: adminName,
      });
      clearGroupChatRoomSockets(roomId);

      res.json({
        ok: true,
        roomId,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "解散群聊失败，请稍后重试。",
      });
    }
  });

  app.get("/api/auth/admin/images/history", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;

    const keyword = sanitizeText(req.query?.keyword, "", 80);
    const keywordLower = keyword.toLowerCase();
    const limit = sanitizeRuntimeInteger(req.query?.limit, 0, 0, 20000);

    let docs = [];
    try {
      let query = GeneratedImageHistory.find(
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
            { imageStorageType: "oss" },
          ],
        },
        {
          userId: 1,
          prompt: 1,
          imageStorageType: 1,
          imageUrl: 1,
          imageMimeType: 1,
          size: 1,
          model: 1,
          createdAt: 1,
        },
      )
        .sort({ createdAt: -1, _id: -1 });
      if (limit > 0) {
        query = query.limit(limit);
      }
      docs = await query.lean();
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取图片管理列表失败，请稍后重试。",
      });
      return;
    }

    let groups = [];
    try {
      const imageItems = Array.isArray(docs) ? docs.map(toAdminGeneratedImageHistoryItem) : [];
      const baseUserIdSet = new Set(
        imageItems
          .map((item) => sanitizeId(item?.baseUserId, ""))
          .filter((id) => id && isMongoObjectIdLike(id)),
      );

      const rosterUsers = baseUserIdSet.size
        ? await AuthUser.find(
            {
              _id: { $in: Array.from(baseUserIdSet) },
              role: "user",
            },
            { username: 1, profile: 1 },
          ).lean()
        : [];
      const rosterByUserId = new Map(
        rosterUsers.map((user) => {
          const userId = sanitizeId(user?._id, "");
          const profile = sanitizeUserProfile(user?.profile);
          return [
            userId,
            {
              userId,
              username: sanitizeText(user?.username, "", 64),
              studentName: sanitizeText(profile.name || user?.username, "", 64),
              studentId: sanitizeText(profile.studentId, "", 20),
              className: sanitizeText(profile.className, "", 40),
            },
          ];
        }),
      );

      const groupMap = new Map();
      imageItems.forEach((item) => {
        const baseUserId = sanitizeId(item?.baseUserId, "");
        const roster = rosterByUserId.get(baseUserId);
        if (!baseUserId || !roster) return;

        if (!groupMap.has(baseUserId)) {
          groupMap.set(baseUserId, {
            userId: baseUserId,
            baseUserId,
            username: roster.username,
            studentName: roster.studentName,
            studentId: roster.studentId,
            className: roster.className,
            imageCount: 0,
            latestCreatedAt: "",
            images: [],
          });
        }

        const group = groupMap.get(baseUserId);
        group.images.push(item);
        group.imageCount += 1;
        if (
          !group.latestCreatedAt ||
          Date.parse(item.createdAt) > Date.parse(group.latestCreatedAt)
        ) {
          group.latestCreatedAt = item.createdAt;
        }
      });

      groups = Array.from(groupMap.values()).map((group) => {
        const sortedImages = [...group.images].sort((a, b) => {
          const aTime = Date.parse(a?.createdAt || "") || 0;
          const bTime = Date.parse(b?.createdAt || "") || 0;
          if (bTime !== aTime) return bTime - aTime;
          return String(b?.id || "").localeCompare(String(a?.id || ""), "zh-CN");
        });
        return {
          ...group,
          imageCount: sortedImages.length,
          latestCreatedAt: sortedImages[0]?.createdAt || "",
          images: sortedImages,
        };
      });

      if (keywordLower) {
        groups = groups.filter((group) => {
          const fields = [
            group?.studentName,
            group?.username,
            group?.studentId,
            group?.className,
            group?.userId,
          ];
          return fields.some((field) =>
            String(field || "").toLowerCase().includes(keywordLower),
          );
        });
      }

      groups.sort((a, b) => {
        const aTime = Date.parse(a?.latestCreatedAt || "") || 0;
        const bTime = Date.parse(b?.latestCreatedAt || "") || 0;
        if (bTime !== aTime) return bTime - aTime;
        return compareClassroomRosterStudent(a, b);
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "整理图片管理列表失败，请稍后重试。",
      });
      return;
    }

    res.json({
      ok: true,
      keyword,
      updatedAt: new Date().toISOString(),
      totalGroupCount: groups.length,
      totalImageCount: groups.reduce((sum, group) => sum + Number(group?.imageCount || 0), 0),
      groups,
    });
  });

  app.get("/api/auth/admin/images/history/:imageId/content", async (req, res) => {
    if (!(await authenticateAdminRequestFromHeaderOrQuery(req, res))) return;

    const imageId = sanitizeId(req.params?.imageId, "");
    const download = sanitizeRuntimeBoolean(req.query?.download, false);
    if (!imageId) {
      res.status(400).json({ error: "无效图片 ID。" });
      return;
    }

    try {
      const doc = await GeneratedImageHistory.findOne(
        { _id: imageId },
        {
          prompt: 1,
          imageUrl: 1,
          ossKey: 1,
          imageData: 1,
          imageMimeType: 1,
          imageStorageType: 1,
          createdAt: 1,
          expiresAt: 1,
        },
      ).lean();
      if (!doc) {
        res.status(404).json({ error: "图片不存在或已过期。" });
        return;
      }

      const storageType = normalizeGeneratedImageStorageType(doc?.imageStorageType);
      const expiresAt = sanitizeIsoDate(doc?.expiresAt);
      if (storageType !== "oss" && expiresAt && Date.parse(expiresAt) <= Date.now()) {
        res.status(410).json({ error: "图片已过期。" });
        return;
      }

      const mimeType = normalizeGeneratedImageMimeType(doc?.imageMimeType) || "image/png";
      const ext = resolveFileExtensionByMimeType(mimeType, "png");
      const fileName = sanitizeGroupChatFileName(
        `generated-image-${String(imageId).slice(-8) || imageId}.${ext}`,
      );
      const ossKey = sanitizeGroupChatOssObjectKey(doc?.ossKey);
      if (ossKey) {
        if (download) {
          const downloadUrl = await buildTeacherLessonFileDownloadUrl({
            ossKey,
            fileName,
          });
          if (downloadUrl) {
            res.json({
              ok: true,
              downloadUrl,
              fileName,
              mimeType,
            });
            return;
          }
        } else if (groupChatOssClient && groupChatOssConfig && !groupChatOssConfig.publicRead) {
          try {
            const signedUrl = sanitizeGroupChatHttpUrl(
              await groupChatOssClient.asyncSignatureUrl(ossKey, {
                method: "GET",
                expires: groupChatOssConfig.signedUrlTtlSeconds,
              }),
            );
            if (/^https?:\/\//i.test(signedUrl)) {
              res.redirect(signedUrl);
              return;
            }
          } catch (error) {
            console.warn(
              `[image-management] OSS 预览地址生成失败（${ossKey}）：`,
              error?.message || error,
            );
          }
        }

        const directUrl =
          sanitizeGroupChatHttpUrl(doc?.imageUrl) || buildGroupChatOssObjectUrl(ossKey);
        if (/^https?:\/\//i.test(directUrl)) {
          if (download) {
            res.json({
              ok: true,
              downloadUrl: directUrl,
              fileName,
              mimeType,
            });
            return;
          }
          res.redirect(directUrl);
          return;
        }
      }

      const imageBuffer = extractGeneratedImageDataBuffer(doc?.imageData);
      if (imageBuffer.length > 0) {
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Length", String(imageBuffer.length));
        res.setHeader("Cache-Control", "private, no-store");
        if (download) {
          res.setHeader("Content-Disposition", buildAttachmentContentDisposition(fileName));
        }
        res.send(imageBuffer);
        return;
      }

      const fallbackUrl = normalizeGeneratedImageStoreUrl(doc?.imageUrl || "");
      if (/^https?:\/\//i.test(fallbackUrl)) {
        if (download) {
          res.json({
            ok: true,
            downloadUrl: fallbackUrl,
            fileName,
            mimeType,
          });
        } else {
          res.redirect(fallbackUrl);
        }
        return;
      }

      const parsedDataUrl = parseGeneratedImageDataUrl(fallbackUrl);
      if (parsedDataUrl) {
        const fallbackMimeType =
          normalizeGeneratedImageMimeType(parsedDataUrl?.mimeType) || mimeType;
        const fallbackExt = resolveFileExtensionByMimeType(fallbackMimeType, "png");
        const fallbackFileName = sanitizeGroupChatFileName(
          `generated-image-${String(imageId).slice(-8) || imageId}.${fallbackExt}`,
        );
        res.setHeader("Content-Type", fallbackMimeType);
        res.setHeader("Content-Length", String(parsedDataUrl.data.length));
        res.setHeader("Cache-Control", "private, no-store");
        if (download) {
          res.setHeader(
            "Content-Disposition",
            buildAttachmentContentDisposition(fallbackFileName),
          );
        }
        res.send(parsedDataUrl.data);
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

  app.get("/api/auth/admin/online-presence", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;

    const classNameFilter = sanitizeText(req.query?.className, "", 40);
    const strictBrowserOpenClassNames = new Set(["810班", "811班"]);
    const nowMs = Date.now();
    const onlineEntries = collectOnlinePresenceEntries(nowMs);
    const onlineUserIds = onlineEntries.map((item) => item.userId);

    if (onlineUserIds.length === 0) {
      res.json({
        ok: true,
        generatedAt: new Date(nowMs).toISOString(),
        className: classNameFilter,
        onlineWindowSeconds: Math.floor(USER_ONLINE_ACTIVITY_WINDOW_MS / 1000),
        totalOnlineCount: 0,
        filteredOnlineCount: 0,
        users: [],
      });
      return;
    }

    const users = await AuthUser.find(
      { _id: { $in: onlineUserIds }, role: "user" },
      { username: 1, profile: 1 },
    ).lean();
    const userById = new Map(users.map((item) => [String(item?._id || ""), item]));

    const onlineUsers = onlineEntries
      .map((entry) => {
        const user = userById.get(entry.userId);
        if (!user) return null;
        const profile = sanitizeUserProfile(user.profile);
        return {
          userId: entry.userId,
          username: user.username || "",
          profile: {
            name: profile.name || "",
            studentId: profile.studentId || "",
            grade: profile.grade || "",
            className: profile.className || "",
          },
          lastSeenAt: sanitizeIsoDate(new Date(entry.lastSeenAtMs)) || new Date(nowMs).toISOString(),
          browserHeartbeatAt:
            entry.browserHeartbeatAtMs > 0
              ? sanitizeIsoDate(new Date(entry.browserHeartbeatAtMs))
              : null,
        };
      })
      .filter(Boolean);

    const effectiveOnlineUsers = onlineUsers.filter((item) => {
      const className = sanitizeText(item?.profile?.className, "", 40);
      if (!strictBrowserOpenClassNames.has(className)) return true;
      const heartbeatMs = new Date(item?.browserHeartbeatAt || 0).getTime() || 0;
      return heartbeatMs >= nowMs - USER_BROWSER_HEARTBEAT_STALE_MS;
    });

    const filteredUsers = classNameFilter
      ? effectiveOnlineUsers.filter(
          (item) => sanitizeText(item?.profile?.className, "", 40) === classNameFilter,
        )
      : effectiveOnlineUsers;

    res.json({
      ok: true,
      generatedAt: new Date(nowMs).toISOString(),
      className: classNameFilter,
      onlineWindowSeconds: Math.floor(USER_ONLINE_ACTIVITY_WINDOW_MS / 1000),
      heartbeatStaleSeconds: Math.floor(USER_BROWSER_HEARTBEAT_STALE_MS / 1000),
      totalOnlineCount: effectiveOnlineUsers.length,
      filteredOnlineCount: filteredUsers.length,
      users: filteredUsers,
    });
  });

  app.get("/api/auth/admin/export/users-txt", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;

    const users = await AuthUser.find({ role: "user" })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const content = buildAdminUsersExportTxt(users);
    const suffix = formatFileStamp(new Date());
    res.json({
      ok: true,
      filename: `educhat-users-${suffix}.txt`,
      content,
    });
  });

  app.get("/api/auth/admin/export/chats-txt", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const teacherScopeKey = sanitizeTeacherScopeKey(req.query?.teacherScopeKey);

    const users = await AuthUser.find({ role: "user" })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const userIds = users.map((u) => u._id);
    const stateDocs = await ChatState.find({ userId: { $in: userIds } }).lean();
    const stateByUserId = new Map(
      stateDocs.map((doc) => {
        const scoped = readTeacherScopedChatStateRaw(doc, teacherScopeKey);
        return [
          String(doc.userId),
          scoped ? normalizeChatStateDoc(doc, teacherScopeKey) : null,
        ];
      }),
    );

    const content = buildAdminChatsExportTxt(users, stateByUserId, teacherScopeKey);
    const suffix = formatFileStamp(new Date());
    res.json({
      ok: true,
      filename: `educhat-chats-${teacherScopeKey}-${suffix}.txt`,
      content,
    });
  });

  app.get("/api/auth/admin/export/chats-zip", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const teacherScopeKey = sanitizeTeacherScopeKey(req.query?.teacherScopeKey);

    const users = await AuthUser.find({ role: "user" })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const userIds = users.map((u) => u._id);
    const stateDocs = await ChatState.find({ userId: { $in: userIds } }).lean();
    const stateByUserId = new Map(
      stateDocs.map((doc) => {
        const scoped = readTeacherScopedChatStateRaw(doc, teacherScopeKey);
        return [
          String(doc.userId),
          scoped ? normalizeChatStateDoc(doc, teacherScopeKey) : null,
        ];
      }),
    );

    const exportedAt = new Date();
    const userFiles = users.map((user, idx) => {
      const userId = String(user?._id || "");
      const state = stateByUserId.get(userId);
      const content = buildSingleUserChatExportTxt(
        user,
        state,
        idx + 1,
        exportedAt,
        teacherScopeKey,
      );
      const username = sanitizeZipFileNamePart(user?.username || `user-${idx + 1}`);
      const shortId = sanitizeZipFileNamePart(userId.slice(-8) || String(idx + 1));
      const fileName = `${String(idx + 1).padStart(3, "0")}-${username}-${shortId}.txt`;
      return { name: fileName, content };
    });

    const readmeContent = buildZipReadme(userFiles.length, exportedAt, teacherScopeKey);
    const zipBuffer = buildZipBuffer([
      { name: "README.txt", content: readmeContent },
      ...userFiles,
    ]);

    const suffix = formatFileStamp(exportedAt);
    const fileName = `educhat-chats-by-user-${teacherScopeKey}-${suffix}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", buildAttachmentContentDisposition(fileName));
    res.send(zipBuffer);
  });

  app.delete("/api/auth/admin/chats", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const teacherScopeKey = sanitizeTeacherScopeKey(req.query?.teacherScopeKey);
    const users = await AuthUser.find({ role: "user" }, { _id: 1 }).lean();
    const userIds = users.map((user) => user._id);
    const scopedUserIds = users
      .map((user) =>
        buildTeacherScopedStorageUserId(String(user?._id || ""), teacherScopeKey),
      )
      .filter(Boolean);

    const imageHistoryDocs = await GeneratedImageHistory.find(
      { userId: { $in: scopedUserIds } },
      { _id: 1, ossKey: 1 },
    ).lean();
    let deleteImageHistoryOssSummary = { deletedCount: 0, failedKeys: [] };
    try {
      deleteImageHistoryOssSummary = await deleteGeneratedImageHistoryOssObjects(
        imageHistoryDocs,
      );
    } catch (error) {
      console.warn(
        "Failed to delete image history OSS objects on admin clear:",
        error?.message || error,
      );
    }
    const chatStateResult = isDefaultTeacherScopeKey(teacherScopeKey)
      ? await ChatState.updateMany(
          { userId: { $in: userIds } },
          {
            $unset: {
              activeId: "",
              groups: "",
              sessions: "",
              sessionMessages: "",
              sessionContextRefs: "",
              settings: "",
            },
          },
        )
      : await ChatState.updateMany(
          { userId: { $in: userIds } },
          {
            $unset: {
              [`teacherStates.${teacherScopeKey}`]: "",
            },
          },
        );
    const [uploadedContextResult, imageHistoryResult] = await Promise.all([
      UploadedFileContext.deleteMany({ userId: { $in: scopedUserIds } }),
      GeneratedImageHistory.deleteMany({ userId: { $in: scopedUserIds } }),
    ]);
    res.json({
      ok: true,
      teacherScopeKey,
      teacherScopeLabel: getTeacherScopeLabel(teacherScopeKey),
      deletedCount: Number(chatStateResult?.modifiedCount || 0),
      deletedUploadedFileContextCount: Number(uploadedContextResult?.deletedCount || 0),
      deletedImageHistoryCount: Number(imageHistoryResult?.deletedCount || 0),
      deletedImageHistoryOssObjectCount: Number(deleteImageHistoryOssSummary?.deletedCount || 0),
      failedImageHistoryOssKeys: Array.isArray(deleteImageHistoryOssSummary?.failedKeys)
        ? deleteImageHistoryOssSummary.failedKeys
        : [],
    });
  });
}
