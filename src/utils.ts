import * as fs from 'fs';
import * as vscode from 'vscode';

import { cosmiconfig } from 'cosmiconfig';
import { SynpetConfiguration } from './types';

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

/**
 * Searches for snypet config and returns a config if found or returns null
 */
export const getSnypetConfig = async (): Promise<SynpetConfiguration | null> => {
  const explorer = cosmiconfig(COSMICONFIG_MODULE_NAME);
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders[0]) {
      const currentFolder = workspaceFolders[0];
      const { path } = currentFolder.uri;
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
