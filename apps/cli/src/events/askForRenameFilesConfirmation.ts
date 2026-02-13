import { acknowledge } from "../utils/socketIO";
import { 
  AskForRenameFilesConfirmation,
  type AskForRenameFilesConfirmationRequestData,
  type AskForRenameFilesConfirmationResponseData,
} from "@core/event-types";

export async function askForRenameFilesConfirmation(
  clientId: string,
  files: { from: string, to: string }[]): Promise<boolean> {

  const data: AskForRenameFilesConfirmationRequestData = {
    files: files
  }

  const resp = await acknowledge({
    event: AskForRenameFilesConfirmation.event,
    data,
    clientId: clientId,
  },
  );

  const respData = resp.data as AskForRenameFilesConfirmationResponseData;
  return respData.confirmed;
}