import type {
  ParameterTypeToValueType,
  ParameterValue,
} from "../types/common.js";
import type {
  GlobalArguments,
  GlobalParameter,
  GlobalParametersMap,
} from "../types/global-parameters.js";
import type { HardhatPlugin } from "../types/plugins.js";

import { HardhatError } from "@nomicfoundation/hardhat-errors";
import { camelToSnakeCase } from "@nomicfoundation/hardhat-utils/string";

import { ParameterType } from "../types/common.js";

import {
  RESERVED_PARAMETER_NAMES,
  isParameterValueValid,
  isValidParamNameCasing,
  parseParameterValue,
} from "./parameters.js";

/**
 * Builds a map of the global parameter definitions by going through all the
 * plugins and validating the global parameters they define.
 *
 * Note: this function can be used before initializing the HRE, so the plugins
 * shouldn't be consider validated. Hence, we should validate the global
 * parameters.
 */
export function buildGlobalParametersMap(
  resolvedPlugins: HardhatPlugin[],
): GlobalParametersMap {
  const globalParametersMap: GlobalParametersMap = new Map();

  for (const plugin of resolvedPlugins) {
    if (plugin.globalParameters === undefined) {
      continue;
    }

    for (const param of plugin.globalParameters) {
      const existingByName = globalParametersMap.get(param.name);
      if (existingByName !== undefined) {
        throw new HardhatError(
          HardhatError.ERRORS.GENERAL.GLOBAL_PARAMETER_ALREADY_DEFINED,
          {
            plugin: plugin.id,
            globalParameter: param.name,
            definedByPlugin: existingByName.pluginId,
          },
        );
      }

      const validatedGlobalParam = buildGlobalParameterDefinition(param);

      const mapEntry = {
        pluginId: plugin.id,
        param: validatedGlobalParam,
      };

      globalParametersMap.set(validatedGlobalParam.name, mapEntry);
    }
  }

  return globalParametersMap;
}

/**
 * Builds a global parameter definition, validating the name, type, and default
 * value.
 */
export function buildGlobalParameterDefinition<T extends ParameterType>({
  name,
  description,
  parameterType,
  defaultValue,
}: {
  name: string;
  description: string;
  parameterType?: T;
  defaultValue: ParameterTypeToValueType<T>;
}): GlobalParameter {
  const type = parameterType ?? ParameterType.STRING;

  if (!isValidParamNameCasing(name)) {
    throw new HardhatError(HardhatError.ERRORS.ARGUMENTS.INVALID_NAME, {
      name,
    });
  }

  if (RESERVED_PARAMETER_NAMES.has(name)) {
    throw new HardhatError(HardhatError.ERRORS.ARGUMENTS.RESERVED_NAME, {
      name,
    });
  }

  if (!isParameterValueValid(type, defaultValue)) {
    throw new HardhatError(
      HardhatError.ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE,
      {
        value: defaultValue,
        name: "defaultValue",
        type: parameterType,
      },
    );
  }

  return {
    name,
    description,
    parameterType: type,
    defaultValue,
  };
}

/**
 * Resolves the global arguments by parsing the user provided arguments and
 * environment variables. The arguments are validated against the global
 * parameter definitions, and the default values are used when the arguments
 * are not provided. Only the arguments defined in the global parameters map
 * are resolved.
 *
 * @param userProvidedGlobalArguments The arguments provided by the user. These
 * take precedence over environment variables.
 * @param globalParametersMap The map of global parameter definitions to
 * validate the arguments.
 */
export function resolveGlobalArguments(
  userProvidedGlobalArguments: Partial<GlobalArguments>,
  globalParametersMap: GlobalParametersMap,
): GlobalArguments {
  const globalArguments: GlobalArguments = {};
  // iterate over the definitions to parse and validate the arguments
  for (const [name, { param }] of globalParametersMap) {
    let value =
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      -- GlobalArguments is empty for user extension, so we need to cast it to
      assign the value. */
      (userProvidedGlobalArguments as Record<string, string | undefined>)[name];
    if (value === undefined) {
      value = process.env[`HARDHAT_${camelToSnakeCase(name).toUpperCase()}`];
    }

    let parsedValue: ParameterValue;
    if (value !== undefined) {
      parsedValue = parseParameterValue(value, param.parameterType, name);
    } else {
      parsedValue = param.defaultValue;
    }

    globalArguments[name] = parsedValue;
  }

  return globalArguments;
}
