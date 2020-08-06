import * as fs from 'fs';
import { map, trim } from 'lodash';
import { workspace as Workspace, window as Window, WorkspaceFolder, QuickPickItem, commands as Commands } from 'vscode';
import { isConfigAvailable } from './utils';
import { SynpetConfiguration } from './types';

interface WorkspaceFolderItem extends QuickPickItem {
  folder: WorkspaceFolder;
}

const pickFolder = async (
  folders: ReadonlyArray<WorkspaceFolder>,
  placeHolder: string
): Promise<WorkspaceFolder | undefined> => {
  if (folders.length === 1) {
    return Promise.resolve(folders[0]);
  }

  const selected = await Window.showQuickPick(
    folders.map<WorkspaceFolderItem>((folder) => {
      return { label: folder.name, description: folder.uri.fsPath, folder: folder };
    }),
    { placeHolder: placeHolder }
  );
  if (selected === undefined) {
    return undefined;
  }
  return selected.folder;
};

export const createDefaultConfiguration = (): void => {
  const folders = Workspace.workspaceFolders;
  if (!folders) {
    Window.showErrorMessage('A Synpet configuration can only be generated if VS Code is opened on a workspace folder.');
    return;
  }
  const noConfigFolders = folders.filter((folder) => !isConfigAvailable(folder.uri.fsPath));

  if (noConfigFolders.length === 0) {
    if (folders.length === 1) {
      Window.showInformationMessage('The workspace already contains a Snypet configuration file.');
    } else {
      Window.showInformationMessage('All workspace folders already contain a Snypet configuration file.');
    }
    return;
  }
  pickFolder(noConfigFolders, 'Select a workspace folder to generate a Snypet configuration for').then(
    async (folder) => {
      if (!folder) {
        return;
      }
      let config: SynpetConfiguration = {
        componentPath: '',
        prefix: '',
      };

      const answer = await Window.showInputBox({
        prompt: 'Enter your React component folder, (use comma seperated value for multiple folders)',
      });

      if (answer) {
        const componentPath = map(answer.split(','), trim);
        config = {
          ...config,
          componentPath,
        };
      }

      const folderRootPath = folder.uri.fsPath;
      const fileData = JSON.stringify(config, null, 2);
      fs.writeFile(`${folderRootPath}/.snypetrc.json`, fileData, (err) => {
        if (!err) {
          const message = `
Successfully created a snypet configuration for "${folder.name}"
Reload window in order to load the snippets.`;
          const action = 'Reload';
          Window.showInformationMessage(message, action).then((input) => {
            if (input === action) {
              Commands.executeCommand('workbench.action.reloadWindow');
            }
          });
        }
      });
    }
  );
};
