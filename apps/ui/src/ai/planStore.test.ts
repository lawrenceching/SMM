import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRecognizePlan,
  createRenamePlan,
  readPlan,
  addRecognizedFileToPlan,
  addRenameEntryToPlan,
  updatePlanStatus,
  deletePlan,
  listAllPlans,
} from './planStore'

/**
 * Tests for the IndexedDB plan store. Uses `fake-indexeddb` (set up
 * globally in `src/test/setup.ts`) to provide a real IDB
 * implementation in jsdom.
 *
 * fake-indexeddb persists across tests within a file, so we clear
 * the store before each test for isolation.
 */

async function clearPlansStore(): Promise<void> {
  const all = await listAllPlans()
  await Promise.all(all.map((p) => deletePlan(p.id)))
}

describe('planStore', () => {
  beforeEach(async () => {
    await clearPlansStore()
  })

  describe('createRecognizePlan', () => {
    it('creates a pending plan with no files', async () => {
      const plan = await createRecognizePlan('/media/show')

      expect(plan.task).toBe('recognize-media-file')
      expect(plan.status).toBe('pending')
      expect(plan.mediaFolderPath).toBe('/media/show')
      expect(plan.files).toEqual([])
      expect(plan.id).toBeTruthy()
    })

    it('normalizes the media folder path to POSIX', async () => {
      const plan = await createRecognizePlan('C:\\Users\\me\\show')
      // Posix conversion turns backslashes into forward slashes and
      // strips the Windows drive prefix; exact behavior is owned
      // by `@core/path`. We just check that backslashes are gone.
      expect(plan.mediaFolderPath).not.toContain('\\')
    })
  })

  describe('createRenamePlan', () => {
    it('creates a pending plan with no files', async () => {
      const plan = await createRenamePlan('/media/movie')

      expect(plan.task).toBe('rename-files')
      expect(plan.status).toBe('pending')
      expect(plan.mediaFolderPath).toBe('/media/movie')
      expect(plan.files).toEqual([])
      expect(plan.id).toBeTruthy()
    })
  })

  describe('readPlan', () => {
    it('returns the plan by id', async () => {
      const created = await createRecognizePlan('/a')
      const read = await readPlan(created.id)

      expect(read).not.toBeNull()
      expect(read!.id).toBe(created.id)
    })

    it('returns null for an unknown id', async () => {
      const read = await readPlan('does-not-exist')
      expect(read).toBeNull()
    })
  })

  describe('addRecognizedFileToPlan', () => {
    it('appends a recognized file to a recognize plan', async () => {
      const plan = await createRecognizePlan('/a')

      const updated = await addRecognizedFileToPlan(plan.id, {
        season: 1,
        episode: 5,
        path: '/a/ep5.mkv',
      })

      expect(updated).not.toBeNull()
      expect(updated!.files).toHaveLength(1)
      expect(updated!.files[0]).toEqual({
        season: 1,
        episode: 5,
        path: '/a/ep5.mkv',
      })
    })

    it('appends multiple files in order', async () => {
      const plan = await createRecognizePlan('/a')
      await addRecognizedFileToPlan(plan.id, { season: 1, episode: 1, path: '/a/e1' })
      await addRecognizedFileToPlan(plan.id, { season: 1, episode: 2, path: '/a/e2' })

      const final = await readPlan(plan.id)
      expect(final!.files).toHaveLength(2)
      expect(final!.files[0]!.episode).toBe(1)
      expect(final!.files[1]!.episode).toBe(2)
    })

    it('returns null when the plan does not exist', async () => {
      const updated = await addRecognizedFileToPlan('nope', {
        season: 1,
        episode: 1,
        path: '/x',
      })
      expect(updated).toBeNull()
    })

    it('throws when the plan is the wrong task', async () => {
      const rename = await createRenamePlan('/a')
      await expect(
        addRecognizedFileToPlan(rename.id, {
          season: 1,
          episode: 1,
          path: '/x',
        }),
      ).rejects.toThrow(/not a recognize-media-file plan/)
    })
  })

  describe('addRenameEntryToPlan', () => {
    it('appends a rename entry to a rename plan', async () => {
      const plan = await createRenamePlan('/a')

      const updated = await addRenameEntryToPlan(plan.id, {
        from: '/a/old.mkv',
        to: '/a/new.mkv',
      })

      expect(updated).not.toBeNull()
      expect(updated!.files).toHaveLength(1)
      expect(updated!.files[0]).toEqual({
        from: '/a/old.mkv',
        to: '/a/new.mkv',
      })
    })

    it('returns null when the plan does not exist', async () => {
      const updated = await addRenameEntryToPlan('nope', {
        from: '/a',
        to: '/b',
      })
      expect(updated).toBeNull()
    })

    it('throws when the plan is the wrong task', async () => {
      const recognize = await createRecognizePlan('/a')
      await expect(
        addRenameEntryToPlan(recognize.id, { from: '/a', to: '/b' }),
      ).rejects.toThrow(/not a rename-files plan/)
    })
  })

  describe('updatePlanStatus', () => {
    it('updates the plan status', async () => {
      const plan = await createRecognizePlan('/a')
      const updated = await updatePlanStatus(plan.id, 'completed')

      expect(updated!.status).toBe('completed')
    })

    it('returns null when the plan does not exist', async () => {
      const updated = await updatePlanStatus('nope', 'completed')
      expect(updated).toBeNull()
    })
  })

  describe('deletePlan', () => {
    it('removes the plan', async () => {
      const plan = await createRecognizePlan('/a')
      await deletePlan(plan.id)
      const read = await readPlan(plan.id)
      expect(read).toBeNull()
    })

    it('is a no-op for unknown ids', async () => {
      await expect(deletePlan('nope')).resolves.toBeUndefined()
    })
  })

  describe('listAllPlans', () => {
    it('returns all plans', async () => {
      await createRecognizePlan('/a')
      await createRecognizePlan('/b')
      await createRenamePlan('/c')

      const all = await listAllPlans()
      expect(all).toHaveLength(3)
      expect(all.filter((p) => p.task === 'recognize-media-file')).toHaveLength(2)
      expect(all.filter((p) => p.task === 'rename-files')).toHaveLength(1)
    })
  })
})
