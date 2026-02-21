import express from "express";
import upload from "../middleware/upload.js";
import { uploadVideo } from "../controllers/videoController.js";

const router = express.Router();

router.post("/upload", upload.single("video"), uploadVideo);

export default router;