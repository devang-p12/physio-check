/**
 * Dynamic Time Warping (DTW) Module
 * Optimized for pose movement comparison.
 */

export class DTW {
    /**
     * Calculates the distance between two normalized pose frames.
     * We focus on Euclidean distance between normalized landmarks.
     */
    static frameDistance(frame1, frame2) {
        let totalDist = 0;
        // We only compare the landmarks that exist in both frames
        const count = Math.min(frame1.length, frame2.length);
        if (count === 0) return 1.0;

        for (let i = 0; i < count; i++) {
            const dx = frame1[i].x - frame2[i].x;
            const dy = frame1[i].y - frame2[i].y;
            const dz = frame1[i].z - frame2[i].z;
            totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        return totalDist / count;
    }

    /**
     * Computes the DTW distance between two sequences.
     */
    static compute(seq1, seq2) {
        const n = seq1.length;
        const m = seq2.length;

        // Initialize DTW matrix with Sakoe-Chiba band optimization (optional, but here we do full)
        const dtw = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
        dtw[0][0] = 0;

        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const cost = this.frameDistance(seq1[i - 1], seq2[j - 1]);
                dtw[i][j] = cost + Math.min(
                    dtw[i - 1][j],    // insertion
                    dtw[i][j - 1],    // deletion
                    dtw[i - 1][j - 1] // match
                );
            }
        }

        // Return normalized path cost
        // The normalization factor (n+m) is standard for DTW
        return dtw[n][m] / (n + m);
    }

    /**
     * Converts DTW distance to a similarity percentage (0-100).
     * Adjusting threshold to be more lenient (1.0 distance = 0 similarity)
     */
    static calculateSimilarity(distance) {
        // A distance of 0.8 is quite far apart in normalized space
        // A distance of 0.2 is very close
        const threshold = 1.0;
        const similarity = Math.max(0, 100 * (1 - (distance / threshold)));

        // Apply a non-linear boost to "mostly correct" movements
        // This makes 70-80% look like 85-90% to encourage users
        if (similarity > 50) {
            return Math.min(100, Math.round(similarity * 1.2));
        }

        return Math.round(similarity);
    }
}
