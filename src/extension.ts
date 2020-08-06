import * as vscode from 'vscode';
import { window as Window, commands as Commands } from 'vscode';

import { getComponentFiles, isConfigAvailable, getVscodeCurrentPath } from './utils';
import { SUPPORTED_FILE_TYPES, NO_CONFIG_ACTIONS } from './constants';
import { createDefaultConfiguration } from './commands';

import { parseComponents } from './component-parser';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(Commands.registerCommand('snypet.createConfig', createDefaultConfiguration));

  const componentPath = getVscodeCurrentPath();
  if (isConfigAvailable(componentPath)) {
    const componentFiles = await getComponentFiles();
    if (!componentFiles.length) {
      Window.showWarningMessage('No components found. Please verify the `componentPath` value in `snypet` config file');
    }
    const componentData = parseComponents(componentFiles);

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
            `<${component.componentName} ${component.attr}>
  </${component.componentName}>`
          );

          items.push(snippetCompletion);
        });

        return items;
      },
    });

    context.subscriptions.push(provider);
  } else {
    const answer = await Window.showWarningMessage(
      'No configuration found for Snypet. Would you like to add a config file?',
      NO_CONFIG_ACTIONS.ADD,
      NO_CONFIG_ACTIONS.IGNORE
    );
    if (answer === NO_CONFIG_ACTIONS.ADD) {
      await Commands.executeCommand('snypet.createConfig');
    }
  }
}
