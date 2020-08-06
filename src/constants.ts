/**
 * @see [moduleName](https://github.com/davidtheclark/cosmiconfig#modulename)
 */
export const COSMICONFIG_MODULE_NAME = 'snypet';
export const COSMICONFIG_SEARCH_PLACES = [
  '.snypetrc',
  '.snypetrc.json',
  '.snypetrc.yaml',
  '.snypetrc.yml',
  '.snypetrc.js',
  '.snypet.config.js',
];

/**
 * Use the first thing that is searched as the default filename.
 * In this case `.snypetrc`
 */
export const DEFAULT_CONFIG_FILE_NAME = COSMICONFIG_SEARCH_PLACES[0];
