/* eslint-disable @typescript-eslint/no-var-requires */
import { Project, Node, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

import { getTypeDef } from './utils';

const project = new Project({
  skipFileDependencyResolution: true,
});

type TPropDetail = {
  name?: string;
  type?: string;
  hasQuestionToken?: boolean;
};

// Refacting to make parser generic
const typeAliasPropParser = (str: string) => {
  const props = str
    .split('\n')
    .filter((txt) => txt.includes(':'))
    .map((txt) => txt.replace(/\s\s+/g, '').replace(';', ''));
  const propArray: any[] = [];

  props.forEach((element) => {
    const propDetail: TPropDetail = {};
    if (element.includes('?:')) {
      const [name, value] = element.split('?:');
      propDetail.name = name.trim();
      propDetail.type = value.trim();
      propDetail.hasQuestionToken = true;
    } else {
      const [name, value] = element.split('?:');
      propDetail.name = name.trim();
      propDetail.type = value.trim();
    }

    propArray.push(propDetail);
  });

  return propArray;
};

const getDefaultExport = (filePath: string): any => {
  const p = new Project({
    skipFileDependencyResolution: true,
  });
  p.addSourceFileAtPath(filePath);
  const sourceFile = p.getSourceFileOrThrow(filePath);

  const exports = sourceFile.getDefaultExportSymbol();
  const defaultExport: any = exports?.getDeclarations()[0];

  let exportedName: any;
  const structure = defaultExport?.getStructure();
  if (structure.name) {
    exportedName = structure.name;
  } else {
    exportedName = structure.expression;
  }

  let propType;
  let propTypeName;

  sourceFile.getClasses().forEach((cl) => {
    if (cl.getName() === exportedName) {
      const extendsFrom = cl.getExtends();
      const typeArg = extendsFrom?.getTypeArguments()[0]; // TODO: consider all the args
      const propName = typeArg?.getFullText() as string;
      propTypeName = propName;

      const typeAlias = sourceFile.getTypeAlias(propName);
      const interfaces = sourceFile.getInterface(propName);

      if (typeAlias) {
        const x = typeAlias.getStructure();
        propType = typeAliasPropParser(x.type as string);
      }

      if (interfaces) {
        propType = interfaces.getStructure().properties;
      }
    }
  });

  if (propType) {
    return {
      exportedName,
      propType,
      propTypeName,
    };
  }
};

//***** Refacting to make parser generic */

const getPropTypeName = (str: string): string => {
  try {
    return str.split('<')[1].split('>')[0].split(',')[0];
  } catch (error) {
    return str.split('<')[1].split('>')[0];
  }
};

const getComponentAliasForDefault = (rootNode: SourceFile): string => {
  let aliasName = '';
  rootNode.forEachChild(
    (leaf: { getFullText: () => any; forEachChild: (arg0: { (c: any): void; (c: any): void }) => void }) => {
      const fullText = leaf.getFullText();

      // If exported deafult, get identifier
      if (fullText.indexOf('export default') > -1) {
        leaf.forEachChild((c: Node<import('typescript').Node>) => {
          if (Node.isIdentifier(c)) {
            aliasName = c.getFullText().trim();
          }
        });
      } else if (fullText.indexOf('export default ') > -1 && fullText.indexOf('extends React') > -1) {
        leaf.forEachChild((c: Node<import('typescript').Node>) => {
          if (Node.isIdentifier(c) && !aliasName) {
            aliasName = c.getFullText().trim();
          }
        });
      }
    }
  );
  return aliasName;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getComponentAttributes = (
  calledFromFile: string,
  relativePath: string,
  componentName: string,
  componentImportedAs: string
) => {
  const p = new Project({
    skipFileDependencyResolution: true,
  });

  const dtsDirectory = path.dirname(calledFromFile);
  const filePath = `${path.join(dtsDirectory, relativePath)}.d.ts`;
  const rootNode = p.addSourceFileAtPath(filePath);
  let componentType;
  let alias: string = componentName;

  if (componentName === 'default') {
    alias = getComponentAliasForDefault(rootNode);
  }

  // Verymuch specific to AtlasKit
  // Need to make this generic
  if (alias === '_default') {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    alias = relativePath.split('/').pop()!;
    return {
      componentName: alias,
    };
  }

  if (
    rootNode.getFullText().indexOf('import React') === -1 &&
    rootNode.getFullText().indexOf('import { Component') === -1
  ) {
    // Not a react component
    return;
  }

  if (componentImportedAs === 'default') {
    const { propType, propTypeName } = getDefaultExport(filePath);
    if (propType) {
      return {
        componentName: alias,
        componentType: propTypeName,
        propTypeDef: propType,
      };
    }
  }

  rootNode.forEachChild((leaf) => {
    const leafText = leaf.getFullText();

    if (
      componentName === 'default' &&
      leafText.indexOf('export default ') > -1 &&
      leafText.indexOf('extends React') > -1
    ) {
      leaf.forEachChild((c) => {
        if (Node.isHeritageClause(c)) {
          componentType = getPropTypeName(c.getFullText());
        }
      });
    } else if (leafText.indexOf(alias) > -1 && leafText.indexOf('extends React') > -1) {
      // Code repeated: TODO - fix
      leaf.forEachChild((c) => {
        if (Node.isHeritageClause(c)) {
          componentType = getPropTypeName(c.getFullText());
        }
      });
    }
  });

  // If we figured out component type
  // let get typedef for those
  if (componentType) {
    const typeDef = getTypeDef(rootNode, componentType);
    return {
      componentName: alias,
      componentType: componentType,
      propTypeDef: typeDef,
    };
  } else if (alias) {
    return {
      componentName: alias,
    };
  }
};
interface IcomponentDetail {
  importedAs: string | undefined;
  exportedAs: string | undefined;
}
interface IcomponentAttr {
  componentName: string;
  componentType?: string;
  propTypeDef?: unknown;
}
interface IcomponentObj {
  fullText: string;
  componentNames: IcomponentDetail[];
}
const componentsDirectory: IcomponentAttr[] = [];
const getComponents = (dirpath: string): void => {
  if (!fs.existsSync(dirpath)) {
    return;
  }
  const rootNode = project.addSourceFileAtPath(dirpath);
  rootNode.forEachChild((leaf) => {
    if (Node.isExportDeclaration(leaf)) {
      const exportData: any = {
        fullText: leaf.getFullText().trim(),
      };

      leaf.forEachChild((exportNode) => {
        // Get all exports identifier
        if (Node.isNamedExports(exportNode)) {
          const componentNames: IcomponentDetail[] = [];
          exportNode.forEachChild((exportSpec) => {
            if (Node.isExportSpecifier(exportSpec)) {
              const componentDetail: IcomponentDetail = {
                importedAs: exportSpec.getFirstChild()?.getFullText().trim(),
                exportedAs: exportSpec.getLastChild()?.getFullText().trim(),
              };
              componentNames.push(componentDetail);
            }
          });
          exportData['componentNames'] = componentNames;
        }

        // Get the files from where components are imported
        if (Node.isStringLiteral(exportNode) && exportData['fullText'].indexOf('from') > 0) {
          exportData.path = exportNode.getFullText().trim().replace(/'|"/g, '');
          exportData['componentNames'].forEach((element: { exportedAs: string; importedAs: string }) => {
            const componentDetail: IcomponentAttr | undefined = getComponentAttributes(
              dirpath,
              exportData.path,
              element.exportedAs,
              element.importedAs
            );
            if (componentDetail) {
              componentsDirectory.push(componentDetail);
            }
          });
        }
      });
    }
  });
};

const getComponentDirectories = (directoryPath: string): void => {
  const list = fs.readdirSync(directoryPath);
  list.forEach(function (listItem) {
    const listItemPath = path.join(directoryPath, listItem);
    // Check if a directory, if not ignore for now [ship]
    const stat = fs.statSync(listItemPath);
    if (stat && stat.isDirectory()) {
      // find if it has package.json
      const packagePath: string = path.join(listItemPath, 'package.json');

      if (fs.existsSync(packagePath)) {
        try {
          const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
          if (packageContent.types) {
            const dts = path.join(listItemPath, packageContent.types);
            getComponents(dts);
          }
        } catch (error) {
          // eslint-disable-next-line no-undef
          console.error(`Error while getting file. ${error}`);
        }
      }
    }
  });
};

export const parseAtlaskit = (directory: string) => {
  getComponentDirectories(directory);
  return componentsDirectory;
};
