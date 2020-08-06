import * as fs from 'fs';
import { cosmiconfig } from 'cosmiconfig';
import { COSMICONFIG_SEARCH_PLACES, COSMICONFIG_MODULE_NAME } from './constants';
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
    const result = await explorer.search();
    if (result && !result.isEmpty) {
      return result.config;
    }
    return null;
  } catch (e) {
    console.error(`Some error occurred while creating the config file, Please try again!. ${e}`);
    return null;
  }
};
