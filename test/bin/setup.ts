#!/bin/env bun

const env = await Bun.file(".env.json").json()

const userConfig = {
    applicationLanguage: "zh-CN",
    folders: [],
    ai: {
        deepseek: {
            baseURL: "https://api.deepseek.com",
            apiKey: env["deepseekApiKey"],
            model: "deepseek-chat"
        }
    },
    selectedAI: "DeepSeek"
}

await Bun.write("C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\smm.json", JSON.stringify(userConfig, null, 4))

export {}