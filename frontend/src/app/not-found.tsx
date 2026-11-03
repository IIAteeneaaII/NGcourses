import Link from 'next/link';
import styles from './not-found.module.css';

export const metadata = {
  title: 'Página no encontrada · NextGen Course',
};

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" />
          <span>NextGen <span className={styles.brandLight}>Course</span></span>
        </Link>
        <p className={styles.code}>Error 404</p>
        <h1 className={styles.title}>No encontramos esta página</h1>
        <p className={styles.text}>
          Puede que el enlace esté mal escrito o que la página ya no exista.
        </p>
        <Link href="/" className={styles.button}>Ir al inicio</Link>
      </div>
    </main>
  );
}
