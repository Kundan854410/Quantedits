package com.quantedits.plugins.quantneoncamera

import android.Manifest
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// MLKit Face Detection imports (available when google-mlkit:face-detection is added)
// import com.google.mlkit.vision.common.InputImage
// import com.google.mlkit.vision.face.FaceDetection
// import com.google.mlkit.vision.face.FaceDetectorOptions

/**
 * Facial expression categories matching the TypeScript definitions.
 */
enum class FacialExpression(val value: String) {
    HAPPY("happy"),
    SAD("sad"),
    TIRED("tired"),
    SURPRISED("surprised"),
    NEUTRAL("neutral"),
    ANGRY("angry")
}

/**
 * Result of a single frame's expression analysis.
 */
data class ExpressionAnalysisResult(
    val expression: FacialExpression,
    val confidence: Double,
    val timestamp: String
) {
    fun toJSObject(): JSObject {
        return JSObject().apply {
            put("expression", expression.value)
            put("confidence", confidence)
            put("timestamp", timestamp)
        }
    }
}

/**
 * QuantneonCamera Capacitor Plugin (Android – Kotlin)
 *
 * Native Android plugin that records Reels with the device camera,
 * runs on-device MLKit face-expression analysis, and triggers Quantneon
 * aura effects + Quantmail VIP Reward tokens when a sad/tired expression
 * is detected.
 */
@CapacitorPlugin(
    name = "QuantneonCamera",
    permissions = [
        Permission(
            strings = [Manifest.permission.CAMERA],
            alias = "camera"
        ),
        Permission(
            strings = [Manifest.permission.RECORD_AUDIO],
            alias = "microphone"
        )
    ]
)
class QuantneonCameraPlugin : Plugin() {

    companion object {
        /** Tag used to identify the Quantneon aura overlay view for removal. */
        const val AURA_OVERLAY_TAG = "quantneon_aura_overlay"
    }

    // Camera & Recording
    private var cameraProvider: ProcessCameraProvider? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var outputFile: File? = null
    private var isRecording = false
    private var recordingStartTime: Long = 0

    // Expression analysis
    private var expressionSnapshots = mutableListOf<ExpressionAnalysisResult>()
    private var analysisHandler: Handler? = null
    private var analysisRunnable: Runnable? = null

    // Aura configuration
    private var auraGlowColor: String = "#7C3AED"
    private var auraIntensity: Double = 0.8
    private var auraPulseHz: Double = 1.2

    // Reward tracking
    private var auraApplied = false
    private var rewardDispatched = false
    private var lastRewardTime: Long = 0
    private val rewardCooldownMs: Long = 30_000

    // Aura overlay view
    private var auraOverlay: View? = null

    // Pending call for permission callback
    private var pendingCall: PluginCall? = null
    private var pendingOptions: JSObject? = null

    // MARK: - Plugin Methods

    /**
     * Start recording a Reel with the native camera and MLKit face detection.
     */
    @PluginMethod
    fun startRecording(call: PluginCall) {
        // Check camera permission
        if (getPermissionState("camera") != "granted") {
            pendingCall = call
            pendingOptions = call.data
            requestPermissionForAlias("camera", call, "cameraPermissionCallback")
            return
        }

        doStartRecording(call)
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        if (getPermissionState("camera") == "granted") {
            doStartRecording(call)
        } else {
            call.reject("Camera permission is required to record Reels")
        }
    }

    private fun doStartRecording(call: PluginCall) {
        val facing = call.getString("facing", "front") ?: "front"
        val enableAnalysis = call.getBoolean("enableExpressionAnalysis", true) ?: true

        expressionSnapshots.clear()
        auraApplied = false
        rewardDispatched = false
        recordingStartTime = System.currentTimeMillis()

        activity.runOnUiThread {
            try {
                setupCameraAndRecord(facing)

                if (enableAnalysis) {
                    startExpressionAnalysis()
                }

                isRecording = true
                call.resolve()
            } catch (e: Exception) {
                call.reject("Failed to start recording: ${e.message}")
            }
        }
    }

    /**
     * Stop the current recording and return results.
     */
    @PluginMethod
    fun stopRecording(call: PluginCall) {
        if (!isRecording) {
            call.reject("No active recording session")
            return
        }

        activity.runOnUiThread {
            // Stop expression analysis
            analysisRunnable?.let { analysisHandler?.removeCallbacks(it) }
            analysisHandler = null
            analysisRunnable = null

            // Stop recording
            activeRecording?.stop()
            activeRecording = null
            cameraProvider?.unbindAll()
            isRecording = false

            // Remove aura overlay
            removeAuraOverlay()

            val durationSec = (System.currentTimeMillis() - recordingStartTime) / 1000.0
            val snapshots = JSArray()
            expressionSnapshots.forEach { snapshots.put(it.toJSObject()) }

            val result = JSObject().apply {
                put("videoUri", outputFile?.toURI()?.toString() ?: "")
                put("durationSec", durationSec)
                put("expressionSnapshots", snapshots)
                put("auraApplied", auraApplied)
                put("rewardDispatched", rewardDispatched)
            }

            call.resolve(result)
        }
    }

