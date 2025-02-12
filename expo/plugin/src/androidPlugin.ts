import {
  AndroidConfig,
  ConfigPlugin,
  WarningAggregator,
  withProjectBuildGradle,
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod
} from '@expo/config-plugins';

import {
  mergeContents,
  removeContents,
} from "@expo/config-plugins/build/utils/generateCode";


type Props = {
  //ext?:Map<string,string|boolean>
  license?: string
}

import path from 'path';
import fs from 'fs';

const PUBLIC_MODULE = 'react-native-background-geolocation';
const PRIVATE_MODULE = PUBLIC_MODULE + '-android';
const NODE_MODULES = path.join('.', 'node_modules');

const META_LICENSE_KEY = "com.transistorsoft.locationmanager.license";

const MODULE_NAME = fs.existsSync(path.join(NODE_MODULES, PUBLIC_MODULE)) ? PUBLIC_MODULE : PRIVATE_MODULE;

const { addMetaDataItemToMainApplication, getMainApplicationOrThrow } = AndroidConfig.Manifest;

const androidPlugin: ConfigPlugin<Props> = (config, props={}) => {
  config = withProjectBuildGradle(config, ({ modResults, ...subConfig }) => {
    if (modResults.language !== 'groovy') {
      WarningAggregator.addWarningAndroid(
        'withBackgroundGeolocation',
        `Cannot automatically configure project build.gradle if it's not groovy`,
      );
      return { modResults, ...subConfig };
    }

    modResults.contents = applyMavenUrl(modResults.contents);

    return { modResults, ...subConfig };
  });

  config = withAppBuildGradle(config, ({ modResults, ...subConfig }) => {
    if (modResults.language !== 'groovy') {
      WarningAggregator.addWarningAndroid(
        'withBackgroundGeolocation',
        `Cannot automatically configure project build.gradle if it's not groovy`,
      );
      return { modResults, ...subConfig };
    }

    modResults.contents = applyAppGradle(modResults.contents);

    return { modResults, ...subConfig };
  });

  config = withAndroidManifest(config, async (config) => {

    const mainApplication = getMainApplicationOrThrow(config.modResults);

    addMetaDataItemToMainApplication(
      mainApplication,
      META_LICENSE_KEY,
      props.license || "UNDEFINED"
    );
    return config;

  });

  return config;
};

const applyAppGradle = (buildGradle:string) => {
  // Apply background-geolocation.gradle
  const newSrc = [];

  newSrc.push(`Project background_geolocation = project(':${MODULE_NAME}')`)
  newSrc.push(`apply from: "\${background_geolocation.projectDir}/app.gradle"`)

  buildGradle = mergeContents({
    tag: `[${MODULE_NAME}]-project`,
    src: buildGradle,
    newSrc: newSrc.join("\n"),
    anchor: /\"react\.gradle\"\)/,
    offset: 1,
    comment: "//",
  }).contents;

  buildGradle = mergeContents({
    tag: `[${MODULE_NAME}]-proguard`,
    src: buildGradle,
    newSrc: `\t    proguardFiles "\${background_geolocation.projectDir}/proguard-rules.pro"`,
    anchor: /\"proguard-rules.pro\"/,
    offset: 1,
    comment: "//",
  }).contents;

  return buildGradle;

}

/**
 * DISABLED in favour of gradle.properties
 *
const applyExtVars = (buildGradle: string, props:Props) => {

  const newSrc = [];

  const ext = props.ext;
  if (ext) {
    for (let [key, value] of ext) {
      if (typeof(value) === 'boolean') {
        newSrc.push(`\t${key} = ${value}`)
      } else {
        newSrc.push(`\t${key} = "${value}"`)
      }
    }
  }

  return mergeContents({
    tag: `[${MODULE_NAME}-ext`,
    src: buildGradle,
    newSrc: newSrc.join("\n"),
    anchor: /ext(?:\s+)?\{/,
    offset: 1,
    comment: "//",
  }).contents;
}
*/

const applyMavenUrl = (buildGradle: string):string => {
  return mergeContents({
    tag: `[${MODULE_NAME}-maven`,
    src: buildGradle,
    newSrc: `\tmaven { url "\${project(":${MODULE_NAME}").projectDir}/libs" }`,
    anchor: /mavenLocal\(\)/,
    offset: 1,
    comment: "//",
  }).contents;
}

export default androidPlugin;

