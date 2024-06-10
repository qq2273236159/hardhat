import type { HardhatUserConfig } from "./src/config.js";

import { overrideTask, task, configVariable, emptyTask } from "./src/config.js";

const exampleEmptyTask = emptyTask("empty", "An example empty task").build();

const exampleEmptySubtask = task(["empty", "task"])
  .setDescription("An example empty subtask task")
  .setAction(async (_, _hre) => {
    console.log("empty task");
  })
  .build();

const exampleTaskOverride = task("example2")
  .setAction(async (_, _hre) => {
    console.log("from an override");
  })
  .setDescription("An example task")
  .addVariadicParameter({
    name: "testFiles",
    description: "An optional list of files to test",
    // defaultValue: [],
  })
  .addNamedParameter({
    name: "noCompile",
    description: "Don't compile before running this task",
  })
  .addFlag({
    name: "parallel",
    description: "Run tests in parallel",
  })
  .addFlag({
    name: "bail",
    description: "Stop running tests after the first test failure",
  })
  .addNamedParameter({
    name: "grep",
    description: "Only run tests matching the given string or regexp",
  })
  .build();

const testTask = task("test", "Runs mocha tests")
  .addVariadicParameter({
    name: "testFiles",
    description: "An optional list of files to test",
    // defaultValue: [],
  })
  .addNamedParameter({
    name: "noCompile",
    description: "Don't compile before running this task",
  })
  .addFlag({
    name: "parallel",
    description: "Run tests in parallel",
  })
  .addFlag({
    name: "bail",
    description: "Stop running tests after the first test failure",
  })
  .addNamedParameter({
    name: "grep",
    description: "Only run tests matching the given string or regexp",
  })
  .setAction(import.meta.resolve("./tasks/non-existing.ts"))
  .build();

const testTaskOverride = overrideTask("test")
  .addFlag({
    name: "newFlag",
    description: "A new flag",
  })
  .setAction((_taskArguments, _hre, _runSuper) => {})
  .build();

const testSolidityTask = task(["test", "solidity"], "Runs Solidity tests")
  .setAction(async () => {
    console.log("Running Solidity tests");
  })
  .build();

export default {
  tasks: [
    exampleTaskOverride,
    testTask,
    testTaskOverride,
    testSolidityTask,
    exampleEmptyTask,
    exampleEmptySubtask,
  ],
  privateKey: configVariable("privateKey"),
} satisfies HardhatUserConfig;
