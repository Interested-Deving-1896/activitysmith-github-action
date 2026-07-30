import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import send from "../src/send.js";
import {
  baseInputs,
  createCore,
  installFetch,
  restoreFetch,
} from "./helpers.js";

afterEach(() => {
  restoreFetch();
});

test("dispatches all supported operations with their expected request", async (t) => {
  const cases = [
    {
      action: "send_push_notification",
      expectedBody: {
        message: "Production is healthy",
        tags: ["deployment", "production"],
        title: "Deployment complete",
      },
      expectedMethod: "POST",
      expectedPath: "/api/push-notification",
      payload: `
        title: Deployment complete
        message: Production is healthy
        tags: [deployment, production]
      `,
      response: { success: true, timestamp: "2026-07-30T00:00:00Z" },
    },
    {
      action: "start_live_activity",
      channels: "ops,deploys",
      expectedBody: {
        content_state: {
          icon: { color: "blue", symbol: "shippingbox" },
          message: "Starting",
          title: "Deployment",
          type: "alert",
        },
        target: { channels: ["ops", "deploys"] },
      },
      expectedMethod: "POST",
      expectedOutput: { live_activity_id: "activity-123" },
      expectedPath: "/api/live-activity/start",
      payload: `
        content_state:
          title: Deployment
          type: alert
          message: Starting
          icon:
            symbol: shippingbox
            color: blue
      `,
      response: { activity_id: "activity-123", success: true },
    },
    {
      action: "update_live_activity",
      expectedBody: {
        activity_id: "activity-123",
        content_state: {
          message: "Running",
          secondary_action: {
            title: "Logs",
            type: "open_url",
            url: "https://example.com/logs",
          },
          title: "Deployment",
        },
      },
      expectedMethod: "POST",
      expectedPath: "/api/live-activity/update",
      inputs: { "live-activity-id": "activity-123" },
      payload: `
        content_state:
          title: Deployment
          message: Running
          secondary_action:
            title: Logs
            type: open_url
            url: https://example.com/logs
      `,
      response: { success: true },
    },
    {
      action: "end_live_activity",
      expectedBody: {
        activity_id: "activity-123",
        content_state: {
          auto_dismiss_seconds: 10,
          color: "green",
          title: "Deployment complete",
        },
      },
      expectedMethod: "POST",
      expectedPath: "/api/live-activity/end",
      inputs: { "live-activity-id": "activity-123" },
      payload: `
        content_state:
          title: Deployment complete
          color: green
          auto_dismiss_seconds: 10
      `,
      response: { success: true },
    },
    {
      action: "stream_live_activity",
      expectedBody: {
        content_state: {
          duration_seconds: 60,
          title: "Smoke timer",
          type: "timer",
        },
      },
      expectedMethod: "PUT",
      expectedOutput: {
        live_activity_id: "activity-456",
        operation: "started",
      },
      expectedPath: "/api/live-activity/stream/smoke-stream",
      inputs: { "stream-key": "smoke-stream" },
      payload: `
        content_state:
          title: Smoke timer
          type: timer
          duration_seconds: 60
      `,
      response: {
        activity_id: "activity-456",
        operation: "started",
        success: true,
      },
    },
    {
      action: "end_live_activity_stream",
      expectedBody: undefined,
      expectedMethod: "DELETE",
      expectedOutput: { operation: "ended" },
      expectedPath: "/api/live-activity/stream/smoke-stream",
      inputs: { "stream-key": "smoke-stream" },
      response: { operation: "ended", success: true },
    },
    {
      action: "update_metric_value",
      expectedBody: {
        timestamp: "2026-07-30T00:00:00Z",
        value: 42,
      },
      expectedMethod: "POST",
      expectedPath: "/api/metrics/deployments/value",
      inputs: { "metric-key": "deployments" },
      payload: `
        value: 42
        timestamp: 2026-07-30T00:00:00Z
      `,
      response: { success: true },
    },
    {
      action: "update_app_icon_badge_count",
      channels: "ops,deploys",
      expectedBody: {
        badge: 7,
        target: { channels: ["ops", "deploys"] },
      },
      expectedMethod: "POST",
      expectedPath: "/api/badge",
      payload: "badge: 7",
      response: {
        badge: 7,
        devices_notified: 2,
        effective_channel_slugs: ["ops", "deploys"],
        success: true,
        users_notified: 2,
      },
    },
  ];

  for (const operation of cases) {
    await t.test(operation.action, async () => {
      const requests = installFetch(operation.response);
      const core = createCore(
        baseInputs({
          action: operation.action,
          channels: operation.channels,
          payload: operation.payload,
          ...operation.inputs,
        })
      );

      await send(core);

      assert.equal(requests.length, 1);
      assert.equal(new URL(requests[0].url).pathname, operation.expectedPath);
      assert.equal(requests[0].method, operation.expectedMethod);
      assert.deepEqual(requests[0].body, operation.expectedBody);
      assert.equal(core.outputs.ok, true);
      assert.deepEqual(JSON.parse(core.outputs.response), operation.response);
      assert.equal(Number.isInteger(core.outputs.time), true);
      assert.deepEqual(
        Object.fromEntries(
          Object.keys(operation.expectedOutput ?? {}).map((name) => [
            name,
            core.outputs[name],
          ])
        ),
        operation.expectedOutput ?? {}
      );
      assert.deepEqual(core.failures, []);
    });
  }
});

test("loads a JSON payload file", async () => {
  const requests = installFetch({
    success: true,
    timestamp: "2026-07-30T00:00:00Z",
  });
  const core = createCore(
    baseInputs({
      action: "send_push_notification",
      "payload-file-path": "test/fixtures/push.json",
    })
  );

  await send(core);

  assert.deepEqual(requests[0].body, {
    message: "Loaded from a payload file",
    tags: ["test"],
    title: "Fixture notification",
  });
});

