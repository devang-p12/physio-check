import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "no token Provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, "secret123");
    next();
  } catch {
    res.status(401).json({ message: "invalid token" });
  }
};