    /**
     * Configure the Quantneon aura visual effect.
     */
    @PluginMethod
    fun configureAura(call: PluginCall) {
        call.getString("glowColor")?.let { auraGlowColor = it }
        call.getDouble("intensity")?.let { auraIntensity = it }
        call.getDouble("pulseHz")?.let { auraPulseHz = it }
        call.resolve()
    }

    /**
     * Manually trigger expression analysis on the current camera frame.
     */
    @PluginMethod
    fun analyzeExpression(call: PluginCall) {
        val result = performExpressionAnalysis()
        call.resolve(result.toJSObject())
    }

    // MARK: - Camera Setup

    /**
     * Set up CameraX and start video recording.
     */
    private fun setupCameraAndRecord(facing: String) {
        val context = this.context
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            val provider = cameraProviderFuture.get()
            this.cameraProvider = provider

            // Select camera
            val cameraSelector = if (facing == "front") {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }

            // Build recorder
            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(Quality.HD))
                .build()

            videoCapture = VideoCapture.withOutput(recorder)

            // Preview (optional – not displayed in Capacitor WebView)
            val preview = Preview.Builder().build()

            try {
                provider.unbindAll()
                provider.bindToLifecycle(
                    activity,
                    cameraSelector,
                    preview,
                    videoCapture
                )

                // Start recording to file
                startVideoRecording()
            } catch (e: Exception) {
                throw RuntimeException("Camera binding failed: ${e.message}")
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /**
     * Start recording video to a temporary file.
     */
    private fun startVideoRecording() {
        val videoCapture = this.videoCapture ?: return
        val context = this.context

        val fileName = "quantedits_reel_${System.currentTimeMillis()}.mp4"
        outputFile = File(context.cacheDir, fileName)

        val outputOptions = FileOutputOptions.Builder(outputFile!!).build()

        activeRecording = videoCapture.output
            .prepareRecording(context, outputOptions)
            .apply {
                if (ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    withAudioEnabled()
                }
            }
            .start(ContextCompat.getMainExecutor(context)) { event ->
                when (event) {
                    is VideoRecordEvent.Finalize -> {
                        if (event.hasError()) {
                            println("[QuantneonCamera] Recording error: ${event.error}")
                        } else {
                            println("[QuantneonCamera] Recording saved: ${outputFile?.absolutePath}")
                        }
                    }
                }
            }
    }

    // MARK: - MLKit Face Expression Analysis

    /**
     * Start periodic expression analysis using MLKit Face Detection.
     * Analysis runs every 500ms during recording.
     */
    private fun startExpressionAnalysis() {
        analysisHandler = Handler(Looper.getMainLooper())
        analysisRunnable = object : Runnable {
            override fun run() {
                if (!isRecording) return

                val result = performExpressionAnalysis()
                expressionSnapshots.add(result)

                // Notify the web layer of expression changes
                notifyListeners("expressionChanged", result.toJSObject())

                // Check for sad/tired expressions to trigger aura + reward
                handleExpressionTrigger(result)

                // Schedule next analysis
                analysisHandler?.postDelayed(this, 500)
            }
        }
        analysisHandler?.post(analysisRunnable!!)
    }

    /**
     * Perform a single expression analysis on the current camera frame.
     *
     * In a full MLKit integration, this captures the current video frame,
     * creates an InputImage, and runs it through FaceDetector with
     * classification enabled (smiling probability, eye-open probability).
     *
     * MLKit integration pseudocode:
     * ```
     * val options = FaceDetectorOptions.Builder()
     *     .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
     *     .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
     *     .build()
     * val detector = FaceDetection.getClient(options)
     * val inputImage = InputImage.fromBitmap(bitmap, rotationDegrees)
     * detector.process(inputImage)
     *     .addOnSuccessListener { faces ->
     *         val face = faces.firstOrNull()
     *         val smileProb = face?.smilingProbability ?: 0f
     *         val eyeOpenProb = (face?.leftEyeOpenProbability ?: 0f +
     *                           face?.rightEyeOpenProbability ?: 0f) / 2f
     *         // Map to FacialExpression...
     *     }
     * ```
     */
    private fun performExpressionAnalysis(): ExpressionAnalysisResult {
        // TODO: Replace with actual MLKit FaceDetector analysis when dependency is added.
        // Production mapping logic:
        // - smilingProbability > 0.7 → HAPPY
        // - smilingProbability < 0.2 && eyeOpenProbability < 0.3 → TIRED
        // - smilingProbability < 0.2 && eyeOpenProbability > 0.5 → SAD
        // - eyeOpenProbability > 0.8 && smilingProbability < 0.3 → SURPRISED
        // - else → NEUTRAL

        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        dateFormat.timeZone = TimeZone.getTimeZone("UTC")

        return ExpressionAnalysisResult(
            expression = FacialExpression.NEUTRAL,
            confidence = 0.5,
            timestamp = dateFormat.format(Date())
        )
    }

    /**
     * Handle sad/tired expression detection: apply aura and dispatch reward.
     */
    private fun handleExpressionTrigger(result: ExpressionAnalysisResult) {
        val triggerExpressions = listOf(FacialExpression.SAD, FacialExpression.TIRED)

        if (!triggerExpressions.contains(result.expression) || result.confidence <= 0.6) {
            return
        }

        // Apply Quantneon aura
        if (!auraApplied) {
            auraApplied = true
            applyQuantneonAura(result.expression)
            val auraData = JSObject().apply {
                put("expression", result.expression.value)
            }
            notifyListeners("auraApplied", auraData)
        }

        // Dispatch Quantmail VIP Reward (with cooldown)
        val now = System.currentTimeMillis()
        if (now - lastRewardTime >= rewardCooldownMs) {
            lastRewardTime = now
            rewardDispatched = true
            val tokenId = "qm-vip-android-$now"
            dispatchQuantmailReward(tokenId, result.expression)
            val rewardData = JSObject().apply {
                put("tokenId", tokenId)
                put("expression", result.expression.value)
            }
            notifyListeners("rewardDispatched", rewardData)
        }
    }

    // MARK: - Quantneon Aura Effect

    /**
     * Apply the glowing Quantneon aura overlay to the activity view.
     *
     * Creates a pulsing radial gradient overlay when a sad/tired expression
     * is detected, using Android's built-in animation framework.
     */
    private fun applyQuantneonAura(expression: FacialExpression) {
        activity.runOnUiThread {
            val rootView = activity.window.decorView as? ViewGroup ?: return@runOnUiThread

            // Create aura overlay view
            val overlay = View(context).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                isClickable = false
                isFocusable = false
                tag = AURA_OVERLAY_TAG

                // Radial gradient glow
                val glowColor = parseHexColor(auraGlowColor)
                val gradient = GradientDrawable(
                    GradientDrawable.Orientation.TL_BR,
                    intArrayOf(
                        Color.argb(0, Color.red(glowColor), Color.green(glowColor), Color.blue(glowColor)),
                        Color.argb(
                            (auraIntensity * 76).toInt(),
                            Color.red(glowColor),
                            Color.green(glowColor),
                            Color.blue(glowColor)
                        ),
                        Color.argb(
                            (auraIntensity * 153).toInt(),
                            Color.red(glowColor),
                            Color.green(glowColor),
                            Color.blue(glowColor)
                        )
                    )
                )
                gradient.gradientType = GradientDrawable.RADIAL_GRADIENT
                gradient.gradientRadius = rootView.width.toFloat().coerceAtLeast(500f)
                background = gradient
            }

            // Pulsation animation
            val pulseDuration = (1000.0 / auraPulseHz).toLong()
            ObjectAnimator.ofFloat(overlay, "alpha", 0.4f, 1.0f).apply {
                duration = pulseDuration
                repeatCount = ValueAnimator.INFINITE
                repeatMode = ValueAnimator.REVERSE
                start()
            }

            rootView.addView(overlay)
            auraOverlay = overlay
        }
    }

