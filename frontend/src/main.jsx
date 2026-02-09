import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import BrandingProvider from './contexts/BrandingContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrandingProvider>
      <App />
    </BrandingProvider>
  </React.StrictMode>,
)


























