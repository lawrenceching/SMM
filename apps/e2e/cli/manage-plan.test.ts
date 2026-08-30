import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { $ } from 'bun'
import { tvShowFolder } from '../test/actions/import-folders'
import { setup, cleanup, bin } from './base'
import {
    createAndImportInitializedFolder,
    parsePlanId,
    planFilePath,
    cliOutput,
} from './helpers'

const timeout = 60_000

describe('manage-plan', () => {
    beforeEach(async () => {
        await setup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: () => {},
        })
    })

    afterEach(async () => {
        await cleanup({
            binary: bin,
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            resetUserConfig: true,
        })
    })

    it(
        'plan list filters by folder and supports json',
        async () => {
            const folderA = await createAndImportInitializedFolder(
                bin,
                { ...tvShowFolder, folderName: 'ManagePlan A 123123' },
                { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
            )
            const folderB = await createAndImportInitializedFolder(
                bin,
                { ...tvShowFolder, folderName: 'ManagePlan B 456456' },
                { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
            )
            const pathA = folderA.path!
            const pathB = folderB.path!

            const tried = await $`${bin} try-to-recognize ${pathA}`.nothrow()
            expect(tried.exitCode).toBe(0)
            const planId = parsePlanId(tried.text())

            const listedAll = await $`${bin} plan list`.nothrow()
            expect(listedAll.exitCode).toBe(0)
            expect(listedAll.text()).toContain(planId)
            expect(listedAll.text()).toContain('recognize-media-file')
            expect(listedAll.text()).toContain('pending')

            const listedA = await $`${bin} plan list ${pathA}`.nothrow()
            expect(listedA.exitCode).toBe(0)
            expect(listedA.text()).toContain(planId)

            const listedB = await $`${bin} plan list ${pathB}`.nothrow()
            expect(listedB.exitCode).toBe(0)
            expect(listedB.text()).not.toContain(planId)

            const listJson = await $`${bin} plan list --format json`.nothrow()
            expect(listJson.exitCode).toBe(0)
            const listBody = JSON.parse(listJson.text()) as { plans: Array<{ id: string }> }
            expect(listBody.plans.some((p) => p.id === planId)).toBe(true)
        },
        timeout,
    )

    it(
        'plan show and plan apply',
        async () => {
            const folder = await createAndImportInitializedFolder(
                bin,
                { ...tvShowFolder, folderName: 'ManagePlan ShowApply 111' },
                { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
            )
            const folderPath = folder.path!

            const tried = await $`${bin} try-to-recognize ${folderPath}`.nothrow()
            expect(tried.exitCode).toBe(0)
            const planId = parsePlanId(tried.text())

            const shown = await $`${bin} plan show ${planId}`.nothrow()
            expect(shown.exitCode).toBe(0)
            expect(shown.text()).toMatch(new RegExp(`plan:\\s+${planId}`))
            expect(shown.text()).toMatch(/task:\s+recognize-media-file/)
            expect(shown.text()).toContain('S01E01')

            const shownJson = await $`${bin} plan show ${planId} --format json`.nothrow()
            expect(shownJson.exitCode).toBe(0)
            const showBody = JSON.parse(shownJson.text()) as { plan: { id: string; task: string } }
            expect(showBody.plan.id).toBe(planId)
            expect(showBody.plan.task).toBe('recognize-media-file')

            const applied = await $`${bin} plan apply ${planId}`.nothrow()
            expect(applied.exitCode).toBe(0)
            expect(applied.text()).toMatch(/applied .* \(3 file\(s\)\)/)
            expect(existsSync(await planFilePath(bin, planId))).toBe(false)
        },
        timeout,
    )

    it(
        'reject hides from list unless --all',
        async () => {
            const folder = await createAndImportInitializedFolder(
                bin,
                { ...tvShowFolder, folderName: 'ManagePlan Reject 222' },
                { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
            )
            const tried = await $`${bin} try-to-recognize ${folder.path!}`.nothrow()
            expect(tried.exitCode).toBe(0)
            const planId = parsePlanId(tried.text())

            const rejected = await $`${bin} reject ${planId}`.nothrow()
            expect(rejected.exitCode).toBe(0)
            expect(rejected.text()).toMatch(new RegExp(`rejected\\s+${planId}`))
            expect(existsSync(await planFilePath(bin, planId))).toBe(true)
            const planAfterReject = JSON.parse(
                readFileSync(await planFilePath(bin, planId), 'utf-8'),
            ) as { status: string }
            expect(planAfterReject.status).toBe('rejected')

            const listedAfterReject = await $`${bin} plan list`.nothrow()
            expect(listedAfterReject.exitCode).toBe(0)
            expect(listedAfterReject.text()).not.toContain(planId)

            const listedAllStatuses = await $`${bin} plan list --all`.nothrow()
            expect(listedAllStatuses.exitCode).toBe(0)
            expect(listedAllStatuses.text()).toContain(planId)
            expect(listedAllStatuses.text()).toContain('rejected')
        },
        timeout,
    )

    it(
        'plan reject alias and missing plan',
        async () => {
            const folder = await createAndImportInitializedFolder(
                bin,
                { ...tvShowFolder, folderName: 'ManagePlan RejectAlias 789' },
                { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
            )
            const tried = await $`${bin} try-to-recognize ${folder.path!}`.nothrow()
            expect(tried.exitCode).toBe(0)
            const planId = parsePlanId(tried.text())

            const rejected = await $`${bin} plan reject ${planId}`.nothrow()
            expect(rejected.exitCode).toBe(0)
            expect(cliOutput(rejected)).toMatch(new RegExp(`rejected\\s+${planId}`))

            const missing = await $`${bin} plan show missing-id`.nothrow()
            expect(missing.exitCode).toBe(1)
            expect(cliOutput(missing)).toMatch(/Plan not found/i)
        },
        timeout,
    )

    it(
        'apply alias matches plan apply',
        async () => {
            const folder = await createAndImportInitializedFolder(
                bin,
                { ...tvShowFolder, folderName: 'ManagePlan ApplyAlias 333' },
                { updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }) },
            )
            const folderPath = folder.path!

            const tried = await $`${bin} try-to-recognize ${folderPath}`.nothrow()
            expect(tried.exitCode).toBe(0)
            const planId = parsePlanId(tried.text())

            const applied = await $`${bin} apply ${planId}`.nothrow()
            expect(applied.exitCode).toBe(0)
            expect(applied.text()).toMatch(/applied .* \(3 file\(s\)\)/)
            expect(existsSync(await planFilePath(bin, planId))).toBe(false)
        },
        timeout,
    )
})
