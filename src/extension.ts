import * as vscode from 'vscode';
import { window as Window, commands as Commands } from 'vscode';
import { trimEnd } from 'lodash';

import { getComponentFiles, getVscodeCurrentPath, getVscodeCurrentFolder, getSnypetConfigSync } from './utils';
import { SUPPORTED_FILE_TYPES, NO_CONFIG_ACTIONS } from './constants';
import { createDefaultConfiguration } from './commands';

import * as path from 'path';

import { parseComponents } from './component-parser';
import { parseAtlaskit } from './atlaskit-parser';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(Commands.registerCommand('snypet.createConfig', createDefaultConfiguration));

  const componentPath = getVscodeCurrentPath();
  const config = getSnypetConfigSync(componentPath);

  if (config && config.componentPath) {
    const componentFiles = await getComponentFiles();
    if (!componentFiles.length) {
      Window.showWarningMessage('No components found. Please verify the `componentPath` value in `snypet` config file');
    }
    let componentData = parseComponents(componentFiles);

    const { componentPath } = config;
    const ATLASKIT_PATH = 'node_modules/@atlaskit';
    // TODO: remove hardcoded atlaskit before publishing
    if (componentPath.includes(ATLASKIT_PATH)) {
      const atlasKitRoot: string = path.join(getVscodeCurrentPath(), 'node_modules/@atlaskit');
      const akData = parseAtlaskit(atlasKitRoot);
      componentData = componentData.concat(akData);
    }

    componentData.forEach((component: any) => {
      component.attr = '';
      const componentPropTypeDefs = component.propTypeDef;
      if (Array.isArray(componentPropTypeDefs)) {
        const attrs = componentPropTypeDefs.reduce((acc, prop, index) => {
          let comment = prop.value;

          if (prop.isOptional) {
            comment += ' ? ';
          }

          if (prop.comment) {
            comment += ` //${prop.comment.replace(/\r?\n|\r/g, ' ').replace(/'|"|`/g, '')}`;
          }

          const attributes = `${acc}\n\t${prop.name}='$\{${index + 1}:${trimEnd(comment, ';')}}'`;
          return attributes;
        }, '');
        component.attr = attrs;
      } else if (componentPropTypeDefs) {
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
        const items: vscode.CompletionItem[] = [];

        componentData.forEach((component: any) => {
          let snippetName = component.componentName;
          if (config.prefix) {
            snippetName = `${config.prefix}${snippetName}`;
          }
          const snippetCompletion = new vscode.CompletionItem(snippetName);
          snippetCompletion.insertText = new vscode.SnippetString(
            `<${component.componentName}${component.attr}>\n</${component.componentName}>`
          );

          items.push(snippetCompletion);
        });

        return items;
      },
    });

    context.subscriptions.push(provider);
  } else {
    const currentFolder = getVscodeCurrentFolder();
    let message = 'No Snypet configuration found. Would you like to add a config file?';
    if (currentFolder) {
      message = `No Snypet configuration found for ${currentFolder.name}. Would you like to add a config file?`;
    }
    const answer = await Window.showWarningMessage(message, NO_CONFIG_ACTIONS.ADD, NO_CONFIG_ACTIONS.IGNORE);
    if (answer === NO_CONFIG_ACTIONS.ADD) {
      await Commands.executeCommand('snypet.createConfig');
    }
  }
}
