import { useState, useEffect } from 'react'
import { Transaction, calculateTVA, saveTransaction, listTransactions, TVAResponse } from '../api/transactions'

interface UseTransactionsProps {
    token: string | null
}

export function useTransactions({ token }: UseTransactionsProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastCalculation, setLastCalculation] = useState<TVAResponse | null>(null)

    /**
     * Fetch transactions from the backend
     */
    const fetchTransactions = async (year?: number) => {
        if (!token) {
            setError('No authentication token')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const data = await listTransactions(token, year)
            setTransactions(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Calculate TVA (without saving)
     */
    const calculate = async (amount: number, rate: number): Promise<TVAResponse | null> => {
        if (!token) {
            setError('No authentication token')
            return null
        }

        if (amount <= 0) {
            setError('Amount must be positive')
            return null
        }

        if (rate < 0 || rate > 100) {
            setError('TVA rate must be between 0 and 100')
            return null
        }

        setError(null)
        setLoading(true)

        try {
            const result = await calculateTVA(amount, rate, token)
            setLastCalculation(result)
            return result
        } catch (err: any) {
            setError(err.message)
            return null
        } finally {
            setLoading(false)
        }
    }

    /**
     * Save a transaction to the database
     */
    const save = async (
        amount: number,
        rate: number,
        description: string
    ): Promise<Transaction | null> => {
        if (!token) {
            setError('No authentication token')
            return null
        }

        if (amount <= 0) {
            setError('Amount must be positive')
            return null
        }

        if (rate < 0 || rate > 100) {
            setError('TVA rate must be between 0 and 100')
            return null
        }

        setError(null)
        setLoading(true)

        try {
            const transaction = await saveTransaction(amount, rate, description, token)
            setTransactions([transaction, ...transactions])
            setLastCalculation({
                tva: transaction.tva,
                total: transaction.total,
                user_id: transaction.user_id,
            })
            return transaction
        } catch (err: any) {
            setError(err.message)
            return null
        } finally {
            setLoading(false)
        }
    }

    /**
     * Clear error message
     */
    const clearError = () => setError(null)

    return {
        transactions,
        loading,
        error,
        lastCalculation,
        fetchTransactions,
        calculate,
        save,
        clearError,
    }
}
