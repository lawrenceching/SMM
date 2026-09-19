import { describe, expect, test } from 'bun:test'
import { resolveElectronChromedriverBinary } from './electronChromedriverBinary.ts'

describe('resolveElectronChromedriverBinary', () => {
    test('uses CHROMEDRIVER only when that file exists', () => {
        expect(
            resolveElectronChromedriverBinary(
                { CHROMEDRIVER: '/opt/electron/chromedriver' },
                (candidate) => candidate === '/opt/electron/chromedriver',
            ),
        ).toBe('/opt/electron/chromedriver')
    })

    test('leaves auto-download in place when unset or missing', () => {
        expect(resolveElectronChromedriverBinary({}, () => true)).toBeUndefined()
        expect(
            resolveElectronChromedriverBinary({ CHROMEDRIVER: '/missing' }, () => false),
        ).toBeUndefined()
    })
})
