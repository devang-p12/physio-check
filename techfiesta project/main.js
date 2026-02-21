import { TemplateProcessor } from './templateProcessor.js';
import { RepTemplateGenerator } from './repTemplateGenerator.js';
import { PoseNormalizer } from './poseNormalizer.js';
import { LiveMatcher } from './liveMatcher.js';

class App {
    constructor() {
        this.templateProcessor = new TemplateProcessor();
        this.liveMatcher = null;
        this.referenceTemplate = null;
        this.isProcessing = false;
        this.recordedBlob = null;

        // UI Elements
        this.refVideo = document.getElementById('reference-video');
        this.refCanvas = document.getElementById('reference-canvas');
        this.liveVideo = document.getElementById('live-video');
        this.liveCanvas = document.getElementById('live-canvas');
        this.dropZone = document.getElementById('drop-zone');
        this.fileInput = document.getElementById('reference-input');
        this.recordBtn = document.getElementById('record-ref-btn');
        this.processBtn = document.getElementById('process-btn');

        this.refCtx = this.refCanvas.getContext('2d');
        this.liveCtx = this.liveCanvas.getContext('2d');

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecordingRef = false;

        this.init();
    }

    init() {
        // File Upload Handler
        this.fileInput.onchange = (e) => this.handleFileUpload(e.target.files[0]);

        // Record Reference Handler
        this.recordBtn.onclick = () => this.toggleReferenceRecording();

        // Start Live Session
        document.getElementById('start-btn').onclick = () => this.startLiveSession();
        document.getElementById('reset-btn').onclick = () => this.resetSession();
        this.processBtn.onclick = () => this.processReferencePoints();
        document.getElementById('export-btn').onclick = () => {
            if (this.referenceTemplate) RepTemplateGenerator.exportToJSON(this.referenceTemplate);
        };

        // Resize canvases
        window.addEventListener('resize', () => this.resizeCanvases());
        this.resizeCanvases();
    }

    async toggleReferenceRecording() {
        if (!this.isRecordingRef) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                this.recordedChunks = [];
                this.mediaRecorder = new MediaRecorder(stream);

                this.dropZone.hidden = true;
                this.refVideo.hidden = false;
                this.refVideo.srcObject = stream;
                this.refVideo.muted = true;
                this.refVideo.play();

                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.recordedChunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    this.recordedBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(this.recordedBlob);

                    stream.getTracks().forEach(track => track.stop());

                    this.refVideo.srcObject = null;
                    this.refVideo.src = url;
                    this.refVideo.controls = true;
                    this.processBtn.disabled = false;
                };

                this.mediaRecorder.start();
                this.isRecordingRef = true;
                this.recordBtn.innerText = "🛑 Stop Recording";
            } catch (err) {
                alert("Camera access denied: " + err.message);
            }
        } else {
            this.mediaRecorder.stop();
            this.isRecordingRef = false;
            this.recordBtn.innerText = "Record Reference";
        }
    }

    resizeCanvases() {
        this.refCanvas.width = this.refCanvas.offsetWidth;
        this.refCanvas.height = this.refCanvas.offsetHeight;
        this.liveCanvas.width = this.liveCanvas.offsetWidth;
        this.liveCanvas.height = this.liveCanvas.offsetHeight;
    }

    async handleFileUpload(file) {
        if (!file) return;
        this.dropZone.hidden = true;
        this.refVideo.hidden = false;
        this.refVideo.src = URL.createObjectURL(file);
        this.recordedBlob = null;
        this.processBtn.disabled = false;
    }

    async processReferencePoints() {
        const file = this.recordedBlob || this.fileInput.files[0];
        if (!file) {
            alert("Please upload or record a video first.");
            return;
        }

        this.processBtn.disabled = true;
        this.processBtn.innerText = "Analyzing...";

        try {
            const series = await this.templateProcessor.processVideo(file);
            this.referenceTemplate = RepTemplateGenerator.generate(series);

            if (this.referenceTemplate) {
                this.liveMatcher = new LiveMatcher(this.referenceTemplate);
                this.processBtn.innerText = "Template Ready";
                document.getElementById('start-btn').disabled = false;
                document.getElementById('export-btn').disabled = false;
                alert(`Analysis complete! Extracted movement pattern.`);
            } else {
                throw new Error("No landmarks detected. Please ensure your full body is visible.");
            }
        } catch (err) {
            console.error(err);
            alert("Analysis failed: " + err.message);
            this.processBtn.innerText = "Generate Template";
            this.processBtn.disabled = false;
        }
    }

    async startLiveSession() {
        if (!this.referenceTemplate) return;

        const pose = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults((results) => {
            this.drawPose(this.liveCtx, results);
            if (results.poseLandmarks) {
                const normalized = PoseNormalizer.normalize(results.poseLandmarks);
                const match = this.liveMatcher.processFrame(normalized);
                this.updateUI(match);
            }
        });

        const camera = new window.Camera(this.liveVideo, {
            onFrame: async () => {
                await pose.send({ image: this.liveVideo });
            },
            width: 640,
            height: 480
        });

        camera.start();
        document.getElementById('live-status').innerText = "LIVE SESSION ACTIVE";
    }

    updateUI(match) {
        document.getElementById('sim-score').innerText = `${match.similarity}%`;
        document.getElementById('rep-count').innerText = match.repCount;
        document.getElementById('live-status').innerText = match.status;
    }

    drawPose(ctx, results) {
        ctx.save();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (results.poseLandmarks) {
            window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#6366f1', lineWidth: 4 });
            window.drawLandmarks(ctx, results.poseLandmarks, { color: '#fff', radius: 4 });
        }
        ctx.restore();
    }

    resetSession() {
        if (this.liveMatcher) this.liveMatcher.reset();
        this.updateUI({ similarity: 0, repCount: 0, status: 'Session Reset' });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new App();
});
