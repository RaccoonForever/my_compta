/**
 * API service for transaction operations
 */

export interface Transaction {
    id: string
    user_id: string
    amount: number
    tva_rate: number
    description: string
    created_at: string
    tva: number
    total: number
}

export interface TVAResponse {
    tva: number
    total: number
    user_id: string
}

const API_BASE = '/api/v1'
const TIMEOUT_MS = 30000 // 30 second timeout

/**
 * Helper to add timeout to fetch requests
 */
function withTimeout(promise: Promise<Response>, ms: number): Promise<Response> {
    return Promise.race([
        promise,
        new Promise<Response>((_, reject) =>
            setTimeout(() => {
                console.error(`API request timeout after ${ms}ms`)
                reject(new Error(`Request timeout after ${ms}ms - Backend may not be running`))
            }, ms)
        ),
    ])
}

/**
 * Test basic connectivity to backend
 */
export async function testConnection(): Promise<boolean> {
    try {
        console.log('Testing connection to backend...')
        // Use longer timeout (15s) for initial health check to account for slow network/backend startup
        const res = await withTimeout(fetch(`${API_BASE}/health`), 15000)
        const data = await res.json()
        console.log('✅ Backend connection successful:', data)
        return true
    } catch (err: any) {
        console.warn('⚠️ Backend connection test failed (this is not critical):', err.message)
        // Don't throw - just return false. The app will still work, user just won't see the status indicator
        return false
    }
}

/**
 * Get debug info from backend
 */
export async function getDebugInfo(): Promise<any> {
    try {
        console.log('Fetching debug info...')
        const res = await withTimeout(fetch(`${API_BASE}/debug`), 10000)
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const data = await res.json()
        console.log('Debug info:', data)
        return data
    } catch (err: any) {
        console.warn('Failed to get debug info:', err.message)
        return null
    }
}

/**
 * Calculate TVA for a transaction without persisting
 */
export async function calculateTVA(
    amount: number,
    rate: number,
    token: string
): Promise<TVAResponse> {
    console.log('Sending TVA calculation request...', { amount, rate })

    const res = await withTimeout(
        fetch(`${API_BASE}/tva`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ amount, tva_rate: rate, description: '' }),
        }),
        TIMEOUT_MS
    )

    if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        console.error('TVA calculation error:', error)
        throw new Error(error.detail || `API error: ${res.status}`)
    }

    const data = await res.json()
    console.log('TVA calculation successful:', data)
    return data
}

/**
 * Save a transaction to the database
 */
export async function saveTransaction(
    amount: number,
    rate: number,
    description: string,
    token: string
): Promise<Transaction> {
    console.log('Saving transaction...', { amount, rate, description })

    const res = await withTimeout(
        fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ amount, tva_rate: rate, description }),
        }),
        TIMEOUT_MS
    )

    if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        console.error('Save transaction error:', error)
        throw new Error(error.detail || `API error: ${res.status}`)
    }

    const data = await res.json()
    console.log('Transaction saved successfully:', data)
    return data
}

/**
 * List transactions for the authenticated user
 */
export async function listTransactions(
    token: string,
    year?: number
): Promise<Transaction[]> {
    const url = new URL(`${API_BASE}/transactions`, window.location.origin)
    if (year) {
        url.searchParams.set('year', year.toString())
    }

    console.log('Fetching transactions...', { url: url.toString() })

    // Use shorter timeout for list endpoint (15s instead of 30s)
    const res = await withTimeout(
        fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        }),
        15000
    )

    if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        console.error('List transactions error:', error)
        throw new Error(error.detail || `API error: ${res.status}`)
    }

    const data = await res.json()
    console.log(`Fetched ${data.length} transactions`)
    return data
}
