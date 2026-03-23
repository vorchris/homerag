import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Files from './pages/Files'
import Search from './pages/Search'
import Collections from './pages/Collections'
import Settings from './pages/Settings'
import './styles/globals.css'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/files" replace />} />
          <Route path="/files" element={<Files />} />
          <Route path="/search" element={<Search />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
