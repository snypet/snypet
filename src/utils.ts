import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { isArray, isString, concat } from 'lodash';

import { cosmiconfig } from 'cosmiconfig';
import { SynpetConfiguration } from './types';
import { COSMICONFIG_MODULE_NAME } from './constants';

export const walk = (dir: string): string[] => {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(walk(file));
    } else {
      /* Is a index file */
      if (file.endsWith('index.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
};

export const getVscodeCurrentPath = (): string | undefined => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders[0]) {
    const currentFolder = workspaceFolders[0];
    const { path } = currentFolder.uri;
    return path;
  }
  return;
};

/**
 * Searches for snypet config and returns a config if found or returns null
 */
export const getSnypetConfig = async (): Promise<SynpetConfiguration | null> => {
  const explorer = cosmiconfig(COSMICONFIG_MODULE_NAME);
  try {
    const path = getVscodeCurrentPath();
    if (path) {
      const result = await explorer.search(path);
      if (result && !result.isEmpty) {
        return result.config;
      }
    }
    return null;
  } catch (e) {
    console.error(`Some error occurred while creating the config file, Please try again!. ${e}`);
    return null;
  }
};

/**
 *  Returns all the components file paths based on the `componentPath` value in `snypet` config
 */
export const getComponentFiles = (rootPath: string, componentPath: string | string[]): string[] => {
  let componentFiles: string[] = [];
  if (isString(componentPath)) {
    const componentsRoot = path.join(rootPath, componentPath);
    componentFiles = concat(componentFiles, walk(componentsRoot));
  }

  if (isArray(componentPath)) {
    componentPath.forEach((filePath) => {
      const componentsRoot = path.join(rootPath, filePath);
      componentFiles = concat(componentFiles, walk(componentsRoot));
    });
  }
  return componentFiles;
};
