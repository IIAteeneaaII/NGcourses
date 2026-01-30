'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface CourseRequest {
  id: string;
  title: string;
  description: string;
  objective: string;
  level: 'basico' | 'intermedio' | 'avanzado';
  format: 'video' | 'taller' | 'mixto';
  priority: 'alta' | 'media' | 'baja';
  desiredDate: string;
  attachments: string;
  notes: string;
  status: 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado';
  createdAt: string;
}

const MOCK_HISTORY: CourseRequest[] = [
  {
    id: '1',
    title: 'React Avanzado',
    description: '',
    objective: '',
    level: 'avanzado',
    format: 'video',
    priority: 'alta',
    desiredDate: '',
    attachments: '',
    notes: '',
    status: 'en_revision',
    createdAt: '2024-01-05',
  },
  {
    id: '2',
    title: 'Python para Data Science',
    description: '',
    objective: '',
    level: 'intermedio',
    format: 'mixto',
    priority: 'media',
    desiredDate: '',
    attachments: '',
    notes: '',
    status: 'aprobado',
    createdAt: '2024-01-03',
  },
  {
    id: '3',
    title: 'DevOps Fundamentals',
    description: '',
    objective: '',
    level: 'basico',
    format: 'video',
    priority: 'baja',
    desiredDate: '',
    attachments: '',
    notes: '',
    status: 'pendiente',
    createdAt: '2024-01-01',
  },
];

export default function SolicitarCursoPage() {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [history, setHistory] = useState<CourseRequest[]>(MOCK_HISTORY);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    objective: '',
    level: 'basico' as 'basico' | 'intermedio' | 'avanzado',
    format: 'video' as 'video' | 'taller' | 'mixto',
    priority: 'media' as 'alta' | 'media' | 'baja',
    desiredDate: '',
    attachments: '',
    notes: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLevelChange = (level: 'basico' | 'intermedio' | 'avanzado') => {
    setFormData((prev) => ({ ...prev, level }));
  };

  const handleFormatChange = (format: 'video' | 'taller' | 'mixto') => {
    setFormData((prev) => ({ ...prev, format }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Por favor, completa al menos el titulo del curso');
      return;
    }

    const newRequest: CourseRequest = {
      id: `req-${Date.now()}`,
      ...formData,
      status: 'pendiente',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setHistory((prev) => [newRequest, ...prev]);
    setShowSuccess(true);

    // Reset form
    setFormData({
      title: '',
      description: '',
      objective: '',
      level: 'basico',
      format: 'video',
      priority: 'media',
      desiredDate: '',
      attachments: '',
      notes: '',
    });

    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      en_revision: 'En revision',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
    };
    return labels[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      pendiente: styles.statusPending,
      en_revision: styles.statusReview,
      aprobado: styles.statusApproved,
      rechazado: styles.statusRejected,
    };
    return classes[status] || '';
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
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
          Volver a opciones
        </button>
      </div>

      <div className={styles.contentGrid}>
        {/* Formulario */}
        <div className={styles.formSection}>
          <h1 className={styles.formTitle}>Solicitar curso</h1>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Titulo/tema solicitado</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={styles.formInput}
                placeholder="Titulo/tema solicitado"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Descripcion</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className={styles.formTextarea}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Objetivo del curso</label>
              <textarea
                name="objective"
                value={formData.objective}
                onChange={handleInputChange}
                className={styles.formTextarea}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nivel deseado</label>
              <div className={styles.levelButtons}>
                <button
                  type="button"
                  className={`${styles.levelButton} ${
                    formData.level === 'basico' ? styles.active : ''
                  }`}
                  onClick={() => handleLevelChange('basico')}
                >
                  Basico
                </button>
                <button
                  type="button"
                  className={`${styles.levelButton} ${
                    formData.level === 'intermedio' ? styles.active : ''
                  }`}
                  onClick={() => handleLevelChange('intermedio')}
                >
                  Intermedio
                </button>
                <button
                  type="button"
                  className={`${styles.levelButton} ${
                    formData.level === 'avanzado' ? styles.active : ''
                  }`}
                  onClick={() => handleLevelChange('avanzado')}
                >
                  Avanzado
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Formato</label>
              <div className={styles.radioGroup}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="format"
                    value="video"
                    checked={formData.format === 'video'}
                    onChange={() => handleFormatChange('video')}
                  />
                  <span>Video</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="format"
                    value="taller"
                    checked={formData.format === 'taller'}
                    onChange={() => handleFormatChange('taller')}
                  />
                  <span>Taller</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="format"
                    value="mixto"
                    checked={formData.format === 'mixto'}
                    onChange={() => handleFormatChange('mixto')}
                  />
                  <span>Mixto</span>
                </label>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Prioridad</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className={styles.prioritySelect}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fecha deseada</label>
              <input
                type="date"
                name="desiredDate"
                value={formData.desiredDate}
                onChange={handleInputChange}
                className={styles.dateInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Adjuntar archivos/enlaces</label>
              <textarea
                name="attachments"
                value={formData.attachments}
                onChange={handleInputChange}
                className={styles.formTextarea}
                rows={3}
                placeholder="Pega enlaces o describe los archivos adjuntos"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Notas adicionales</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className={styles.formTextarea}
                rows={3}
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              Enviar solicitud
            </button>
          </form>

          {showSuccess && (
            <div className={styles.successMessage}>
              <p className={styles.successTitle}>Solicitud enviada</p>
              <p className={styles.successSubtitle}>
                Tu solicitud ha sido registrada correctamente
              </p>
            </div>
          )}
        </div>

        {/* Historial */}
        <div className={styles.historySection}>
          <h2 className={styles.historyTitle}>Historial de solicitudes</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Titulo</th>
                  <th>Estatus</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {history.map((request) => (
                  <tr key={request.id}>
                    <td>{request.title}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${getStatusClass(
                          request.status
                        )}`}
                      >
                        {getStatusLabel(request.status)}
                      </span>
                    </td>
                    <td>{request.createdAt}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={3} className={styles.emptyState}>
                      No hay solicitudes registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
