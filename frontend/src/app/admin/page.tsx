import Link from 'next/link';
import styles from './page.module.css';

export default function AdminDashboardPage() {
  const historyItems = [
    {
      id: 1,
      initials: 'CR',
      title: 'Facturación Electrónica Avanzada',
      colorClass: 'red',
    },
    {
      id: 2,
      initials: 'SO',
      title: 'Gestión de Recursos Humanos',
      colorClass: 'black',
    },
    {
      id: 3,
      initials: 'EN',
      title: 'Marketing Digital Corporativo',
      colorClass: '',
    },
  ];

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          Bienvenido al panel de administración. Gestiona usuarios, cursos y contenido educativo para tu equipo.
        </p>
      </div>

      {/* Options Grid - 3 Cards */}
      <div className={styles.optionsGrid}>
        {/* Gestionar Usuarios */}
        <div className={styles.optionCard}>
          <div className={`${styles.optionIcon} ${styles.users}`}>
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Gestionar Usuarios</h2>
          <p className={styles.optionDescription}>
            Administra usuarios, roles y permisos del sistema
          </p>
          <Link href="/admin/usuarios" className={styles.optionButton}>
            Empezar
          </Link>
        </div>

        {/* Crear Curso */}
        <div className={styles.optionCard}>
          <div className={styles.optionIcon}>
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 5V19M5 12H19"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Crear Curso</h2>
          <p className={styles.optionDescription}>
            Crea y gestiona tus propios cursos de capacitación
          </p>
          <Link href="/admin/cursos/crear" className={styles.optionButton}>
            Empezar
          </Link>
        </div>

        {/* Solicitar Curso */}
        <div className={styles.optionCard}>
          <div className={`${styles.optionIcon} ${styles.light}`}>
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className={styles.optionTitle}>Solicitar Curso</h2>
          <p className={styles.optionDescription}>
            Solicita cursos personalizados para tu equipo
          </p>
          <Link href="/admin/solicitudes" className={styles.optionButton}>
            Enviar solicitud
          </Link>
        </div>
      </div>

      {/* History Section */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h3 className={styles.historyTitle}>
            Mis solicitudes / Mis cursos creados
          </h3>
          <Link href="/admin/cursos" className={styles.viewAllLink}>
            Ver todo
          </Link>
        </div>

        <div className={styles.historyList}>
          {historyItems.map((item) => (
            <div key={item.id} className={styles.historyItem}>
              <div className={styles.historyItemContent}>
                <div
                  className={`${styles.historyIcon} ${
                    item.colorClass ? styles[item.colorClass] : ''
                  }`}
                >
                  {item.initials}
                </div>
                <span className={styles.historyItemTitle}>{item.title}</span>
              </div>
              <button className={styles.viewDetailsButton}>Ver detalles</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
