export const doctorOnly = (req, res , next) => {
    if(req.user.role !== "doctor"){
        return res.status(403).json({message: "doctor access only"});
    }
    next();
};