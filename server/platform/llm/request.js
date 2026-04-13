export async function buildLlmRequestContext(deps, agentId) {
  const providerConfig = deps.getProviderConfig(agentId);
  return {
    providerConfig,
  };
}
