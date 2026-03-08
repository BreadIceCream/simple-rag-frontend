/**
 * Helper to parse SSE streams using Fetch API
 */
export async function fetchSSE(url: string, options: RequestInit, onMessage: (data: any) => void, onError: (err: any) => void, onDone: () => void) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        })

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`)
        }

        if (!response.body) {
            throw new Error('ReadableStream not supported in this browser.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep the last incomplete line in buffer

            for (const line of lines) {
                if (line.trim() === '') continue
                if (line.startsWith('data:')) {
                    const dataStr = line.replace(/^data:\s*/, '')
                    if (dataStr === '[DONE]') {
                        onDone()
                        return
                    }
                    try {
                        const dataObj = JSON.parse(dataStr)
                        onMessage(dataObj)
                    } catch (e) {
                        console.error('Failed to parse SSE data', dataStr, e)
                    }
                }
            }
        }
        onDone()
    } catch (err) {
        onError(err)
    }
}
