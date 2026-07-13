import { createServer } from 'node:http'
import type { Server } from 'node:http'

let server: Server | null = null

const CONFIG_RESPONSE = JSON.stringify({
    mediaDatabases: [
        {
            type: 'tmdb',
            baseUrl: 'http://127.0.0.1:10086',
        },
        {
            type: 'tmdb',
            baseUrl: 'https://mediadb.vercel.app/api/tmdb',
        },
    ],
})

export async function startConfigServer(address: string): Promise<void> {
    if (server) return

    const url = new URL(address)
    const port = parseInt(url.port, 10)
    const host = url.hostname

    server = createServer((req, res) => {
        if (req.url === '/config.json' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(CONFIG_RESPONSE)
        } else {
            res.writeHead(404)
            res.end()
        }
    })

    await new Promise<void>((resolve, reject) => {
        server!.listen(port, host, () => resolve())
        server!.on('error', reject)
    })

    console.log(`[Config Server] Started on ${address}`)
}

export async function stopConfigServer(): Promise<void> {
    if (server) {
        await new Promise<void>((resolve) => {
            server!.close(() => resolve())
        })
        server = null
        console.log('[Config Server] Stopped')
    }
}
