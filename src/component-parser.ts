import { Project, Node, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { getTypeDef } from './utils';

const project = new Project({
  skipFileDependencyResolution: true,
});

const getTypeDesc = (rootNode: SourceFile, propTypeVarName: string, currentFilePath: string): object | undefined => {
  // Need to implement better robust logic
  // Will do for quick hack
  const currentDirectory = currentFilePath.split('index.tsx')[0];

  let typeFilePath;
  rootNode.forEachChild((node) => {
    // If import declaration
    if (Node.isImportDeclaration(node)) {
      // check if propTypeVarName is in this declaration
      if (node.getFullText().indexOf(propTypeVarName) > -1) {
        // console.log(node.getFullText());
        node.forEachChild((child) => {
          if (Node.isStringLiteral(child)) {
            typeFilePath = child.getFullText().trim();
            typeFilePath = typeFilePath.replace(/'|"/g, '');
            typeFilePath = path.join(currentDirectory.trim(), typeFilePath.trim());
          }
        });
      }
    }
  });

  if (typeFilePath) {
    //TODO: create a forEach to figure the correct path
    const withTs = `${typeFilePath}.ts`;
    const withTsx = `${typeFilePath}.tsx`;
    const withIndexTs = `${typeFilePath}/index.ts`;
    const withIndexTsx = `${typeFilePath}/index.ts`;
    let correctPath;

    if (fs.existsSync(withTs)) {
      correctPath = withTs;
    } else if (fs.existsSync(withTsx)) {
      correctPath = withTsx;
    } else if (fs.existsSync(withIndexTs)) {
      correctPath = withIndexTs;
    } else if (fs.existsSync(withIndexTsx)) {
      correctPath = withIndexTsx;
    }

    if (!correctPath) {
      return;
    }

    const tsParser = new Project({
      skipFileDependencyResolution: true,
    });

    const typeRoot = tsParser.addSourceFileAtPath(correctPath);
    const typeDef = getTypeDef(typeRoot, propTypeVarName);

    return {
      propTypeDef: typeDef,
    };
  }
};

export const parseComponents = (files: string[]): unknown => {
  const componentsDetailArray: { componentName: undefined; componentType?: string; filePath?: string }[] = [];
  // Iterate through all the files to parse component data
  // and create array to further build snippets
  files.forEach((filePath) => {
    let componentName;
    let componentType: string | null = '';

    const rootNode = project.addSourceFileAtPath(filePath);
    rootNode.forEachChild((node) => {
      // Find any variable declaration among the child nodes
      if (Node.isVariableStatement(node)) {
        // If node is a variable declaration
        // and is exported as well
        if (node.getFirstChild()?.getFullText().trim() === 'export') {
          const exportVariableStatementChild = node.getFirstChild();

          // get the next sibling of export node
          // as most probably it will be the component variable name declaration ???CHECK???
          const variableDec = exportVariableStatementChild?.getNextSibling();

          // if variableDec has variableDeclarationList
          // chances are high to get component name
          if (variableDec && Node.isVariableDeclarationList(variableDec)) {
            // First declaration will be the component name
            const nameDec = variableDec.getDeclarations()[0];
            componentName = nameDec.getName();

            // iterate inside to get the prop types
            nameDec.forEachChild((child) => {
              if (Node.isTypeReferenceNode(child)) {
                componentType = child.getFullText().trim();
              }
            });
          }
        }
      }
    });
    if (componentType && componentType?.startsWith('React.FC')) {
      // TODO - Fix the code repititon
      try {
        const propType = componentType.split('<')[1].split('>')[0];
        let detail = {
          componentName,
          componentType: propType,
          filePath,
        };

        if (!propType.startsWith('{')) {
          detail = {
            ...detail,
            ...getTypeDesc(rootNode, propType, filePath),
            filePath,
          };
        }

        componentsDetailArray.push(detail);
      } catch (error) {
        componentsDetailArray.push({
          componentName,
        });
      }
    }
  });

  return componentsDetailArray;
};
