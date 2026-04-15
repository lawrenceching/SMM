import { browser } from '@wdio/globals'
import { env } from 'node:process'
import ConfigDialog from '../componentobjects/ConfigDialog'

type PrimaryDatabase = 'TMDB' | 'TVDB'
type PreferMediaLanguage = '__unset__' | 'zh-CN' | 'en-US' | 'ja-JP'

export async function setPrimaryDatabaseAndPreferLanguage(
    database: PrimaryDatabase,
    language: PreferMediaLanguage
): Promise<void> {
    await ConfigDialog.setPrimaryDatabase(database)
    console.log(`set primary database to ${database} in ConfigDialog`)
    if (env.slowdown) {
        await browser.pause(1000)
    }

    await ConfigDialog.setPreferMediaLanguage(language)
    console.log(`set prefer media language to ${language} in ConfigDialog`)
    if (env.slowdown) {
        await browser.pause(1000)
    }
}
