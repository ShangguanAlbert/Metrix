const ROUTE_METHODS = new Set([
  "all",
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "use",
]);

function shouldAlwaysForwardUseCall(args = []) {
  return typeof args[0] === "function";
}

export function createFilteredRouteApp(app, shouldRegisterPath) {
  return new Proxy(app, {
    get(target, prop, receiver) {
      if (!ROUTE_METHODS.has(prop)) {
        return Reflect.get(target, prop, receiver);
      }

      const original = Reflect.get(target, prop, receiver);
      if (typeof original !== "function") {
        return original;
      }

      return (...args) => {
        if (prop === "use" && shouldAlwaysForwardUseCall(args)) {
          return original.apply(target, args);
        }

        const [routePath] = args;
        if (shouldRegisterPath(routePath, prop, args)) {
          return original.apply(target, args);
        }

        return target;
      };
    },
  });
}
