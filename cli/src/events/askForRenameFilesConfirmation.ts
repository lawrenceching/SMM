import { acknowledge } from "../utils/socketIO";
import { AskForRenameFilesConfirmation } from "@core/event-types";

export async function askForRenameFilesConfirmation(
  clientId: string,
  files: { from: string, to: string }[]): Promise<boolean> {

  const data: AskForRenameFilesConfirmation.RequestData = {
    files: files
  }

  const resp = await acknowledge({
    event: AskForRenameFilesConfirmation.event,
    data,
    clientId: clientId,
  },
  );

  const respData = resp.data as AskForRenameFilesConfirmation.ResponseData;
  return respData.confirmed;
}