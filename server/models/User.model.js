export const createUser = ({name,email,password,role}) => ({
    id: Date.now(),
    name,
    email,
    password,
    role,
    createdAt: new Date()
})