import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// This entry script's file name changes with every build. When the server reports a
// different one, this tab is running an old version, so let the app offer a reload.
const loadedBuild = import.meta.url.split('/').pop().split('?')[0]
axios.interceptors.response.use((res) => {
  const liveBuild = res.headers['x-app-build']
  if (liveBuild && liveBuild !== loadedBuild) window.dispatchEvent(new Event('compicode:update'))
  return res
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
