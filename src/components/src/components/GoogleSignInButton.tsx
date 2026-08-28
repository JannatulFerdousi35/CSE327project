import { useEffect, useRef } from 'react'

declare global {
  interface Window { google?: any }
}

type Props = { onCredential: (idToken: string) => void; text?: 'signin_with' | 'signup_with' }

export default function GoogleSignInButton({ onCredential, text = 'signin_with' }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
    if (!clientId) return

    const initialize = () => {
      if (!window.google || !buttonRef.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onCredential(response.credential),
      })
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', width: 340, text })
    }

    const existing = document.getElementById('google-identity-script') as HTMLScriptElement | null
    if (existing) {
      window.google ? initialize() : existing.addEventListener('load', initialize)
      return
    }
    const script = document.createElement('script')
    script.id = 'google-identity-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = initialize
    document.head.appendChild(script)
  }, [onCredential, text])

  return <div ref={buttonRef} />
}
