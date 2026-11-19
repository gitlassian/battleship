import { NavLink, Outlet } from 'react-router-dom';
import { usingMock } from '../api.js';

export default function Layout({ onLogout }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">🐱 Cat Shop<span>админка</span></div>
        <nav>
          <NavLink to="/" end>Обзор</NavLink>
          <NavLink to="/cats">Коты</NavLink>
          <NavLink to="/orders">Заказы</NavLink>
        </nav>
        <button className="link logout" onClick={onLogout}>Выйти</button>
      </aside>
      <main className="content">
        {usingMock && <div className="mock-banner">Тестовые данные (VITE_USE_MOCK=1): изменения сбросятся после перезагрузки.</div>}
        <Outlet />
      </main>
    </div>
  );
}
