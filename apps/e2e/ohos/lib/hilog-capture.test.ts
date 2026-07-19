import { describe, expect, test } from 'bun:test'
import { toElectronLogLine } from './hilog-capture'

describe('toElectronLogLine', () => {
    test('strips hilog metadata from Electron-tagged lines', () => {
        const raw =
            "07-19 00:44:42.187 22229 22463 I A00001/com.huawei.ohos_electron/Electron: [core-routes] doDeleteFolder: folder already absent { folderPath: '/data/storage/el2/base/files/metadata' }"
        expect(toElectronLogLine(raw)).toBe(
            "07-19 00:44:42.187 [core-routes] doDeleteFolder: folder already absent { folderPath: '/data/storage/el2/base/files/metadata' }",
        )
    })

    test('keeps continuation lines that still carry the Electron tag', () => {
        const raw =
            '07-19 00:44:42.187 22229 22463 I A00001/com.huawei.ohos_electron/Electron:   filePath: \'/data/storage/el2/base/files/smm.json\','
        expect(toElectronLogLine(raw)).toBe(
            "07-19 00:44:42.187   filePath: '/data/storage/el2/base/files/smm.json',",
        )
    })

    test('drops non-Electron tags', () => {
        const raw =
            '07-19 00:44:42.187 1107 59750 E C01723/resource_schedule_service/APP_NAP: appId:com.huawei.ohos_electron'
        expect(toElectronLogLine(raw)).toBeNull()
    })

    test('drops comment / header lines', () => {
        expect(toElectronLogLine('# ohos hilog capture started')).toBeNull()
    })
})
