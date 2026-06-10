import { common } from '@kit.AbilityKit';
import LogUtil from 'web_engine/src/main/ets/utils/LogUtil';
import { startHttpServer } from './RustHello';
import { setupFileSelectBridge } from './FileSelectBridge';

const TAG: string = 'RustBridgeInit';
export const RUST_HTTP_PORT: number = 18080;

export function initRustBridge(context: common.UIAbilityContext): void {
  try {
    setupFileSelectBridge(context);

    if (startHttpServer(RUST_HTTP_PORT)) {
      LogUtil.info(TAG, `HTTP server started on 0.0.0.0:${RUST_HTTP_PORT}`);
    } else {
      LogUtil.warn(TAG, `HTTP server not started (port ${RUST_HTTP_PORT} may already be in use)`);
    }
  } catch (err) {
    LogUtil.error(TAG, `initRustBridge failed: ${JSON.stringify(err)}`);
  }
}
