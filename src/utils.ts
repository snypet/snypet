import * as fs from 'fs';
import { workspace as Workspace, window as Window, WorkspaceFolder as IWorkSpaceFolder } from 'vscode';
import * as path from 'path';
import { isArray, isString, concat } from 'lodash';
import { cosmiconfigSync } from 'cosmiconfig';

import { cosmiconfig } from 'cosmiconfig';
import { SynpetConfiguration } from './types';
import { COSMICONFIG_MODULE_NAME, FILETYPES } from './constants';
import { Node, SourceFile } from 'ts-morph';

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

export const getVscodeCurrentPath = (): string => {
  const workspaceFolders = Workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders[0]) {
    const currentFolder = workspaceFolders[0];
    const { path } = currentFolder.uri;
    return path;
  }
  return '';
};

// TODO: use this and deprecitate `getVscodeCurrentPath`
export const getVscodeCurrentFolder = (): IWorkSpaceFolder | null => {
  const workspaceFolders = Workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders[0]) {
    return workspaceFolders[0];
  }
  return null;
};

/**
 * Searches for snypet config and returns a config if found or returns null
 */
export const getSnypetConfig = async (path: string): Promise<SynpetConfiguration | null> => {
  try {
    const explorer = cosmiconfig(COSMICONFIG_MODULE_NAME, {
      stopDir: path, // only search in the current root directory
    });
    if (path) {
      const result = await explorer.search(path);
      if (result && !result.isEmpty) {
        return result.config;
      }
    }

    return null;
  } catch (e) {
    // eslint-disable-next-line no-undef
    console.error(`Some error occurred while creating the config file, Please try again!. ${e}`);
    return null;
  }
};

// TODO: remove duplicate code
export const getSnypetConfigSync = (path: string): SynpetConfiguration | null => {
  try {
    const explorer = cosmiconfigSync(COSMICONFIG_MODULE_NAME, {
      stopDir: path,
    });
    const result = explorer.search(path);
    if (result && !result.isEmpty) {
      return result.config;
    }
    return null;
  } catch (error) {
    console.error(`Some error occurred while creating the config file, Please try again!. ${error}`);
    return null;
  }
};

/**
 *  Returns all the components file paths based on the `componentPath` value in `snypet` config
 */
export const getComponentFiles = async (): Promise<string[]> => {
  let componentFiles: string[] = [];

  const rootPath = getVscodeCurrentPath();
  const config = await getSnypetConfig(rootPath || '');

  if (rootPath && config) {
    const { componentPath } = config;
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
  }
  return componentFiles;
};
export const isConfigAvailable = (path: string): boolean => {
  const config = getSnypetConfigSync(path);
  return !!config;
};
export const getRelativePath = (from: string, to: string): string | undefined => {
  try {
    const rootPath: string = getVscodeCurrentPath();
    let relativePath = path.relative(from.replace(rootPath, ''), to.replace(rootPath, ''));
    FILETYPES.map((types) => {
      relativePath = relativePath.replace(types, '');
    });
    return relativePath.replace('../', './');
  } catch (err) {
    console.error(`Some error occurred during getting relative path ${err}`);
    return;
  }
};

export const getCurrentFocusFile = (): string => {
  if (Window.activeTextEditor) {
    return Window.activeTextEditor.document.fileName;
  } else {
    return '';
  }
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const gettypeDefFromPropLiteral = (node: any): any => {
  const typeDefs: {}[] = [];
  node.forEachChild((n: Node<import('typescript').Node>) => {
    if (Node.isPropertySignature(n)) {
      const typeDef: any = {};
      n.forEachChild((nn) => {
        if (nn.getKindName() === 'Identifier') {
          const currentText = nn.getFullText().trim();
          if (currentText.indexOf('/**') > -1) {
            const [comment, name] = currentText.split('*/');
            typeDef.comment = comment.replace('/** ', '').trim();
            typeDef.name = name.trim();
          } else {
            typeDef.comment = undefined;
            typeDef.name = currentText;
          }
        } else if (nn.getKindName() === 'QuestionToken') {
          typeDef.hasQuestionToken = true;
        } else {
          typeDef.type = nn.getFullText().trim();
        }
      });

      typeDefs.push(typeDef);
    }
  });

  return typeDefs;
};

export const getTypeDef = (root: SourceFile, typeName: string): unknown => {
  let typeDef;

  root.forEachChild((c) => {
    if (Node.isInterfaceDeclaration(c) && c.getFullText().indexOf(typeName) > -1) {
      typeDef = gettypeDefFromPropLiteral(c);
    }

    if (Node.isTypeAliasDeclaration(c) && c.getFullText().indexOf(typeName) > -1) {
      c.forEachChild((cc) => {
        if (cc.getKindName() === 'TypeLiteral') {
          typeDef = gettypeDefFromPropLiteral(cc);
        }
      });
    }
  });
  return typeDef;
};
