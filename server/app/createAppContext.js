import * as core from "../services/core-runtime.js";

export function createAppContext({ env = process.env, mongoose = core.mongoose } = {}) {
  return {
    ...core,
    env,
    mongoose,
  };
}
