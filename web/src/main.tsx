import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { nativeRequest } from './nativeBridge'
import type { Registration } from './types'
import './index.css'
import './responsive.css'

const registration = await nativeRequest<Registration | null>('session.get')
if (registration) localStorage.setItem('palmera-web-registration', JSON.stringify(registration))
else localStorage.removeItem('palmera-web-registration')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
