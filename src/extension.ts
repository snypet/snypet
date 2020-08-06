import * as vscode from 'vscode';
import * as path from 'path';
import { walk, getSnypetConfig } from './utils';

import { parseComponents } from './component-parser';

export function activate(context: vscode.ExtensionContext) {
  // Get files having components
  // TODO: enhance the logic to get components
  const packageDir = 'packages';
  const rootPath = vscode.workspace.rootPath;
  let componentData;
  const config = getSnypetConfig();
  console.log('Log: config', config);

  if (rootPath) {
    const componentsRoot = path.join(rootPath, packageDir);
    const componentFiles = walk(componentsRoot);
    // Write logic to get component name
    componentData = parseComponents(componentFiles);

    // Hack to add the attributes
    componentData.forEach((component) => {
      component.attr = '';
      if (component.propTypeDef) {
        const keys = Object.keys(component.propTypeDef);
        if (keys.length > 0) {
          const attrs = keys.reduce((acc, key, index) => {
            return `${acc}
  ${key}='$\{${index + 1}}'`;
          }, '');
          component.attr = attrs;
        }
      }
    });
    console.log(componentData);
  }

  const provider = vscode.languages.registerCompletionItemProvider(
    ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
      ) {
        const items = [];

        componentData.forEach((component) => {
          const snippetCompletion = new vscode.CompletionItem(component.componentName);

          snippetCompletion.insertText = new vscode.SnippetString(
            `<${component.componentName} ${component.attr}>
  </${component.componentName}>`
          );

          items.push(snippetCompletion);
        });

        return items;
      },
    }
  );

  context.subscriptions.push(provider);
}
