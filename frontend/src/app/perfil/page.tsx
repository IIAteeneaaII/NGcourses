import ProfileContent from '@/components/profile/ProfileContent';
import { getUserProfile, getUserStatistics, getUserCoursesInProgress } from '@/data/courses';

export default function PerfilPage() {
  const profile = getUserProfile();
  const statistics = getUserStatistics();
  const coursesInProgress = getUserCoursesInProgress();

  return (
    <ProfileContent
      profile={profile}
      statistics={statistics}
      coursesInProgress={coursesInProgress}
    />
  );
}
