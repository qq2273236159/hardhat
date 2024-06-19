import type {
  ConfigurationVariable,
  HardhatConfig,
  HardhatUserConfig,
} from "../../src/types/config.js";
import type {
  HardhatUserConfigValidationError,
  HookContext,
  HookManager,
} from "../../src/types/hooks.js";
import type { HardhatRuntimeEnvironment } from "../../src/types/hre.js";
import type { Task, TaskManager } from "../../src/types/tasks.js";
import type { UserInterruptionManager } from "../../src/types/user-interruptions.js";

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { HookManagerImplementation } from "../../src/internal/hook-manager.js";
import { UserInterruptionManagerImplementation } from "../../src/internal/user-interruptions.js";

// This allows us to test the sequential return of handlers
// Currently `hre.created` is the only hook that is returned sequentially
// but it returns void. `testExample` takes and returns a string to
// ease testing.
declare module "../../src/types/hooks.js" {
  interface HardhatRuntimeEnvironmentHooks {
    testExample: (context: HookContext, input: string) => Promise<string>;
  }
}

describe("HookManager", () => {
  describe("runHandlerChain", () => {
    let hookManager: HookManager;

    beforeEach(() => {
      const manager = new HookManagerImplementation([]);

      const userInterruptionsManager =
        new UserInterruptionManagerImplementation(hookManager);

      manager.setContext({
        config: {
          tasks: [],
          plugins: [],
        },
        hooks: hookManager,
        globalArguments: {},
        interruptions: userInterruptionsManager,
      });

      hookManager = manager;
    });

    it("should return the default implementation if no other handlers are provided", async () => {
      const notExpectedConfig = {};

      const defaultImplementationVersionOfConfig: HardhatConfig = {
        plugins: [],
        tasks: [],
      };

      const resultConfig = await hookManager.runHandlerChain(
        "config",
        "extendUserConfig",
        [notExpectedConfig],
        async () => {
          return defaultImplementationVersionOfConfig;
        },
      );

      assert.equal(resultConfig, defaultImplementationVersionOfConfig);
    });

    it("should run the handlers as a chain finishing with the default implementation", async () => {
      const sequence: string[] = [];

      hookManager.registerHandlers("config", {
        extendUserConfig: async (
          config: HardhatUserConfig,
          next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
        ) => {
          sequence.push("first:before");
          const newConfig = await next(config);
          sequence.push("first:after");

          return newConfig;
        },
      });

      hookManager.registerHandlers("config", {
        extendUserConfig: async (
          config: HardhatUserConfig,
          next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
        ) => {
          sequence.push("second:before");
          const newConfig = await next(config);
          sequence.push("second:after");

          return newConfig;
        },
      });

      hookManager.registerHandlers("config", {
        extendUserConfig: async (
          config: HardhatUserConfig,
          next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
        ) => {
          sequence.push("third:before");
          const newConfig = await next(config);
          sequence.push("third:after");

          return newConfig;
        },
      });

      await hookManager.runHandlerChain(
        "config",
        "extendUserConfig",
        [{}],
        async () => {
          sequence.push("default");
          return {};
        },
      );

      assert.deepEqual(sequence, [
        "third:before",
        "second:before",
        "first:before",
        "default",
        "first:after",
        "second:after",
        "third:after",
      ]);
    });

    it("should pass the parameters directly for config hooks", async () => {
      const expectedConfig: HardhatConfig = {
        plugins: [],
        tasks: [],
      };

      hookManager.registerHandlers("config", {
        extendUserConfig: async (
          config: HardhatUserConfig,
          next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
        ) => {
          assert.equal(
            config,
            expectedConfig,
            "the param passed to runHandlerChain should be object equal with the param passed to the handlers",
          );

          const newConfig = await next(config);

          return newConfig;
        },
      });

      const resultConfig = await hookManager.runHandlerChain(
        "config",
        "extendUserConfig",
        [expectedConfig],
        async (c) => {
          assert.equal(
            c,
            expectedConfig,
            "the param passed through the next hierarchy should be object equal with the param passed to the default implementation",
          );

          return c;
        },
      );

      assert.equal(resultConfig, expectedConfig);
    });

    it("should pass the parameters with hook context for non-config hooks", async () => {
      const exampleConfigVar: ConfigurationVariable = {
        _type: "ConfigurationVariable",
        name: "example",
      };

      hookManager.registerHandlers("configurationVariables", {
        fetchValue: async (
          context: HookContext,
          variable: ConfigurationVariable,
          next: (
            nextContext: HookContext,
            nextVariable: ConfigurationVariable,
          ) => Promise<string>,
        ) => {
          assert(
            context !== null && typeof context === "object",
            "Hook Context should be an object",
          );

          assert.equal(
            variable,
            exampleConfigVar,
            "the param passed to runHandlerChain should be object equal with the param passed to the handlers",
          );

          const newValue = await next(context, variable);

          return newValue;
        },
      });

      const resultValue = await hookManager.runHandlerChain(
        "configurationVariables",
        "fetchValue",
        [exampleConfigVar],
        async (context, configVar) => {
          assert(
            context !== null && typeof context === "object",
            "Hook Context should be an object",
          );

          assert.equal(
            configVar,
            exampleConfigVar,
            "the param passed through the next hierarchy should be object equal with the param passed to the default implementation",
          );

          return "default-value";
        },
      );

      assert.equal(resultValue, "default-value");
    });
  });

  describe("runSequentialHandlers", () => {
    let hookManager: HookManager;

    beforeEach(() => {
      const manager = new HookManagerImplementation([]);

      const userInterruptionsManager =
        new UserInterruptionManagerImplementation(hookManager);

      manager.setContext({
        config: {
          tasks: [],
          plugins: [],
        },
        hooks: hookManager,
        globalArguments: {},
        interruptions: userInterruptionsManager,
      });

      hookManager = manager;
    });

    it("Should return the empty set if no handlers are registered", async () => {
      const mockHre = buildMockHardhatRuntimeEnvironment(hookManager);

      const resultHre = await hookManager.runSequentialHandlers(
        "hre",
        "created",
        [mockHre],
      );

      assert.deepEqual(resultHre, []);
    });

    it("Should return a return entry per handler", async () => {
      hookManager.registerHandlers("hre", {
        testExample: async (
          _context: HookContext,
          _input: string,
        ): Promise<string> => {
          return "first";
        },
      });

      hookManager.registerHandlers("hre", {
        testExample: async (
          _context: HookContext,
          _input: string,
        ): Promise<string> => {
          return "second";
        },
      });

      hookManager.registerHandlers("hre", {
        testExample: async (
          _context: HookContext,
          _input: string,
        ): Promise<string> => {
          return "third";
        },
      });

      const result = await hookManager.runSequentialHandlers(
        "hre",
        "testExample",
        ["input"],
      );

      assert.deepEqual(result, ["third", "second", "first"]);
    });

    it("Should let handlers access the passed context (for non-config hooks)", async () => {
      hookManager.registerHandlers("hre", {
        testExample: async (
          context: HookContext,
          input: string,
        ): Promise<string> => {
          assert(
            context !== null && typeof context === "object",
            "Context should be passed for sequential processing",
          );
          assert.equal(input, "input");
          return "result";
        },
      });

      const result = await hookManager.runSequentialHandlers(
        "hre",
        "testExample",
        ["input"],
      );

      assert.deepEqual(result, ["result"]);
    });

    it("Should stop config handlers having access to the hook context", async () => {
      const expectedConfig: HardhatConfig = {
        plugins: [],
        tasks: [],
      };

      hookManager.registerHandlers("config", {
        validateUserConfig: async (
          config: HardhatUserConfig,
        ): Promise<HardhatUserConfigValidationError[]> => {
          assert.deepEqual(
            config,
            expectedConfig,
            "The first parameter should be the config - not the context",
          );

          return [];
        },
      });

      const validationResult = await hookManager.runSequentialHandlers(
        "config",
        "validateUserConfig",
        [expectedConfig],
      );

      assert.deepEqual(validationResult, [[]]);
    });
  });

  describe("runParallelHandlers", () => {
    let hookManager: HookManager;

    beforeEach(() => {
      const manager = new HookManagerImplementation([]);

      const userInterruptionsManager =
        new UserInterruptionManagerImplementation(hookManager);

      manager.setContext({
        config: {
          tasks: [],
          plugins: [],
        },
        hooks: hookManager,
        globalArguments: {},
        interruptions: userInterruptionsManager,
      });

      hookManager = manager;
    });

    it("Should return an empty result set if no handlers are provided", async () => {
      const originalConfig: HardhatConfig = {
        plugins: [],
        tasks: [],
      };

      const results = await hookManager.runParallelHandlers(
        "config",
        "validateUserConfig",
        [originalConfig],
      );

      assert.deepEqual(results, []);
    });

    it("Should return a result per handler", async () => {
      const originalConfig: HardhatConfig = {
        plugins: [],
        tasks: [],
      };

      hookManager.registerHandlers("config", {
        validateUserConfig: async (
          _config: HardhatUserConfig,
        ): Promise<HardhatUserConfigValidationError[]> => {
          return [
            {
              path: [],
              message: "first",
            },
          ];
        },
      });

      hookManager.registerHandlers("config", {
        validateUserConfig: async (
          _config: HardhatUserConfig,
        ): Promise<HardhatUserConfigValidationError[]> => {
          return [
            {
              path: [],
              message: "second",
            },
          ];
        },
      });

      const results = await hookManager.runParallelHandlers(
        "config",
        "validateUserConfig",
        [originalConfig],
      );

      assert.deepEqual(results, [
        [
          {
            path: [],
            message: "second",
          },
        ],
        [
          {
            path: [],
            message: "first",
          },
        ],
      ]);
    });

    it("Should pass the context to the handler (for non-config)", async () => {
      const mockHre = buildMockHardhatRuntimeEnvironment(hookManager);

      hookManager.registerHandlers("hre", {
        created: async (
          context: HookContext,
          hre: HardhatRuntimeEnvironment,
        ): Promise<void> => {
          assert(
            context !== null && typeof context === "object",
            "hook context should be passed",
          );
          assert.equal(hre, mockHre);
        },
      });

      const result = await hookManager.runParallelHandlers("hre", "created", [
        mockHre,
      ]);

      assert.deepEqual(result, [undefined]);
    });

    it("Should not pass the hook context for config", async () => {
      const expectedConfig: HardhatConfig = {
        plugins: [],
        tasks: [],
      };

      const validationError = {
        path: [],
        message: "first",
      };

      hookManager.registerHandlers("config", {
        validateUserConfig: async (
          config: HardhatUserConfig,
        ): Promise<HardhatUserConfigValidationError[]> => {
          assert.equal(config, expectedConfig);
          return [validationError];
        },
      });

      const results = await hookManager.runParallelHandlers(
        "config",
        "validateUserConfig",
        [expectedConfig],
      );

      assert.deepEqual(results, [[validationError]]);
    });
  });
});

function buildMockHardhatRuntimeEnvironment(
  hookManager: HookManager,
): HardhatRuntimeEnvironment {
  const mockInteruptionManager: UserInterruptionManager = {
    displayMessage: async () => {},
    requestInput: async () => "",
    requestSecretInput: async () => "",
    uninterrupted: async <ReturnT>(
      f: () => ReturnT,
    ): Promise<Awaited<ReturnT>> => {
      /* eslint-disable-next-line @typescript-eslint/return-await, @typescript-eslint/await-thenable -- this is following the pattern in the real implementation */
      return await f();
    },
  };

  const mockTaskManager: TaskManager = {
    getTask: () => {
      throw new Error("Method not implemented.");
    },
    rootTasks: new Map<string, Task>(),
  };

  const mockHre: HardhatRuntimeEnvironment = {
    hooks: hookManager,
    config: {
      tasks: [],
      plugins: [],
    },
    tasks: mockTaskManager,
    globalArguments: {},
    interruptions: mockInteruptionManager,
  };

  return mockHre;
}
