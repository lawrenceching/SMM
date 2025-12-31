import { sendAndWaitForResponse } from "@/utils/websocketManager";
import {AskForRenameFilesConfirmation } from "@core/event-types";

export async function askForRenameFilesConfirmation(
    clientId: string, 
    files: {from: string, to: string}[]): Promise<boolean> {

    const data: AskForRenameFilesConfirmation.RequestData = {
        files: files
    }

    const resp = await sendAndWaitForResponse(
        {
          event: AskForRenameFilesConfirmation.event,
          data,
        },
        '', // responseEvent not needed with Socket.IO acknowledgements
        30000, // 30 second timeout
        clientId // Send to specific client room
      );

    const respData = resp.data as AskForRenameFilesConfirmation.ResponseData;
    return respData.confirmed;
}