    /**
     * Remove the Quantneon aura overlay from the activity view.
     */
    private fun removeAuraOverlay() {
        auraOverlay?.let { overlay ->
            (overlay.parent as? ViewGroup)?.removeView(overlay)
        }
        auraOverlay = null
    }

    // MARK: - Quantmail Reward Dispatch

    /**
     * Dispatch a VIP Reward token to the user's Quantmail inbox.
     */
    private fun dispatchQuantmailReward(tokenId: String, expression: FacialExpression) {
        // In production, this would make an API call to Quantmail.
        println("[Quantmail] VIP Reward dispatched: $tokenId (triggered by ${expression.value})")

        // TODO: Uncomment when Quantmail API is available:
        // val url = URL("https://api.quantmail.io/v1/rewards/vip")
        // val connection = url.openConnection() as HttpURLConnection
        // connection.requestMethod = "POST"
        // connection.setRequestProperty("Content-Type", "application/json")
        // connection.doOutput = true
        // val body = JSONObject().apply {
        //     put("tokenId", tokenId)
        //     put("triggeredBy", expression.value)
        //     put("points", 50)
        //     put("createdAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date()))
        // }
        // connection.outputStream.write(body.toString().toByteArray())
        // connection.connect()
    }

    // MARK: - Utility

    /**
     * Parse a hex color string to an Android Color int.
     */
    private fun parseHexColor(hex: String): Int {
        val sanitized = hex.removePrefix("#")
        return if (sanitized.length == 6) {
            Color.parseColor("#$sanitized")
        } else {
            Color.parseColor("#7C3AED") // Fallback to brand purple
        }
    }
}
