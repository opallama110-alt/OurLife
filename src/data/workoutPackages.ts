import { ExerciseDefinition, MuscleGroup } from '../types';

export interface WorkoutRoutine {
    id: string;
    name: string;
    description: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    muscleGroups: MuscleGroup[];
    exerciseIds: string[]; // References IDs in EXERCISE_DATABASE
}

export const WORKOUT_PACKAGES: WorkoutRoutine[] = [
    {
        id: 'push_day_A',
        name: 'Push Day (Chest Focus)',
        description: 'Focus on chest, shoulders, and triceps with heavy compounds.',
        difficulty: 'Intermediate',
        muscleGroups: ['chest', 'shoulders', 'triceps'],
        exerciseIds: ['chest_1', 'chest_2', 'shoulder_1', 'tri_3', 'shoulder_3', 'tri_1']
    },
    {
        id: 'pull_day_A',
        name: 'Pull Day (Back Width)',
        description: 'Vertical pulling for lats width, plus biceps and rear delts.',
        difficulty: 'Intermediate',
        muscleGroups: ['lats', 'biceps', 'forearms', 'traps'],
        exerciseIds: ['lat_2', 'lat_1', 'lat_4', 'bi_1', 'shoulder_4', 'bi_3']
    },
    {
        id: 'leg_day_A',
        name: 'Leg Day (Quad Focus)',
        description: 'Heavy squats and quad isolation. Do not skip.',
        difficulty: 'Advanced',
        muscleGroups: ['quads', 'glutes', 'hamstrings', 'calves'],
        exerciseIds: ['quad_1', 'quad_2', 'quad_5', 'ham_2', 'calf_1']
    },
    {
        id: 'full_body_A',
        name: 'Full Body A',
        description: 'Classic full body routine hitting all major groups.',
        difficulty: 'Beginner',
        muscleGroups: ['chest', 'lats', 'quads', 'shoulders', 'hamstrings'],
        exerciseIds: ['chest_3', 'lat_1', 'quad_6', 'shoulder_2', 'ham_1', 'abs_4']
    },
    {
        id: 'upper_body',
        name: 'Upper Body Power',
        description: 'Upper body compound movements for strength.',
        difficulty: 'Intermediate',
        muscleGroups: ['chest', 'lats', 'shoulders', 'triceps', 'biceps'],
        exerciseIds: ['chest_1', 'lat_4', 'shoulder_1', 'lat_2', 'tri_2', 'bi_1']
    },
    {
        id: 'lower_body',
        name: 'Lower Body Power',
        description: 'Lower body compound movements for mass.',
        difficulty: 'Intermediate',
        muscleGroups: ['quads', 'hamstrings', 'glutes', 'calves', 'lower_back'],
        exerciseIds: ['quad_1', 'ham_1', 'quad_2', 'glu_1', 'calf_1', 'abs_2']
    }
];
