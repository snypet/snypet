import * as vscode from 'vscode';

import { getSnypetConfig, getVscodeCurrentPath, getComponentFiles } from './utils';
import { SUPPORTED_FILES_TYPES } from './constants';

import { parseComponents } from './component-parser';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let componentData;

  const rootPath = getVscodeCurrentPath();
  const config = await getSnypetConfig();

  if (rootPath && config) {
    const { componentPath } = config;
    const componentFiles = getComponentFiles(rootPath, componentPath);

    componentData = parseComponents(componentFiles);

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

  const provider = vscode.languages.registerCompletionItemProvider(SUPPORTED_FILES_TYPES, {
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
  });

  context.subscriptions.push(provider);
}
