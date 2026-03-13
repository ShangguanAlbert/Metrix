export function createStartupTasks(deps) {
  return {
    async run() {
      await deps.runStartupMaintenanceTasks();
    },
  };
}
