/**
 * Rep Template Generator Module
 * Segments pose series into reps and generates an average template.
 */

export class RepTemplateGenerator {
    /**
     * Generates a template from a landmark series.
     * Simple implementation: Uses the entire series if it's one clean rep, 
     * or segments based on movement cycles.
     */
    static generate(series) {
        if (!series || series.length < 10) return null;

        // For this implementation, we assume the reference video contains 
        // a single representative repetition. 
        // In a production system, we would:
        // 1. Calculate the standard deviation of movement for each landmark.
        // 2. Identify the landmark with the most movement (the "driver").
        // 3. Segment the series using zero-crossing or peak detection on the "driver".
        // 4. Average the segments using DTW Barycenter Averaging (DBA).

        // Here, we'll return the normalized data points as the template.
        return series.map(frame => frame.data);
    }

    /**
     * Saves the template to a JSON file.
     */
    static exportToJSON(template) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "exercise_template.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
}
