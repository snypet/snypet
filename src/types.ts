/**
 * Synpet configuration
 */
export interface SynpetConfiguration {
  componentPath: string | string[];
  prefix?: string;
  snippetFileName?: string;
  displayComments?: boolean;
  optionalProps?: boolean;
}
