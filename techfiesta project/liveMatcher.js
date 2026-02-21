/**
 * Live Matcher Module
 * Enhanced with sub-sequence matching and smoothing.
 */
import { DTW } from './dtw.js';

export class LiveMatcher {
    constructor(template) {
        this.template = template;
        // Allow live reps to be slower or faster than reference
        this.windowSize = Math.round(template.length * 1.5);
        this.buffer = [];
        this.repCount = 0;
        this.isCooldown = false;
        this.cooldownTime = 1500; // Increased to 1.5s to prevent ghost reps
        this.similarityThreshold = 75; // Lowered from 80 for accessibility
    }

    /**
     * Smooths landmarks to reduce MediaPipe jitter.
     */
    smoothFrame(newFrame) {
        if (this.buffer.length === 0) return newFrame;
        const lastFrame = this.buffer[this.buffer.length - 1];

        const smoothed = newFrame.map((lm, i) => {
            if (!lastFrame[i]) return lm;
            return {
                x: lm.x * 0.7 + lastFrame[i].x * 0.3,
                y: lm.y * 0.7 + lastFrame[i].y * 0.3,
                z: lm.z * 0.7 + lastFrame[i].z * 0.3
            };
        });
        return smoothed;
    }

    processFrame(normalizedFrame) {
        if (!normalizedFrame) return { similarity: 0, repCount: this.repCount, status: 'Detecting body...' };

        // 1. Add smoothed frame to buffer
        const smoothed = this.smoothFrame(normalizedFrame.data);
        this.buffer.push(smoothed);

        // Keep buffer at window size
        if (this.buffer.length > this.windowSize) {
            this.buffer.shift();
        }

        // 2. Need at least 50% of template length to start matching
        if (this.buffer.length < this.template.length * 0.5) {
            return { similarity: 0, repCount: this.repCount, status: 'Preparing...' };
        }

        // 3. Sub-sequence Matching
        // Instead of exact window, we compare the best fitting sub-slice of our buffer
        // This handles cases where the user's rep is faster than the reference
        let bestSimilarity = 0;

        // Sample just 3 slices to save CPU (End of buffer, Middle, and full)
        const slices = [
            this.buffer.slice(-this.template.length), // Most recent frames
            this.buffer.slice(-Math.round(this.template.length * 0.8)), // Faster rep
            this.buffer.slice(-Math.round(this.template.length * 1.2)) // Slower rep
        ];

        for (const slice of slices) {
            if (slice.length < 5) continue;
            const distance = DTW.compute(slice, this.template);
            const sim = DTW.calculateSimilarity(distance);
            if (sim > bestSimilarity) bestSimilarity = sim;
        }

        // 4. Rep Validation Logic
        let status = 'Perform Movement';

        if (bestSimilarity > this.similarityThreshold && !this.isCooldown) {
            this.repCount++;
            this.triggerCooldown();
            status = 'PERFECT REP! +1';
        } else if (this.isCooldown) {
            status = 'Rep Logged... Wait';
        } else if (bestSimilarity > 40) {
            status = 'Movement detected';
        } else if (this.buffer.length >= this.template.length) {
            status = 'Keep going';
        }

        return {
            similarity: bestSimilarity,
            repCount: this.repCount,
            status: status
        };
    }

    triggerCooldown() {
        this.isCooldown = true;
        setTimeout(() => {
            this.isCooldown = false;
            // Clear half the buffer on success to ensure the next rep is fresh
            this.buffer = this.buffer.slice(Math.round(this.buffer.length / 2));
        }, this.cooldownTime);
    }

    reset() {
        this.repCount = 0;
        this.buffer = [];
        this.isCooldown = false;
    }
}
