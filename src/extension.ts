import * as vscode from 'vscode';
import { window as Window, commands as Commands, ProgressLocation } from 'vscode';
import { trimEnd } from 'lodash';

import { getComponentFiles, getVscodeCurrentPath, getVscodeCurrentFolder, getSnypetConfigSync } from './utils';
import { SUPPORTED_FILE_TYPES, NO_CONFIG_ACTIONS } from './constants';
import { createConfigFile } from './commands';

import * as path from 'path';

import { parseComponents } from './component-parser';
import { parseAtlaskit } from './atlaskit-parser';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(Commands.registerCommand('snypet.createConfig', createConfigFile));

  const componentPath = getVscodeCurrentPath();
  const config = getSnypetConfigSync(componentPath);

  if (config && config.componentPath) {
    Window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Snypet🦜: Generating snippets...',
        cancellable: false,
      },
      async () => {
        const { displayComments = false, optionalProps = false } = config;
        const componentFiles = await getComponentFiles();
        if (!componentFiles.length) {
          Window.showWarningMessage(
            'No components found. Please verify the `componentPath` value in `snypet` config file'
          );
        }
        let componentData = parseComponents(componentFiles) as any[];

        const { componentPath } = config;
        const ATLASKIT_PATH = 'node_modules/@atlaskit';
        // TODO: remove hardcoded atlaskit before publishing
        if (componentPath.includes(ATLASKIT_PATH)) {
          const atlasKitRoot: string = path.join(getVscodeCurrentPath(), ATLASKIT_PATH);
          const akData = parseAtlaskit(atlasKitRoot);
          componentData = componentData.concat(akData);
        }

        componentData.forEach((component: any) => {
          component.attr = '';
          const componentPropTypeDefs = component.propTypeDef;
          if (Array.isArray(componentPropTypeDefs)) {
            const attrs = componentPropTypeDefs.reduce((acc, prop, index) => {
              let comment = prop.type
                .replace(/\s\s+/g, ' ')
                .replace(/'|"|`|{|}/g, '')
                .replace(/\r?\n|\r/g, '');

              if (prop.hasQuestionToken && !optionalProps) {
                return acc;
              }

              if (prop.hasQuestionToken && displayComments) {
                comment += ' ? ';
              }

              if (prop.comment && displayComments) {
                comment += ` //${prop.comment
                  .replace(/\s\s+/g, ' ')
                  .replace(/'|"|`|{|}/g, '')
                  .replace(/\r?\n|\r/g, '')}`;
              }

              const attributes = `${acc}\n\t${prop.name}='$\{${index + 1}:${trimEnd(comment, ';')}}'`;
              return attributes;
            }, '');
            component.attr = attrs;
          }
        });

        const provider = vscode.languages.registerCompletionItemProvider(SUPPORTED_FILE_TYPES, {
          provideCompletionItems() {
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
      }
    );
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
