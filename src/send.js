import Client from "./client.js";
import Config from "./config.js";
import ActivitySmithError from "./errors.js";

/**
 * Orchestrate the action job happenings from inputs to logic to outputs.
 * @param {core} core - GitHub Actions core utilities.
 * @throws if an error happens but might not cause the job to fail.
 */
export default async function send(core) {
  let config;
  try {
    config = new Config(core);
    await new Client().run(config);
  } catch (/** @type {any} */ error) {
    if (!config) {
      const errorMessage = error?.message ?? `${error}`;
      core.error(`❌ ${errorMessage}`);
      core.setOutput("ok", false);
      core.setOutput("response", JSON.stringify(errorMessage));
    }

    const failOnError =
      config?.inputs.errors ??
      (core.getInput("errors").trim().toLowerCase() === "true");
    if (failOnError) {
      core.setFailed(error);
      throw new ActivitySmithError(core, error);
    }
  } finally {
    core.setOutput("time", Math.floor(Date.now() / 1000));
  }
}
