import { useState, useEffect } from 'react'
import { auth } from './firebase'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser)
      if (currentUser) {
        const idToken = await currentUser.getIdToken()
        setToken(idToken)
      } else {
        setToken(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    const idToken = await result.user.getIdToken()
    setToken(idToken)
  }

  const logout = async () => {
    await firebaseSignOut(auth)
    setToken(null)
  }

  return { user, token, loading, login, logout }
}
