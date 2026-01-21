export interface Lesson {
  id: string;
  name: string;
  videoId?: string;
  duration?: number;
  completed: boolean;
  order: number;
}

export interface Module {
  id: string;
  name: string;
  lessons: Lesson[];
  order: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  progress: number;
}

export interface VideoProgress {
  lessonId: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  lastWatched: Date;
}

export interface BunnyVideoConfig {
  libraryId: string;
  videoId: string;
  thumbnailTime?: number;
}
