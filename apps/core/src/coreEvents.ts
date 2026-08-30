import { EventEmitter } from "node:events";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  type MediaMetadataUpdatedEventData,
} from "@smm/types/event-types";

export { MEDIA_METADATA_UPDATED_EVENT };

export interface CoreEventMap {
  [MEDIA_METADATA_UPDATED_EVENT]: MediaMetadataUpdatedEventData;
}

export type CoreEventName = keyof CoreEventMap;

export class CoreEventBus {
  private readonly emitter = new EventEmitter();

  on<E extends CoreEventName>(event: E, listener: (data: CoreEventMap[E]) => void): void {
    this.emitter.on(event, listener);
  }

  off<E extends CoreEventName>(event: E, listener: (data: CoreEventMap[E]) => void): void {
    this.emitter.off(event, listener);
  }

  once<E extends CoreEventName>(event: E, listener: (data: CoreEventMap[E]) => void): void {
    this.emitter.once(event, listener);
  }

  emit<E extends CoreEventName>(event: E, data: CoreEventMap[E]): void {
    this.emitter.emit(event, data);
  }
}
