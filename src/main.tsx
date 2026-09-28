import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<main><p>Loading LANBox…</p></main>}>
      <App />
    </Suspense>
  </StrictMode>,
)
