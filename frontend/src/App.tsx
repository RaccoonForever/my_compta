import React, { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTransactions } from './hooks/useTransactions'
import { testConnection } from './api/transactions'
import './index.css'

export default function App() {
  const { user, token, loading: authLoading, login, logout } = useAuth()
  const { transactions, loading: txLoading, error: txError, lastCalculation, fetchTransactions, calculate, save, clearError } = useTransactions({ token })

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [amount, setAmount] = useState('100')
  const [rate, setRate] = useState('20')
  const [description, setDescription] = useState('')
  const [loginError, setLoginError] = useState('')
  const [activeTab, setActiveTab] = useState<'calculate' | 'history'>('calculate')
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  // Test backend connection on mount (with timeout to prevent blocking)
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const online = await Promise.race([
          testConnection(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000))
        ])
        setBackendOnline(online)
      } catch (err) {
        console.error('Backend check error:', err)
        setBackendOnline(null) // null = unknown status, don't show warning
      }
    }

    // Run check in background, don't block UI
    checkBackend()
  }, [])

  // Note: We don't fetch transactions on login anymore to avoid timeout
  // Users can click the "Load History" button when they want to see transactions

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    try {
      await login(email, password)
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setLoginError(err.message || 'Login failed')
    }
  }

  const handleLogout = async () => {
    await logout()
    setActiveTab('calculate')
  }

  const handleCalculate = async () => {
    clearError()
    const result = await calculate(parseFloat(amount), parseFloat(rate))
    if (result) {
      // Calculation successful, result is in lastCalculation
    }
  }

  const handleSave = async () => {
    clearError()
    const result = await save(parseFloat(amount), parseFloat(rate), description)
    if (result) {
      // Transaction saved successfully
      setDescription('')
      // Optionally reset form
      // setAmount('0')
      // setRate('0')
    }
  }

  const handleRefresh = async () => {
    clearError()
    await fetchTransactions()
  }

  if (authLoading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>💰 My Compta — TVA Calculator</h1>

      {/* Backend status indicator */}
      {backendOnline === false && (
        <div className="alert alert-error">
          ⚠️ <strong>Backend not responding!</strong> Make sure the backend is running:
          <code style={{ display: 'block', marginTop: '8px', padding: '8px', backgroundColor: '#fff' }}>
            cd backend && uvicorn app.main:app --reload --port 8000
          </code>
        </div>
      )}
      {backendOnline === true && !user && (
        <div className="alert alert-success">
          ✅ Backend is online and ready
        </div>
      )}

      {!user ? (
        // Login Section
        <div className="card">
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {loginError && <div className="alert alert-error">{loginError}</div>}
            <button type="submit" className="btn-primary">
              Login
            </button>
          </form>
        </div>
      ) : (
        // Main App Section
        <>
          {/* Welcome Section */}
          <div className="welcome">
            <p>👋 Welcome, <strong>{user.email}</strong></p>
            <button onClick={handleLogout} className="btn-secondary" style={{ marginTop: '10px' }}>
              Logout
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === 'calculate' ? 'active' : ''}`}
              onClick={() => setActiveTab('calculate')}
            >
              📊 Calculate TVA
            </button>
            <button
              className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📋 Transaction History ({transactions.length})
            </button>
          </div>

          {/* Calculate Tab */}
          {activeTab === 'calculate' && (
            <div className="card">
              <h2>Calculate TVA</h2>
              <div className="form-group">
                <label htmlFor="amount">Amount (€)</label>
                <input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="100.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="rate">TVA Rate (%)</label>
                <input
                  id="rate"
                  type="number"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  placeholder="20"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description (optional)</label>
                <input
                  id="description"
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g., Office supplies"
                  maxLength={500}
                />
              </div>

              {txError && <div className="alert alert-error">{txError}</div>}

              <div className="button-group">
                <button onClick={handleCalculate} className="btn-primary" disabled={txLoading}>
                  {txLoading ? 'Calculating...' : 'Calculate Only'}
                </button>
                <button onClick={handleSave} className="btn-success" disabled={txLoading}>
                  {txLoading ? 'Saving...' : 'Calculate & Save'}
                </button>
              </div>

              {lastCalculation && (
                <div className="result-box">
                  <h3>Result</h3>
                  <div className="result-item">
                    <span className="result-label">Base Amount:</span>
                    <span className="result-value">{parseFloat(amount).toFixed(2)}€</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">TVA ({rate}%):</span>
                    <span className="result-value">{lastCalculation.tva.toFixed(2)}€</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Total Amount:</span>
                    <span className="result-value">{lastCalculation.total.toFixed(2)}€</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="card">
              <h2>Transaction History</h2>
              <p style={{ color: '#666', marginBottom: '15px' }}>
                Click "Load History" to fetch your saved transactions
              </p>
              <button onClick={handleRefresh} className="btn-primary" style={{ marginBottom: '15px' }} disabled={txLoading}>
                {txLoading ? 'Loading...' : '📂 Load History'}
              </button>

              {txError && <div className="alert alert-error">{txError}</div>}

              {transactions.length === 0 ? (
                <div className="transaction-table-empty">
                  <p>No transactions loaded yet.</p>
                  <p style={{ fontSize: '0.9em', color: '#999' }}>
                    • Click "Load History" to fetch your saved transactions<br />
                    • Or create a new one using the Calculate TVA tab
                  </p>
                </div>
              ) : (
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Rate</th>
                      <th>TVA</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                        <td>{tx.description || '—'}</td>
                        <td>{tx.amount.toFixed(2)}€</td>
                        <td>{tx.tva_rate}%</td>
                        <td>{tx.tva.toFixed(2)}€</td>
                        <td><strong>{tx.total.toFixed(2)}€</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
