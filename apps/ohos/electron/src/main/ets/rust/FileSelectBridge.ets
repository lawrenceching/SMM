import { picker } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { completeSelectFile, registerSelectFileHandler } from './RustHello';

async function openFolderPicker(context: common.UIAbilityContext): Promise<void> {
  try {
    const options = new picker.DocumentSelectOptions();
    options.selectMode = picker.DocumentSelectMode.FOLDER;
    options.maxSelectNumber = 1;

    const documentPicker = new picker.DocumentViewPicker(context);
    const uris = await documentPicker.select(options);
    completeSelectFile(JSON.stringify({ uris }));
  } catch (err) {
    const error = err as BusinessError;
    if (error.code === 13900042) {
      completeSelectFile(JSON.stringify({ uris: [], cancelled: true }));
      return;
    }
    completeSelectFile(JSON.stringify({
      uris: [],
      error: error.message ?? JSON.stringify(err),
    }));
  }
}

export function setupFileSelectBridge(context: common.UIAbilityContext): void {
  registerSelectFileHandler(() => {
    openFolderPicker(context);
  });
}
