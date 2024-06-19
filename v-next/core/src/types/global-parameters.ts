import type {
  ParameterType,
  ParameterTypeToValueType,
  ParameterValue,
} from "./common.js";

/**
 * A global parameter with an associated value and a default if not provided by
 * the user. They are available in the Hardhat Runtime Environment.
 *
 * They can be provided in these different ways:
 *  1. Through environment variables, with the format
 *     `HARDHAT_<PARAM_NAME_WITH_THIS_CASING>`.
 *  2. Through the CLI with the format `--<param-name-with-this-casing> <value>`.
 *    2.1. Through the CLI with the format `--<param-name-with-this-casing>` if
 *      the parameter is boolean and its default value is `false`.
 *
 * If both are present, the second one takes precedence.
 */
export interface GlobalParameter<T extends ParameterType = ParameterType> {
  name: string;
  description: string;
  parameterType: ParameterType;
  defaultValue: ParameterTypeToValueType<T>;
}

/**
 * The values of each global parameter for a certain instance of the Hardhat
 * Runtime Environment.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface -- To be used through module augmentation
export interface GlobalArguments extends Record<string, ParameterValue> {}

/**
 * An entry in the global parameters map.
 * @see GlobalParametersMap
 */
export interface GlobalParametersMapEntry {
  pluginId: string;
  param: GlobalParameter;
}

/**
 * A map with all the `GlobalParameter`s and which plugin defined them.
 */
export type GlobalParametersMap = Map<string, GlobalParametersMapEntry>;
