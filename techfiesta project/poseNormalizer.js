/**
 * Pose Normalization Module
 * Handles centering, scaling, and visibility detection of landmarks.
 */

export class PoseNormalizer {
    /**
     * Normalizes a set of landmarks.
     */
    static normalize(landmarks) {
        if (!landmarks || landmarks.length === 0) return null;

        // Shoulder detection is critical for our normalization
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        // If shoulders aren't detected with at least some confidence, skip frame
        if (leftShoulder.visibility < 0.3 || rightShoulder.visibility < 0.3) {
            return null;
        }

        const isFullBody = this.detectFullBody(landmarks);

        const shoulderCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2,
            z: (leftShoulder.z + rightShoulder.z) / 2
        };

        const shoulderWidth = Math.sqrt(
            Math.pow(leftShoulder.x - rightShoulder.x, 2) +
            Math.pow(leftShoulder.y - rightShoulder.y, 2)
        );

        // Prevent division by zero
        if (shoulderWidth < 0.01) return null;

        const targetIndices = isFullBody ? [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28] : [11, 12, 13, 14, 15, 16];

        const normalized = targetIndices.map(index => {
            const lm = landmarks[index];
            return {
                x: (lm.x - shoulderCenter.x) / shoulderWidth,
                y: (lm.y - shoulderCenter.y) / shoulderWidth,
                z: (lm.z - shoulderCenter.z) / shoulderWidth,
                visibility: lm.visibility
            };
        });

        return {
            data: normalized,
            isFullBody,
            indices: targetIndices
        };
    }

    static detectFullBody(landmarks) {
        const lowerBodyIndices = [23, 24, 25, 26]; // Hips and Knees
        const visibilityThreshold = 0.3;
        const visibleCount = lowerBodyIndices.filter(idx => landmarks[idx] && landmarks[idx].visibility > visibilityThreshold).length;
        return visibleCount >= 2;
    }
}
