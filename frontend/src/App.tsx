import React, { useState } from 'react'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { user, token, loading, login, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [amount, setAmount] = useState(100)
  const [rate, setRate] = useState(20)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      setError('')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  const calc = async () => {
    if (!token) {
      setError('You must be logged in')
      return
    }

    try {
      const res = await fetch('/api/v1/tva', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, tva_rate: rate }),
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      setResult(await res.json())
      setError('')
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h1>My Compta — TVA Calculator</h1>

      {!user ? (
        <div style={{ border: '1px solid #ccc', padding: 20, marginBottom: 20 }}>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div>
              <label>Email: </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Password: </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit">Login</button>
          </form>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <p>Welcome, {user.email}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}

      {user && (
        <div style={{ border: '1px solid #ccc', padding: 20 }}>
          <h2>Calculate TVA</h2>
          <div>
            <label>Amount: </label>
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <label>TVA %: </label>
            <input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} />
          </div>
          <button onClick={calc}>Calculate</button>
          {result && (
            <div style={{ marginTop: 10, padding: 10, backgroundColor: '#f0f0f0' }}>
              <p>TVA: {result.tva}€</p>
              <p>Total: {result.total}€</p>
              <p>User: {result.user}</p>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
