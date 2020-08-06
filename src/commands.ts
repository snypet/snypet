import { cosmiconfigSync } from 'cosmiconfig';
import * as fs from 'fs';
import { workspace as Workspace, window as Window, WorkspaceFolder, QuickPickItem } from 'vscode';

import { COSMICONFIG_MODULE_NAME } from './constants';

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
  const noConfigFolders = folders.filter((folder) => {
    const explorer = cosmiconfigSync(COSMICONFIG_MODULE_NAME, {
      stopDir: folder.uri.fsPath,
    });
    const config = explorer.search(folder.uri.fsPath);
    return config ? false : true;
  });

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
      let config = {
        componentPath: '',
        prefix: '',
      };

      const componentPath = await Window.showInputBox({
        prompt: 'Select your React component folder',
      });

      if (componentPath) {
        config = {
          ...config,
          componentPath,
        };
      }
      const folderRootPath = folder.uri.fsPath;
      const fileData = JSON.stringify(config, null, 2);
      fs.writeFile(`${folderRootPath}/.snypetrc.json`, fileData, (err) => {
        if (!err) {
          Window.showInformationMessage(`Successfully created a snypet configuration for ${folder.name}`);
        }
      });
    }
  );
};
