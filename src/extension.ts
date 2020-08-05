import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { parseComponents } from './component-parser';

var walk = function (dir) {
  var results = [];
  var list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = dir + '/' + file;
    var stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(walk(file));
    } else {
      /* Is a index file */
      if (file.endsWith('index.tsx')) {
        results.push(file);
      }
      // results.push(file);
    }
  });
  return results;
};

export function activate(context: vscode.ExtensionContext) {
  // Get files having components
  // TODO: enhance the logic to get components
  const packageDir = 'packages';
  const rootPath = vscode.workspace.rootPath;
  let componentData;

  if (rootPath) {
    const componentsRoot = path.join(rootPath, packageDir);
    const componentFiles = walk(componentsRoot);
    // Write logic to get component name
    componentData = parseComponents(componentFiles);
    console.log(componentData);

    // Hack to add the attributes
    componentData.forEach((component) => {
      component.attr = '';
      if (component.propTypeDef) {
        const keys = Object.keys(component.propTypeDef);
        if (keys.length > 0) {
          const attrs = keys.reduce((acc, key, index) => {
            return `${acc} 
            ${key}='\$\{${index + 1}\}'`;
          }, '');
          component.attr = attrs;
        }
      }
    });
  }

  const provider = vscode.languages.registerCompletionItemProvider(
    ['plaintext', 'javascript', 'typescript'],
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
      ) {
        let items = [];

        componentData.forEach((component) => {
          const snippetCompletion = new vscode.CompletionItem(
            component.componentName
          );

          snippetCompletion.insertText = new vscode.SnippetString(
            `<${component.componentName} ${component.attr}></${component.componentName}>`
          );

          items.push(snippetCompletion);
        });

        return items;
      },
    }
  );

  context.subscriptions.push(provider);
}
