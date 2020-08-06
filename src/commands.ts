import { cosmiconfigSync } from 'cosmiconfig';
import { workspace as Workspace, window as Window, commands as Commands } from 'vscode';

import { COSMICONFIG_MODULE_NAME } from './constants';

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
};
