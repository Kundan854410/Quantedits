import Foundation
import Capacitor
import AVFoundation
import UIKit

// MARK: - MLKit Face Detection (Google ML Kit)
// In production, import: import MLKitFaceDetection, import MLKitVision
// For compilation without the pod, we define protocol-compatible types below.

/// Facial expression categories matching the TypeScript definitions.
enum FacialExpression: String, Codable {
    case happy, sad, tired, surprised, neutral, angry
}

/// Result of a single frame's expression analysis.
struct ExpressionAnalysisResult: Codable {
    let expression: FacialExpression
    let confidence: Double
    let timestamp: String
}

// MARK: - QuantneonCamera Capacitor Plugin (iOS – Swift)

/// Native iOS Capacitor plugin that records Reels with the device camera,
/// runs on-device MLKit face-expression analysis, and triggers Quantneon
/// aura effects + Quantmail VIP Reward tokens when a sad/tired expression
/// is detected.
@objc(QuantneonCameraPlugin)
public class QuantneonCameraPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "QuantneonCameraPlugin"
    public let jsName = "QuantneonCamera"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configureAura", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "analyzeExpression", returnType: CAPPluginReturnPromise)
    ]

    // MARK: - Properties

    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureMovieFileOutput?
    private var outputFileURL: URL?
    private var recordingDelegate: RecordingDelegate?
    private var expressionSnapshots: [ExpressionAnalysisResult] = []
    private var recordingStartTime: Date?
    private var isRecording = false
    private var analysisTimer: Timer?

    // Aura configuration
    private var auraGlowColor: String = "#7C3AED"
    private var auraIntensity: Double = 0.8
    private var auraPulseHz: Double = 1.2

    // Reward tracking
    private var auraApplied = false
    private var rewardDispatched = false
    private var lastRewardTime: Date?

    // MARK: - Plugin Methods

    /// Start recording a Reel with the native camera and MLKit face detection.
    @objc func startRecording(_ call: CAPPluginCall) {
        let maxDuration = call.getInt("maxDurationSec") ?? 60
        let facing = call.getString("facing") ?? "front"
        let enableAnalysis = call.getBool("enableExpressionAnalysis") ?? true

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.expressionSnapshots = []
            self.auraApplied = false
            self.rewardDispatched = false
            self.recordingStartTime = Date()

            do {
                try self.setupCaptureSession(facing: facing)
                try self.startCameraRecording(maxDuration: maxDuration)

                if enableAnalysis {
                    self.startExpressionAnalysis()
                }

                self.isRecording = true
                call.resolve()
            } catch {
                call.reject("Failed to start recording: \(error.localizedDescription)")
            }
        }
    }

    /// Stop the current recording and return results.
    @objc func stopRecording(_ call: CAPPluginCall) {
        guard isRecording else {
            call.reject("No active recording session")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.analysisTimer?.invalidate()
            self.analysisTimer = nil
            self.videoOutput?.stopRecording()
            self.captureSession?.stopRunning()
            self.isRecording = false

            let duration = Date().timeIntervalSince(self.recordingStartTime ?? Date())
            let snapshots = self.expressionSnapshots.map { snapshot -> [String: Any] in
                return [
                    "expression": snapshot.expression.rawValue,
                    "confidence": snapshot.confidence,
                    "timestamp": snapshot.timestamp
                ]
            }

            call.resolve([
                "videoUri": self.outputFileURL?.absoluteString ?? "",
                "durationSec": duration,
                "expressionSnapshots": snapshots,
                "auraApplied": self.auraApplied,
                "rewardDispatched": self.rewardDispatched
            ])
        }
    }

    /// Configure the Quantneon aura visual effect.
    @objc func configureAura(_ call: CAPPluginCall) {
        if let color = call.getString("glowColor") {
            auraGlowColor = color
        }
        if let intensity = call.getDouble("intensity") {
            auraIntensity = intensity
        }
        if let pulseHz = call.getDouble("pulseHz") {
            auraPulseHz = pulseHz
        }
        call.resolve()
    }

    /// Manually trigger expression analysis on the current camera frame.
    @objc func analyzeExpression(_ call: CAPPluginCall) {
        let result = performExpressionAnalysis()
        call.resolve([
            "expression": result.expression.rawValue,
            "confidence": result.confidence,
            "timestamp": result.timestamp
        ])
    }

    // MARK: - Camera Setup

    private func setupCaptureSession(facing: String) throws {
        let session = AVCaptureSession()
        session.sessionPreset = .high

        // Select camera based on facing direction
        let position: AVCaptureDevice.Position = facing == "front" ? .front : .back
        guard let camera = AVCaptureDevice.default(
            .builtInWideAngleCamera,
            for: .video,
            position: position
        ) else {
            throw NSError(
                domain: "QuantneonCamera",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Camera not available"]
            )
        }

        let videoInput = try AVCaptureDeviceInput(device: camera)
        if session.canAddInput(videoInput) {
            session.addInput(videoInput)
        }

        // Audio input
        if let audioDevice = AVCaptureDevice.default(for: .audio) {
            let audioInput = try AVCaptureDeviceInput(device: audioDevice)
            if session.canAddInput(audioInput) {
                session.addInput(audioInput)
            }
        }

        // Video output
        let movieOutput = AVCaptureMovieFileOutput()
        if session.canAddOutput(movieOutput) {
            session.addOutput(movieOutput)
        }

        self.captureSession = session
        self.videoOutput = movieOutput

        session.startRunning()
    }

    private func startCameraRecording(maxDuration: Int) throws {
        guard let videoOutput = self.videoOutput else {
            throw NSError(
                domain: "QuantneonCamera",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Video output not configured"]
            )
        }

        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "quantedits_reel_\(Int(Date().timeIntervalSince1970)).mov"
        let fileURL = tempDir.appendingPathComponent(fileName)
        self.outputFileURL = fileURL

        videoOutput.maxRecordedDuration = CMTime(seconds: Double(maxDuration), preferredTimescale: 600)

        let delegate = RecordingDelegate()
        self.recordingDelegate = delegate
        videoOutput.startRecording(to: fileURL, recordingDelegate: delegate)
    }

    // MARK: - MLKit Face Expression Analysis

    /// Start periodic expression analysis using MLKit Face Detection.
    private func startExpressionAnalysis() {
        // Run analysis every 500ms during recording
        analysisTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self, self.isRecording else { return }
            let result = self.performExpressionAnalysis()
            self.expressionSnapshots.append(result)

            // Notify the web layer of expression changes
            self.notifyListeners("expressionChanged", data: [
                "expression": result.expression.rawValue,
                "confidence": result.confidence,
                "timestamp": result.timestamp
            ])

            // Check for sad/tired expressions to trigger aura + reward
            self.handleExpressionTrigger(result)
        }
    }

    /// Perform a single expression analysis on the current camera frame.
    ///
    /// In a full MLKit integration, this captures the current video frame,
    /// creates a VisionImage, and runs it through FaceDetector with
    /// classification enabled (smile probability, eye-open probability).
    ///
    /// MLKit integration pseudocode:
    /// ```
    /// let options = FaceDetectorOptions()
    /// options.classificationMode = .all
    /// options.performanceMode = .fast
    /// let detector = FaceDetector.faceDetector(options: options)
    /// let visionImage = VisionImage(buffer: sampleBuffer)
    /// let faces = try detector.results(in: visionImage)
    /// ```
    private func performExpressionAnalysis() -> ExpressionAnalysisResult {
        // TODO: Replace with actual MLKit FaceDetector analysis when pods are installed.
        // The code below maps MLKit's smilingProbability and eyeOpenProbability
        // to our FacialExpression enum.
        //
        // Production mapping logic:
        // - smilingProbability > 0.7 → .happy
        // - smilingProbability < 0.2 && eyeOpenProbability < 0.3 → .tired
        // - smilingProbability < 0.2 && eyeOpenProbability > 0.5 → .sad
        // - eyeOpenProbability > 0.8 && smilingProbability < 0.3 → .surprised
        // - else → .neutral

        let formatter = ISO8601DateFormatter()
        return ExpressionAnalysisResult(
            expression: .neutral,
            confidence: 0.5,
            timestamp: formatter.string(from: Date())
        )
    }

    /// Handle sad/tired expression detection: apply aura and dispatch reward.
    private func handleExpressionTrigger(_ result: ExpressionAnalysisResult) {
        let triggerExpressions: [FacialExpression] = [.sad, .tired]

        guard triggerExpressions.contains(result.expression),
              result.confidence > 0.6 else {
            return
        }

        // Apply Quantneon aura
        if !auraApplied {
            auraApplied = true
            applyQuantneonAura(for: result.expression)
            notifyListeners("auraApplied", data: [
                "expression": result.expression.rawValue
            ])
        }

        // Dispatch Quantmail VIP Reward (with 30-second cooldown)
        let cooldown: TimeInterval = 30
        let now = Date()
        if lastRewardTime == nil || now.timeIntervalSince(lastRewardTime!) >= cooldown {
            lastRewardTime = now
            rewardDispatched = true
            let tokenId = "qm-vip-ios-\(Int(now.timeIntervalSince1970))"
            dispatchQuantmailReward(tokenId: tokenId, expression: result.expression)
            notifyListeners("rewardDispatched", data: [
                "tokenId": tokenId,
                "expression": result.expression.rawValue
            ])
        }
    }

    // MARK: - Quantneon Aura Effect

    /// Apply the glowing Quantneon aura overlay to the camera preview.
    ///
    /// This creates a pulsing glow layer over the camera preview when a
    /// sad/tired expression is detected. The glow uses Core Animation
    /// for smooth, GPU-accelerated rendering.
    private func applyQuantneonAura(for expression: FacialExpression) {
        guard let bridge = self.bridge,
              let viewController = bridge.viewController else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            let auraView = UIView(frame: viewController.view.bounds)
            auraView.tag = 9999 // Tag for later removal
            auraView.isUserInteractionEnabled = false
            auraView.backgroundColor = .clear

            // Create glow layer
            let glowLayer = CAGradientLayer()
            glowLayer.frame = auraView.bounds
            glowLayer.colors = [
                UIColor(hex: self.auraGlowColor)?.withAlphaComponent(0.0).cgColor ?? UIColor.purple.withAlphaComponent(0.0).cgColor,
                UIColor(hex: self.auraGlowColor)?.withAlphaComponent(CGFloat(self.auraIntensity) * 0.3).cgColor ?? UIColor.purple.withAlphaComponent(0.3).cgColor,
                UIColor(hex: self.auraGlowColor)?.withAlphaComponent(CGFloat(self.auraIntensity) * 0.6).cgColor ?? UIColor.purple.withAlphaComponent(0.6).cgColor
            ]
            glowLayer.type = .radial
            glowLayer.startPoint = CGPoint(x: 0.5, y: 0.5)
            glowLayer.endPoint = CGPoint(x: 1.0, y: 1.0)
            auraView.layer.addSublayer(glowLayer)

            // Pulsation animation
            let pulseAnimation = CABasicAnimation(keyPath: "opacity")
            pulseAnimation.fromValue = 0.4
            pulseAnimation.toValue = 1.0
            pulseAnimation.duration = 1.0 / self.auraPulseHz
            pulseAnimation.autoreverses = true
            pulseAnimation.repeatCount = .infinity
            auraView.layer.add(pulseAnimation, forKey: "quantneonPulse")

            viewController.view.addSubview(auraView)
        }
    }

    // MARK: - Quantmail Reward Dispatch

    /// Dispatch a VIP Reward token to the user's Quantmail inbox.
    private func dispatchQuantmailReward(tokenId: String, expression: FacialExpression) {
        // In production, this would make an API call to Quantmail.
        // For now, log the reward dispatch.
        print("[Quantmail] VIP Reward dispatched: \(tokenId) (triggered by \(expression.rawValue))")

        // TODO: Uncomment when Quantmail API is available:
        // let url = URL(string: "https://api.quantmail.io/v1/rewards/vip")!
        // var request = URLRequest(url: url)
        // request.httpMethod = "POST"
        // request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // let body: [String: Any] = [
        //     "tokenId": tokenId,
        //     "triggeredBy": expression.rawValue,
        //     "points": 50,
        //     "createdAt": ISO8601DateFormatter().string(from: Date())
        // ]
        // request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        // URLSession.shared.dataTask(with: request).resume()
    }
}

// MARK: - Recording Delegate

private class RecordingDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
    func fileOutput(
        _ output: AVCaptureFileOutput,
        didFinishRecordingTo outputFileURL: URL,
        from connections: [AVCaptureConnection],
        error: Error?
    ) {
        if let error = error {
            print("[QuantneonCamera] Recording error: \(error.localizedDescription)")
        } else {
            print("[QuantneonCamera] Recording saved to: \(outputFileURL.absoluteString)")
        }
    }
}

// MARK: - UIColor Hex Extension

private extension UIColor {
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        guard hexSanitized.count == 6 else { return nil }

        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)

        self.init(
            red: CGFloat((rgb & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgb & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgb & 0x0000FF) / 255.0,
            alpha: 1.0
        )
    }
}
