import { Routes, Route } from 'react-router-dom'
import { RegisterPage } from './pages/RegisterPage'

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold text-gray-800">Dashboard — frontend scaffold OK</h1>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<RegisterPage />} />
    </Routes>
  )
}

export default App
