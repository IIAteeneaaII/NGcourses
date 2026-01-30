'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface User {
  id: string;
  nombre: string;
  userName: string;
  email: string;
  rol: string;
  activo: boolean;
}

const ROLES: Record<string, string> = {
  admin: 'Administrador',
  instructor: 'Instructor',
  estudiante: 'Estudiante',
  supervisor: 'Supervisor',
};

const MOCK_USERS: User[] = [
  { id: '1', nombre: 'Juan Perez', userName: 'jperez', email: 'jperez@pascual.com', rol: 'admin', activo: true },
  { id: '2', nombre: 'Maria Garcia', userName: 'mgarcia', email: 'mgarcia@pascual.com', rol: 'instructor', activo: true },
  { id: '3', nombre: 'Carlos Lopez', userName: 'clopez', email: 'clopez@pascual.com', rol: 'estudiante', activo: true },
  { id: '4', nombre: 'Ana Martinez', userName: 'amartinez', email: 'amartinez@pascual.com', rol: 'instructor', activo: false },
  { id: '5', nombre: 'Pedro Rodriguez', userName: 'prodriguez', email: 'prodriguez@pascual.com', rol: 'estudiante', activo: true },
  { id: '6', nombre: 'Laura Sanchez', userName: 'lsanchez', email: 'lsanchez@pascual.com', rol: 'supervisor', activo: true },
  { id: '7', nombre: 'Miguel Torres', userName: 'mtorres', email: 'mtorres@pascual.com', rol: 'estudiante', activo: true },
  { id: '8', nombre: 'Sofia Ramirez', userName: 'sramirez', email: 'sramirez@pascual.com', rol: 'instructor', activo: false },
  { id: '9', nombre: 'Diego Flores', userName: 'dflores', email: 'dflores@pascual.com', rol: 'estudiante', activo: true },
  { id: '10', nombre: 'Carmen Morales', userName: 'cmorales', email: 'cmorales@pascual.com', rol: 'estudiante', activo: true },
  { id: '11', nombre: 'Luis Jimenez', userName: 'ljimenez', email: 'ljimenez@pascual.com', rol: 'admin', activo: true },
  { id: '12', nombre: 'Patricia Ruiz', userName: 'pruiz', email: 'pruiz@pascual.com', rol: 'estudiante', activo: false },
  { id: '13', nombre: 'Roberto Mendez', userName: 'rmendez', email: 'rmendez@pascual.com', rol: 'instructor', activo: true },
  { id: '14', nombre: 'Elena Castro', userName: 'ecastro', email: 'ecastro@pascual.com', rol: 'estudiante', activo: true },
  { id: '15', nombre: 'Fernando Ortiz', userName: 'fortiz', email: 'fortiz@pascual.com', rol: 'supervisor', activo: true },
];

const ITEMS_PER_PAGE = 10;

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === '' || user.rol === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleToggleActive = (userId: string) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, activo: !user.activo } : user
      )
    );
  };

  const handleResetSearch = () => {
    setSearchTerm('');
    setRoleFilter('');
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.userHeader}>
        <div className={styles.headerInfo}>
          <h1 className={styles.pageTitle}>Editar usuarios</h1>
          <p className={styles.pageSubtitle}>Gestion y edicion de usuarios del sistema</p>
        </div>
        <button
          className={styles.backButton}
          onClick={() => router.push('/admin')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Inicio
        </button>
      </div>

      <section className={styles.mainContent}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.searchInput}
              placeholder="Buscar usuario por nombre, email o usuario..."
            />
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleResetSearch}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Borrar
            </button>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={styles.roleSelect}
          >
            <option value="">Todos los roles</option>
            {Object.entries(ROLES).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.nombre}</td>
                    <td>{user.userName}</td>
                    <td>{user.email}</td>
                    <td>{ROLES[user.rol] || user.rol}</td>
                    <td className={styles.actionsCell}>
                      <Link
                        href={`/admin/usuarios/${user.id}/editar`}
                        className={styles.editButton}
                        title="Editar"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </Link>

                      <label className={styles.toggleLabel} title="Activar/Desactivar cuenta">
                        <input
                          type="checkbox"
                          checked={user.activo}
                          onChange={() => handleToggleActive(user.id)}
                          className={styles.toggleInput}
                        />
                        <span className={styles.toggleSlider}></span>
                      </label>

                      <span className={`${styles.statusText} ${user.activo ? styles.active : styles.inactive}`}>
                        {user.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    No hay usuarios registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.paginationRow}>
          <button
            className={styles.pageButton}
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className={styles.pageNumber}>{currentPage}</span>
          <button
            className={styles.pageButton}
            onClick={handleNextPage}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