test("supports the legacy payload delimiter", async () => {
  const requests = installFetch({ success: true });
  const core = createCore(
    baseInputs({
      action: "start_live_activity",
      payload: `
        content_state:
          current_step: 2
          title: Deployment
      `,
      "payload-delimiter": ".",
    })
  );

  await send(core);

  assert.deepEqual(requests[0].body, {
    "content_state.current_step": "2",
    "content_state.title": "Deployment",
  });
});

test("does not override an explicit target with channels", async () => {
  const requests = installFetch({
    success: true,
    timestamp: "2026-07-30T00:00:00Z",
  });
  const core = createCore(
    baseInputs({
      action: "send_push_notification",
      channels: "ignored",
      payload: `
        title: Targeted notification
        target:
          channels: [explicit]
      `,
    })
  );

  await send(core);

  assert.deepEqual(requests[0].body.target, { channels: ["explicit"] });
});

test("reports configuration failures without failing the workflow by default", async (t) => {
  const cases = [
    {
      inputs: { action: "send_push_notification", payload: "title: Test" },
      message: "An API key must be provided",
    },
    {
      inputs: { "api-key": "test-api-key", payload: "title: Test" },
      message: "An action must be provided",
    },
    {
      inputs: {
        "api-key": "test-api-key",
        action: "update_live_activity",
        payload: "content_state: { title: Test }",
      },
      message: "A live activity id must be provided",
    },
    {
      inputs: {
        "api-key": "test-api-key",
        action: "stream_live_activity",
        payload: "content_state: { title: Test }",
      },
      message: "A stream key must be provided",
    },
    {
      inputs: {
        "api-key": "test-api-key",
        action: "update_metric_value",
        payload: "value: 1",
      },
      message: "A metric key must be provided",
    },
    {
      inputs: {
        "api-key": "test-api-key",
        action: "update_app_icon_badge_count",
      },
      message: "A payload or payload file path must be provided",
    },
    {
      inputs: {
        "api-key": "test-api-key",
        action: "send_push_notification",
      },
      message: "A payload or payload file path must be provided",
    },
  ];

  for (const validationCase of cases) {
    await t.test(validationCase.message, async () => {
      const core = createCore(validationCase.inputs);
      await send(core);
      assert.equal(core.outputs.ok, false);
      assert.match(core.outputs.response, new RegExp(validationCase.message));
      assert.equal(Number.isInteger(core.outputs.time), true);
      assert.deepEqual(core.failures, []);
    });
  }
});

test("reports conflicting inline and file payloads without failing the workflow", async () => {
  const core = createCore(
    {
      action: "send_push_notification",
      "api-key": "test-api-key",
      payload: "title: Inline",
      "payload-file-path": "test/fixtures/push.json",
    }
  );

  await send(core);

  assert.equal(core.outputs.ok, false);
  assert.match(
    core.outputs.response,
    /Just the payload or payload file path is required/
  );
  assert.deepEqual(core.failures, []);
});

test("supports strict handling for configuration failures", async () => {
  const core = createCore({
    action: "update_live_activity",
    "api-key": "test-api-key",
    errors: "true",
    payload: "content_state: { title: Test }",
  });

  await assert.rejects(() => send(core), /A live activity id must be provided/);

  assert.equal(core.outputs.ok, false);
  assert.equal(core.failures.length, 1);
  assert.match(core.failures[0], /A live activity id must be provided/);
});

test("reports API errors without failing the workflow by default", async () => {
  installFetch(
    {
      error: "service_unavailable",
      message: "ActivitySmith is temporarily unavailable",
    },
    503
  );
  const core = createCore({
    action: "send_push_notification",
    "api-key": "test-api-key",
    payload: "title: Deployment update",
  });

  await send(core);

  assert.equal(core.outputs.ok, false);
  assert.deepEqual(JSON.parse(core.outputs.response), {
    error: "service_unavailable",
    message: "ActivitySmith is temporarily unavailable",
  });
  assert.equal(Number.isInteger(core.outputs.time), true);
  assert.deepEqual(core.failures, []);
  assert.match(core.logs.error.join("\n"), /service_unavailable/);
});

test("supports explicitly failing the workflow on API errors", async () => {
  installFetch({ error: "unauthorized" }, 401);
  const core = createCore(
    baseInputs({
      action: "send_push_notification",
      payload: "title: Deployment update",
    })
  );

  await assert.rejects(() => send(core), /unauthorized/);

  assert.equal(core.outputs.ok, false);
  assert.equal(core.failures.length, 1);
  assert.match(core.failures[0], /unauthorized/);
});

test("reports invalid metric and badge payloads without failing by default", async (t) => {
  const cases = [
    {
      inputs: {
        action: "update_metric_value",
        "api-key": "test-api-key",
        "metric-key": "deployments",
        payload: "timestamp: 2026-07-30T00:00:00Z",
      },
      message: "update_metric_value requires a value",
    },
    {
      inputs: {
        action: "update_app_icon_badge_count",
        "api-key": "test-api-key",
        payload: "badge: -1",
      },
      message: "requires a non-negative integer badge",
    },
  ];

  for (const validationCase of cases) {
    await t.test(validationCase.message, async () => {
      const core = createCore(validationCase.inputs);
      await send(core);
      assert.equal(core.outputs.ok, false);
      assert.match(core.outputs.response, new RegExp(validationCase.message));
      assert.deepEqual(core.failures, []);
    });
  }
});
