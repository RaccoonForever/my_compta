import React, { useState } from 'react'

export default function App() {
  const [amount, setAmount] = useState(100)
  const [rate, setRate] = useState(20)
  const [result, setResult] = useState<any>(null)

  async function calc() {
    const res = await fetch('/api/v1/tva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, tva_rate: rate }),
    })
    setResult(await res.json())
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>My Compta — TVA</h1>
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
        <div>
          <p>TVA: {result.tva}</p>
          <p>Total: {result.total}</p>
        </div>
      )}
    </div>
  )
}
