import * as vscode from 'vscode';
import { trimEnd } from 'lodash';

import { getComponentFiles } from './utils';
import { SUPPORTED_FILE_TYPES } from './constants';

import { parseComponents } from './component-parser';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const componentFiles = await getComponentFiles();
  if (!componentFiles.length) {
    vscode.window.showWarningMessage(
      'No components found. Please verify the `componentPath` value in `snypet` config file'
    );
    return;
  }

  let componentData = parseComponents(componentFiles);

  componentData.forEach((component) => {
    component.attr = '';
    const componentPropTypeDefs = component.propTypeDef;
    if (componentPropTypeDefs) {
      const keys = Object.keys(componentPropTypeDefs);
      if (keys.length > 0) {
        const attrs = keys.reduce((acc, key, index) => {
          return `${acc}\n\t${key}='$\{${index + 1}:${trimEnd(componentPropTypeDefs[key], ';')}}'`;
        }, '');
        component.attr = attrs;
      }
    }
  });

  const provider = vscode.languages.registerCompletionItemProvider(SUPPORTED_FILE_TYPES, {
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
          `<${component.componentName}${component.attr}>\n</${component.componentName}>`
        );

        items.push(snippetCompletion);
      });

      return items;
    },
  });

  context.subscriptions.push(provider);
}
