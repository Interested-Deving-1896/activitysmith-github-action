const originalFetch = globalThis.fetch;

export function restoreFetch() {
  globalThis.fetch = originalFetch;
}

export function createCore(inputs = {}) {
  const outputs = {};
  const failures = [];
  const logs = {
    debug: [],
    error: [],
    info: [],
    warning: [],
  };

  return {
    failures,
    logs,
    outputs,
    getBooleanInput(name) {
      const value = inputs[name] ?? "false";
      if (value === "true") {
        return true;
      }
      if (value === "false" || value === "") {
        return false;
      }
      throw new TypeError(`Invalid boolean input: ${name}`);
    },
    getInput: (name) => inputs[name] ?? "",
    isDebug: () => false,
    setFailed: (error) =>
      failures.push(error instanceof Error ? error.message : `${error}`),
    setOutput: (name, value) => {
      outputs[name] = value;
    },
    setSecret: () => {},
    debug: (message) => logs.debug.push(message),
    error: (message) => logs.error.push(message),
    info: (message) => logs.info.push(message),
    warning: (message) => logs.warning.push(message),
  };
}

export function installFetch(responseBody, status = 200) {
  const requests = [];

  globalThis.fetch = async (url, init = {}) => {
    requests.push({
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
      headers: init.headers,
      method: init.method,
      url: `${url}`,
    });

    return new Response(JSON.stringify(responseBody), {
      headers: { "content-type": "application/json" },
      status,
    });
  };

  return requests;
}

export function baseInputs(inputs) {
  return {
    "api-key": "test-api-key",
    errors: "true",
    ...inputs,
  };
}
