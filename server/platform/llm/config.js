export async function resolveLlmRuntimeConfig(deps, agentId) {
  const runtimeConfig = await deps.getResolvedAgentRuntimeConfig(agentId);
  const provider = deps.getProviderByAgent(agentId, runtimeConfig);
  const model = deps.getModelByAgent(agentId, runtimeConfig);
  const protocol = deps.resolveRequestProtocol(runtimeConfig.protocol, provider, model).value;
  return {
    runtimeConfig,
    provider,
    model,
    protocol,
  };
}
