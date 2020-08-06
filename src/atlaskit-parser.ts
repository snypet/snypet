/* eslint-disable @typescript-eslint/no-var-requires */
import { Project, Node, SyntaxKind, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

import { getTypeDef } from './utils';

const project = new Project({
  skipFileDependencyResolution: true,
});

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
const getComponentDetails = (calledFromFile: string, relativePath: string, componentName: string) => {
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
    const typeDef = getTypeDef(rootNode);
    return {
      componentName: alias,
      componentType: componentType,
      propTypeDef: typeDef,
    };
  }
};

const componentsDirectory: (
  | { componentName: any; componentType?: undefined; propTypeDef?: undefined }
  | { componentName: any; componentType: never; propTypeDef: undefined }
)[] = [];
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
          const componentNames: { importedAs: string | undefined; exportedAs: string | undefined }[] = [];
          exportNode.forEachChild((exportSpec) => {
            if (Node.isExportSpecifier(exportSpec)) {
              const componentDetail = {
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
          exportData['componentNames'].forEach((element: { exportedAs: any }) => {
            const componentDetail = getComponentDetails(dirpath, exportData.path, element.exportedAs);
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
          // eslint-disable-next-line no-undef
          const packageContent = require(packagePath);
          if (packageContent.types) {
            const dts = path.join(listItemPath, packageContent.types);
            getComponents(dts);
          }
        } catch (error) {
          throw new Error(error);
        }
      }
    }
  });
};

export const parseAtlaskit = (directory: string) => {
  getComponentDirectories(directory);
  return componentsDirectory;
};
