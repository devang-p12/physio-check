/**
 * Template Processor Module
 * Extracts pose landmarks from reference videos.
 */
import { PoseNormalizer } from './poseNormalizer.js';

export class TemplateProcessor {
    constructor() {
        this.pose = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.3, // Lowered for better detection
            minTrackingConfidence: 0.3
        });

        this.rawLandmarksSeries = [];
        this.pose.onResults((results) => {
            if (results.poseLandmarks) {
                const normalized = PoseNormalizer.normalize(results.poseLandmarks);
                if (normalized) {
                    this.rawLandmarksSeries.push(normalized);
                }
            }
        });
    }

    /**
     * Processes a video file and extracts time-series landmarks.
     */
    async processVideo(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true;
            video.playsInline = true;

            this.rawLandmarksSeries = [];

            video.onloadedmetadata = async () => {
                // We will manually step through the video frames to ensure every point is checked
                // This is more reliable than requestAnimationFrame for background processing
                const duration = video.duration;
                const fps = 10; // Sample at 10 FPS for processing
                const interval = 1 / fps;
                let currentTime = 0;

                console.log(`Starting source analysis. Duration: ${duration}s @ ${fps}fps`);

                while (currentTime < duration) {
                    video.currentTime = currentTime;

                    // Wait for the video to seek
                    await new Promise(r => {
                        video.onseeked = r;
                        // Safety timeout
                        setTimeout(r, 100);
                    });

                    await this.pose.send({ image: video });
                    currentTime += interval;
                    console.log(`Progress: ${Math.round((currentTime / duration) * 100)}%`);
                }

                console.log(`Processing finished. Detected ${this.rawLandmarksSeries.length} valid pose frames.`);

                if (this.rawLandmarksSeries.length < 5) {
                    reject(new Error("Could not detect your body clearly. Please stand back so shoulders and torso are visible."));
                } else {
                    resolve(this.rawLandmarksSeries);
                }
            };

            video.onerror = () => reject(new Error("Failed to load video file."));
        });
    }
}
