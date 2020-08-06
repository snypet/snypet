import * as vscode from 'vscode';
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
      const currentlyOpenTabfilePath = vscode.window.activeTextEditor.document.fileName;
      componentData.forEach((component) => {
        const snippetCompletion = new vscode.CompletionItem(component.componentName);
        //This is to get the relative file Path
        // const relativePath: string = getRelativePath(currentlyOpenTabfilePath, component.filePath);
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
