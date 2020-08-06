import { Project, Node, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

import { getTypeDef } from './utils';

const project = new Project({
  skipFileDependencyResolution: true,
});

const getPropTypeName = (str) => {
  try {
    return str.split('<')[1].split('>')[0].split(',')[0];
  } catch (error) {
    return str.split('<')[1].split('>')[0];
  }
};

const getComponentAliasForDefault = (rootNode) => {
  let aliasName;
  rootNode.forEachChild((leaf) => {
    const fullText = leaf.getFullText();

    // If exported deafult, get identifier
    if (fullText.indexOf('export default') > -1) {
      leaf.forEachChild((c) => {
        if (Node.isIdentifier(c)) {
          aliasName = c.getFullText().trim();
        }
      });
    } else if (fullText.indexOf('export default ') > -1 && fullText.indexOf('extends React') > -1) {
      leaf.forEachChild((c) => {
        if (Node.isIdentifier(c) && !aliasName) {
          aliasName = c.getFullText().trim();
        }
      });
    }
  });

  return aliasName;
};

const getPropDef = (typeName, file) => {
  const p = new Project({
    skipFileDependencyResolution: true,
  });
  const rootNode = p.addSourceFileAtPath(filePath);
};

const getComponentDetails = (calledFromFile, relativePath, componentName) => {
  const p = new Project({
    skipFileDependencyResolution: true,
  });

  const dtsDirectory = path.dirname(calledFromFile);
  const filePath = `${path.join(dtsDirectory, relativePath)}.d.ts`;
  const rootNode = p.addSourceFileAtPath(filePath);
  let componentType;
  let alias = componentName;

  if (componentName === 'default') {
    alias = getComponentAliasForDefault(rootNode);
  }

  // Verymuch specific to AtlasKit
  // Need to make this generic
  if (alias === '_default') {
    alias = relativePath.split('/').pop();
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
    const typeDef = getTypeDef(rootNode, componentType);
    return {
      componentName: alias,
      componentType: componentType,
      propTypeDef: typeDef,
    };
  }
};

const componentsDirectory = [];
const getComponents = (dirpath) => {
  if (!fs.existsSync(dirpath)) {
    return;
  }
  const rootNode = project.addSourceFileAtPath(dirpath);

  rootNode.forEachChild((leaf) => {
    if (Node.isExportDeclaration(leaf)) {
      const exportData = {
        fullText: leaf.getFullText().trim(),
      };

      leaf.forEachChild((exportNode) => {
        // Get all exports identifier
        if (Node.isNamedExports(exportNode)) {
          const componentNames = [];
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
          exportData['componentNames'].forEach((element) => {
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

const getComponentDirectories = (directoryPath) => {
  const list = fs.readdirSync(directoryPath);
  list.forEach(function (listItem) {
    const listItemPath = path.join(directoryPath, listItem);
    // Check if a directory, if not ignore for now [ship]
    const stat = fs.statSync(listItemPath);
    if (stat && stat.isDirectory()) {
      // find if it has package.json
      const packagePath = path.join(listItemPath, 'package.json');

      if (fs.existsSync(packagePath)) {
        try {
          const packageContent = require(packagePath);
          if (packageContent.types) {
            const dts = path.join(listItemPath, packageContent.types);
            getComponents(dts);
          }
        } catch (error) {}
      }
    }
  });
};

export const parseAtlaskit = (directory) => {
  getComponentDirectories(directory);
  return componentsDirectory;
};
