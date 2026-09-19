import { describe, expect, test } from 'bun:test'
import { electronCiAppArgs } from './electronCiAppArgs.ts'

describe('electronCiAppArgs', () => {
    test('adds sandbox and gpu flags only for Linux CI', () => {
        expect(electronCiAppArgs({ CI: 'true' }, 'linux')).toEqual([
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
        ])
    })

    test('leaves local Linux and other CI platforms unchanged', () => {
        expect(electronCiAppArgs({}, 'linux')).toEqual([])
        expect(electronCiAppArgs({ CI: 'true' }, 'win32')).toEqual([])
        expect(electronCiAppArgs({ CI: 'true' }, 'darwin')).toEqual([])
        expect(electronCiAppArgs({ CI: '1' }, 'linux')).toEqual([])
    })
})
