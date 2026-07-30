/**
 * The Logger class creates a Logger to output debug messages and errors.
 *
 * @see {@link https://tools.slack.dev/node-slack-sdk/web-api/#logging}
 */
export default class Logger {
  /**
   * The logger for outputs.
   * @type {{
   *   debug: (message: string) => void,
   *   info: (message: string) => void,
   *   warn: (message: string) => void,
   *   error: (message: string) => void
   * }}
   */
  logger;

  /**
   * Shared utilities specific to the GitHub action workflow.
   * @param {import("@actions/core")} core - GitHub Actions core utilities.
   */
  constructor(core) {
    this.logger = {
      debug: (message) => core.debug(message),
      info: (message) => core.info(message),
      warn: (message) => core.warning(message),
      error: (message) => core.error(message),
    };
  }
}
