export const createExercise = ({name,reps,duration,description}) => ({
    id: Date.now(),
    name,
    reps,
    duration,
    description,
    createdAt: new Date()
})