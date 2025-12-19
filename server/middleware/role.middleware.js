export const doctorOnly = (req, res, next) => {
  if (req.user.role !== "doctor") {
    return res.status(403).json({ message: "doctor access only" });
  }
  next();
};

export const patientOnly = (req, res, next) => {
  if (req.user.role !== "patient") {
    return res.status(403).json({ message: "patient access only" });
  }
  next();
};
