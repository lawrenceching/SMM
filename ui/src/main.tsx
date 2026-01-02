import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppV2 from './AppV2.tsx'

function AppSwitcher() {
  const [useAppV2, setUseAppV2] = useState(false)

  return (
    <>
      {/* 切换按钮 */}
      <button
        onClick={() => setUseAppV2(!useAppV2)}
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          zIndex: 9999,
          padding: '8px 16px',
          backgroundColor: '#4a9eff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '500',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#3a8eef'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#4a9eff'
        }}
      >
        {useAppV2 ? '切换到 App' : '切换到 AppV2'}
      </button>

      {/* 渲染对应的组件 */}
      {useAppV2 ? <AppV2 /> : <App />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppSwitcher />
  </StrictMode>,
)
